import { runIndex, indexStatus } from '../../utils/indexer';
import { requireAdmin } from '../../utils/auth';

// Dispara a atualização sem esperar terminar (pode levar alguns minutos)
export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { force = true, companyId = null } = (await readBody(event).catch(() => ({}))) || {};
  // Na Vercel a função encerra ao responder, então esperamos (com limite de tempo)
  const result = await runIndex({ force, companyId, budgetMs: 240_000 }).catch((e) => ({ error: e.message }));
  return { ...(await indexStatus()), result };
});
