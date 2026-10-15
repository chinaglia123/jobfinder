// Camada de banco com a mesma interface (assíncrona) para três motores:
//  - Turso (libSQL remoto): quando TURSO_DATABASE_URL está definido — usado na Vercel
//  - libSQL em arquivo: JOBFINDER_DB=libsql — para testar localmente o mesmo caminho do Turso
//  - node:sqlite (padrão): uso no computador e no Docker, sem dependências nativas
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const SCHEMA_VERSION = '8';

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`,
  `CREATE TABLE IF NOT EXISTS resumes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 0,
    name TEXT, text TEXT NOT NULL, language TEXT DEFAULT 'pt', seniority TEXT,
    areas TEXT, skills TEXT, target_titles TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT UNIQUE NOT NULL, title TEXT NOT NULL, company TEXT, location TEXT,
    mode TEXT NOT NULL, -- 'remote' | 'hybrid' | 'onsite' | 'unknown'
    source TEXT NOT NULL, published_at TEXT, applicants INTEGER, score INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 0, -- 0 = uso local, sem login
    job_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'saved', -- 'saved' | 'applied' | 'interview' | 'offer' | 'rejected'
    match_score INTEGER DEFAULT 0, match_reasons TEXT, cover_letter TEXT, notes TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, job_id),
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
  )`,
  // Cache de descrições já lidas (evita repetir requisições e bloqueios do LinkedIn)
  `CREATE TABLE IF NOT EXISTS job_details (
    source TEXT NOT NULL, ext_id TEXT NOT NULL, mode TEXT, applicants INTEGER, description TEXT,
    fetched_at INTEGER NOT NULL, PRIMARY KEY (source, ext_id)
  )`,
  // Quadros de vagas indexados (sites de carreira das empresas e agregadores)
  `CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ats TEXT NOT NULL, slug TEXT NOT NULL, name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1, last_indexed INTEGER, job_count INTEGER DEFAULT 0, error TEXT,
    UNIQUE (ats, slug)
  )`,
  `CREATE TABLE IF NOT EXISTS index_jobs (
    url TEXT PRIMARY KEY, company_id INTEGER NOT NULL, source TEXT NOT NULL,
    title TEXT NOT NULL, title_norm TEXT NOT NULL, company TEXT, location TEXT, mode TEXT NOT NULL,
    description TEXT, tags TEXT, published_at TEXT, seen_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_index_jobs_company ON index_jobs(company_id)`,
  // Vagas do LinkedIn aguardando leitura da descrição em segundo plano
  `CREATE TABLE IF NOT EXISTS verify_queue (
    source TEXT NOT NULL, ext_id TEXT NOT NULL, added_at INTEGER NOT NULL, PRIMARY KEY (source, ext_id)
  )`,
  // Contas (modo hospedado) e dados por pessoa
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL, name TEXT, pass_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS user_data (
    user_id INTEGER PRIMARY KEY, profile TEXT, cv_text TEXT, filters TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS hidden_jobs (
    user_id INTEGER NOT NULL, url TEXT NOT NULL, title TEXT, company TEXT,
    hidden_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, url)
  )`,
  // Limite de uso por pessoa/IP (janela fixa). Fica no banco porque na Vercel cada função tem memória própria.
  `CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL)`,
  // Histórico de cada vaga (mesma empresa + cargo): quando apareceu e quantas vezes foi publicada — detecta vagas fantasma
  `CREATE TABLE IF NOT EXISTS fingerprints (fp TEXT PRIMARY KEY, first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL, postings INTEGER NOT NULL DEFAULT 1)`,
  // Descoberta automática de empresas: nomes vistos nas buscas e links de sistemas de recrutamento achados nas vagas
  `CREATE TABLE IF NOT EXISTS company_candidates (
    key TEXT PRIMARY KEY, kind TEXT NOT NULL, -- 'name' | 'board'
    name TEXT, ats TEXT, slug TEXT, added_at INTEGER NOT NULL, tried_at INTEGER, result TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_candidates_pending ON company_candidates(tried_at, kind)`,
];

// Empresas iniciais (slugs conferidos nas APIs públicas em out/2026)
const SEED = [
  ['greenhouse', 'arcoeducacao', 'Arco Educação'], ['greenhouse', 'stone', 'Stone'], ['greenhouse', 'btgpactual', 'BTG Pactual'],
  ['greenhouse', 'c6bank', 'C6 Bank'], ['greenhouse', 'xpinc', 'XP Inc.'], ['greenhouse', 'agibank', 'Agibank'],
  ['greenhouse', 'quintoandar', 'QuintoAndar'], ['greenhouse', 'gympass', 'Wellhub (Gympass)'], ['greenhouse', 'ebanx', 'EBANX'],
  ['greenhouse', 'vtex', 'VTEX'], ['greenhouse', 'wildlifestudios', 'Wildlife Studios'], ['greenhouse', 'jusbrasil', 'Jusbrasil'],
  ['greenhouse', 'rdstation', 'RD Station'], ['greenhouse', 'blip', 'Blip'],
  ['greenhouse', 'clara', 'Clara'], ['greenhouse', 'wizeline', 'Wizeline'], ['greenhouse', 'canonical', 'Canonical'],
  ['greenhouse', 'gitlab', 'GitLab'], ['greenhouse', 'duolingo', 'Duolingo'], ['greenhouse', 'airtable', 'Airtable'],
  ['lever', 'ciandt', 'CI&T'], ['lever', 'flashapp', 'Flash'], ['lever', 'swile', 'Swile'], ['lever', 'toptal', 'Toptal'], ['lever', 'kavak', 'Kavak'],
  ['lever', 'neon', 'Neon'], ['lever', 'starkbank', 'Stark Bank'],
  ['ashby', 'nubank', 'Nubank'], ['ashby', 'addi', 'Addi'], ['ashby', 'zapier', 'Zapier'], ['ashby', 'kueski', 'Kueski'],
  ['ashby', 'neon', 'Neon (Ashby)'], ['ashby', 'belvo', 'Belvo'],
  ['feed', 'remoteok', 'RemoteOK'], ['feed', 'weworkremotely', 'We Work Remotely'], ['feed', 'workingnomads', 'Working Nomads'],
];

// ===== Motores =====

/** node:sqlite (síncrono) embrulhado na interface assíncrona */
async function nodeSqliteDriver() {
  const { DatabaseSync } = await import('node:sqlite');
  const dataDir = process.env.JOBFINDER_DATA_DIR || resolve(process.cwd(), '.data');
  try { mkdirSync(dataDir, { recursive: true }); } catch {}
  const path = resolve(dataDir, 'jobfinder.db');
  const raw = new DatabaseSync(path);
  raw.exec('PRAGMA journal_mode = WAL;');
  const cache = new Map();
  const stmt = (sql) => { let s = cache.get(sql); if (!s) { s = raw.prepare(sql); cache.set(sql, s); } return s; };
  return {
    name: `SQLite local (${path})`,
    async all(sql, args) { return stmt(sql).all(...args); },
    async get(sql, args) { return stmt(sql).get(...args) ?? null; },
    async run(sql, args) { const r = stmt(sql).run(...args); return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) }; },
    async exec(sql) { raw.exec(sql); },
    async batch(stmts) {
      raw.exec('BEGIN');
      try {
        const out = stmts.map(({ sql, args = [] }) => (/^\s*(select|pragma|with)\b/i.test(sql) || /\breturning\b/i.test(sql) ? stmt(sql).all(...args) : stmt(sql).run(...args)));
        raw.exec('COMMIT');
        return out;
      } catch (e) { raw.exec('ROLLBACK'); throw e; }
    },
  };
}

/** libSQL: Turso remoto (cliente "web", sem módulos nativos — ideal para a Vercel) ou arquivo local para testes */
async function libsqlDriver() {
  const remote = process.env.TURSO_DATABASE_URL;
  let client;
  if (remote) {
    const { createClient } = await import('@libsql/client/web');
    client = createClient({ url: remote, authToken: process.env.TURSO_AUTH_TOKEN });
  } else {
    const { createClient } = await import('@libsql/client');
    const dataDir = process.env.JOBFINDER_DATA_DIR || resolve(process.cwd(), '.data');
    try { mkdirSync(dataDir, { recursive: true }); } catch {}
    client = createClient({ url: 'file:' + resolve(dataDir, 'jobfinder-libsql.db').split('\\').join('/') });
  }
  const rows = (rs) => rs.rows.map((r) => Object.fromEntries(rs.columns.map((c, i) => [c, r[i]])));
  // Gravações simultâneas podem encontrar o banco ocupado: tenta de novo algumas vezes antes de desistir
  const retry = async (fn) => {
    for (let attempt = 1; ; attempt++) {
      try { return await fn(); } catch (e) {
        if (attempt >= 4 || !/SQLITE_BUSY|database is locked|LOCKED/i.test(String(e?.code || e?.message))) throw e;
        await new Promise((r) => setTimeout(r, 150 * attempt + Math.random() * 100));
      }
    }
  };
  return {
    name: remote ? `Turso (${new URL(remote.replace(/^libsql:/, 'https:')).host})` : 'libSQL local (teste)',
    async all(sql, args) { return rows(await retry(() => client.execute({ sql, args }))); },
    async get(sql, args) { return rows(await retry(() => client.execute({ sql, args })))[0] ?? null; },
    async run(sql, args) {
      const r = await retry(() => client.execute({ sql, args }));
      return { changes: r.rowsAffected, lastInsertRowid: r.lastInsertRowid != null ? Number(r.lastInsertRowid) : null };
    },
    async exec(sql) { await retry(() => client.executeMultiple(sql)); },
    async batch(stmts) {
      const res = await retry(() => client.batch(stmts.map(({ sql, args = [] }) => ({ sql, args })), 'write'));
      return res.map((r) => (r.columns.length ? rows(r) : { changes: r.rowsAffected }));
    },
  };
}

// ===== Inicialização (uma vez por processo/instância) =====
const useLibsql = !!process.env.TURSO_DATABASE_URL || process.env.JOBFINDER_DB === 'libsql';
let driver = null;

async function init() {
  // Na Vercel o disco é temporário: sem Turso, os dados sumiriam a cada execução
  if (process.env.VERCEL && !process.env.TURSO_DATABASE_URL) {
    throw new Error('Configure TURSO_DATABASE_URL e TURSO_AUTH_TOKEN nas variáveis de ambiente da Vercel.');
  }
  driver = useLibsql ? await libsqlDriver() : await nodeSqliteDriver();
  await driver.exec(SCHEMA[0]);
  const v = await driver.get('SELECT value FROM settings WHERE key = ?', ['schema_version']);
  if (v?.value === SCHEMA_VERSION) return;

  // Esquema completo (idempotente)
  await driver.batch(SCHEMA.map((sql) => ({ sql })));

  // Migrações de bancos criados por versões anteriores
  const appCols = (await driver.all('PRAGMA table_info(applications)', [])).map((c) => c.name);
  if (!appCols.includes('user_id')) {
    await driver.batch([
      { sql: `CREATE TABLE applications_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL DEFAULT 0, job_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'saved', match_score INTEGER DEFAULT 0, match_reasons TEXT, cover_letter TEXT, notes TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE (user_id, job_id),
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE)` },
      { sql: `INSERT INTO applications_v2 (id, user_id, job_id, status, match_score, match_reasons, cover_letter, notes, updated_at)
        SELECT id, 0, job_id, status, match_score, match_reasons, cover_letter, notes, updated_at FROM applications` },
      { sql: 'DROP TABLE applications' },
      { sql: 'ALTER TABLE applications_v2 RENAME TO applications' },
    ]);
  }
  const resumeCols = (await driver.all('PRAGMA table_info(resumes)', [])).map((c) => c.name);
  if (!resumeCols.includes('user_id')) await driver.run('ALTER TABLE resumes ADD COLUMN user_id INTEGER NOT NULL DEFAULT 0', []);
  // Resumo do conteúdo de cada vaga indexada: só regrava quando muda (economiza escritas no Turso)
  const idxCols = (await driver.all('PRAGMA table_info(index_jobs)', [])).map((c) => c.name);
  if (!idxCols.includes('content_hash')) await driver.run('ALTER TABLE index_jobs ADD COLUMN content_hash TEXT', []);
  const compCols = (await driver.all('PRAGMA table_info(companies)', [])).map((c) => c.name);
  if (!compCols.includes('discovered')) await driver.run('ALTER TABLE companies ADD COLUMN discovered INTEGER NOT NULL DEFAULT 0', []);

  // Correção do cadastro inicial: esses endereços eram de outras empresas (ARCO Companies nos EUA,
  // General Assembly, uma "Flash" sem vagas no Brasil). Sai o quadro e as vagas dele.
  const WRONG = "ats = 'greenhouse' AND slug IN ('arco', 'remote', 'flash')";
  await driver.batch([
    { sql: `DELETE FROM index_jobs WHERE company_id IN (SELECT id FROM companies WHERE ${WRONG})` },
    { sql: `DELETE FROM companies WHERE ${WRONG}` },
  ]);

  // Empresas iniciais (sem INSERT OR IGNORE, que consumiria ids do AUTOINCREMENT)
  await driver.batch([
    ...SEED.map(([ats, slug, name]) => ({
      sql: 'INSERT INTO companies (ats, slug, name) SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM companies WHERE ats = ? AND slug = ?)',
      args: [ats, slug, name, ats, slug],
    })),
    // Nomes limpos: sem espaços sobrando e, nas descobertas pelo endereço, o nome visto na vaga
    { sql: 'UPDATE companies SET name = trim(name)' },
    { sql: `UPDATE companies SET name = (SELECT cc.name FROM company_candidates cc WHERE cc.kind = 'board' AND cc.ats = companies.ats
        AND lower(cc.slug) = lower(companies.slug) AND cc.name IS NOT NULL LIMIT 1)
      WHERE discovered = 1 AND lower(name) = lower(slug) AND EXISTS (SELECT 1 FROM company_candidates cc WHERE cc.kind = 'board'
        AND cc.ats = companies.ats AND lower(cc.slug) = lower(companies.slug) AND cc.name IS NOT NULL)` },
    // Se alguma já tinha sido descoberta sozinha, passa a contar como cadastrada
    { sql: `UPDATE companies SET discovered = 0 WHERE (ats, slug) IN (${SEED.map(() => '(?, ?)').join(', ')})`, args: SEED.flatMap(([a, s]) => [a, s]) },
    { sql: `INSERT INTO settings (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, args: [SCHEMA_VERSION] },
  ]);
  console.log('[Banco] Pronto:', driver.name);
}

let readyPromise = null;
export const dbReady = () => (readyPromise ||= init().catch((e) => { readyPromise = null; throw e; }));

/**
 * Interface usada pelo app (sempre assíncrona):
 *   await db.get(sql, [args])  → linha ou null
 *   await db.all(sql, [args])  → linhas
 *   await db.run(sql, [args])  → { changes, lastInsertRowid }
 *   await db.batch([{ sql, args }]) → executa tudo numa transação
 */
export const db = {
  async get(sql, args = []) { await dbReady(); return driver.get(sql, args); },
  async all(sql, args = []) { await dbReady(); return driver.all(sql, args); },
  async run(sql, args = []) { await dbReady(); return driver.run(sql, args); },
  async batch(stmts) { await dbReady(); return stmts.length ? driver.batch(stmts) : []; },
  get engine() { return driver?.name || (useLibsql ? 'libSQL' : 'SQLite local'); },
};
