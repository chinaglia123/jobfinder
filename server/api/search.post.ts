import { SOURCES } from '../utils/search';
import { searchIndex, indexStatus } from '../utils/indexer';
import { normalizeFilters, processJobs } from '../utils/pipeline';
import { requireUser } from '../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const f = normalizeFilters(await readBody(event));
  const region = f.region;
  const wanted = (f.sources && f.sources.length ? f.sources : Object.keys(SOURCES))
    .filter((s: string) => SOURCES[s] && SOURCES[s].regions.includes(region))
    .filter((s: string) => !(f.exclude || []).includes(s)); // a interface pede o LinkedIn (lento) em separado

  const status: Record<string, any> = {};
  const results = await Promise.all(wanted.map(async (s: string) => {
    try {
      const r = await SOURCES[s].run(f);
      status[s] = { ok: true, raw: r.length };
      return r.map((j: any) => ({ ...j, source: SOURCES[s].label }));
    } catch (e: any) {
      status[s] = { ok: false, error: e.message };
      return [];
    }
  }));

  // Vagas dos sites de carreira das empresas, já indexadas em segundo plano (instantâneo)
  if (!f.sources || !f.sources.length || f.sources.includes('empresas')) {
    try {
      const [idx, st] = await Promise.all([searchIndex(f.matcher), indexStatus()]);
      status.empresas = { ok: true, raw: idx.length, indexadas: st.jobs, quadros: st.enabled, atualizando: st.running };
      results.push(idx);
    } catch (e: any) {
      status.empresas = { ok: false, error: e.message };
    }
  }


  return processJobs(f, results.flat(), status, { verifyLinkedin: wanted.includes('linkedin'), userId: user.id });
});
