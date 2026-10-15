import { generateAI, parseJSON } from '../../utils/ai';
import { aiCreds } from '../../utils/ai-creds';
import { AREA_GROUPS } from '#shared/areas.js';

const AREA_LIST = AREA_GROUPS.flatMap((g) => g.areas.map((a) => ({ id: a.id, label: `${g.label} › ${a.label}`, parts: a.label.split('/').map((x) => norm(x).trim()).filter((x) => x.length >= 3) })));
import { norm } from '../../utils/search';

function chatLocal(msg: string, filters: any) {
  const m = norm(msg), a: any = {};
  let reply = '', run = false;

  if (/hibrid/.test(m)) { a.workMode = 'remote_hybrid'; reply += 'Modalidade: remoto + híbrido na sua cidade. '; }
  else if (/remot|home office/.test(m)) { a.workMode = 'remote'; reply += 'Somente remoto ativado. '; }
  if (/presencial|qualquer modalidade/.test(m)) { a.workMode = 'any'; reply += 'Qualquer modalidade (inclui presencial). '; }

  if (/exterior|fora do brasil|internacional|ingles|english|abroad/.test(m)) { a.region = 'world'; a.location = ''; reply += 'Busca internacional (vagas no exterior). '; }
  if (/brasil/.test(m)) { a.region = 'br'; reply += 'Região: Brasil. '; }
  if (/portugues|pt-?br/.test(m)) { a.region = 'br'; a.lang = 'pt'; reply += 'Só vagas em português. '; }
  const ex = m.match(/(?:sem|exclu\w*|tira\w*|remov\w*)\s+(?:vagas? de\s+)?([a-z0-9 ]{3,30})/);
  if (ex) { a.excludeTerms = [...(filters.excludeTerms || []), ex[1].trim()]; reply += `Excluindo vagas com "${ex[1].trim()}" no título. `; }

  if (/hoje|24 ?h/.test(m)) { a.days = 1; reply += 'Apenas últimas 24h. '; }
  else if (/semana|7 dias/.test(m)) { a.days = 7; reply += 'Últimos 7 dias. '; }
  else if (/mes|30 dias/.test(m)) { a.days = 30; reply += 'Últimos 30 dias. '; }
  else if (/recente/.test(m)) { a.days = 3; reply += 'Vagas recentes (3 dias). '; }

  // Áreas citadas pelo nome (ex: "CRM", "help desk", "social media")
  const areas = AREA_LIST.filter((ar) => ar.parts.some((p) => new RegExp('(^|[^a-z])' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z]|$)').test(m)));
  if (areas.length) { a.areas = [...new Set([...(filters.areas || []), ...areas.map((x) => x.id)])]; reply += `Áreas: ${areas.map((x) => x.label).join(', ')}. `; }

  if (/explorar tudo|todas as vagas|sem filtro|mostra tudo|me mostra tudo|qualquer cargo|qualquer area/.test(m)) { a.explore = true; reply += 'Explorando todas as áreas, sem filtro de cargo. '; }

  if (/poucas candidaturas|poucos candidatos/.test(m)) { a.fewApplicants = true; reply += 'Priorizando vagas com poucas candidaturas. '; }

  const q = m.match(/(?:vagas? de|procur\w+|buscar?|cargo de|area de)\s+([a-z0-9 +#/.-]{3,40})/);
  if (q && !areas.length && !/vagas? (recentes|remotas|hibridas)/.test(q[0])) {
    a.queries = [q[1].replace(/\b(remoto|remota|recentes?|no brasil|fora)\b.*/, '').trim()];
    if (a.queries[0]) reply += `Buscando por "${a.queries[0]}". `;
  }

  if (/(rodar|buscar|procurar|pesquisar|executar|ache|encontr)/.test(m) || Object.keys(a).length) run = true;
  if (!reply) reply = 'Posso ajustar filtros, procurar vagas ou te orientar sobre seu currículo. O que você gostaria de ajustar agora?';

  return { reply: reply.trim(), filters: a, run, provider: 'local' };
}

export default defineEventHandler(async (event) => {
  const { messages = [], cvText = '', filters = {}, analysis = null, jobs = [] } = await readBody(event) || {};
  const last = messages[messages.length - 1]?.content || '';

  let lastKeyError = null;
  try {
    const systemPrompt = `Você é o Copiloto de Empregabilidade com Inteligência Artificial.
Você ajuda o usuário a encontrar o emprego ideal, tirar dúvidas sobre o currículo, analisar compatibilidade com vagas e AGIR diretamente na interface.
Responda ESTRITAMENTE em formato JSON:
{
  "reply": "sua resposta em markdown, amigável e direta",
  "filters": { ...quaisquer filtros que o usuário pediu para mudar... },
  "run": true ou false (coloque true se o usuário pediu para buscar, rodar ou se você mudou os filtros)
}

Campos aceitos em filters:
- queries: lista de strings (ex: ["analista de marketing", "social media"])
- location: string (ex: "Sorocaba")
- region: "br" ou "world"
- workMode: "remote" | "remote_hybrid" | "any"
- seniority: "junior" | "mid" | ""
- days: 1 | 3 | 7 | 14 | 30 | 60
- fewApplicants: true | false
- lang: "pt" (só vagas em português) | "any"
- expand: true | false (incluir cargos relacionados)
- excludeTerms: lista de palavras proibidas no título (ex: ["estágio", "vendas"])
- explore: true | false (true = sem filtro de cargo, todas as áreas)
- areas: lista de ids de áreas (busca vários cargos de uma vez). Ids válidos: ${AREA_LIST.map((x) => `${x.id} (${x.label})`).join('; ')}

Filtros atuais: ${JSON.stringify(filters)}
Perfil analisado: ${JSON.stringify(analysis)}
Trecho CV: ${(cvText || '').slice(0, 3000)}
Vagas recentes encontradas: ${JSON.stringify(jobs.slice(0, 10).map((j: any) => `${j.title} @ ${j.company} (${j.mode})`))}`;

    const ai = await generateAI({
      systemPrompt,
      messages: messages.slice(-10),
      json: true,
      temperature: 0.3,
      creds: aiCreds(event)
    });

    lastKeyError = ai.keyError;
    const parsed = parseJSON(ai.text);
    if (parsed) {
      return {
        reply: parsed.reply || '',
        filters: parsed.filters || {},
        run: !!parsed.run,
        provider: ai.provider,
        keyError: ai.keyError
      };
    }
  } catch (err) {
    console.warn('[AI:Chat fallback]', err);
  }

  return { ...chatLocal(last, filters), keyError: lastKeyError };
});
