import { runIndex, drainVerifyQueue, indexStatus } from '../../utils/indexer';
import { processCandidates } from '../../utils/discovery';
import { runSweep } from '../../utils/sweep';
import { cleanupAuth } from '../../utils/auth';

// Rotina periódica (cron da Vercel e/ou GitHub Actions): atualiza os quadros das empresas,
// lê descrições pendentes do LinkedIn e limpa sessões vencidas.
// Protegida por CRON_SECRET (a Vercel envia "Authorization: Bearer <CRON_SECRET>" automaticamente).
export default defineEventHandler(async (event) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw createError({ statusCode: 503, message: 'Defina CRON_SECRET para habilitar a rotina.' });
  if (getHeader(event, 'authorization') !== `Bearer ${secret}`) throw createError({ statusCode: 401, message: 'Não autorizado.' });

  const t0 = Date.now();
  const index = await runIndex({ budgetMs: 120_000 });
  // Varredura de todas as áreas (colhe empresas novas para a descoberta)
  const sweep = await runSweep({ areasPerRun: 4, budgetMs: 45_000 }).catch((e) => ({ error: e.message }));
  // Descoberta: confere empresas novas vistas nas buscas (elas entram na próxima atualização)
  const discovery = await processCandidates({ budgetMs: Math.max(0, 210_000 - (Date.now() - t0)), max: 150 }).catch((e) => ({ error: e.message }));
  const verified = await drainVerifyQueue(40, Math.max(0, 260_000 - (Date.now() - t0)));
  await cleanupAuth().catch(() => {});
  return { ok: true, seconds: Math.round((Date.now() - t0) / 1000), index, sweep, discovery, verified, status: await indexStatus() };
});
