import { normalizeFilters, processJobs } from '../../utils/pipeline';
import { normalizeExternalJobs } from '../../utils/agent';
import { requireUser } from '../../utils/auth';

// Recebe vagas coletadas fora do servidor (o agente local no PC da pessoa: Indeed, Glassdoor...)
// e aplica o mesmo funil de filtros e match da busca normal.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const body = (await readBody(event)) || {};
  const f = normalizeFilters(body.filters);
  const status = body.status && typeof body.status === 'object' ? body.status : {};
  return processJobs(f, normalizeExternalJobs(body.jobs), status, { userId: user.id });
});
