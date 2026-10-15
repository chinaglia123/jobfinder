import { AREAS_BY_ID } from '#shared/areas.js';
import { jobFingerprint, mergeJob } from '#shared/jobs.js';

// Estado compartilhado do app (filtros, perfil, resultados, candidaturas) e as ações sobre ele.
export const DEFAULT_FILTERS = {
  queries: ['analista de marketing', 'marketing digital', 'vendas técnicas', 'assistente de marketing'],
  workMode: 'remote_hybrid',
  seniority: 'mid',
  location: 'Sorocaba',
  days: 30,
  region: 'br',
  fewApplicants: false,
  includeUnconfirmed: true,
  lang: 'any', // 'pt' = só vagas em português
  expand: true, // incluir cargos relacionados (mais variedade)
  excludeTerms: [], // palavras proibidas no título
  areas: [], // áreas escolhidas (ver shared/areas.js)
  hideSuspicious: true, // esconde vagas com sinais fortes de golpe
};

const emptySearch = () => ({
  jobs: [], status: {}, links: [], ran: false,
  loadingFast: false, loadingSlow: false, loadingAgent: false, error: '', startedAt: 0,
});

export const AGENT_DEFAULT_URL = 'http://127.0.0.1:8765';

/** fetch com tempo limite (o agente local pode não estar rodando) */
async function fetchTimeout(url, opts = {}, ms = 2500) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); } finally { clearTimeout(t); }
}

/** Ordem igual à do servidor: modalidade confirmada primeiro, depois match/relevância, depois data. */
export function sortJobs(jobs, by = 'match') {
  const t = (j) => new Date(j.date || 0).getTime() || 0;
  return [...jobs].sort((a, b) => {
    if (by === 'recent') return t(b) - t(a);
    // Mesmo desconto do servidor para vagas com sinais de fantasma/golpe
    const penalty = (j) => (j.ghost?.level || 0) * (j.matchScore != null ? 8 : 1) + (j.scam?.level || 0) * (j.matchScore != null ? 15 : 2);
    return Number(a.mode === 'unknown') - Number(b.mode === 'unknown')
      || ((b.matchScore ?? b.score ?? 0) - penalty(b)) - ((a.matchScore ?? a.score ?? 0) - penalty(a))
      || t(b) - t(a);
  });
}

/** Junta os resultados das etapas da busca: a mesma vaga (mesmo link ou mesma empresa + cargo) vira uma só */
function mergeJobs(current, incoming) {
  const at = new Map();
  const out = [];
  for (const j of [...current, ...incoming]) {
    const fp = j.fp || jobFingerprint(j.title, j.company);
    const i = at.get(j.url) ?? at.get(fp);
    if (i != null) { out[i] = mergeJob(out[i], j); at.set(j.url, i); continue; }
    at.set(j.url, out.length).set(fp, out.length);
    out.push({ ...j, fp });
  }
  return sortJobs(out);
}

let searchSeq = 0;

export function useJobFinder() {
  const filters = useState('filters', () => ({ ...DEFAULT_FILTERS }));
  const profile = useState('profile', () => null); // resultado da análise do CV (editável)
  const cvText = useState('cvText', () => '');
  const search = useState('search', emptySearch);
  const kanban = useState('kanban', () => ({ saved: [], applied: [], interview: [], offer: [], rejected: [] }));
  const selectedUrl = useState('selectedUrl', () => null);
  const toasts = useState('toasts', () => []);
  const info = useState('info', () => null);
  const agent = useState('agent', () => ({ url: AGENT_DEFAULT_URL, online: false, checked: false, version: null, sources: [] }));
  const auth = useState('auth', () => ({ loaded: false, mode: 'local', user: null, inviteRequired: false }));
  // Chave de IA da própria pessoa: guardada só neste navegador, enviada apenas nas chamadas de IA
  const aiKey = useState('aiKey', () => null); // { provider, key, model }

  /** Aviso temporário. `action` opcional: { label, run } (ex: Desfazer) */
  const toast = (message, kind = 'ok', action = null) => {
    const id = Date.now() + Math.random();
    toasts.value = [...toasts.value, { id, message, kind, action }];
    // Erros e avisos com ação ficam mais tempo na tela
    setTimeout(() => { toasts.value = toasts.value.filter((t) => t.id !== id); }, action || kind === 'bad' ? 6000 : 3200);
  };

  // ===== Chave de IA própria =====
  function loadAiKey() {
    try { aiKey.value = JSON.parse(localStorage.getItem('jf_ai_key') || 'null'); } catch { aiKey.value = null; }
  }
  function setAiKey(v) {
    aiKey.value = v;
    try { v ? localStorage.setItem('jf_ai_key', JSON.stringify(v)) : localStorage.removeItem('jf_ai_key'); } catch {}
  }
  /** Cabeçalhos para as rotas de IA (vazios se a pessoa não configurou chave) */
  function aiHeaders(k = aiKey.value) {
    if (!k?.key) return {};
    return { 'X-AI-Provider': k.provider, 'X-AI-Key': k.key, ...(k.model ? { 'X-AI-Model': k.model } : {}) };
  }
  /** Avisa (uma vez a cada 2 min) quando a chave da pessoa falhou e caímos para outra opção */
  let lastKeyWarn = 0;
  function checkKeyError(res) {
    if (res?.keyError && Date.now() - lastKeyWarn > 120000) {
      lastKeyWarn = Date.now();
      toast(res.keyError, 'bad');
    }
    return res;
  }

  // ===== Conta =====
  async function fetchMe() {
    try { auth.value = { ...(await $fetch('/api/auth/me')), loaded: true }; }
    catch { auth.value = { ...auth.value, loaded: true }; }
    return auth.value;
  }
  async function login(email, password) {
    await $fetch('/api/auth/login', { method: 'POST', body: { email, password } });
    return fetchMe();
  }
  async function register(data) {
    await $fetch('/api/auth/register', { method: 'POST', body: data });
    return fetchMe();
  }
  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    profile.value = null; cvText.value = ''; search.value = emptySearch();
    kanban.value = { saved: [], applied: [], interview: [], offer: [], rejected: [] };
    await fetchMe();
  }

  // ===== Dados da pessoa guardados no servidor (currículo, perfil, filtros) =====
  async function loadUserData() {
    try {
      const d = await $fetch('/api/me/data');
      if (d.filters) filters.value = { ...DEFAULT_FILTERS, ...d.filters };
      if (d.profile) profile.value = d.profile;
      if (d.cvText) cvText.value = d.cvText;
      return d;
    } catch { return null; }
  }
  let saveTimer = null;
  const pendingSave = {};
  function saveUserData(patch) {
    Object.assign(pendingSave, patch);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const body = { ...pendingSave };
      for (const k of Object.keys(pendingSave)) delete pendingSave[k];
      $fetch('/api/me/data', { method: 'PUT', body }).catch(() => {});
    }, 800);
  }

  // ===== Vagas ocultas =====
  async function hideJob(job) {
    const before = search.value.jobs;
    search.value = { ...search.value, jobs: before.filter((j) => j.url !== job.url) };
    if (selectedUrl.value === job.url) {
      const i = before.findIndex((j) => j.url === job.url);
      selectedUrl.value = (before[i + 1] || before[i - 1])?.url || null;
    }
    try {
      await $fetch('/api/hidden', { method: 'POST', body: { url: job.url, title: job.title, company: job.company } });
      toast('Vaga ocultada — ela não aparece mais nas buscas', 'ok', { label: 'Desfazer', run: () => unhideJob(job) });
    } catch (err) {
      search.value = { ...search.value, jobs: before };
      toast('Não consegui ocultar: ' + (err?.data?.message || err.message), 'bad');
    }
  }
  async function unhideJob(job) {
    await $fetch('/api/hidden', { method: 'POST', body: { url: job.url, hide: false } });
    if (job.mode && !search.value.jobs.some((j) => j.url === job.url)) {
      search.value = { ...search.value, jobs: mergeJobs(search.value.jobs, [job]) };
    }
  }

  const savedByUrl = computed(() => {
    const m = new Map();
    for (const [status, rows] of Object.entries(kanban.value)) for (const r of rows || []) m.set(r.url, { ...r, status });
    return m;
  });

  const selectedJob = computed(() => search.value.jobs.find((j) => j.url === selectedUrl.value) || null);

  async function fetchInfo() {
    try { info.value = await $fetch('/api/info'); } catch {}
  }

  /** Verifica se o agente local (Python) está rodando neste computador */
  async function checkAgent() {
    try {
      const r = await fetchTimeout(agent.value.url.replace(/\/$/, '') + '/status', {}, 1500);
      const d = await r.json();
      agent.value = { ...agent.value, online: !!d.ok, checked: true, version: d.version, sources: d.sources || [] };
    } catch {
      agent.value = { ...agent.value, online: false, checked: true };
    }
    return agent.value.online;
  }

  async function fetchKanban() {
    try { kanban.value = (await $fetch('/api/kanban')).columns; } catch {}
  }

  /**
   * Busca em duas etapas em paralelo: fontes rápidas (Gupy, empresas, Remotar...) aparecem em segundos;
   * o LinkedIn (que precisa ler descrições) chega depois e é mesclado na lista.
   */
  async function runSearch(patch = null) {
    if (patch) filters.value = { ...filters.value, ...patch };
    const seq = ++searchSeq;
    const body = {
      ...filters.value,
      keywords: profile.value?.keywords || [],
      profile: profile.value
        ? { keywords: profile.value.keywords || [], titles: profile.value.titles || [], seniority: profile.value.seniority || '' }
        : null,
    };
    search.value = { ...emptySearch(), ran: true, loadingFast: true, loadingSlow: true, loadingAgent: true, startedAt: Date.now() };

    const apply = (res) => {
      if (seq !== searchSeq) return;
      search.value = {
        ...search.value,
        jobs: mergeJobs(search.value.jobs, res.jobs || []),
        status: { ...search.value.status, ...(res.status || {}) },
        links: res.links?.length ? res.links : search.value.links,
      };
      if (!selectedUrl.value || !search.value.jobs.some((j) => j.url === selectedUrl.value)) {
        selectedUrl.value = search.value.jobs[0]?.url || null;
      }
    };
    const fail = (err) => {
      if (seq !== searchSeq) return;
      search.value = { ...search.value, error: err?.data?.message || err?.message || 'Falha de conexão' };
    };

    const fast = $fetch('/api/search', { method: 'POST', body: { ...body, exclude: ['linkedin'] } })
      .then(apply, fail)
      .finally(() => { if (seq === searchSeq) search.value = { ...search.value, loadingFast: false }; });
    const slow = $fetch('/api/search', { method: 'POST', body: { ...body, sources: ['linkedin'] } })
      .then(apply, () => {})
      .finally(() => { if (seq === searchSeq) search.value = { ...search.value, loadingSlow: false }; });

    // 3ª etapa: agente local (Indeed, Glassdoor). O navegador busca no agente e o servidor aplica o funil.
    const viaAgent = (async () => {
      if (!(await checkAgent())) return;
      // O agente busca até 4 cargos: os digitados primeiro, depois o principal de cada área
      const agentQueries = [...new Set([...(body.queries || []), ...(body.areas || []).map((id) => AREAS_BY_ID[id]?.queries[0]).filter(Boolean)])].slice(0, 4);
      const r = await fetchTimeout(agent.value.url.replace(/\/$/, '') + '/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, queries: agentQueries }),
      }, 120000);
      if (!r.ok) throw new Error('agente respondeu ' + r.status);
      const found = await r.json();
      if (seq !== searchSeq) return;
      const res = await $fetch('/api/search/external', { method: 'POST', body: { filters: body, jobs: found.jobs || [], status: found.status || {} } });
      apply(res);
    })()
      .catch((err) => {
        if (seq === searchSeq) search.value = { ...search.value, status: { ...search.value.status, agente: { ok: false, error: err.message } } };
      })
      .finally(() => { if (seq === searchSeq) search.value = { ...search.value, loadingAgent: false }; });

    await Promise.allSettled([fast, slow, viaAgent]);
  }

  async function saveJob(job, status = 'saved') {
    try {
      await $fetch('/api/kanban/update', { method: 'POST', body: { job, status } });
      await fetchKanban();
      return true;
    } catch (err) {
      toast('Não consegui salvar: ' + (err?.data?.message || err.message), 'bad');
      return false;
    }
  }

  async function removeSaved(applicationId) {
    try {
      await $fetch(`/api/kanban/${applicationId}`, { method: 'DELETE' });
      await fetchKanban();
    } catch (err) {
      toast('Não consegui remover: ' + err.message, 'bad');
    }
  }

  return {
    filters, profile, cvText, search, kanban, selectedUrl, selectedJob, savedByUrl, toasts, info, agent, auth,
    toast, fetchInfo, fetchKanban, checkAgent, runSearch, saveJob, removeSaved,
    fetchMe, login, register, logout, loadUserData, saveUserData, hideJob, unhideJob,
    aiKey, loadAiKey, setAiKey, aiHeaders, checkKeyError,
  };
}
