import { classifyMode, strip } from '../../utils/search';
import { normalizeFilters, processJobs } from '../../utils/pipeline';
import { requireUser } from '../../utils/auth';

const str = (v: any, max = 300) => (typeof v === 'string' ? v : v == null ? '' : String(v)).slice(0, max);

// Recebe vagas coletadas fora do servidor (o agente local no PC da pessoa: Indeed, Glassdoor...)
// e aplica o mesmo funil de filtros e match da busca normal.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const body = (await readBody(event)) || {};
  const f = normalizeFilters(body.filters);
  const raw = Array.isArray(body.jobs) ? body.jobs.slice(0, 1000) : [];

  const jobs = raw
    .filter((j: any) => j && typeof j.title === 'string' && /^https?:\/\//.test(j.url || ''))
    .map((j: any) => {
      const desc = strip(str(j.desc, 8000));
      const fromText = classifyMode(str(j.title), desc);
      const hint = ['remote', 'hybrid', 'onsite'].includes(j.mode) ? j.mode : 'unknown';
      return {
        title: str(j.title, 200),
        company: str(j.company, 120) || 'Empresa',
        url: str(j.url, 600),
        location: str(j.location, 120),
        date: str(j.date, 40) || null,
        // A descrição tem prioridade; a dica do site só vale quando o texto não diz nada
        mode: fromText !== 'unknown' ? fromText : hint,
        verified: fromText !== 'unknown',
        desc,
        tags: (Array.isArray(j.tags) ? j.tags : []).map((t: any) => str(t, 40)).filter(Boolean).slice(0, 8),
        source: str(j.source, 40) || 'Agente local',
        geoCheck: true,
      };
    });

  const status = body.status && typeof body.status === 'object' ? body.status : {};
  return processJobs(f, jobs, status, { userId: user.id });
});
