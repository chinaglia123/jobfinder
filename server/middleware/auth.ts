import { MODE, getUser, rateLimit, AI_PER_DAY } from '../utils/auth';

// Rotas abertas mesmo sem login (no modo hospedado)
const PUBLIC = ['/api/auth/', '/api/info', '/api/agente/download', '/api/cron/']; // cron: protegido por CRON_SECRET

// Rotas que gastam a cota diária de IA do site
const SITE_AI = /^\/api\/(ai\/(?!test)|cv\/analyze)/;

// Limites por pessoa no modo hospedado (chamadas por hora)
const LIMITS: [RegExp, string, number][] = [
  [/^\/api\/search/, 'search', 40],
  [/^\/api\/ai\//, 'ai', 60],
  [/^\/api\/cv\//, 'cv', 20],
  [/^\/api\/companies$/, 'companies', 20],
];

export default defineEventHandler(async (event) => {
  const path = event.path.split('?')[0];
  if (!path.startsWith('/api/') || MODE === 'local') return;
  if (PUBLIC.some((p) => path.startsWith(p))) return;
  if (!(await getUser(event))) throw createError({ statusCode: 401, message: 'Entre na sua conta para continuar.' });
  if (event.method === 'POST') {
    // Quem usa a própria chave de IA não consome a cota do servidor nas rotas de IA
    const ownKey = !!getHeader(event, 'x-ai-key');
    for (const [re, name, max] of LIMITS) {
      if (ownKey && (name === 'ai' || name === 'cv')) continue;
      if (re.test(path)) await rateLimit(event, name, max, 3600e3);
    }
    // A chave do site é dividida entre todo mundo: cada pessoa tem uma cota por dia
    if (!ownKey && SITE_AI.test(path) && (process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY)) {
      await rateLimit(event, 'ai-dia', AI_PER_DAY, 24 * 3600e3,
        `Você usou os ${AI_PER_DAY} usos de IA de hoje do site. Para continuar agora, coloque sua própria chave grátis em Ajustes (leva 2 minutos).`);
    }
  }
});
