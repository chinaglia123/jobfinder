// Adaptador Unificado de Inteligência Artificial: Groq, Gemini, OpenRouter ou Motor Local.
// Ordem: chave da própria pessoa (enviada pelo navegador) → chave do servidor (.env) → heurística local.

// Modelos em ordem de preferência. Os provedores aposentam modelos com frequência:
// se um não existir mais, tentamos o próximo e, por fim, perguntamos ao provedor quais existem.
export const AI_PROVIDERS = {
  groq: { label: 'Groq', models: ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b', 'llama-3.3-70b-versatile'] },
  gemini: { label: 'Google Gemini', models: ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'] },
  openrouter: { label: 'OpenRouter', models: ['openai/gpt-oss-20b:free', 'meta-llama/llama-3.3-70b-instruct:free', 'qwen/qwen3-14b:free'] },
};
for (const p of Object.values(AI_PROVIDERS)) p.defaultModel = p.models[0];

const TIMEOUT_MS = 45000;

async function post(url, headers, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ctrl.signal });
    if (!r.ok) {
      // Mensagem curta e sem ecoar a chave
      let detail = '';
      try { const d = await r.json(); detail = d.error?.message || d.message || ''; } catch {}
      const err = new Error(`HTTP ${r.status}${detail ? ': ' + String(detail).slice(0, 160) : ''}`);
      err.status = r.status;
      throw err;
    }
    return r.json();
  } finally { clearTimeout(t); }
}

function openAIStyle(url, key, model, { systemPrompt, messages, json, temperature }, extraHeaders = {}) {
  return post(url, { Authorization: `Bearer ${key}`, ...extraHeaders }, {
    model,
    messages: [{ role: 'system', content: systemPrompt }, ...messages.map((m) => ({ role: m.role, content: m.content }))],
    temperature,
    response_format: json ? { type: 'json_object' } : undefined,
  }).then((d) => d.choices?.[0]?.message?.content || '');
}

const CALL = {
  groq: (key, model, req) => openAIStyle('https://api.groq.com/openai/v1/chat/completions', key, model, req),
  openrouter: (key, model, req) => openAIStyle('https://openrouter.ai/api/v1/chat/completions', key, model, { ...req, json: false }, { 'X-Title': 'JobFinder' }),
  gemini: (key, model, { systemPrompt, messages, json, temperature }) =>
    // Chave no cabeçalho (não na URL), para não aparecer em logs de acesso
    post(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { 'x-goog-api-key': key }, {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      // O Gemini exige que a conversa comece pela pessoa (o Copiloto abre com uma saudação)
      contents: messages.slice(Math.max(0, messages.findIndex((m) => m.role === 'user')))
        .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: json ? { responseMimeType: 'application/json', temperature } : { temperature },
    }).then((d) => d.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || ''),
};

/** Chaves configuradas no servidor (.env), na ordem de preferência */
function serverCreds() {
  const out = [];
  if (process.env.GROQ_API_KEY) out.push({ provider: 'groq', key: process.env.GROQ_API_KEY, model: process.env.GROQ_MODEL });
  if (process.env.GEMINI_API_KEY) out.push({ provider: 'gemini', key: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL });
  if (process.env.OPENROUTER_API_KEY) out.push({ provider: 'openrouter', key: process.env.OPENROUTER_API_KEY, model: process.env.OPENROUTER_MODEL });
  return out;
}

const isModelMissing = (e) => e?.status === 404 || /model_not_found|does not exist|not found|decommissioned|deprecated|no endpoints/i.test(String(e?.message));
const workingModel = new Map(); // provedor → último modelo que funcionou (evita repetir 404)

/** Pergunta ao provedor quais modelos de texto a chave pode usar */
async function discoverModels(provider, key) {
  try {
    if (provider === 'gemini') {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key } });
      const d = await r.json();
      return (d.models || [])
        .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent') && /flash/.test(m.name) && !/image|tts|audio|live|embed/.test(m.name))
        .map((m) => m.name.replace(/^models\//, ''));
    }
    const url = provider === 'groq' ? 'https://api.groq.com/openai/v1/models' : 'https://openrouter.ai/api/v1/models';
    const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    const d = await r.json();
    return (d.data || [])
      .map((m) => m.id)
      .filter((id) => !/whisper|guard|orpheus|tts|embed|audio|vision|allam/i.test(id))
      .filter((id) => provider !== 'openrouter' || id.endsWith(':free'));
  } catch {
    return [];
  }
}

/**
 * Chama um provedor (usado também para testar a chave da pessoa). Lança erro se falhar.
 * Sem modelo escolhido, usa a lista de preferência e se adapta a modelos aposentados.
 */
export async function callProvider({ provider, key, model }, req) {
  const p = AI_PROVIDERS[provider];
  if (!p || !CALL[provider]) throw new Error('Provedor de IA desconhecido');
  const full = { json: false, temperature: 0.3, messages: [], ...req };
  if (model) return { text: await CALL[provider](key, model, full), provider, model };

  const tried = new Set();
  const attempt = async (m) => {
    tried.add(m);
    const text = await CALL[provider](key, m, full);
    workingModel.set(provider, m);
    return { text, provider, model: m };
  };
  let lastErr = null;
  for (const m of [...new Set([workingModel.get(provider), ...p.models].filter(Boolean))]) {
    try { return await attempt(m); } catch (e) { lastErr = e; if (!isModelMissing(e)) throw e; }
  }
  // Nenhum da lista existe mais: usa o que o provedor oferece hoje
  for (const m of (await discoverModels(provider, key)).filter((x) => !tried.has(x)).slice(0, 3)) {
    try { return await attempt(m); } catch (e) { lastErr = e; if (!isModelMissing(e)) throw e; }
  }
  throw lastErr || new Error('Nenhum modelo disponível');
}

/**
 * Gera uma resposta. `creds` = chave da própria pessoa ({ provider, key, model }), opcional.
 * Retorna { text, provider, model, userKey, keyError }. text = null → usar heurística local.
 */
export async function generateAI({ systemPrompt, messages = [], json = false, temperature = 0.3, creds = null }) {
  const req = { systemPrompt, messages, json, temperature };
  let keyError = null;

  if (creds?.key) {
    try {
      const r = await callProvider(creds, req);
      if (r.text) return { ...r, userKey: true };
    } catch (e) {
      keyError = describeKeyError(e);
      console.warn('[AI:chave do usuário falhou]', creds.provider, e.status || e.message?.slice(0, 40));
    }
  }

  for (const c of serverCreds()) {
    try {
      const r = await callProvider(c, req);
      if (r.text) return { ...r, userKey: false, keyError };
    } catch (e) {
      console.warn(`[AI:${c.provider} error, fallback]`, e.message);
    }
  }

  return { text: null, provider: 'local', userKey: false, keyError };
}

/** Explica em português por que a chave falhou */
export function describeKeyError(e) {
  const s = e?.status;
  const msg = String(e?.message || '').toLowerCase();
  if (s === 401 || s === 403 || (s === 400 && /api.?key|invalid.*key|credential|unauthori/.test(msg))) return 'Chave de IA inválida ou sem permissão. Confira em Ajustes.';
  if (s === 404) return 'Modelo de IA não encontrado para essa chave. Confira o modelo em Ajustes.';
  if (s === 429) return 'Sua chave de IA atingiu o limite de uso do provedor. Tente mais tarde.';
  if (e?.name === 'AbortError') return 'O provedor de IA demorou demais para responder.';
  return 'Não foi possível usar sua chave de IA agora.';
}

/** Extrai JSON da resposta mesmo quando o modelo embrulha em ```json ... ``` ou adiciona texto. */
export function parseJSON(text) {
  if (!text) return null;
  const clean = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  try { return JSON.parse(clean); } catch {}
  const a = clean.indexOf('{'), b = clean.lastIndexOf('}');
  if (a >= 0 && b > a) {
    try { return JSON.parse(clean.slice(a, b + 1)); } catch {}
  }
  return null;
}
