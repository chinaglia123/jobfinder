// Funil comum a todas as fontes: deduplicação, relevância, modalidade, candidaturas, match e ordenação.
import { db } from './db';
import { verifyLinkedIn, searchLinks, norm, nearList, buildMatcher, wordRe, openToBrazil, relatedQueries, detectLang, detectContract } from './search';
import { enqueueVerify, withForeground } from './indexer';
import { AREAS_BY_ID } from '#shared/areas.js';

const SENIOR_RE = /\b(senior|sr\.?|especialista|coordenador\w*|gerente|head|lead|lider|manager|diretor\w*|iii|staff|principal)\b/;
const SENIOR_RE_JR = /\b(senior|sr\.?|pleno|pl\.?|especialista|coordenador\w*|gerente|head|lead|lider|manager|diretor\w*|ii|iii|staff|principal)\b/;

const LEVELS = ['estagio', 'junior', 'pleno', 'senior'];
function jobLevel(title: string) {
  const t = norm(title);
  if (/\b(estagi\w*|intern(ship)?|trainee|aprendiz)\b/.test(t)) return 0;
  if (/\b(senior|sr\.?|especialista|lead|lider|head|staff|principal|iii)\b/.test(t)) return 3;
  if (/\b(pleno|pl\.?|mid|ii)\b/.test(t)) return 2;
  if (/\b(junior|jr\.?|assistente|auxiliar|i)\b/.test(t)) return 1;
  return -1;
}

const ageDays = (j: any) => (j.date ? (Date.now() - new Date(j.date).getTime()) / 864e5 : null);

/** Compatibilidade real com o currículo: habilidades + cargo + nível + frescor. */
function computeMatch(j: any, profile: any, targetMatchers: any[]) {
  const text = norm([j.title, (j.tags || []).join(' '), j.desc || ''].join(' '));
  const skills: string[] = [...new Set((profile.keywords || []).map(norm).filter((k: string) => k.length > 1))] as string[];
  const matched = skills.filter((k) => wordRe(k).test(text));
  const skillPart = skills.length ? Math.min(1, matched.length / Math.min(6, skills.length)) * 45 : 0;

  // Melhor aderência do título da vaga a algum dos cargos-alvo
  const titleRatio = Math.max(0, ...targetMatchers.map((m: any) => {
    const strong = m.groups.filter((g: any) => g.strong).length;
    return strong ? m.hits(j.title) / strong : 0;
  }));
  const titlePart = Math.min(1, titleRatio) * 35;

  let levelPart = 5;
  const want = LEVELS.indexOf(norm(profile.seniority || '').replace(/[^a-z]/g, ''));
  const have = jobLevel(j.title);
  if (want >= 0 && have >= 0) levelPart = want === have ? 10 : Math.abs(want - have) === 1 ? 3 : -10;

  const age = ageDays(j);
  const fresh = (age != null && age <= 3 ? 5 : 0) + (j.fewApplicants ? 5 : 0);

  return { score: Math.max(1, Math.min(99, Math.round(skillPart + titlePart + levelPart + fresh))), matched };
}

/** Normaliza o corpo da requisição de busca (filtros vindos da interface). */
export function normalizeFilters(input: any) {
  const f: any = { ...(input || {}) };
  f.queries = (f.queries || []).map((s: string) => String(s).trim()).filter(Boolean);
  if (!f.workMode) f.workMode = f.remote ? 'remote' : 'any';
  if (f.includeUnconfirmed === undefined) f.includeUnconfirmed = true;

  // Áreas escolhidas (ex: "Marketing › CRM") viram cargos para buscar e para reconhecer o título
  const areas = (Array.isArray(f.areas) ? f.areas : []).map((id: string) => AREAS_BY_ID[id]).filter(Boolean);
  f.areas = areas.map((a: any) => a.id);
  const typed = [...f.queries];
  const seenQ = new Set(typed.map(norm));
  const take = (q: string) => (seenQ.has(norm(q)) ? false : (seenQ.add(norm(q)), true));
  if (!typed.length && areas.length) f.queries = areas.map((a: any) => a.queries[0]).filter(take).slice(0, 5);
  // Demais cargos das áreas: buscados só na 1ª página de cada fonte (para não pesar)
  f.areaQueries = areas.flatMap((a: any) => a.queries.slice(0, 3)).filter(take).slice(0, 12);
  const areaMatch = areas.flatMap((a: any) => a.queries);
  if (!f.queries.length) f.queries = ['emprego'];

  // Cargos relacionados (mais variedade): só a partir do que a pessoa digitou; pesam menos no ranking
  f.expand = f.expand !== false;
  f.related = f.expand && typed.length ? relatedQueries(typed, areas.length ? 4 : 8) : [];
  // Cargo digitado ou área escolhida conta como escolha explícita (não "relacionado")
  f.typedMatcher = buildMatcher([...f.queries, ...areaMatch]);
  f.matcher = f.related.length ? buildMatcher([...f.queries, ...areaMatch, ...f.related]) : f.typedMatcher;
  // Palavras que a pessoa não quer ver no título (ex: "estágio", "vendas")
  f.excludeTerms = (Array.isArray(f.excludeTerms) ? f.excludeTerms : []).map((t: string) => norm(t).trim()).filter((t: string) => t.length > 1);
  // Casa pelo radical: "estágio" também pega "estagiário"; "vendas" pega "vendedor"
  f.excludeRes = f.excludeTerms.map((t: string) => {
    if (t.includes(' ')) return wordRe(t);
    const stem = t.length > 5 ? t.slice(0, -2) : t.length > 4 ? t.slice(0, -1) : t;
    return new RegExp('(^|[^a-z0-9])' + stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + (stem === t ? '([^a-z0-9]|$)' : ''));
  });
  f.lang = f.lang === 'pt' ? 'pt' : 'any';

  f.region = f.region === 'world' ? 'world' : 'br';
  return f;
}

/** Aplica o funil às vagas brutas. `verifyLinkedin` lê descrições do LinkedIn (lento). */
export async function processJobs(f: any, raw: any[], status: Record<string, any>, { verifyLinkedin = false, userId = null as number | null } = {}) {
  const days = Number(f.days) || 0;
  // Vagas que a pessoa marcou como "não tenho interesse" nunca voltam para a lista
  const hidden = new Set(userId == null ? [] : (await db.all('SELECT url FROM hidden_jobs WHERE user_id = ?', [userId]) as any[]).map((r) => r.url));
  const region = f.region;
  const results = [raw];
  const seniorRe = f.seniority === 'junior' ? SENIOR_RE_JR : f.seniority === 'mid' ? SENIOR_RE : null;
  const extra = [...new Set(((f.keywords as string[]) || []).map(norm).filter((w) => w.length > 1))];

  // 1. Deduplicação + relevância pelo título (com sinônimos PT/EN)
  const seen = new Set<string>();
  let jobs = results.flat().filter((j: any) => {
    if (!j.title || !j.url || hidden.has(j.url)) return false;
    const dk = norm(j.title + '|' + j.company).replace(/\s+/g, ' ');
    if (seen.has(j.url) || seen.has(dk)) return false;
    seen.add(j.url);
    seen.add(dk);

    const titleHits = f.matcher.hits(j.title);
    if (f.excludeRes.length && f.excludeRes.some((re: RegExp) => re.test(norm(j.title)))) return false;
    if (f.matcher.terms.length && !titleHits) return false;
    if (seniorRe && seniorRe.test(norm(j.title))) return false;

    const age = ageDays(j);
    if (days && age != null && age > days) return false;
    if (region === 'br' && j.source === 'LinkedIn' && /worldwide|united states|europe/i.test(j.location)) return false;
    if (region === 'br' && j.geoCheck && !openToBrazil(j.location)) return false;

    const body = norm((j.tags || []).join(' ') + ' ' + (j.desc || ''));
    j.score = f.typedMatcher.hits(j.title) * 3 + titleHits + f.matcher.hits(body) + extra.filter((t) => wordRe(t).test(body)).length;
    j.related = !f.typedMatcher.hits(j.title);
    return true;
  });

  // 2. Confirma modalidade do LinkedIn lendo a descrição (só das vagas que passaram no filtro)
  if (verifyLinkedin) {
    const needMode = f.workMode !== 'any' || f.fewApplicants;
    const v = await withForeground(() => verifyLinkedIn(jobs, needMode ? { maxFetch: 15, budgetMs: 15000 } : { maxFetch: 6, budgetMs: 8000 }));
    // O que não deu tempo de ler vai para a fila do trabalhador em segundo plano
    await enqueueVerify(jobs.filter((j: any) => j.source === 'LinkedIn' && j.id && !j.checked).map((j: any) => j.id));
    status.linkedin = {
      ...status.linkedin,
      verificadas: v.fetched + v.cached,
      pendentes: v.pending,
      bloqueado: v.blocked,
    };
  }

  // 2b. Idioma e tipo de contrato (depois da leitura das descrições do LinkedIn)
  for (const j of jobs) {
    j.lang = detectLang(j.title, j.desc);
    j.contract = detectContract(j.title, j.tags || [], j.desc);
  }
  if (f.lang === 'pt') jobs = jobs.filter((j: any) => j.lang !== 'en' && j.lang !== 'es');

  // 3. Modalidade + cidade para híbrido
  const near = nearList(f.location || '');
  const isNear = (loc: string) => near.some((c) => norm(loc).includes(c));
  jobs = jobs.filter((j: any) => {
    if (f.workMode === 'any') return true;
    if (j.mode === 'onsite') return false;
    if (j.mode === 'unknown') return !!f.includeUnconfirmed;
    if (j.mode === 'hybrid') return f.workMode === 'remote_hybrid' && (!near.length || isNear(j.location));
    return true;
  });

  // 4. Poucas candidaturas (número real do LinkedIn; senão, vaga publicada há poucos dias)
  for (const j of jobs) {
    const age = ageDays(j);
    j.fewApplicants = j.applicants != null ? j.applicants <= 50 : age != null && age <= 3;
  }
  if (f.fewApplicants) {
    jobs = jobs.filter((j: any) => {
      const age = ageDays(j);
      return j.applicants != null ? j.applicants <= 50 : age != null && age <= 7;
    });
  }

  // 5. Match % com o currículo (só quando há perfil analisado)
  const profile = f.profile && ((f.profile.keywords || []).length || (f.profile.titles || []).length) ? f.profile : null;
  if (profile) {
    const targetMatchers = ((profile.titles || []).length ? profile.titles : f.queries).map((t: string) => buildMatcher([t]));
    for (const j of jobs) {
      const m = computeMatch(j, profile, targetMatchers);
      j.matchScore = m.score;
      j.matchedSkills = m.matched.slice(0, 6);
    }
  }

  // 6. Ordenação: modalidade confirmada primeiro, depois match/relevância, depois data
  jobs.sort((a: any, b: any) =>
    Number(a.mode === 'unknown') - Number(b.mode === 'unknown')
    || (b.matchScore ?? b.score ?? 0) - (a.matchScore ?? a.score ?? 0)
    || new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

  const counts = jobs.reduce((c: any, j: any) => {
    c[j.mode] = (c[j.mode] || 0) + 1;
    return c;
  }, {});

  return {
    jobs: jobs.slice(0, 300).map((j: any) => ({ ...j, desc: (j.desc || '').slice(0, 2500), checked: undefined, geoCheck: undefined })),
    status,
    counts,
    links: searchLinks(f),
    terms: f.matcher.terms,
    related: f.related,
  };
}
