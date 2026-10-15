// Varredura: percorre TODAS as áreas (algumas por rodada) nas fontes rápidas, sem mostrar nada para ninguém,
// só para colher nomes de empresas e links de recrutamento. Isso alimenta a descoberta automática e faz a
// base de empresas acompanhadas crescer sem depender do que as pessoas buscam.
import { db } from './db';
import { SOURCES } from './search';
import { normalizeFilters } from './pipeline';
import { noteCandidates } from './discovery';
import { AREA_GROUPS } from '#shared/areas.js';

const ALL_AREAS = AREA_GROUPS.flatMap((g) => g.areas);
// Fontes baratas e estáveis (LinkedIn fica de fora: é lento e bloqueia)
const SWEEP_SOURCES = ['gupy', 'remotar', 'trampos', 'infojobs', 'vagascom', 'catho', 'empregoscom', 'himalayas', 'getonbrd'];

async function collect(filters) {
  const f = normalizeFilters({ region: 'br', workMode: 'any', expand: false, ...filters });
  const res = await Promise.all(SWEEP_SOURCES.map(async (s) => {
    try { return (await SOURCES[s].run(f)).map((j) => ({ ...j, source: SOURCES[s].label })); } catch { return []; }
  }));
  return res.flat();
}

/** Uma rodada: as próximas `areasPerRun` áreas + uma passada sem filtro. Devolve quantas candidatas novas anotou. */
export async function runSweep({ areasPerRun = 4, budgetMs = 90_000 } = {}) {
  const t0 = Date.now();
  const cursor = Number((await db.get("SELECT value FROM settings WHERE key = 'sweep_cursor'"))?.value || 0);
  let noted = 0, jobs = 0, done = 0;

  // Passada sem filtro de cargo: pega o que acabou de ser publicado em todas as áreas
  const recent = await collect({ explore: true, queries: [] });
  jobs += recent.length;
  noted += await noteCandidates(recent, 300);

  for (let i = 0; i < areasPerRun && Date.now() - t0 < budgetMs; i++) {
    const area = ALL_AREAS[(cursor + i) % ALL_AREAS.length];
    const found = await collect({ queries: area.queries.slice(0, 2) });
    jobs += found.length;
    noted += await noteCandidates(found, 300);
    done++;
  }
  const next = (cursor + done) % ALL_AREAS.length;
  await db.batch([
    { sql: "INSERT INTO settings (key, value) VALUES ('sweep_cursor', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", args: [String(next)] },
    { sql: "INSERT INTO settings (key, value) VALUES ('sweep_last', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", args: [JSON.stringify({ at: Date.now(), jobs, noted, areas: done })] },
  ]);
  return { jobs, noted, areas: done, nextArea: ALL_AREAS[next]?.label, seconds: Math.round((Date.now() - t0) / 1000) };
}
