// Pontuação ATS: simula como um sistema de triagem compara um currículo com uma vaga.
// Roda no navegador (nota ao vivo enquanto a pessoa edita) e no servidor.
// É uma estimativa: cada empresa configura seu ATS de um jeito, mas os critérios abaixo são os mais comuns
// (palavras-chave da vaga, cargo, experiência, formação, idiomas e um formato que o sistema consegue ler).
import { normText } from './jobs.js';

// Habilidades, ferramentas e métodos que sistemas de triagem costumam procurar (forma normalizada → como mostrar)
const TERMS = `
excel|Excel; power bi|Power BI; tableau|Tableau; looker|Looker; looker studio|Looker Studio; google data studio|Data Studio;
sql|SQL; python|Python; r|R; javascript|JavaScript; typescript|TypeScript; java|Java; c#|C#; php|PHP; go|Go; kotlin|Kotlin; swift|Swift;
react|React; vue|Vue; angular|Angular; node|Node.js; next.js|Next.js; django|Django; spring|Spring; .net|.NET; html|HTML; css|CSS;
aws|AWS; azure|Azure; gcp|GCP; google cloud|Google Cloud; docker|Docker; kubernetes|Kubernetes; terraform|Terraform; linux|Linux; windows server|Windows Server;
git|Git; ci/cd|CI/CD; api|APIs; rest|REST; graphql|GraphQL; microsservicos|Microsserviços; microservices|Microservices;
active directory|Active Directory; office 365|Office 365; microsoft 365|Microsoft 365; itil|ITIL; redes|Redes; tcp/ip|TCP/IP; vpn|VPN; help desk|Help desk; service desk|Service desk;
glpi|GLPI; jira|Jira; confluence|Confluence; servicenow|ServiceNow; zendesk|Zendesk; freshdesk|Freshdesk; intercom|Intercom;
scrum|Scrum; kanban|Kanban; agile|Ágil; metodologias ageis|Metodologias ágeis; okr|OKR; kpi|KPIs; pmo|PMO; pmbok|PMBOK;
crm|CRM; salesforce|Salesforce; hubspot|HubSpot; rd station|RD Station; pipedrive|Pipedrive; braze|Braze; marketing cloud|Marketing Cloud; mailchimp|Mailchimp; klaviyo|Klaviyo;
google ads|Google Ads; meta ads|Meta Ads; facebook ads|Facebook Ads; tiktok ads|TikTok Ads; linkedin ads|LinkedIn Ads; google analytics|Google Analytics; ga4|GA4; google tag manager|Google Tag Manager;
seo|SEO; sem|SEM; midia paga|Mídia paga; trafego pago|Tráfego pago; inbound|Inbound; e-mail marketing|E-mail marketing; email marketing|E-mail marketing; automacao de marketing|Automação de marketing;
copywriting|Copywriting; redacao|Redação; conteudo|Conteúdo; social media|Social media; branding|Branding; growth|Growth; funil de vendas|Funil de vendas; testes a/b|Testes A/B; teste a/b|Testes A/B;
segmentacao|Segmentação; retencao|Retenção; ltv|LTV; cac|CAC; churn|Churn; nps|NPS; roi|ROI; ctr|CTR; cpc|CPC; cpa|CPA;
canva|Canva; figma|Figma; photoshop|Photoshop; illustrator|Illustrator; premiere|Premiere; after effects|After Effects; indesign|InDesign; ux|UX; ui|UI; design thinking|Design thinking;
wordpress|WordPress; shopify|Shopify; vtex|VTEX; e-commerce|E-commerce; marketplace|Marketplace;
sap|SAP; totvs|TOTVS; protheus|Protheus; erp|ERP; oracle|Oracle; omie|Omie; conta azul|Conta Azul;
contas a pagar|Contas a pagar; contas a receber|Contas a receber; conciliacao bancaria|Conciliação bancária; fluxo de caixa|Fluxo de caixa; dre|DRE; orcamento|Orçamento; fp&a|FP&A; ifrs|IFRS; sped|SPED; fiscal|Fiscal; tributario|Tributário; faturamento|Faturamento;
departamento pessoal|Departamento pessoal; folha de pagamento|Folha de pagamento; esocial|eSocial; recrutamento e selecao|Recrutamento e seleção; recrutamento|Recrutamento; onboarding|Onboarding; treinamento|Treinamento; clima organizacional|Clima organizacional;
negociacao|Negociação; prospeccao|Prospecção; vendas b2b|Vendas B2B; b2b|B2B; b2c|B2C; saas|SaaS; inside sales|Inside sales; sdr|SDR; customer success|Customer Success; atendimento ao cliente|Atendimento ao cliente; pos-venda|Pós-venda;
logistica|Logística; supply chain|Supply chain; compras|Compras; estoque|Estoque; wms|WMS;
lgpd|LGPD; compliance|Compliance; auditoria|Auditoria;
estatistica|Estatística; machine learning|Machine learning; etl|ETL; data warehouse|Data warehouse; big query|BigQuery; bigquery|BigQuery; airflow|Airflow; spark|Spark; pandas|Pandas;
cnh|CNH; ingles|Inglês; english|Inglês; espanhol|Espanhol; spanish|Espanhol
`.split(';').map((s) => s.trim()).filter(Boolean).map((s) => { const [k, label] = s.split('|'); return { k: k.trim(), label: (label || k).trim() }; });

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const termRe = (t) => new RegExp('(^|[^a-z0-9])' + esc(t) + '([^a-z0-9]|$)');
const TERM_RES = TERMS.map((t) => ({ ...t, re: termRe(t.k) }));
const LANGS = new Set(['ingles', 'english', 'espanhol', 'spanish']);

// Palavras que indicam requisito desejável (não obrigatório) no trecho
const NICE = /desejave(l|is)|diferencia(l|is)|sera um plus|e um plus|plus|nice to have|bonus|preferencia|preferencialmente|sera um diferencial/;
const GENERIC_TITLE = new Set('analista assistente auxiliar especialista coordenador coordenadora gerente supervisor pessoa jr pl sr junior pleno senior de da do das dos e em para com remoto remote hibrido vaga i ii iii'.split(' '));

/** Lê a vaga e devolve o que um ATS procuraria */
const POS_RE = /\b(mestrado|mestre|masters? degree|master's degree|mba|pos-graduacao|pos graduacao)\b/;

export function extractRequirements(job) {
  const title = normText(job?.title || '');
  const desc = normText(job?.desc || '');
  // Separa em trechos para saber o que é obrigatório e o que é desejável
  // Trechos por frase/linha (não por dois-pontos: "Desejável: Python" precisa ficar junto)
  const parts = desc.split(/(?<=[.;!?])\s+|\n+|•/).filter(Boolean);
  const keywords = new Map();
  (parts.length ? parts : [desc]).forEach((part, pi) => {
    const nice = NICE.test(part);
    const found = TERM_RES.filter((t) => !LANGS.has(t.k) && t.re.test(part));
    const labels = [...new Set(found.map((t) => t.label))];
    // "RD Station, HubSpot ou Salesforce": é um requisito só, cumprido por qualquer uma das opções
    const group = labels.length >= 2 && /\b(ou|or)\b|\//.test(part) ? `g${pi}` : null;
    for (const label of labels) {
      const prev = keywords.get(label);
      // Se aparece como obrigatório em algum lugar, vale como obrigatório
      if (!prev || (prev.nice && !nice)) keywords.set(label, { term: label, keys: TERM_RES.filter((x) => x.label === label).map((x) => x.k), nice, group: prev?.group || group });
    }
  });
  // Títulos de vaga também contam (ex: "Analista de CRM" → CRM)
  for (const t of TERM_RES) if (!LANGS.has(t.k) && t.re.test(title) && !keywords.has(t.label)) keywords.set(t.label, { term: t.label, keys: [t.k], nice: false });

  const years = [...desc.matchAll(/(\d{1,2})\s*\+?\s*(?:a\s*\d{1,2}\s*)?(anos|years)\b/g)].map((m) => Number(m[1])).filter((n) => n > 0 && n <= 15);
  // Pós só conta quando é exigência (com fronteira de palavra: "mba" não pode casar dentro de outra palavra)
  const posCtx = desc.match(new RegExp('.{0,60}' + POS_RE.source + '.{0,60}'))?.[0];
  const education = posCtx && !NICE.test(posCtx) ? 'pos'
    : /ensino superior|superior completo|graduacao|bacharel|formacao superior|faculdade|degree|bachelor|tecnologo/.test(desc) ? 'superior'
      : /ensino medio|segundo grau/.test(desc) ? 'medio' : null;
  const langNeeded = [];
  const en = desc.match(/(ingles|english)[^.;]{0,40}/);
  if (en && !NICE.test(en[0])) langNeeded.push({ lang: 'Inglês', level: /fluente|fluent|avancado|advanced/.test(en[0]) ? 'avançado' : /intermediario|intermediate/.test(en[0]) ? 'intermediário' : 'qualquer' });
  if (/(espanhol|spanish)/.test(desc) && !NICE.test(desc.match(/.{0,40}(espanhol|spanish).{0,40}/)?.[0] || '')) langNeeded.push({ lang: 'Espanhol', level: 'qualquer' });

  const titleTerms = title.replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').split(/[^a-z0-9+#]+/).filter((w) => w.length > 2 && !GENERIC_TITLE.has(w));
  return { keywords: [...keywords.values()].slice(0, 40), minYears: years.length ? Math.max(...years) : null, education, languages: langNeeded, titleTerms: [...new Set(titleTerms)] };
}

/** Anos de experiência somando os períodos ("2022–2024", "2023 - atual", "mar/2021 a jun/2023") */
function yearsOfExperience(text) {
  const now = new Date().getFullYear();
  const ranges = [...text.matchAll(/((?:19|20)\d{2})\s*(?:[-–—]|a|ate|to)\s*((?:19|20)\d{2}|atual|presente|hoje|o momento|current|present|now)/g)];
  let total = 0;
  const seen = new Set();
  for (const m of ranges) {
    const a = Number(m[1]);
    const b = /\d/.test(m[2]) ? Number(m[2]) : now;
    const key = `${a}-${b}`;
    if (b >= a && !seen.has(key)) { seen.add(key); total += Math.max(0.5, b - a); }
  }
  const declared = [...text.matchAll(/(\d{1,2})\s*\+?\s*(anos|years) de (experiencia|atuacao|experience)/g)].map((m) => Number(m[1]));
  return Math.max(total, ...declared, 0);
}

/**
 * Nota de 0 a 100 de um currículo (texto) para a vaga, com o detalhamento.
 * `req` = extractRequirements(job). `cv` = texto do currículo (use cvToText no currículo estruturado).
 */
export function scoreCv(cv, req, job) {
  const text = normText(cv || '');
  const parts = [];
  const tips = [];

  // 1. Palavras-chave (45): obrigatórias valem o dobro das desejáveis
  const kws = req.keywords || [];
  const has = (k) => k.keys.some((key) => termRe(key).test(text));
  // Cada requisito vale uma vez: termos alternativos ("A ou B") formam um requisito só
  const reqs = new Map();
  for (const k of kws) {
    const id = k.group || k.term;
    const r = reqs.get(id) || { terms: [], nice: k.nice };
    r.terms.push(k);
    r.nice = r.nice && k.nice;
    reqs.set(id, r);
  }
  const matched = kws.filter(has);
  const satisfied = [...reqs.values()].filter((r) => r.terms.some(has));
  const missing = [...reqs.values()].filter((r) => !r.terms.some(has))
    .map((r) => ({ term: r.terms.map((t) => t.term).join(' ou '), nice: r.nice }));
  const total = [...reqs.values()].reduce((s, r) => s + (r.nice ? 1 : 2), 0);
  const got = satisfied.reduce((s, r) => s + (r.nice ? 1 : 2), 0);
  const kwScore = total ? Math.round((got / total) * 45) : 35;
  parts.push({ key: 'keywords', label: 'Palavras-chave da vaga', score: kwScore, max: 45, detail: total ? `${satisfied.length} de ${reqs.size} requisitos` : 'a vaga não lista ferramentas específicas' });
  const missingRequired = missing.filter((k) => !k.nice);
  if (missingRequired.length) tips.push(`A vaga pede ${missingRequired.slice(0, 4).map((k) => k.term).join(', ')}. Se você tem, deixe escrito exatamente assim.`);

  // 2. Cargo (15): as palavras principais do título da vaga aparecem no currículo
  const tt = req.titleTerms || [];
  const titleHits = tt.filter((w) => termRe(w).test(text)).length;
  const titleScore = tt.length ? Math.round((titleHits / tt.length) * 15) : 12;
  parts.push({ key: 'title', label: 'Cargo', score: titleScore, max: 15, detail: tt.length ? `${titleHits} de ${tt.length} termos do título` : '—' });
  if (tt.length && titleHits < tt.length) tips.push(`Use no título ou no resumo os termos do cargo (${tt.join(', ')}) — se descreverem o que você faz.`);

  // 3. Experiência (10)
  const years = yearsOfExperience(text);
  let expScore = 10;
  if (req.minYears) expScore = years >= req.minYears ? 10 : Math.round((Math.min(years, req.minYears) / req.minYears) * 10);
  parts.push({ key: 'experience', label: 'Tempo de experiência', score: expScore, max: 10, detail: req.minYears ? `pede ${req.minYears}+ anos · currículo mostra ~${Math.round(years)}` : years ? `~${Math.round(years)} anos` : 'sem exigência' });
  if (req.minYears && years < req.minYears && years > 0) tips.push('Deixe claros os períodos (mês/ano) de cada experiência para o sistema somar seu tempo de atuação.');

  // 4. Formação (10)
  const hasDegree = /graduacao|bacharel|licenciatura|tecnologo|superior|universidade|faculdade|bachelor|degree|mba|pos-graduacao|mestrado/.test(text);
  const hasPos = POS_RE.test(text);
  const eduScore = !req.education || req.education === 'medio' ? 10 : req.education === 'pos' ? (hasPos ? 10 : hasDegree ? 5 : 0) : hasDegree ? 10 : 0;
  parts.push({ key: 'education', label: 'Formação', score: eduScore, max: 10, detail: req.education ? `pede ${{ superior: 'ensino superior', pos: 'pós-graduação', medio: 'ensino médio' }[req.education]}` : 'sem exigência' });
  if (eduScore < 10) tips.push('A vaga pede formação que o currículo não mostra com clareza — escreva curso, instituição e ano.');

  // 5. Idiomas (5)
  let langScore = 5;
  for (const l of req.languages || []) {
    const re = l.lang === 'Inglês' ? /ingles|english/ : /espanhol|spanish/;
    if (!re.test(text)) { langScore = 0; tips.push(`A vaga pede ${l.lang}${l.level !== 'qualquer' ? ` ${l.level}` : ''}: informe seu nível.`); }
    else if (l.level === 'avançado' && !/fluente|avancado|fluent|advanced|nativo|native/.test(text)) langScore = Math.min(langScore, 2);
  }
  parts.push({ key: 'languages', label: 'Idiomas', score: langScore, max: 5, detail: (req.languages || []).length ? req.languages.map((l) => l.lang).join(', ') : 'sem exigência' });

  // 6. Formato e legibilidade (15): contato, seções que o ATS reconhece e tamanho
  const words = text.split(/\s+/).filter(Boolean).length;
  const checks = [
    [/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(text), 'e-mail'],
    [/\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}|\+\d{6,}/.test(text), 'telefone'],
    [/resumo|summary|perfil|objetivo/.test(text), 'resumo'],
    [/competencias|habilidades|skills|conhecimentos/.test(text), 'competências'],
    [/experiencia|experience/.test(text), 'experiência'],
    [/formacao|education|escolaridade/.test(text), 'formação'],
    [words >= 150 && words <= 1100, 'conteúdo suficiente (entre ~150 e 1.100 palavras)'],
  ];
  const fmtScore = Math.round((checks.filter((c) => c[0]).length / checks.length) * 15);
  const missingFmt = checks.filter((c) => !c[0]).map((c) => c[1]);
  parts.push({ key: 'format', label: 'Formato e seções', score: fmtScore, max: 15, detail: missingFmt.length ? `falta: ${missingFmt.join(', ')}` : 'tudo certo' });
  if (missingFmt.length) tips.push(`Para o sistema ler bem, inclua: ${missingFmt.join(', ')}.`);

  const score = Math.max(0, Math.min(100, parts.reduce((s, p) => s + p.score, 0)));
  return { score, parts, matched: matched.map((k) => k.term), missing: missing.map((k) => ({ term: k.term, nice: k.nice })), tips: tips.slice(0, 4) };
}

/** Rótulo da faixa de nota */
export const atsBand = (s) => (s >= 80 ? { label: 'Ótima chance de passar na triagem', tone: 'ok' } : s >= 60 ? { label: 'Boa, mas dá para melhorar', tone: 'accent' } : { label: 'Risco de ser filtrado pelo sistema', tone: 'warn' });
