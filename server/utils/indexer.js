// Indexador: baixa os quadros de vagas das empresas periodicamente e confirma, com calma,
// as vagas do LinkedIn que ficaram "a confirmar" nas buscas.
// Localmente roda em segundo plano (plugin); na Vercel é chamado pelo cron (/api/cron/indexar).
import { db } from './db';
import { ATS } from './ats';
import { norm, sleep, linkedInDetail, openToBrazil } from './search';
import { jobFingerprint } from '#shared/jobs.js';

const REFRESH_MS = 6 * 3600e3; // cada quadro é atualizado a cada 6h
const ERROR_RETRY_MS = 3600e3; // quadro com erro tenta de novo em 1h
const QUEUE_MAX = 600;
const CHUNK = 100; // gravações por lote (o Turso recebe tudo numa requisição só)

// Estado compartilhado entre recargas do dev server
const state = globalThis.__jobIndexer || (globalThis.__jobIndexer = {
  running: false, lastRun: null, lastDuration: null, lastError: null,
  verifyBlockedUntil: 0, verifyActive: false, foreground: 0,
});

const UPSERT = `INSERT INTO index_jobs (url, company_id, source, title, title_norm, company, location, mode, description, tags, published_at, seen_at, content_hash)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(url) DO UPDATE SET company_id = excluded.company_id, source = excluded.source, title = excluded.title, title_norm = excluded.title_norm,
    company = excluded.company, location = excluded.location, mode = excluded.mode, description = excluded.description,
    tags = excluded.tags, published_at = COALESCE(excluded.published_at, index_jobs.published_at), seen_at = excluded.seen_at,
    content_hash = excluded.content_hash
  WHERE index_jobs.content_hash IS NOT excluded.content_hash`;

// Hash curto (FNV-1a) do conteúdo da vaga
const hash = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); };

async function indexCompany(c) {
  const started = Date.now();
  try {
    let jobs = (await ATS[c.ats].fetch(c.slug)).filter((j) => j.url && j.title);
    // Empresas descobertas sozinhas costumam ser globais: guardamos só as vagas abertas para o Brasil
    if (c.discovered) jobs = jobs.filter((j) => openToBrazil(j.location));
    const source = c.ats === 'feed' ? c.name : `${c.name} (${ATS[c.ats].label})`;
    const existing = new Set((await db.all('SELECT url FROM index_jobs WHERE company_id = ?', [c.id])).map((r) => r.url));
    const current = new Set(jobs.map((j) => j.url));
    const stmts = [];
    for (const j of jobs) {
      const company = j.company || c.name;
      const tags = JSON.stringify(j.tags || []);
      const h = hash(`${j.title}|${j.location}|${j.mode}|${j.date}|${tags}|${j.desc || ''}`);
      stmts.push({ sql: UPSERT, args: [j.url, c.id, source, j.title, norm(j.title), company, j.location || '', j.mode || 'unknown', j.desc || '', tags, j.date || null, started, h] });
      // Vaga nova (link que não existia): registra no histórico — se o mesmo cargo já foi publicado antes, conta como repostagem
      const fpArgs = [jobFingerprint(j.title, company), new Date(j.date || started).getTime() || started, started];
      stmts.push(existing.has(j.url)
        // Já indexada antes: só garante que existe no histórico (não grava nada se já existir)
        ? { sql: 'INSERT OR IGNORE INTO fingerprints (fp, first_seen, last_seen, postings) VALUES (?, ?, ?, 1)', args: fpArgs }
        : { sql: `INSERT INTO fingerprints (fp, first_seen, last_seen, postings) VALUES (?, ?, ?, 1)
            ON CONFLICT(fp) DO UPDATE SET last_seen = excluded.last_seen, postings = fingerprints.postings + 1`, args: fpArgs });
    }
    for (let i = 0; i < stmts.length; i += CHUNK) await db.batch(stmts.slice(i, i + CHUNK));
    // Remove as vagas que saíram do ar
    const gone = [...existing].filter((u) => !current.has(u));
    for (let i = 0; i < gone.length; i += CHUNK) {
      const part = gone.slice(i, i + CHUNK);
      await db.run(`DELETE FROM index_jobs WHERE url IN (${part.map(() => '?').join(',')})`, part);
    }
    await db.run('UPDATE companies SET last_indexed = ?, job_count = ?, error = NULL WHERE id = ?', [Date.now(), jobs.length, c.id]);
    return jobs.length;
  } catch (e) {
    // Marca o erro e só tenta de novo depois de ERROR_RETRY_MS
    await db.run('UPDATE companies SET last_indexed = ?, error = ? WHERE id = ?',
      [Date.now() - REFRESH_MS + ERROR_RETRY_MS, String(e.message || e).slice(0, 200), c.id]).catch(() => {});
    return 0;
  }
}

/**
 * Atualiza os quadros vencidos (ou todos, com force). Não roda duas vezes ao mesmo tempo na mesma instância.
 * `budgetMs`: para de pegar quadros novos depois desse tempo (funções da Vercel têm tempo máximo).
 */
export async function runIndex({ force = false, companyId = null, budgetMs = Infinity } = {}) {
  if (state.running) return { started: false, reason: 'already-running' };
  state.running = true;
  const t0 = Date.now();
  try {
    let list = force
      ? await db.all('SELECT * FROM companies WHERE enabled = 1')
      // Quadros cadastrados: a cada 6h; descobertos: a cada 12h (são muitos, e mudam menos)
      : await db.all(`SELECT * FROM companies WHERE enabled = 1 AND (last_indexed IS NULL
            OR last_indexed < CASE WHEN discovered = 1 THEN ? ELSE ? END
            OR (error IS NOT NULL AND last_indexed < ?))
          ORDER BY last_indexed IS NOT NULL, last_indexed`, [Date.now() - 2 * REFRESH_MS, Date.now() - REFRESH_MS, Date.now() - ERROR_RETRY_MS]);
    if (companyId) list = list.filter((c) => c.id === companyId);
    let i = 0, total = 0, done = 0;
    await Promise.all(Array.from({ length: Math.min(6, list.length) }, async () => {
      while (i < list.length && Date.now() - t0 < budgetMs) {
        const n = await indexCompany(list[i++]); // (total += await ... perderia somas em paralelo)
        total += n;
        done++;
        await sleep(300);
      }
    }));
    state.lastRun = Date.now();
    state.lastDuration = Date.now() - t0;
    state.lastError = null;
    return { started: true, boards: done, pending: list.length - done, jobs: total };
  } catch (e) {
    state.lastError = e.message;
    return { started: true, error: e.message };
  } finally {
    state.running = false;
  }
}

/** Busca no índice: pré-filtro SQL pelos termos (com sinônimos) e o resto do filtro fica no funil. */
export async function searchIndex(matcher, limit = 3000) {
  const terms = [...new Set(matcher.groups.filter((g) => g.strong).flatMap((g) => g.terms))].filter((t) => t.length > 1);
  if (!terms.length) return [];
  // Termos curtos (ux, ui, bi...) precisam casar como palavra inteira, senão "ui" pega "cuidador"
  const where = terms.map((t) => (t.length <= 3 ? "(' ' || title_norm || ' ') GLOB ?" : 'title_norm LIKE ?')).join(' OR ');
  const args = terms.map((t) => (t.length <= 3 ? `*[^a-z0-9]${t}[^a-z0-9]*` : `%${t}%`));
  const rows = await db.all(`SELECT * FROM index_jobs WHERE ${where} LIMIT ${Number(limit)}`, args);
  return rows.map((r) => ({
    title: r.title, company: r.company, url: r.url, location: r.location, mode: r.mode,
    verified: r.mode !== 'unknown', desc: r.description || '', tags: safeJSON(r.tags), date: r.published_at,
    source: r.source, geoCheck: true,
  }));
}
const safeJSON = (s) => { try { return JSON.parse(s) || []; } catch { return []; } };

/** Coloca vagas do LinkedIn na fila para ler a descrição depois. */
export async function enqueueVerify(ids) {
  if (!ids.length) return;
  const now = Date.now();
  await db.batch(ids.slice(0, 200).map((id) => ({ sql: 'INSERT OR IGNORE INTO verify_queue (source, ext_id, added_at) VALUES (?, ?, ?)', args: ['linkedin', String(id), now] })));
  const size = (await db.get('SELECT COUNT(*) AS c FROM verify_queue')).c;
  if (size > QUEUE_MAX) await db.run('DELETE FROM verify_queue WHERE rowid IN (SELECT rowid FROM verify_queue ORDER BY added_at LIMIT ?)', [size - QUEUE_MAX]);
}

/** A busca em primeiro plano tem prioridade sobre o trabalhador (evita bloqueio do LinkedIn). */
export async function withForeground(fn) {
  state.foreground++;
  try { return await fn(); } finally { state.foreground--; }
}

/** Uma rodada do trabalhador: lê descrições da fila, uma por vez, até esvaziar, o tempo acabar ou o LinkedIn limitar. */
export async function drainVerifyQueue(maxItems = 60, budgetMs = Infinity) {
  if (state.verifyActive || Date.now() < state.verifyBlockedUntil) return 0;
  state.verifyActive = true;
  const t0 = Date.now();
  let done = 0;
  try {
    while (done < maxItems && !state.foreground && Date.now() - t0 < budgetMs) {
      const next = await db.get("SELECT ext_id FROM verify_queue WHERE source = 'linkedin' ORDER BY added_at DESC LIMIT 1");
      if (!next) break;
      try {
        const info = await linkedInDetail(next.ext_id);
        await db.run('DELETE FROM verify_queue WHERE source = ? AND ext_id = ?', ['linkedin', next.ext_id]);
        done++;
        if (!info.cached) await sleep(1500);
      } catch (e) {
        if (/429/.test(e.message)) { state.verifyBlockedUntil = Date.now() + 10 * 60e3; break; }
        await db.run('DELETE FROM verify_queue WHERE source = ? AND ext_id = ?', ['linkedin', next.ext_id]); // vaga removida ou erro permanente
      }
    }
  } finally {
    state.verifyActive = false;
  }
  return done;
}

export async function indexStatus() {
  const [totals, companies, queue, cand] = await Promise.all([
    db.get("SELECT COUNT(*) AS jobs, SUM(mode = 'remote') AS remote, SUM(mode = 'hybrid') AS hybrid FROM index_jobs"),
    db.get('SELECT COUNT(*) AS total, SUM(enabled) AS enabled, SUM(error IS NOT NULL) AS errors, MAX(last_indexed) AS last, SUM(discovered) AS discovered FROM companies'),
    db.get('SELECT COUNT(*) AS c FROM verify_queue'),
    db.get('SELECT COUNT(*) AS total, SUM(tried_at IS NULL) AS pending FROM company_candidates'),
  ]);
  return {
    jobs: totals.jobs || 0,
    remote: totals.remote || 0,
    hybrid: totals.hybrid || 0,
    companies: companies.total || 0,
    enabled: companies.enabled || 0,
    errors: companies.errors || 0,
    lastIndexed: companies.last || null,
    discovered: companies.discovered || 0,
    candidates: { total: cand.total || 0, pending: cand.pending || 0 },
    running: state.running,
    queue: queue.c,
    verifyBlockedUntil: state.verifyBlockedUntil > Date.now() ? state.verifyBlockedUntil : null,
  };
}
