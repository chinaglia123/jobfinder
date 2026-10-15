// Motor de busca e agregação multi-plataformas
import { db } from './db';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';

export const norm = (s) => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const strip = (s) => (s || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function get(url, asJson = true) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: asJson ? 'application/json' : 'text/html', 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' },
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return asJson ? r.json() : r.text();
  } finally { clearTimeout(t); }
}

// ================= MODALIDADE =================
// Frases que mencionam remoto/presencial mas NÃO definem a modalidade da vaga
const NOISE_RE = /(auxilio|ajuda de custo|subsidio|kit|beneficio|vale)[^.;\n]{0,25}home ?office|home ?office[^.;\n]{0,15}(flexivel|eventual|ocasional|as sextas|1x por semana)/g;
const NEGATED_REMOTE_RE = /(nao|sem) (e |eh |sera |oferece |oferecemos |aceita |aceitamos |possui |ha |tem )?(possibilidade de )?(trabalho )?(remot|home ?office)|not (a )?remote|no remote/;
const HYBRID_RE = /hibrid|hybrid|\d ?(x|vezes|dias?) (por semana )?(no|na|ao|em|de) (escritorio|presencial|empresa|sede)|dias? presenciais|presencial \d ?(x|vezes|dias)|modelo flex|flex office/;
const REMOTE_STRONG_RE = /100% ?remot|totalmente remot|full ?remote|fully remote|remote[- ]first|100% home ?office|trabalho 100% home|remote only|remote-only|work from anywhere|trabalhe de qualquer lugar|anywhere in (the world|brazil|latam)/;
const ONSITE_RE = /100% presencial|modelo presencial|regime presencial|trabalho presencial|atuacao presencial|vaga presencial|presencialmente|on-?site|in-?office|in office|(morar|residir) (em|na|no|nas|proximo|perto)(?! (o |qualquer )?(brasil|territorio|america|latam|pais))/;
const REMOTE_WEAK_RE = /\bremot[oa]s?\b|\bremote\b|home ?office|teletrabalho|work from home|\bwfh\b|anywhere/;

function modeOf(t) {
  if (!t) return 'unknown';
  if (NEGATED_REMOTE_RE.test(t)) return 'onsite';
  if (HYBRID_RE.test(t)) return 'hybrid';
  if (REMOTE_STRONG_RE.test(t)) return 'remote';
  if (ONSITE_RE.test(t)) return 'onsite';
  if (REMOTE_WEAK_RE.test(t)) return 'remote';
  if (/\bpresencial\b/.test(t)) return 'onsite';
  return 'unknown';
}

// O título manda (ex: "Analista - Híbrido"); a descrição só decide se o título for neutro
export function classifyMode(title, desc = '') {
  const fromTitle = modeOf(norm(title).replace(NOISE_RE, ' '));
  if (fromTitle !== 'unknown') return fromTitle;
  return modeOf(norm(desc).replace(NOISE_RE, ' '));
}

const NEARBY = {
  sorocaba: ['sorocaba', 'votorantim', 'itu', 'salto', 'boituva', 'porto feliz', 'mairinque', 'aluminio', 'aracoiaba', 'ipero', 'piedade', 'salto de pirapora', 'sao roque', 'tatui', 'itapetininga', 'cerquilho', 'tiete', 'jundiai', 'indaiatuba'],
};
// Vaga aceita quem mora no Brasil? (para fontes internacionais e quadros de empresas)
const BR_GEO_RE = /brazil|brasil|latam|latin america|america latina|south america|americas|worldwide|anywhere|global|work from anywhere|(sp|rj|mg|pr|sc|rs|df|ba|pe|ce|go)|sao paulo|rio de janeiro|belo horizonte|curitiba|porto alegre|florianopolis|recife|campinas|brasilia|salvador|fortaleza/;
export function openToBrazil(location) {
  const l = norm(location).trim();
  if (!l || /^(remote|remoto|home ?office|anywhere|\(remote\))$/.test(l)) return true;
  return BR_GEO_RE.test(l);
}

export const nearList = (city) => { const c = norm(city).split(',')[0].trim(); return c ? NEARBY[c] || [c] : []; };

// ================= SINÔNIMOS / RELEVÂNCIA =================
// Cada grupo: termos equivalentes PT/EN. O primeiro termo em inglês é usado nas fontes internacionais.
const SYNONYMS = [
  ['marketing', 'mkt', 'growth', 'marketing'],
  ['crm', 'lifecycle', 'retencao', 'retention', 'relacionamento com o cliente'],
  ['seo', 'sem', 'search engine'],
  ['branding', 'brand', 'marca', 'gestao de marca'],
  ['comunicacao', 'communications', 'relacoes publicas', 'assessoria de imprensa', 'comunicacao interna'],
  ['endomarketing', 'employer branding'],
  ['trade marketing', 'merchandising', 'shopper'],
  ['inbound', 'automacao de marketing', 'marketing automation', 'email marketing', 'e-mail marketing'],
  ['midia', 'media buyer', 'planejamento de midia', 'midia programatica'],
  ['influencia', 'influencer', 'influenciadores', 'creator', 'ugc'],
  ['eventos', 'events', 'experiencias'],
  ['social media', 'midias sociais', 'redes sociais', 'community manager', 'social media'],
  ['conteudo', 'content', 'copywriter', 'copywriting', 'redator', 'redacao'],
  ['trafego', 'trafego pago', 'performance', 'paid media', 'midia paga', 'ads'],
  ['vendas', 'comercial', 'sales', 'sdr', 'bdr', 'inside sales', 'executivo de contas', 'account executive', 'pre-vendas'],
  ['atendimento', 'suporte', 'support', 'customer success', 'sucesso do cliente', 'customer service', 'customer support', 'cs'],
  ['desenvolvedor', 'developer', 'programador', 'engenheiro de software', 'software engineer', 'dev'],
  ['frontend', 'front-end', 'front end'],
  ['backend', 'back-end', 'back end'],
  ['dados', 'data', 'bi', 'analytics', 'business intelligence'],
  ['rh', 'recursos humanos', 'hr', 'people', 'gente e gestao', 'talent', 'recrutamento', 'recruiter', 'talent acquisition'],
  ['financeiro', 'finance', 'financial', 'financas', 'contabil', 'contabilidade', 'accounting', 'fiscal', 'controladoria'],
  ['administrativo', 'administrative', 'admin', 'back office', 'backoffice'],
  ['design', 'designer', 'ux', 'ui', 'product designer', 'designer grafico', 'graphic designer'],
  ['produto', 'product', 'product manager', 'product owner', 'po', 'pm'],
  ['projetos', 'project', 'pmo', 'project manager', 'gerente de projetos'],
  ['logistica', 'logistics', 'supply chain', 'suprimentos', 'compras', 'procurement'],
  ['juridico', 'legal', 'advogado', 'lawyer'],
  ['qa', 'quality assurance', 'testes', 'tester', 'qualidade'],
  ['devops', 'sre', 'infraestrutura', 'infrastructure', 'cloud'],
  ['ecommerce', 'e-commerce', 'marketplace', 'loja virtual'],
];
const SYN_INDEX = new Map();
for (const g of SYNONYMS) for (const t of g) SYN_INDEX.set(norm(t), g.map(norm));

const GENERIC = new Set('analista assistente auxiliar especialista junior pleno senior jr pl sr para com dos das nos nas coordenador coordenadora gerente supervisor tecnico tecnica pessoa estagio estagiario profissional tecnicos tecnicas the and of de da do em remoto remote home office hibrido vaga vagas analyst assistant specialist manager'.split(' '));
const WEAK = new Set('digital media executivo executiva representante'.split(' '));
const EN_GROUP_HINT = /^(marketing|growth|social media|content|copywriter|sales|support|customer success|developer|software engineer|data|analytics|hr|people|recruiter|finance|accounting|administrative|design|designer|ux|product|project|logistics|legal|qa|devops|ecommerce)$/;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const wordRe = (t) => new RegExp('(^|[^a-z0-9])' + escapeRe(t) + '([^a-z0-9]|$)');

/** Transforma as buscas do usuário em grupos de termos (com sinônimos) que a vaga precisa conter. */
export function buildMatcher(queries) {
  const groups = [];
  const seen = new Set();
  for (const q of queries) {
    const nq = norm(q);
    // Expressões de várias palavras conhecidas (ex: "social media") entram inteiras
    let rest = nq;
    for (const [term, g] of SYN_INDEX) {
      if (/[\s-]/.test(term) && wordRe(term).test(rest)) {
        const key = g[0];
        if (!seen.has(key)) { seen.add(key); groups.push({ key, terms: g, strong: true }); }
        rest = rest.replace(term, ' ');
      }
    }
    for (const w of rest.split(/[\s/,()-]+/)) {
      if (w.length < 2 || GENERIC.has(w)) continue;
      if (w.length < 3 && !SYN_INDEX.has(w)) continue;
      const g = SYN_INDEX.get(w) || [w];
      const key = g[0];
      if (seen.has(key)) continue;
      seen.add(key);
      groups.push({ key, terms: g, strong: !WEAK.has(w) });
    }
  }
  const regexes = groups.map((g) => ({ ...g, res: g.terms.map(wordRe) }));
  const strong = regexes.filter((g) => g.strong);
  return {
    groups: regexes,
    terms: groups.map((g) => g.key),
    /** Quantos grupos fortes aparecem no texto */
    hits(text) {
      const t = norm(text);
      return strong.filter((g) => g.res.some((r) => r.test(t))).length;
    },
    /** Termos em inglês para fontes internacionais (Jobicy, Remotive) */
    english() {
      const out = [];
      for (const g of strong) out.push(g.terms.find((t) => EN_GROUP_HINT.test(t)) || g.terms[0]);
      return [...new Set(out)];
    },
  };
}

// ================= CARGOS RELACIONADOS =================
// Quando a busca é de uma área conhecida, também procuramos cargos vizinhos (mais variedade).
const RELATED = {
  marketing: ['marketing digital', 'social media', 'growth marketing', 'tráfego pago', 'CRM', 'inbound marketing', 'marketing de conteúdo', 'SEO', 'branding', 'comunicação', 'e-mail marketing', 'marketing de produto', 'trade marketing', 'endomarketing', 'copywriter', 'mídia paga'],
  'social media': ['social media', 'redes sociais', 'community manager', 'marketing de conteúdo', 'influencer marketing'],
  vendas: ['inside sales', 'SDR', 'executivo de contas', 'pré-vendas', 'customer success', 'comercial'],
  atendimento: ['customer success', 'suporte', 'SAC', 'experiência do cliente', 'customer service'],
  desenvolvedor: ['frontend', 'backend', 'fullstack', 'software engineer', 'programador'],
  dados: ['analista de BI', 'cientista de dados', 'engenheiro de dados', 'analytics', 'analista de dados'],
  rh: ['recrutamento', 'talent acquisition', 'business partner', 'departamento pessoal', 'people'],
  design: ['UX designer', 'UI designer', 'product designer', 'designer gráfico', 'motion designer'],
  financeiro: ['contabilidade', 'fiscal', 'controladoria', 'FP&A', 'contas a pagar'],
  administrativo: ['assistente administrativo', 'back office', 'auxiliar administrativo', 'secretária'],
  produto: ['product manager', 'product owner', 'product ops'],
  projetos: ['gerente de projetos', 'PMO', 'analista de projetos', 'scrum master'],
};

/** Cargos relacionados às buscas (sem repetir o que a pessoa já digitou). */
export function relatedQueries(queries, max = 8) {
  const typed = new Set(queries.map(norm));
  const groups = buildMatcher(queries).groups.filter((g) => g.strong).map((g) => g.key);
  const out = [];
  for (const k of groups) for (const r of RELATED[k] || []) {
    if (!typed.has(norm(r)) && !out.some((x) => norm(x) === norm(r))) out.push(r);
  }
  return out.slice(0, max);
}

/** Plano de consultas: buscas digitadas com várias páginas, relacionadas só com a primeira. */
export function queryPlan(f, pages, maxTyped = 5) {
  return [
    ...f.queries.slice(0, maxTyped).flatMap((q) => pages.map((page) => ({ q, page }))),
    ...(f.related || []).map((q) => ({ q, page: pages[0], related: true })),
  ];
}

// ================= IDIOMA E CONTRATO =================
const PT_RE = /\b(de|da|do|das|dos|para|com|voce|vaga|experiencia|conhecimento|empresa|nao|sera|atuar|requisitos|beneficios|analista|assistente|estagio|pleno|junior|senior|desejavel|trabalho|area)\b/g;
const EN_RE = /\b(the|and|with|you|your|our|we|of|for|experience|skills|team|role|will|requirements|benefits|work|ability|analyst|manager|engineer)\b/g;
const ES_RE = /\b(el|los|las|del|con|una|experiencia|trabajo|empresa|buscamos|requisitos|beneficios|conocimientos|deseable|ofrecemos|y)\b/g;

/** Idioma da vaga ('pt' | 'en' | 'es' | 'unknown'), pelo título e começo da descrição. */
export function detectLang(title, desc = '') {
  const raw = `${title} ${String(desc).slice(0, 1500)}`.toLowerCase();
  // Acentuação típica do português (o espanhol usa "ción" e "ñ")
  if (/ção|ções|ão\b|õe|você/.test(raw) && !/ción|ciones|ñ/.test(raw)) return 'pt';
  const t = norm(raw);
  const pt = (t.match(PT_RE) || []).length;
  const en = (t.match(EN_RE) || []).length;
  const es = (t.match(ES_RE) || []).length + (/ción|ñ/.test(raw) ? 3 : 0);
  const best = Math.max(pt, en, es);
  if (best < 2) return 'unknown';
  return best === pt ? 'pt' : best === en ? 'en' : 'es';
}

/** Tipos de contrato citados no título/etiquetas/descrição (pode haver mais de um). */
export function detectContract(title, tags = [], desc = '') {
  const head = norm(`${title} ${tags.join(' ')}`);
  const t = norm(`${title} ${tags.join(' ')} ${String(desc).slice(0, 2500)}`);
  const out = [];
  if (/\b(estagi\w*|intern(ship)?|jovem aprendiz|trainee)\b/.test(head)) out.push('estagio');
  if (/\bpj\b|pessoa juridica|\bcontractor\b/.test(t)) out.push('pj');
  if (/\bclt\b|carteira assinada|\befetivo\b/.test(t)) out.push('clt');
  if (/\bfreela\w*|\bfreelance\w*|\bautonomo\b|por projeto/.test(t)) out.push('freela');
  if (/\btemporari\w*|\btemporary\b/.test(t)) out.push('temporario');
  return out;
}

// ================= CACHE DE DETALHES (SQLite) =================
const getDetail = (source, id, since) =>
  db.get('SELECT mode, applicants, description FROM job_details WHERE source = ? AND ext_id = ? AND fetched_at > ?', [source, String(id), since]);
const putDetail = (source, id, mode, applicants, description) =>
  db.run(`INSERT INTO job_details (source, ext_id, mode, applicants, description, fetched_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(source, ext_id) DO UPDATE SET mode = excluded.mode, applicants = excluded.applicants, description = excluded.description, fetched_at = excluded.fetched_at`,
  [source, String(id), mode, applicants, description, Date.now()]);
const DETAIL_TTL = 3 * 864e5;

// ================= LINKEDIN =================
async function liFetch(url) {
  try { return await get(url, false); }
  catch (e) { if (!/429/.test(e.message)) throw e; await sleep(5000); return get(url, false); }
}

function parseApplicants(s) {
  if (!s) return null;
  const n = Number((s.match(/\d+/) || [])[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseLinkedInCards(html) {
  const out = [];
  for (const li of html.split(/<li[ >]/).slice(1)) {
    const url = (li.match(/base-card__full-link[^>]*href="([^"?]+)/) || [])[1];
    const title = strip((li.match(/base-search-card__title[^>]*>([\s\S]*?)<\/h3>/) || [])[1]);
    const id = (li.match(/jobPosting:(\d+)/) || [])[1];
    if (!url || !title) continue;
    out.push({
      id, title, url,
      company: strip((li.match(/base-search-card__subtitle[^>]*>([\s\S]*?)<\/h4>/) || [])[1]),
      location: strip((li.match(/job-search-card__location[^>]*>([\s\S]*?)<\/span>/) || [])[1]),
      date: (li.match(/datetime="([^"]+)"/) || [])[1] || null,
      mode: classifyMode(title),
      verified: false,
      tags: [],
    });
  }
  return out;
}

/** Baixa a descrição completa de uma vaga do LinkedIn (com cache). */
export async function linkedInDetail(id) {
  const c = await getDetail('linkedin', id, Date.now() - DETAIL_TTL);
  if (c) return { mode: c.mode, applicants: c.applicants, desc: c.description || '', cached: true };
  const html = await liFetch('https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/' + id);
  const desc = strip((html.match(/show-more-less-html__markup[^>]*>([\s\S]*?)<\/div>/) || [])[1] || '');
  const applicants = parseApplicants(strip((html.match(/num-applicants__caption[^>]*>([\s\S]*?)<\/(span|figcaption)>/) || [])[1]));
  const info = { mode: classifyMode('', desc), applicants, desc, cached: false };
  await putDetail('linkedin', id, info.mode, applicants, desc.slice(0, 8000));
  return info;
}

/**
 * Confirma modalidade/candidaturas lendo a descrição. O LinkedIn bloqueia (429) com requisições
 * paralelas, então vai uma por vez, das vagas mais relevantes para as menos, até o limite de tempo.
 */
export async function verifyLinkedIn(jobs, { maxFetch = 40, budgetMs = 45000 } = {}) {
  let fetched = 0, cached = 0, blocked = false;
  const start = Date.now();
  const list = jobs.filter((j) => j.source === 'LinkedIn' && j.id).sort((a, b) => (b.score || 0) - (a.score || 0));
  for (const j of list) {
    const fromCache = await getDetail('linkedin', j.id, Date.now() - DETAIL_TTL);
    if (!fromCache && (blocked || fetched >= maxFetch || Date.now() - start > budgetMs)) continue;
    try {
      const info = await linkedInDetail(j.id);
      if (info.cached) cached++; else fetched++;
      j.mode = classifyMode(j.title, info.desc);
      j.applicants = info.applicants;
      j.desc = info.desc;
      j.verified = j.mode !== 'unknown';
      j.checked = true;
      if (!info.cached) await sleep(900);
    } catch { blocked = true; }
  }
  return { fetched, cached, blocked, pending: list.filter((j) => !j.checked).length };
}

// ================= FONTES =================
const pool = async (items, n, fn) => {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
};

// Remotar: a busca é por texto livre (casa com a descrição), então puxamos várias páginas
export const SOURCES = {
  remotar: { label: 'Remotar', regions: ['br'], async run(f) {
    const reqs = queryPlan(f, [1, 2, 3]);
    const pages = await pool(reqs, 4, async ({ q, page }) => {
      try { return (await get(`https://api.remotar.com.br/jobs?search=${encodeURIComponent(q)}&page=${page}`)).data || []; }
      catch { return []; }
    });
    return pages.flat().map((j) => {
      const desc = strip(j.description || j.subtitle || '');
      const t = norm(j.type || '');
      const mode = t === 'remote' ? 'remote' : t === 'hybrid' ? 'hybrid' : /presen|onsite|office/.test(t) ? 'onsite' : classifyMode(j.title, desc);
      return {
        title: j.title,
        company: j.company?.name || j.companyDisplayName || 'Empresa confidencial',
        url: j.externalLink || `https://remotar.com.br/job/${j.id}`,
        location: mode === 'remote' ? 'Remoto (Brasil)' : [j.city, j.state].filter(Boolean).join('/'),
        date: j.createdAt,
        mode,
        verified: mode !== 'unknown',
        desc,
        tags: [...(j.jobTags || []).map((t) => t.tag?.name), ...(j.jobCategories || []).map((c) => c.category?.name || c.name)].filter(Boolean),
      };
    });
  } },
  trampos: { label: 'Trampos.co', regions: ['br'], async run(f) {
    const reqs = queryPlan(f, [1, 2, 3]);
    const pages = await pool(reqs, 4, async ({ q, page }) => {
      try { return (await get(`https://trampos.co/api/v2/opportunities?tr=${encodeURIComponent(q)}&page=${page}`)).opportunities || []; }
      catch { return []; }
    });
    return pages.flat().map((j) => {
      const mode = j.home_office ? 'remote' : j.hybrid ? 'hybrid' : 'onsite';
      return {
        title: j.name,
        company: j.custom_company_name || j.company?.name || 'Confidencial',
        url: `https://trampos.co/oportunidades/${j.id}`,
        location: mode === 'remote' ? 'Remoto (Brasil)' : [j.city, j.state].filter(Boolean).join('/'),
        date: j.published_at,
        mode,
        verified: true,
        tags: [j.category_name, j.type_name].filter(Boolean),
      };
    });
  } },
  linkedin: { label: 'LinkedIn', regions: ['br', 'world'], async run(f) {
    const br = f.region === 'br';
    const country = br ? { location: 'Brasil', geoId: '106057199' } : { location: 'Worldwide' };
    const plans = [];
    for (const q of f.queries.slice(0, 4)) {
      if (f.workMode !== 'any') plans.push({ keywords: `${q} ${br ? 'remoto' : 'remote'}`, ...country });
      if (f.workMode === 'remote_hybrid' && f.location) plans.push({ keywords: q, location: f.location });
      if (f.workMode === 'any') plans.push({ keywords: q, ...(f.location ? { location: f.location } : country) });
    }
    const out = [];
    for (const [i, pl] of plans.entries()) {
      const p = new URLSearchParams(pl);
      if (f.days) p.set('f_TPR', 'r' + f.days * 86400);
      // A página pública traz ~60 vagas de uma vez (a API "seeMore" traz só 10)
      let html;
      try { html = await liFetch('https://www.linkedin.com/jobs/search?' + p); }
      catch (e) { if (out.length) break; throw e; }
      out.push(...parseLinkedInCards(html));
      if (i < plans.length - 1) await sleep(1000);
    }
    return out;
  } },
  remotive: { label: 'Remotive', regions: ['br', 'world'], async run(f) {
    const terms = f.matcher.english().slice(0, 4);
    const res = await pool(terms.length ? terms : f.queries.slice(0, 2), 3, async (q) => {
      try { return (await get('https://remotive.com/api/remote-jobs?limit=100&search=' + encodeURIComponent(q))).jobs || []; }
      catch { return []; }
    });
    return res.flat().map((j) => ({ title: j.title, company: j.company_name, url: j.url, location: j.candidate_required_location || 'Remote', date: j.publication_date, mode: 'remote', verified: true, geoCheck: true, desc: strip(j.description || '').slice(0, 3000), tags: [j.category, ...(j.tags || [])] }));
  } },
  // Gupy: maior ATS do Brasil. A API do portal aceita filtro de modalidade e já traz a descrição.
  gupy: { label: 'Gupy', regions: ['br'], async run(f) {
    const types = f.workMode === 'remote' ? ['remote'] : f.workMode === 'remote_hybrid' ? ['remote', 'hybrid'] : [''];
    const reqs = queryPlan(f, [0, 100]).flatMap(({ q, page }) => types.map((t) => ({ q, t, offset: page })));
    const pages = await pool(reqs, 4, async ({ q, t, offset }) => {
      try {
        const u = `https://portal.gupy.io/api/job-search/jobs?jobName=${encodeURIComponent(q)}&limit=100&offset=${offset}` + (t ? `&workplaceType=${t}` : '');
        return (await get(u)).data || [];
      } catch { return []; }
    });
    const TYPE_TAG = { vacancy_type_internship: 'Estágio', vacancy_legal_entity: 'PJ', vacancy_type_temporary: 'Temporária', vacancy_type_apprentice: 'Jovem Aprendiz', vacancy_type_autonomous: 'Autônomo', vacancy_type_associate: 'Associado', vacancy_type_effective: 'CLT' };
    return pages.flat().filter((j) => j.type !== 'vacancy_type_talent_pool').map((j) => {
      const mode = j.workplaceType === 'remote' ? 'remote' : j.workplaceType === 'hybrid' ? 'hybrid' : j.workplaceType === 'on-site' ? 'onsite' : classifyMode(j.name, j.description);
      return {
        title: j.name,
        company: j.careerPageName || 'Empresa (Gupy)',
        url: (j.jobUrl || '').split('?')[0],
        location: mode === 'remote' ? 'Remoto (Brasil)' : [j.city, j.state].filter(Boolean).join('/'),
        date: j.publishedDate,
        mode,
        verified: mode !== 'unknown',
        desc: strip(j.description || '').slice(0, 6000),
        tags: [TYPE_TAG[j.type], j.badges?.isPWD || j.disabilities ? 'PcD' : null].filter(Boolean),
      };
    });
  } },
  // Vagas.com: um dos maiores portais brasileiros (HTML público)
  vagascom: { label: 'Vagas.com', regions: ['br'], async run(f) {
    const remote = f.workMode !== 'any';
    const slug = (q) => norm(q).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const reqs = queryPlan(f, [1, 2]).flatMap(({ q, page }) => [
      ...(remote ? [{ q, page, ho: true }] : []),
      ...(f.workMode !== 'remote' ? [{ q, page, ho: false }] : []),
    ]);
    const pages = await pool(reqs, 3, async ({ q, page, ho }) => {
      const params = new URLSearchParams({ q });
      if (page > 1) params.set('pagina', String(page));
      if (ho) params.append('m[]', '100% Home Office');
      try {
        const html = await get(`https://www.vagas.com.br/vagas-de-${slug(q)}?${params}`, false);
        return (html.match(/<li class="vaga[\s\S]*?<\/li>/g) || []).map((li) => ({ li, ho }));
      } catch { return []; }
    });
    return pages.flat().map(({ li, ho }) => {
      const a = li.match(/class="link-detalhes-vaga"[^>]*title="([^"]+)"[^>]*href="([^"]+)"/) || [];
      const desc = strip((li.match(/<div class="detalhes">([\s\S]*?)<\/div>/) || [])[1]).replace(/^Descrição:\s*/, '');
      const local = strip((li.match(/class="vaga-local">([\s\S]*?)<div class="tooltip/) || [])[1]);
      const anyCity = /qualquer cidade do brasil/i.test(li);
      const d = li.match(/data-publicacao[^>]*>[\s\S]*?(\d{2})\/(\d{2})\/(\d{4})/) || [];
      const title = strip(a[1]);
      const mode = ho ? 'remote' : classifyMode(title, desc);
      return {
        title,
        url: a[2] ? 'https://www.vagas.com.br' + a[2] : '',
        company: strip((li.match(/class="emprVaga">([\s\S]*?)<\/span>/) || [])[1]) || 'Empresa (Vagas.com)',
        location: mode === 'remote' ? 'Remoto (Brasil)' : local + (anyCity ? ' · aceita todo o Brasil' : ''),
        date: d[3] ? `${d[3]}-${d[2]}-${d[1]}` : null,
        mode, verified: mode !== 'unknown', desc,
        tags: [strip((li.match(/class="nivelVaga">([\s\S]*?)<\/span>/) || [])[1])].filter(Boolean),
      };
    }).filter((j) => j.title && j.url);
  } },
  // InfoJobs: portal brasileiro com filtro próprio de home office
  infojobs: { label: 'InfoJobs', regions: ['br'], async run(f) {
    const remote = f.workMode !== 'any';
    const enc = (q) => norm(q).replace(/[^a-z0-9]+/g, '+').replace(/^\+|\+$/g, '');
    const reqs = queryPlan(f, [1, 2], 4);
    const pages = await pool(reqs, 3, async ({ q, page }) => {
      const url = `https://www.infojobs.com.br/vagas-de-emprego-${enc(q)}${remote ? '-trabalho-home-office' : ''}.aspx${page > 1 ? `?page=${page}` : ''}`;
      try { return (await get(url, false)).split('js_rowCard').slice(1); } catch { return []; }
    });
    const dec = (s) => strip(String(s || '').replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16))));
    return pages.flat().map((c) => {
      const href = (c.match(/data-href="([^"]+)"/) || [])[1];
      const title = dec((c.match(/js_vacancyTitle[^>]*>([\s\S]*?)<\/h2>/) || [])[1]);
      const companyHtml = (c.match(/<a class="text-body text-decoration-none"[^>]*>([\s\S]*?)<\/a>/) || [])[1] || '';
      const company = dec(companyHtml.split('<span onclick')[0] + ' ' + ((companyHtml.match(/<span class="text-nowrap">\s*([^<]*)/) || [])[1] || ''));
      const location = dec((c.match(/<div class="mb-8">([\s\S]*?)<\/div>/) || [])[1]);
      const text = dec(c);
      const work = (text.match(/\b(Home office|Híbrido|Presencial)\b/i) || [])[1] || '';
      const mode = /home/i.test(work) ? 'remote' : /h[ií]brido/i.test(work) ? 'hybrid' : /presencial/i.test(work) ? 'onsite' : classifyMode(title);
      const dt = c.match(/js_date" data-value="(\d{4})\/(\d{2})\/(\d{2})/) || [];
      const salary = (text.match(/R\$ ?[\d.,]+/) || [])[0];
      return {
        title,
        url: href ? 'https://www.infojobs.com.br' + href : '',
        company: company || 'Empresa (InfoJobs)',
        location: mode === 'remote' ? 'Remoto (Brasil)' : location,
        date: dt[1] ? `${dt[1]}-${dt[2]}-${dt[3]}` : null,
        mode, verified: mode !== 'unknown',
        desc: dec((c.match(/<div class="text-medium">([\s\S]*?)<\/div>/) || [])[1]),
        tags: [salary].filter(Boolean),
      };
    }).filter((j) => j.title && j.url);
  } },
  // Himalayas: vagas remotas de empresas do mundo todo, filtradas pelas que aceitam quem mora no Brasil
  himalayas: { label: 'Himalayas', regions: ['br', 'world'], async run(f) {
    const terms = f.matcher.english().slice(0, 4);
    const country = f.region === 'br' ? '&country=Brazil' : '';
    const reqs = (terms.length ? terms : f.queries.slice(0, 2)).flatMap((q) => [1, 2, 3].map((page) => ({ q, page })));
    const pages = await pool(reqs, 3, async ({ q, page }) => {
      try { return (await get(`https://himalayas.app/jobs/api/search?q=${encodeURIComponent(q)}${country}&limit=20&page=${page}`)).jobs || []; }
      catch { return []; }
    });
    return pages.flat().map((j) => {
      const locs = j.locationRestrictions || [];
      const br = locs.includes('Brazil');
      return {
        title: j.title,
        company: j.companyName,
        url: j.applicationLink,
        location: !locs.length ? 'Remoto (mundo todo)' : br ? (locs.length === 1 ? 'Remoto (Brasil)' : `Remoto (Brasil + ${locs.length - 1} países)`) : locs.slice(0, 3).join(', '),
        date: j.pubDate ? new Date(j.pubDate * 1000).toISOString() : null,
        mode: 'remote',
        verified: true,
        desc: strip(j.description || j.excerpt || '').slice(0, 6000),
        tags: ['Empresa internacional', ...(j.seniority || []), j.employmentType].filter(Boolean),
      };
    });
  } },
  // Get on Board: vagas de tecnologia/negócios na América Latina (muitas remotas para a região)
  getonbrd: { label: 'Get on Board', regions: ['br', 'world'], async run(f) {
    const terms = [...new Set([...f.matcher.english().slice(0, 3), ...f.queries.slice(0, 2)])];
    const res = await pool(terms, 3, async (q) => {
      try { return (await get(`https://www.getonbrd.com/api/v0/search/jobs?query=${encodeURIComponent(q)}&per_page=50&expand=["company"]`)).data || []; }
      catch { return []; }
    });
    return res.flat().map((d) => {
      const a = d.attributes || {};
      const mode = a.remote_modality === 'fully_remote' || a.remote_modality === 'remote_local' ? 'remote' : a.remote_modality === 'hybrid' ? 'hybrid' : a.remote ? 'remote' : 'onsite';
      const countries = (a.countries || []).filter((c) => c !== 'Remote');
      return {
        title: a.title,
        company: a.company?.data?.attributes?.name || 'Empresa (Get on Board)',
        url: d.links?.public_url,
        location: mode === 'remote' && !countries.length ? 'Remoto (América Latina)' : countries.join(', ') || 'Remote',
        date: a.published_at ? new Date(a.published_at * 1000).toISOString() : null,
        mode,
        verified: true,
        geoCheck: true,
        desc: strip([a.description, a.functions, a.desirable].join(' ')).slice(0, 6000),
        tags: [a.category_name, a.modality?.data?.attributes?.name].filter(Boolean),
      };
    });
  } },
  jobicy: { label: 'Jobicy', regions: ['br', 'world'], async run(f) {
    // Jobicy só entende tags simples em inglês ("marketing", "sales")
    const tags = f.matcher.english().filter((t) => !t.includes(' ')).slice(0, 4);
    const res = await pool(tags.length ? tags : [''], 3, async (tag) => {
      try { return (await get('https://jobicy.com/api/v2/remote-jobs?count=50' + (tag ? '&tag=' + encodeURIComponent(tag) : ''))).jobs || []; }
      catch { return []; }
    });
    return res.flat().map((j) => ({ title: j.jobTitle, company: j.companyName, url: j.url, location: j.jobGeo || 'Remote', date: j.pubDate, mode: 'remote', verified: true, geoCheck: true, desc: strip(j.jobExcerpt || j.jobDescription || '').slice(0, 3000), tags: [].concat(j.jobIndustry || [], j.jobType || []) }));
  } },
};

export function searchLinks(f) {
  const q = encodeURIComponent(f.queries[0] || ''), l = encodeURIComponent(f.location || '');
  const br = f.region === 'br', remote = f.workMode !== 'any';
  const days = f.days || '';
  return [
    { name: 'LinkedIn (Vagas)', url: `https://www.linkedin.com/jobs/search/?keywords=${q}&location=${br ? 'Brasil' : 'Worldwide'}${remote ? '&f_WT=2%2C3' : ''}${days ? '&f_TPR=r' + days * 86400 : ''}` },
    { name: 'Indeed', url: br ? `https://br.indeed.com/jobs?q=${q}${remote ? '+home+office' : ''}&l=${remote ? '' : l}${days ? '&fromage=' + days : ''}` : `https://www.indeed.com/jobs?q=${q}&l=${remote ? 'Remote' : l}${days ? '&fromage=' + days : ''}` },
    { name: 'Gupy (remoto)', url: `https://portal.gupy.io/job-search/term=${q}${remote ? '&workplaceTypes[]=remote&workplaceTypes[]=hybrid' : ''}` },
    { name: 'Vagas.com (home office)', url: `https://www.vagas.com.br/vagas-de-${q}${remote ? '?m%5B%5D=100%25+Home+Office' : ''}` },
    { name: 'Catho', url: `https://www.catho.com.br/vagas/${q}/${remote ? '?work_model[0]=remote' : ''}` },
    { name: 'InfoJobs', url: `https://www.infojobs.com.br/empregos.aspx?palavra=${q}${remote ? '&tipotrabalho=4' : ''}` },
    { name: 'Google Vagas', url: `https://www.google.com/search?q=${q}+${remote ? 'home+office' : 'vagas+' + l}&ibp=htl;jobs` },
    { name: 'Remotar', url: `https://remotar.com.br/search/jobs?q=${q}` },
    { name: 'We Work Remotely', url: `https://weworkremotely.com/remote-jobs/search?term=${q}` },
  ];
}
