// Descoberta automática de empresas: cada busca anota candidatas (links de sistemas de recrutamento
// achados nas vagas e nomes de empresas); a rotina periódica confere cada uma e passa a acompanhar
// as que têm quadro de vagas público com vagas abertas para quem está no Brasil.
import { db } from './db';
import { ATS, parseCompanyUrl } from './ats';
import { norm, openToBrazil } from './search';

const CORP_NOISE = /\b(ltda|s\/?a|sa|eireli|me|epp|inc|llc|ltd|corp|co|gmbh|bv|plc|grupo|group|holding|do brasil|brasil|brazil|tecnologia|technologies|technology|servicos|solucoes)\b/g;
// Nomes que não identificam uma empresa (ou agregadores/consultorias que anunciam para terceiros)
const SKIP_NAME = /confidencial|^empresa\b|^company\b|stealth|freelance|autonomo|^remote\b|^remoto\b|^anonymous|^private|^undisclosed|\((gupy|vagas\.com|infojobs|get on board)\)/;

export const nameKey = (name) => norm(name).replace(/\([^)]*\)/g, ' ').replace(CORP_NOISE, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

// Ordem de tentativa por nome (dos mais comuns em empresas que contratam no Brasil para os menos)
const PROBE_ORDER = ['greenhouse', 'lever', 'ashby', 'workable', 'recruitee', 'smartrecruiters'];
const INSERT = 'INSERT OR IGNORE INTO company_candidates (key, kind, name, ats, slug, added_at) VALUES (?, ?, ?, ?, ?, ?)';

/** Anota candidatas a partir das vagas de uma busca (gravação só do que é novo). */
export async function noteCandidates(jobs, max = 150) {
  const now = Date.now();
  const seen = new Set();
  const stmts = [];
  for (const j of jobs) {
    // 1) Links de sistemas de recrutamento: o quadro é certo (ex: jobs.lever.co/empresa/...)
    const urls = [j.url, ...(j.alsoOn || []).map((a) => a.url), ...(String(j.desc || '').match(/https?:\/\/[^\s"'<>)]+/g) || []).slice(0, 5)];
    for (const u of urls) {
      const p = parseCompanyUrl(u);
      if (!p || !ATS[p.ats] || p.ats === 'feed') continue;
      const key = `board:${p.ats}:${p.slug.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      stmts.push({ sql: INSERT, args: [key, 'board', j.company || null, p.ats, p.slug, now] });
    }
    // 2) Nome da empresa: vamos tentar achar o quadro dela
    const k = nameKey(j.company);
    if (!k || k.length < 4 || SKIP_NAME.test(norm(j.company))) continue;
    const key = `name:${k}`;
    if (seen.has(key)) continue;
    seen.add(key);
    stmts.push({ sql: INSERT, args: [key, 'name', j.company, null, null, now] });
  }
  const list = stmts.slice(0, max);
  for (let i = 0; i < list.length; i += 100) await db.batch(list.slice(i, i + 100));
  return list.length;
}

const slugVariants = (name) => {
  const k = nameKey(name);
  const words = k.split(' ').filter(Boolean);
  return [...new Set([words.join(''), words.join('-'), words.length > 2 ? words.slice(0, 2).join('') : null].filter((s) => s && s.length >= 3))];
};

/** O nome do quadro bate com o nome procurado? (evita "Dock" brasileira ≠ "Stichting Dock" holandesa) */
const sameCompany = (boardName, wanted) => {
  const a = nameKey(boardName), b = nameKey(wanted);
  if (!a || !b) return false;
  return a === b || (a.length >= 4 && b.startsWith(a)) || (b.length >= 4 && a.startsWith(b));
};

/**
 * Tenta um quadro. Para candidata vinda de nome (`wanted`), exige que o nome do quadro bata
 * (ou, nos sistemas que não informam o nome, que o endereço seja exatamente o nome da empresa).
 * Em todos os casos exige ao menos uma vaga aberta para quem está no Brasil.
 */
async function tryBoard(ats, slug, wanted = null, fallbackName = null) {
  let jobs;
  try { jobs = await ATS[ats].fetch(slug); } catch { return null; }
  if (!jobs?.length) return null;
  if (wanted) {
    if (jobs.boardName) { if (!sameCompany(jobs.boardName, wanted)) return null; }
    else if (!slugVariants(wanted).slice(0, 2).includes(slug.toLowerCase())) return null;
  }
  const br = jobs.filter((j) => openToBrazil(j.location));
  if (!br.length) return { rejected: 'sem vagas para o Brasil' };
  const name = String(jobs.boardName || wanted || fallbackName || slug).trim();
  return { ats, slug, name, jobs: jobs.length, br: br.length };
}

async function addCompany(found) {
  await db.run('INSERT INTO companies (ats, slug, name, discovered) VALUES (?, ?, ?, 1) ON CONFLICT(ats, slug) DO NOTHING',
    [found.ats, found.slug, String(found.name).slice(0, 120)]);
}

/** Confere candidatas pendentes (dentro do tempo dado). Retorna quantas empresas novas foram adicionadas. */
export async function processCandidates({ budgetMs = 60_000, max = 80 } = {}) {
  const t0 = Date.now();
  const rows = await db.all(
    "SELECT * FROM company_candidates WHERE tried_at IS NULL ORDER BY kind = 'name', added_at LIMIT ?", [max]);
  let i = 0, added = 0, checked = 0;
  const finish = (key, result) => db.run('UPDATE company_candidates SET tried_at = ?, result = ? WHERE key = ?', [Date.now(), result, key]);

  await Promise.all(Array.from({ length: Math.min(6, rows.length) }, async () => {
    while (i < rows.length && Date.now() - t0 < budgetMs) {
      const c = rows[i++];
      checked++;
      try {
        if (c.kind === 'board') {
          if (await db.get('SELECT 1 FROM companies WHERE ats = ? AND lower(slug) = lower(?)', [c.ats, c.slug])) { await finish(c.key, 'já acompanhada'); continue; }
          const found = await tryBoard(c.ats, c.slug, null, c.name);
          if (found?.ats) { await addCompany(found); added++; await finish(c.key, `adicionada (${found.br} vagas no Brasil)`); }
          else await finish(c.key, found?.rejected || 'quadro vazio ou inexistente');
          continue;
        }
        // Por nome: já acompanhamos uma empresa com esse nome?
        if (await db.get('SELECT 1 FROM companies WHERE lower(name) = lower(?)', [c.name])) { await finish(c.key, 'já acompanhada'); continue; }
        let result = 'nenhum quadro público encontrado';
        search: for (const ats of PROBE_ORDER) {
          for (const slug of slugVariants(c.name)) {
            if (Date.now() - t0 > budgetMs + 20_000) break search;
            const found = await tryBoard(ats, slug, c.name);
            if (found?.ats) { await addCompany(found); added++; result = `adicionada: ${ats}/${slug} (${found.br} vagas no Brasil)`; break search; }
            if (found?.rejected) { result = `${ats}/${slug}: ${found.rejected}`; break search; }
          }
        }
        await finish(c.key, result);
      } catch (e) {
        await finish(c.key, 'erro: ' + String(e.message || e).slice(0, 80)).catch(() => {});
      }
    }
  }));
  return { checked, added, pending: Math.max(0, rows.length - checked) };
}
