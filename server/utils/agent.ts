// Agente local (Python, Indeed e Glassdoor) visto pelo SERVIDOR. Quando o JobFinder roda neste mesmo
// computador (no PC ou servido para a rede de casa), o servidor chama o agente direto: assim quem abre o
// site de outro aparelho também recebe essas vagas, sem precisar rodar o agente no próprio aparelho.
// Na Vercel não há agente no servidor; lá quem chama é o navegador da pessoa.
import { classifyMode, strip } from './search';

const AGENT_URL = (process.env.JOBFINDER_AGENTE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
let cache: { at: number; value: any } | null = null;

async function call(path: string, init: RequestInit = {}, ms = 1500) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(AGENT_URL + path, { ...init, signal: ctrl.signal });
    if (!r.ok) throw new Error('agente respondeu ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

/** O agente está rodando ao lado do servidor? (guarda a resposta por 20s) */
export async function agentStatus() {
  if (process.env.VERCEL) return { ok: false };
  if (cache && Date.now() - cache.at < 20_000) return cache.value;
  let value: any;
  try {
    const d = await call('/status', {}, 800);
    value = { ok: !!d.ok, version: d.version, sources: d.sources || [], viaServer: true };
  } catch { value = { ok: false }; }
  cache = { at: Date.now(), value };
  return value;
}

export async function agentSearch(body: any) {
  return call('/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 120_000);
}

const str = (v: any, max = 300) => (typeof v === 'string' ? v : v == null ? '' : String(v)).slice(0, max);

/** Vagas que vieram de fora do servidor (agente) no formato do funil, com tudo conferido e limitado. */
export function normalizeExternalJobs(list: any) {
  return (Array.isArray(list) ? list.slice(0, 1000) : [])
    .filter((j: any) => j && typeof j.title === 'string' && /^https?:\/\//.test(j.url || ''))
    .map((j: any) => {
      const desc = strip(str(j.desc, 8000));
      const fromText = classifyMode(str(j.title), desc);
      const hint = ['remote', 'hybrid', 'onsite'].includes(j.mode) ? j.mode : 'unknown';
      return {
        title: str(j.title, 200),
        company: str(j.company, 120) || 'Empresa',
        url: str(j.url, 600),
        location: str(j.location, 120),
        date: str(j.date, 40) || null,
        // A descrição tem prioridade; a dica do site só vale quando o texto não diz nada
        mode: fromText !== 'unknown' ? fromText : hint,
        verified: fromText !== 'unknown',
        desc,
        tags: (Array.isArray(j.tags) ? j.tags : []).map((t: any) => str(t, 40)).filter(Boolean).slice(0, 8),
        source: str(j.source, 40) || 'Agente local',
        geoCheck: true,
      };
    });
}
