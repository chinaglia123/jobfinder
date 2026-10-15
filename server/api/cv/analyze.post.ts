import { db } from '../../utils/db';
import { requireUser } from '../../utils/auth';
import { generateAI, parseJSON } from '../../utils/ai';
import { aiCreds } from '../../utils/ai-creds';
import { norm } from '../../utils/search';

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

function analyzeLocal(text: string) {
  const t = norm(text);
  const scores = Object.entries(AREAS).map(([a, kws]) => [
    a,
    kws.filter((k) => new RegExp('(^|[^a-z])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z]|$)').test(t)),
  ] as [string, string[]]).sort((a, b) => b[1].length - a[1].length);

  const best = scores.filter((s) => s[1].length).slice(0, 2);
  const keywords = [...new Set(best.flatMap((s) => s[1]))].slice(0, 12);
  const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const titleRe = /(desenvolvedor|analista|assistente|gerente|coordenador|engenheiro|especialista|auxiliar|consultor|developer|engineer|analyst|manager|specialist|assistant|designer|coordinator|executive|executivo|supervisor)[^|,;()\n]{0,30}/gi;
  // Corta o cargo antes do nome da empresa/período ("Assistente de Marketing - Agência X (2023)")
  const titles = [...new Set((text.match(titleRe) || [])
    .map((s) => s.split(/\s[-–—@]\s|\s(?:na|no|em|at)\s|\s\d{4}/i)[0].trim())
    .filter((s) => s.length > 3 && s.length < 45))].slice(0, 4);
  const en = (t.match(/\b(the|and|experience|skills|education)\b/g) || []).length > (t.match(/\b(experiencia|formacao|habilidades|empresa|cursos?)\b/g) || []).length;
  return {
    areas: best.map((s) => s[0]),
    titles,
    keywords,
    language: en ? 'en' : 'pt',
    seniority: /(senior|sr\.?|lider|gerente|coordenador\w*|head)/.test(t) ? 'sênior' : /(pleno|pl\.?)/.test(t) ? 'pleno' : /(estagi\w*|intern)/.test(t) ? 'estágio' : 'júnior',
    name: lines[0] || 'Candidato',
    source: 'local',
  };
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const body = await readBody(event) || {};
  const text = (body.text || '').trim();
  if (text.length < 20) {
    throw createError({ statusCode: 400, message: 'Texto de currículo muito curto.' });
  }

  const local = analyzeLocal(text);

  // Tenta enriquecer com IA (Groq/Gemini/OpenRouter)
  let result: any = local;
  let keyError = null;
  try {
    const ai = await generateAI({
      systemPrompt: `Você é um Tech Lead e especialista em RH. Analise o currículo e retorne SOMENTE um objeto JSON com o formato:
{
  "name": "nome da pessoa",
  "language": "pt" ou "en",
  "seniority": "estágio" | "júnior" | "pleno" | "sênior",
  "areas": ["área principal", "área secundária"],
  "titles": ["até 4 cargos-alvo ideais para buscar vagas no mercado atual"],
  "keywords": ["até 12 habilidades técnicas e competências essenciais para busca"]
}`,
      messages: [{ role: 'user', content: text.slice(0, 10000) }],
      json: true,
      creds: aiCreds(event),
    });
    keyError = ai.keyError;

    const parsed = parseJSON(ai.text);
    if (parsed) result = { ...local, ...parsed, source: ai.provider };
  } catch (err) {
    console.warn('[AI:Analyze error, using local heuristics]', err);
  }

  // Guarda a análise no banco
  try {
    await db.run(`
      INSERT INTO resumes (user_id, name, text, language, seniority, areas, skills, target_titles)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
      user.id,
      result.name,
      text,
      result.language,
      result.seniority,
      JSON.stringify(result.areas),
      JSON.stringify(result.keywords),
      JSON.stringify(result.titles),
    ]);
  } catch (e) {
    console.warn('[Banco:Resume insert error]', e);
  }

  return { ...result, keyError };
});
