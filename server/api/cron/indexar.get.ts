import { runIndex, drainVerifyQueue, indexStatus } from '../../utils/indexer';
import { cleanupAuth } from '../../utils/auth';

// Rotina periódica (cron da Vercel e/ou GitHub Actions): atualiza os quadros das empresas,
// lê descrições pendentes do LinkedIn e limpa sessões vencidas.
// Protegida por CRON_SECRET (a Vercel envia "Authorization: Bearer <CRON_SECRET>" automaticamente).
export default defineEventHandler(async (event) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw createError({ statusCode: 503, message: 'Defina CRON_SECRET para habilitar a rotina.' });
  if (getHeader(event, 'authorization') !== `Bearer ${secret}`) throw createError({ statusCode: 401, message: 'Não autorizado.' });

  const t0 = Date.now();
  const index = await runIndex({ budgetMs: 200_000 });
  const verified = await drainVerifyQueue(40, Math.max(0, 260_000 - (Date.now() - t0)));
  await cleanupAuth().catch(() => {});
  return { ok: true, seconds: Math.round((Date.now() - t0) / 1000), index, verified, status: await indexStatus() };
});
