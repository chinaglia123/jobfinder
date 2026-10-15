import { generateAI, parseJSON } from '../../utils/ai';
import { aiCreds } from '../../utils/ai-creds';
import { norm, wordRe } from '../../utils/search';
import { jobDescription } from '../../utils/job-desc';

// Ferramentas/competências comuns, usadas para apontar lacunas sem IA
const TOOLS = ['excel', 'power bi', 'sql', 'python', 'google analytics', 'ga4', 'google ads', 'meta ads', 'rd station', 'hubspot', 'salesforce', 'sap', 'totvs', 'crm', 'seo', 'canva', 'figma', 'photoshop', 'illustrator', 'wordpress', 'tableau', 'looker', 'javascript', 'typescript', 'react', 'node', 'java', 'aws', 'docker', 'ingles', 'english', 'espanhol', 'spanish', 'scrum', 'kanban', 'jira', 'notion', 'trello', 'pipedrive', 'zendesk', 'copywriting', 'e-commerce', 'marketplace'];

export default defineEventHandler(async (event) => {
  const { job, cvText, analysis } = await readBody(event) || {};
  if (!job || !cvText) {
    throw createError({ statusCode: 400, message: 'Dados incompletos para cálculo de match.' });
  }

  const desc = await jobDescription(job);

  // 1. Tenta calcular com IA
  let keyError = null;
  try {
    const ai = await generateAI({
      systemPrompt: `Você é um Recrutador Sênior e Especialista em Carreiras.
Analise a compatibilidade entre o currículo e a vaga informada, comparando os requisitos da DESCRIÇÃO com a experiência real do currículo.
Seja honesto: se o candidato não atende requisitos obrigatórios, a nota deve ser baixa.
Responda ESTRITAMENTE em formato JSON:
{
  "score": número de 0 a 100,
  "summary": "resumo de 1 frase explicando o veredito",
  "strengths": ["ponto forte 1", "ponto forte 2", "ponto forte 3"],
  "gaps": ["o que pode faltar ou ser aprofundado"],
  "tips": "dica prática para a candidatura ou entrevista"
}`,
      messages: [{
        role: 'user',
        content: `VAGA:
Título: ${job.title}
Empresa: ${job.company}
Modalidade: ${job.mode}
Local: ${job.location}
Descrição:
${desc.slice(0, 6000) || '(descrição não disponível — avalie apenas pelo título)'}

CURRÍCULO:
${cvText.slice(0, 7000)}`
      }],
      json: true,
      temperature: 0.2,
      creds: aiCreds(event)
    });
    keyError = ai.keyError;

    const parsed = parseJSON(ai.text);
    if (parsed) return { ...parsed, provider: ai.provider, keyError };
  } catch (err) {
    console.warn('[AI:Match fallback to heuristic]', err);
  }

  // Fallback heurístico: compara habilidades do CV com o texto da vaga
  const jobText = norm([job.title, (job.tags || []).join(' '), desc].join(' '));
  const cText = norm(cvText);
  const keywords: string[] = [...new Set((analysis?.keywords || []).map(norm).filter((k: string) => k.length > 1))] as string[];
  const hits = keywords.filter((k) => wordRe(k).test(jobText));
  const asked = TOOLS.filter((t) => wordRe(t).test(jobText));
  const missing = asked.filter((t) => !wordRe(t).test(cText));
  const have = asked.length - missing.length;

  // Parte da nota da busca e ajusta pelas ferramentas que a descrição pede
  const score = (job.matchScore ?? 50) - Math.min(25, missing.length * 6) + Math.min(10, have * 3);

  return {
    score: Math.max(1, Math.min(99, score)),
    summary: desc
      ? (asked.length
        ? `A vaga cita ${asked.length} ferramenta(s) conhecida(s); seu CV menciona ${have} delas (análise local, sem IA).`
        : 'Comparação feita entre as habilidades do seu CV e a descrição da vaga (análise local, sem IA).')
      : 'Descrição da vaga indisponível — estimativa feita só pelo título (análise local, sem IA).',
    strengths: hits.length ? hits.map((h) => `Habilidade do CV citada na vaga: ${h}`) : ['Cargo alinhado com sua busca'],
    gaps: missing.length ? missing.slice(0, 6).map((m) => `A vaga cita "${m}", que não aparece no seu CV`) : ['Confira os requisitos obrigatórios no link original.'],
    tips: hits.length
      ? `Coloque ${hits.slice(0, 3).join(', ')} logo no início do CV e da mensagem ao recrutador.`
      : 'Adapte o resumo do seu CV usando as mesmas palavras da descrição da vaga.',
    provider: 'local',
    keyError
  };
});
