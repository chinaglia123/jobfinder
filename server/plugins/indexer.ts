import { runIndex, drainVerifyQueue } from '../utils/indexer';
import { cleanupAuth } from '../utils/auth';
import { processCandidates } from '../utils/discovery';

// Quando o app roda num servidor contínuo (seu computador, Docker), o indexador trabalha em segundo plano.
// Na Vercel não existem processos contínuos: lá quem chama é o cron (/api/cron/indexar).
export default defineNitroPlugin(() => {
  if (process.env.VERCEL || process.env.JOBFINDER_INDEXER === 'off') return;
  const g = globalThis as any;
  if (g.__jobIndexerTimers) return;

  const boards = () => runIndex().catch((e) => console.warn('[Indexador] erro:', e.message));
  const verify = () => drainVerifyQueue().catch(() => {});

  g.__jobIndexerTimers = [
    setTimeout(boards, 5_000), // primeira rodada logo após iniciar (só quadros vencidos)
    setInterval(boards, 30 * 60_000), // verifica a cada 30 min quais quadros passaram de 6h
    setInterval(verify, 2 * 60_000), // fila de confirmação do LinkedIn
    setInterval(() => cleanupAuth().catch(() => {}), 6 * 3600e3),
    // Descoberta de empresas: confere as candidatas vistas nas buscas
    setInterval(() => processCandidates({ budgetMs: 90_000 }).then((r) => r.added && console.log(`[Descoberta] +${r.added} empresas`)).catch(() => {}), 10 * 60_000),
  ];
  console.log('[Indexador] ativo: quadros de empresas a cada 6h, fila do LinkedIn a cada 2 min');
});
