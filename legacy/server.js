// Buscador de Empregos com IA — servidor sem dependências (Node 18+)
const http = require('http');
const fs = require('fs');
const path = require('path');

// ---- .env simples ----
try {
  for (const l of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}
const PORT = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';
const norm = (s) => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const strip = (s) => (s || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

async function get(url, asJson = true) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: asJson ? 'application/json' : 'text/html' }, signal: ctrl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return asJson ? r.json() : r.text();
  } finally { clearTimeout(t); }
}

// ================= FONTES =================
// f = { queries[], keywords[], region 'br'|'world', workMode 'remote'|'remote_hybrid'|'any', location, days, fewApplicants, includeUnconfirmed }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Classifica a modalidade a partir de um texto (título/descrição)
function classifyMode(text) {
  const t = norm(text);
  if (/100% remot|totalmente remot|full ?remote|fully remote|trabalho 100% home|100% home ?office/.test(t)) return 'remote';
  if (/hibrid|hybrid/.test(t)) return 'hybrid';
  if (/100% presencial|modelo presencial|regime presencial|trabalho presencial|atuacao presencial|on-?site/.test(t)) return 'onsite';
  if (/remot|home ?office|anywhere|teletrabalho/.test(t)) return 'remote';
  if (/presencial/.test(t)) return 'onsite';
  return 'unknown';
}

// Cidades próximas (para "híbrido na minha cidade")
const NEARBY = {
  sorocaba: ['sorocaba', 'votorantim', 'itu', 'salto', 'boituva', 'porto feliz', 'mairinque', 'aluminio', 'aracoiaba', 'ipero', 'piedade', 'salto de pirapora', 'sao roque', 'tatui', 'itapetininga', 'cerquilho', 'tiete', 'jundiai', 'indaiatuba'],
};
const nearList = (city) => { const c = norm(city).split(',')[0].trim(); return c ? NEARBY[c] || [c] : []; };

const liCache = new Map(); // id -> { mode, applicants }
async function liFetch(url) {
  try { return await get(url, false); }
  catch (e) { if (!/429/.test(e.message)) throw e; await sleep(4000); return get(url, false); }
}
function parseApplicants(s) {
  if (!s) return null;
  const n = Number((s.match(/\d+/) || [])[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const SOURCES = {
  remotar: { label: 'Remotar', regions: ['br'], async run(f) {
    const out = [];
    for (const q of f.queries.slice(0, 4)) {
      for (const page of [1, 2]) {
        const d = await get(`https://api.remotar.com.br/jobs?search=${encodeURIComponent(q)}&page=${page}`);
        for (const j of d.data || []) {
          const mode = j.type === 'remote' ? 'remote' : j.type === 'hybrid' ? 'hybrid' : classifyMode(j.type || '');
          out.push({
            title: j.title, company: j.company?.name || j.companyDisplayName || '',
            url: j.externalLink || `https://remotar.com.br/job/${j.id}`,
            location: mode === 'remote' ? 'Remoto (Brasil)' : [j.city, j.state].filter(Boolean).join('/'),
            date: j.createdAt, mode, desc: strip(j.subtitle || ''), tags: (j.jobTags || []).map((t) => t.tag?.name),
          });
        }
        if (!d.meta || d.meta.last_page <= page) break;
      }
    }
    return out;
  } },
  trampos: { label: 'Trampos.co', regions: ['br'], async run(f) {
    const out = [];
    for (const q of f.queries.slice(0, 4)) {
      for (const page of [1, 2, 3]) {
        const d = await get(`https://trampos.co/api/v2/opportunities?tr=${encodeURIComponent(q)}&page=${page}`);
        for (const j of d.opportunities || []) {
          const mode = j.home_office ? 'remote' : j.hybrid ? 'hybrid' : 'onsite';
          out.push({
            title: j.name, company: j.custom_company_name || j.company?.name || '',
            url: `https://trampos.co/oportunidades/${j.id}`,
            location: mode === 'remote' ? 'Remoto (Brasil)' : [j.city, j.state].filter(Boolean).join('/'),
            date: j.published_at, mode, tags: [j.category_name, j.type_name],
          });
        }
        if (!(d.opportunities || []).length) break;
      }
    }
    return out;
  } },
  linkedin: { label: 'LinkedIn', regions: ['br', 'world'], async run(f) {
    const out = [], br = f.region === 'br';
    const plans = [];
    for (const q of f.queries.slice(0, 3)) {
      if (f.workMode !== 'any') plans.push({ keywords: `${q} ${br ? 'remoto' : 'remote'}`, location: br ? 'Brazil' : 'Worldwide' });
      if (f.workMode === 'remote_hybrid' && f.location) plans.push({ keywords: q, location: f.location, distance: '40' });
      if (f.workMode === 'any') plans.push({ keywords: q, location: f.location || (br ? 'Brazil' : 'Worldwide') });
    }
    for (const [i, pl] of plans.entries()) {
      const p = new URLSearchParams({ ...pl, start: '0' });
      if (f.days) p.set('f_TPR', 'r' + f.days * 86400);
      let html;
      try { html = await liFetch('https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?' + p); }
      catch (e) { if (out.length) break; throw e; }
      for (const li of html.split('<li>').slice(1)) {
        const url = (li.match(/base-card__full-link[^>]*href="([^"?]+)/) || [])[1];
        const title = strip((li.match(/base-search-card__title[^>]*>([\s\S]*?)<\/h3>/) || [])[1]);
        const id = (li.match(/jobPosting:(\d+)/) || [])[1];
        if (!url || !title) continue;
        out.push({
          id, title, url,
          company: strip((li.match(/base-search-card__subtitle[^>]*>([\s\S]*?)<\/h4>/) || [])[1]),
          location: strip((li.match(/job-search-card__location[^>]*>([\s\S]*?)<\/span>/) || [])[1]),
          date: (li.match(/datetime="([^"]+)"/) || [])[1] || null,
          mode: classifyMode(title), tags: [],
        });
      }
      if (i < plans.length - 1) await sleep(1500);
    }
    return out;
  } },
  remotive: { label: 'Remotive', regions: ['world'], async run(f) {
    const out = [];
    for (const q of f.queries.slice(0, 3)) {
      const d = await get('https://remotive.com/api/remote-jobs?limit=40&search=' + encodeURIComponent(q));
      for (const j of d.jobs || []) out.push({ title: j.title, company: j.company_name, url: j.url, location: j.candidate_required_location || 'Remote', date: j.publication_date, mode: 'remote', tags: [j.category, ...(j.tags || [])] });
    }
    return out;
  } },
  remoteok: { label: 'RemoteOK', regions: ['world'], async run() {
    const d = await get('https://remoteok.com/api');
    return d.filter((j) => j.position).map((j) => ({ title: j.position, company: j.company, url: j.url, location: j.location || 'Remote', date: j.date, mode: 'remote', tags: j.tags || [] }));
  } },
  arbeitnow: { label: 'Arbeitnow', regions: ['world'], async run() {
    const d = await get('https://www.arbeitnow.com/api/job-board-api');
    return (d.data || []).map((j) => ({ title: j.title, company: j.company_name, url: j.url, location: j.location, date: new Date(j.created_at * 1000).toISOString(), mode: j.remote ? 'remote' : 'onsite', tags: j.tags || [] }));
  } },
  jobicy: { label: 'Jobicy', regions: ['world'], async run(f) {
    const d = await get('https://jobicy.com/api/v2/remote-jobs?count=50&tag=' + encodeURIComponent(f.queries[0] || ''));
    return (d.jobs || []).map((j) => ({ title: j.jobTitle, company: j.companyName, url: j.url, location: j.jobGeo || 'Remote', date: j.pubDate, mode: 'remote', tags: [].concat(j.jobIndustry || []) }));
  } },
};

// Abre a página de cada vaga do LinkedIn para confirmar modalidade e nº de candidatos
async function verifyLinkedIn(jobs, max = 35) {
  let checked = 0, blocked = false;
  await sleep(2500);
  for (const j of jobs) {
    if (j.source !== 'LinkedIn' || !j.id) continue;
    if (liCache.has(j.id)) { Object.assign(j, liCache.get(j.id), { verified: true }); continue; }
    if (blocked || checked >= max) continue;
    try {
      const html = await liFetch('https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/' + j.id);
      const desc = strip((html.match(/show-more-less-html__markup[^>]*>([\s\S]*?)<\/div>/) || [])[1] || html);
      const mode = classifyMode(j.title + ' ' + desc);
      const applicants = parseApplicants(strip((html.match(/num-applicants__caption[^>]*>([\s\S]*?)<\/(span|figcaption)>/) || [])[1]));
      const info = { mode: mode === 'unknown' ? j.mode : mode, applicants };
      liCache.set(j.id, info); Object.assign(j, info, { verified: true });
      checked++;
      await sleep(1500);
    } catch { blocked = true; }
  }
  return { checked, blocked };
}

// Plataformas sem API pública (bloqueiam scraping): geramos links de busca prontos.
function searchLinks(f) {
  const q = encodeURIComponent(f.queries[0] || ''), l = encodeURIComponent(f.location || '');
  const br = f.region === 'br', remote = f.workMode !== 'any';
  const days = f.days || '';
  return [
    { name: 'LinkedIn (logado, filtro remoto real)', url: `https://www.linkedin.com/jobs/search/?keywords=${q}&location=${br ? 'Brasil' : 'Worldwide'}${remote ? '&f_WT=2%2C3' : ''}${days ? '&f_TPR=r' + days * 86400 : ''}&f_EA=true` },
    { name: 'Indeed', url: br ? `https://br.indeed.com/jobs?q=${q}${remote ? '+home+office' : ''}&l=${remote ? '' : l}${days ? '&fromage=' + days : ''}` : `https://www.indeed.com/jobs?q=${q}&l=${remote ? 'Remote' : l}${days ? '&fromage=' + days : ''}` },
    { name: 'Gupy (remoto)', url: `https://portal.gupy.io/job-search/term=${q}${remote ? '&workplaceTypes[]=remote&workplaceTypes[]=hybrid' : ''}` },
    { name: 'Vagas.com (home office)', url: `https://www.vagas.com.br/vagas-de-${q}${remote ? '?m%5B%5D=100%25+Home+Office' : ''}` },
    { name: 'Catho (home office)', url: `https://www.catho.com.br/vagas/${q}/${remote ? '?work_model[0]=remote' : ''}` },
    { name: 'InfoJobs', url: `https://www.infojobs.com.br/empregos.aspx?palavra=${q}${remote ? '&tipotrabalho=4' : ''}` },
    { name: 'Google Vagas', url: `https://www.google.com/search?q=${q}+${remote ? 'home+office' : 'vagas+' + l}&ibp=htl;jobs` },
    { name: 'Glassdoor', url: `https://www.glassdoor.com.br/Vaga/${remote ? 'home-office' : ''}-${q}-vagas-SRCH_KO0,30.htm` },
    { name: 'Remotar', url: `https://remotar.com.br/search/jobs?q=${q}` },
    { name: 'We Work Remotely', url: `https://weworkremotely.com/remote-jobs/search?term=${q}` },
  ];
}

const GENERIC = new Set('analista assistente auxiliar especialista junior pleno senior jr pl sr para com dos das nos nas coordenador coordenadora gerente supervisor tecnico tecnica pessoa estagio estagiario profissional the and of remoto remote home office hibrido'.split(' '));
// termos que sozinhos geram falso positivo (ex: "Digital Product Owner", "Multimedia Designer")
const WEAK = new Set('digital media social executivo executiva representante produto conteudo dados data'.split(' '));
const SENIOR_RE = /\b(senior|sr\.?|especialista|coordenador\w*|gerente|head|lead|lider|manager|diretor\w*|iii|staff|principal)\b/;
const SENIOR_RE_JR = /\b(senior|sr\.?|pleno|pl\.?|especialista|coordenador\w*|gerente|head|lead|lider|manager|diretor\w*|ii|iii|staff|principal)\b/;

async function search(f) {
  f.queries = (f.queries || []).map((s) => s.trim()).filter(Boolean);
  if (!f.queries.length) f.queries = ['emprego'];
  if (!f.workMode) f.workMode = f.remote ? 'remote' : 'any';
  const days = Number(f.days) || 0;
  const region = f.region === 'world' ? 'world' : 'br';
  const wanted = (f.sources && f.sources.length ? f.sources : Object.keys(SOURCES)).filter((s) => SOURCES[s] && SOURCES[s].regions.includes(region));
  const status = {};
  const results = await Promise.all(wanted.map(async (s) => {
    try { const r = await SOURCES[s].run(f); status[s] = { ok: true, raw: r.length }; return r.map((j) => ({ ...j, source: SOURCES[s].label })); }
    catch (e) { status[s] = { ok: false, error: e.message }; return []; }
  }));

  // relevância: o TÍTULO precisa conter um termo forte (ex: marketing, vendas) ou a frase completa (ex: "social media")
  const qWords = (q) => norm(q).split(/[\s/,-]+/).filter((w) => w.length > 2 && !GENERIC.has(w));
  const core = [...new Set(f.queries.flatMap(qWords))];
  const strong = core.filter((w) => !WEAK.has(w));
  const phrases = f.queries.map((q) => qWords(q).join(' ')).filter((p) => p.includes(' '));
  const extra = [...new Set((f.keywords || []).map(norm).filter((w) => w.length > 2))];
  const seniorRe = f.seniority === 'junior' ? SENIOR_RE_JR : f.seniority === 'mid' ? SENIOR_RE : null;
  const seen = new Set();
  let jobs = results.flat().filter((j) => {
    const key = j.url || ''; const dk = norm(j.title + '|' + j.company);
    if (!key || seen.has(key) || seen.has(dk)) return false; seen.add(key); seen.add(dk);
    const title = norm(j.title);
    const hits = strong.filter((t) => new RegExp('\\b' + t + '\\b').test(title)).length + phrases.filter((p) => title.includes(p)).length;
    if (core.length && !hits) return false;
    if (seniorRe && seniorRe.test(title)) return false;
    j.score = hits * 3 + extra.filter((t) => norm(j.title + ' ' + (j.tags || []).join(' ') + ' ' + (j.desc || '')).includes(t)).length;
    if (days && j.date) { const age = (Date.now() - new Date(j.date)) / 864e5; if (age > days) return false; }
    if (region === 'br' && j.source === 'LinkedIn' && /worldwide|united states|europe/i.test(j.location)) return false;
    return true;
  });

  // confirma modalidade/candidatos das vagas do LinkedIn
  const verify = wanted.includes('linkedin') ? await verifyLinkedIn(jobs) : null;
  if (verify) status.linkedin = { ...status.linkedin, verificadas: verify.checked + (verify.blocked ? ' (bloqueado parcialmente)' : '') };

  const near = nearList(f.location);
  const isNear = (loc) => near.some((c) => norm(loc).includes(c));
  jobs = jobs.filter((j) => {
    if (f.workMode === 'any') return true;
    if (j.mode === 'onsite') return false;
    if (j.mode === 'unknown') return !!f.includeUnconfirmed;
    if (j.mode === 'hybrid') return f.workMode === 'remote_hybrid' && (!near.length || isNear(j.location));
    return true; // remote
  });

  const age = (j) => (j.date ? (Date.now() - new Date(j.date)) / 864e5 : 99);
  for (const j of jobs) j.fewApplicants = j.applicants != null ? j.applicants <= 50 : age(j) <= 3;
  if (f.fewApplicants) jobs = jobs.filter((j) => (j.applicants != null ? j.applicants <= 50 : age(j) <= 7));

  const modeRank = { remote: 0, hybrid: 1, unknown: 2, onsite: 3 };
  jobs.sort((a, b) => b.score - a.score || modeRank[a.mode] - modeRank[b.mode] || new Date(b.date || 0) - new Date(a.date || 0));
  jobs.forEach((j) => delete j.desc);
  const counts = jobs.reduce((c, j) => ((c[j.mode] = (c[j.mode] || 0) + 1), c), {});
  return { jobs: jobs.slice(0, 300), status, counts, links: searchLinks(f), terms: core };
}

// ================= IA =================
async function gemini(system, contents, json = true) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] }, contents,
      generationConfig: json ? { responseMimeType: 'application/json', temperature: 0.3 } : { temperature: 0.5 },
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error?.message || 'Erro Gemini');
  return d.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
}

const AREAS = {
  'TI / Tecnologia': ['javascript', 'python', 'java', 'react', 'node', 'sql', 'aws', 'docker', 'desenvolvedor', 'developer', 'software', 'devops', 'dados', 'data', 'ti', 'sistemas', 'programador', 'typescript', 'api', 'cloud', 'suporte tecnico', 'redes'],
  'Marketing': ['marketing', 'seo', 'social media', 'midias sociais', 'trafego', 'google ads', 'meta ads', 'conteudo', 'copywriting', 'branding', 'campanhas', 'growth', 'crm', 'comunicacao'],
  'Financeiro': ['financeiro', 'contabil', 'contabilidade', 'fiscal', 'tesouraria', 'controladoria', 'auditoria', 'finance', 'accounting', 'orcamento', 'contas a pagar', 'contas a receber', 'investimentos', 'fp&a'],
  'Administrativo': ['administrativo', 'secretaria', 'assistente', 'atendimento', 'recepcao', 'rotinas administrativas', 'office', 'excel', 'planilhas', 'arquivo', 'administration', 'back office'],
  'Vendas / Comercial': ['vendas', 'comercial', 'sales', 'negociacao', 'prospeccao', 'sdr', 'bdr', 'account', 'cliente', 'b2b'],
  'RH': ['recursos humanos', 'recrutamento', 'selecao', 'rh', 'hr', 'folha de pagamento', 'departamento pessoal', 'treinamento'],
  'Logística': ['logistica', 'estoque', 'supply chain', 'transporte', 'armazem', 'expedicao', 'compras'],
  'Design': ['design', 'photoshop', 'figma', 'ux', 'ui', 'illustrator', 'criativo'],
};
const STOP = new Set('para com uma que dos das por mais como sobre entre the and for with have has you your from that this will'.split(' '));

function analyzeLocal(text) {
  const t = norm(text);
  const scores = Object.entries(AREAS).map(([a, kws]) => [a, kws.filter((k) => new RegExp('(^|[^a-z])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z]|$)').test(t))]).sort((a, b) => b[1].length - a[1].length);
  const best = scores.filter((s) => s[1].length).slice(0, 2);
  const keywords = [...new Set(best.flatMap((s) => s[1]))].slice(0, 12);
  const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const titleRe = /(desenvolvedor|analista|assistente|gerente|coordenador|engenheiro|especialista|auxiliar|consultor|developer|engineer|analyst|manager|specialist|assistant|designer|coordinator|executive|executivo|supervisor)[^|,;()\n]{0,30}/gi;
  const titles = [...new Set((text.match(titleRe) || []).map((s) => s.trim()).filter((s) => s.length < 45))].slice(0, 4);
  const en = (t.match(/\b(the|and|experience|skills|education)\b/g) || []).length > (t.match(/\b(experiencia|formacao|habilidades|empresa|cursos?)\b/g) || []).length;
  return { areas: best.map((s) => s[0]), titles, keywords, language: en ? 'en' : 'pt', name: lines[0] || '', source: 'local' };
}

async function analyzeCv(text) {
  const local = analyzeLocal(text);
  if (!GEMINI_KEY) return local;
  try {
    const out = await gemini('Você analisa currículos. Responda SOMENTE JSON: {"areas":["TI / Tecnologia|Marketing|Financeiro|Administrativo|Vendas / Comercial|RH|Logística|Design|outra"],"titles":["até 4 cargos-alvo ideais para buscar vagas, no idioma do currículo"],"keywords":["até 10 habilidades-chave para busca"],"language":"pt|en","seniority":"estágio|júnior|pleno|sênior","name":"nome"}',
      [{ role: 'user', parts: [{ text: text.slice(0, 12000) }] }]);
    return { ...local, ...JSON.parse(out), source: 'gemini' };
  } catch (e) { return { ...local, aiError: e.message }; }
}

function chatLocal(msg, filters) {
  const m = norm(msg), a = {}; let reply = '', run = false;
  if (/hibrid/.test(m)) { a.workMode = 'remote_hybrid'; reply += 'Modalidade: remoto + híbrido na sua cidade. '; }
  else if (/remot|home office/.test(m)) { a.workMode = 'remote'; reply += 'Somente remoto. '; }
  if (/presencial|qualquer modalidade/.test(m)) { a.workMode = 'any'; reply += 'Qualquer modalidade. '; }
  if (/exterior|fora do brasil|internacional|ingles|english|abroad/.test(m)) { a.region = 'world'; a.location = ''; reply += 'Busca internacional (vagas em inglês). '; }
  if (/brasil|portugues/.test(m)) { a.region = 'br'; reply += 'Região: Brasil. '; }
  if (/hoje|24 ?h/.test(m)) { a.days = 1; reply += 'Apenas últimas 24h. '; }
  else if (/semana|7 dias/.test(m)) { a.days = 7; reply += 'Últimos 7 dias. '; }
  else if (/mes|30 dias/.test(m)) { a.days = 30; reply += 'Últimos 30 dias. '; }
  else if (/recente/.test(m)) { a.days = 3; reply += 'Vagas recentes (3 dias). '; }
  if (/poucas candidaturas|poucos candidatos|poucas pessoas/.test(m)) { a.fewApplicants = true; reply += 'Priorizando vagas com poucas candidaturas. '; }
  const q = m.match(/(?:vagas? de|procur\w+|buscar?|cargo de|area de)\s+([a-z0-9 +#/.-]{3,40})/);
  if (q && !/vagas? (recentes|remotas)/.test(q[0])) { a.queries = [q[1].replace(/\b(remoto|remota|recentes?|no brasil|fora)\b.*/, '').trim()]; if (a.queries[0]) reply += `Buscando por "${a.queries[0]}". `; }
  if (/(rodar|buscar|procurar|pesquisar|executar|ache|encontr)/.test(m) || Object.keys(a).length) run = true;
  if (!reply) reply = 'Posso ajustar filtros e rodar a busca. Ex.: "vagas remotas de marketing dos últimos 7 dias" ou "busque vagas no exterior". (Configure GEMINI_API_KEY para conversa completa.)';
  return { reply: reply.trim(), filters: a, run };
}

async function chat({ messages = [], cvText = '', filters = {}, analysis = null, jobs = [] }) {
  const last = messages[messages.length - 1]?.content || '';
  if (!GEMINI_KEY) return { ...chatLocal(last, filters), mode: 'local' };
  const system = `Você é o assistente de um buscador de empregos. Ajuda o usuário a achar vagas, melhorar currículo e se preparar para entrevistas, e pode AGIR alterando filtros e rodando a busca.
Responda SOMENTE JSON: {"reply":"texto curto em markdown no idioma do usuário","filters":{...campos a alterar...},"run":true|false}
Campos de filters: queries (array de cargos/termos), location (cidade para híbrido, ex "Sorocaba"), region ("br"|"world"), workMode ("remote"|"remote_hybrid"|"any"), days (0|1|3|7|14|30|60), fewApplicants (bool), includeUnconfirmed (bool), sources (array de: remotar, trampos, linkedin, remotive, remoteok, arbeitnow, jobicy).
Use run:true quando o usuário pedir para buscar/atualizar resultados ou quando mudar filtros relevantes. Não invente vagas; use apenas as listadas abaixo se perguntarem sobre resultados.
Filtros atuais: ${JSON.stringify(filters)}
Análise do currículo: ${JSON.stringify(analysis)}
Currículo (trecho): ${cvText.slice(0, 5000)}
Vagas atuais (até 15): ${JSON.stringify(jobs.slice(0, 15).map((j) => `${j.title} @ ${j.company} (${j.source})`))}`;
  try {
    const out = await gemini(system, messages.slice(-12).map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })));
    const p = JSON.parse(out);
    return { reply: p.reply || '', filters: p.filters || {}, run: !!p.run, mode: 'gemini' };
  } catch (e) { return { ...chatLocal(last, filters), mode: 'local', aiError: e.message }; }
}

// ================= HTTP =================
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const body = (req) => new Promise((res) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { try { res(JSON.parse(b || '{}')); } catch { res({}); } }); });
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'POST' && url.pathname === '/api/search') return send(res, 200, await search(await body(req)));
    if (req.method === 'POST' && url.pathname === '/api/analyze-cv') return send(res, 200, await analyzeCv((await body(req)).text || ''));
    if (req.method === 'POST' && url.pathname === '/api/chat') return send(res, 200, await chat(await body(req)));
    if (url.pathname === '/api/info') return send(res, 200, { ai: !!GEMINI_KEY, model: GEMINI_KEY ? GEMINI_MODEL : null, sources: Object.entries(SOURCES).map(([id, s]) => ({ id, label: s.label })) });
    const file = path.join(__dirname, 'public', url.pathname === '/' ? 'index.html' : path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(path.join(__dirname, 'public')) || !fs.existsSync(file)) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  } catch (e) { send(res, 500, { error: e.message }); }
}).listen(PORT, () => console.log(`\n  Job Finder AI rodando em http://localhost:${PORT}\n  IA: ${GEMINI_KEY ? 'Gemini (' + GEMINI_MODEL + ')' : 'modo local (defina GEMINI_API_KEY para chat completo)'}\n`));
