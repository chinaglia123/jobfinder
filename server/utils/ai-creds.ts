import type { H3Event } from 'h3';
import { AI_PROVIDERS } from './ai';

/**
 * Chave de IA da própria pessoa, enviada pelo navegador nos cabeçalhos
 * X-AI-Provider / X-AI-Key / X-AI-Model. Usada só nesta requisição: nunca é gravada nem registrada.
 */
export function aiCreds(event: H3Event) {
  const provider = String(getHeader(event, 'x-ai-provider') || '').toLowerCase();
  const key = String(getHeader(event, 'x-ai-key') || '').trim();
  const model = String(getHeader(event, 'x-ai-model') || '').trim().slice(0, 100);
  if (!key || !(provider in AI_PROVIDERS) || key.length > 300 || /\s/.test(key)) return null;
  return { provider, key, model: model || undefined };
}
