import { generateAI, parseJSON } from '../../utils/ai';
import { aiCreds } from '../../utils/ai-creds';
import { jobDescription } from '../../utils/job-desc';

export default defineEventHandler(async (event) => {
  const { job, cvText, analysis } = await readBody(event) || {};
  if (!job) {
    throw createError({ statusCode: 400, message: 'Dados da vaga não informados.' });
  }

  const desc = await jobDescription(job);
  let keyError = null;
  try {
    const ai = await generateAI({
      systemPrompt: `Você é um Copywriter e Especialista em Empregabilidade.
Gere DOIS textos em tom profissional, caloroso e focado em resultados:
1. "linkedin_note": Uma mensagem curta de conexão para o recrutador no LinkedIn (máximo 280 caracteres, pronto para copiar).
2. "cover_letter": Uma carta de apresentação de 2 parágrafos conectando os pontos fortes do currículo com a vaga.

Responda SOMENTE JSON:
{
  "linkedin_note": "...",
  "cover_letter": "..."
}`,
      messages: [{
        role: 'user',
        content: `VAGA: ${job.title} na empresa ${job.company} (${job.location}, modalidade ${job.mode}).
DESCRIÇÃO DA VAGA:
${desc.slice(0, 4000) || '(não disponível)'}

CURRÍCULO DO CANDIDATO:
${(cvText || '').slice(0, 5000)}`
      }],
      json: true,
      temperature: 0.4,
      creds: aiCreds(event)
    });
    keyError = ai.keyError;

    const parsed = parseJSON(ai.text);
    if (parsed) return { ...parsed, provider: ai.provider, keyError };
  } catch (err) {
    console.warn('[AI:CoverLetter fallback]', err);
  }

  // Fallback padrão
  return {
    linkedin_note: `Olá! Vi a oportunidade de ${job.title} na ${job.company} e me identifiquei muito com o desafio. Tenho experiência consistente na área e adoraria conectar para acompanhar os próximos passos!`,
    cover_letter: `Prezada equipe da ${job.company},\n\nEscrevo para manifestar meu grande interesse na posição de ${job.title}. Com sólida trajetória e formação na área, desenvolvi competências práticas em execução de estratégias, relacionamento com clientes e entrega de metas.\n\nAcredito que minha energia e comprometimento com resultados podem agregar valor imediato à equipe. Estou à total disposição para conversar sobre como posso contribuir com os objetivos da ${job.company}.\n\nAtenciosamente.`,
    provider: 'local',
    keyError
  };
});
