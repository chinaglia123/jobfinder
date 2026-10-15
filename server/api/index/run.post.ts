import { runIndex, indexStatus } from '../../utils/indexer';
import { processCandidates } from '../../utils/discovery';
import { requireAdmin } from '../../utils/auth';

// Atualização manual (administrador): confere empresas novas e baixa as vagas dos quadros.
// Na Vercel a função encerra ao responder, então esperamos (com limite de tempo).
export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { force = true, companyId = null, discover = !companyId } = (await readBody(event).catch(() => ({}))) || {};
  const discovery = discover ? await processCandidates({ budgetMs: 60_000, max: 80 }).catch((e) => ({ error: e.message })) : null;
  const result = await runIndex({ force, companyId, budgetMs: 180_000 }).catch((e) => ({ error: e.message }));
  return { ...(await indexStatus()), result, discovery };
});
