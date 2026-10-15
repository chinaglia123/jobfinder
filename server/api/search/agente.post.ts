import { normalizeFilters, processJobs } from '../../utils/pipeline';
import { agentStatus, agentSearch, normalizeExternalJobs } from '../../utils/agent';
import { requireUser } from '../../utils/auth';

// Busca no agente local pelo servidor (quando os dois rodam no mesmo computador) e aplica o funil.
// Sem agente ao lado do servidor responde { available: false } e a tela tenta o agente pelo navegador.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  if (!(await agentStatus()).ok) return { available: false };
  const body = (await readBody(event)) || {};
  const f = normalizeFilters(body);
  const queries = (Array.isArray(body.agentQueries) && body.agentQueries.length ? body.agentQueries : f.queries).slice(0, 4);
  try {
    const found = await agentSearch({ ...body, queries });
    return { available: true, ...(await processJobs(f, normalizeExternalJobs(found.jobs), found.status || {}, { userId: user.id })) };
  } catch (e: any) {
    return { available: true, jobs: [], status: { agente: { ok: false, error: e.message } } };
  }
});
