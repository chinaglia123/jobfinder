import { callProvider, describeKeyError, AI_PROVIDERS } from '../../utils/ai';
import { aiCreds } from '../../utils/ai-creds';
import { rateLimit } from '../../utils/auth';

// Testa a chave de IA da pessoa com uma pergunta mínima (a chave vem nos cabeçalhos X-AI-*)
export default defineEventHandler(async (event) => {
  await rateLimit(event, 'ai-test', 20, 3600e3);
  const creds = aiCreds(event);
  if (!creds) throw createError({ statusCode: 400, message: 'Informe o provedor e a chave.' });
  try {
    const r = await callProvider(creds, {
      systemPrompt: 'Responda apenas com a palavra OK.',
      messages: [{ role: 'user', content: 'Teste de conexão.' }],
      temperature: 0,
    });
    return { ok: true, provider: r.provider, label: AI_PROVIDERS[r.provider].label, model: r.model };
  } catch (e: any) {
    throw createError({ statusCode: 400, message: describeKeyError(e).replace(' Confira em Ajustes.', ' Confira se copiou a chave inteira e se ela está ativa.') });
  }
});
