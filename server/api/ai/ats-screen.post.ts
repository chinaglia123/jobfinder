import { generateAI, parseJSON } from '../../utils/ai';
import { aiCreds } from '../../utils/ai-creds';
import { jobDescription } from '../../utils/job-desc';

/**
 * Simula a primeira triagem: o filtro automático (ATS) + a leitura rápida de quem recruta.
 * Diz se o currículo avançaria, o que eliminaria e o que ajustar — sempre sem sugerir mentiras.
 */
const SYSTEM = `Você simula a TRIAGEM INICIAL de uma vaga: primeiro o filtro automático (ATS), depois a leitura de 30 segundos de quem recruta.
Seja rigoroso e realista, como um ATS de verdade: requisitos obrigatórios ausentes derrubam a nota.
Avalie SOMENTE o que está escrito no currículo. As correções sugeridas NUNCA podem pedir para inventar experiência:
sugira apenas deixar explícito o que a pessoa já fez, reorganizar, ou estudar algo.
Para requisitos que faltam, escreva SEMPRE de forma condicional: "Se você tem X, deixe isso explícito em ..."; nunca "inclua X".

Responda SOMENTE JSON:
{
  "decision": "avanca" | "talvez" | "reprovado",
  "score": número de 0 a 100,
  "summary": "1 frase com o veredito",
  "knockouts": ["requisitos obrigatórios que o currículo não mostra (eliminatórios)"],
  "strengths": ["o que faz o currículo passar"],
  "fixes": ["ajustes honestos e concretos, em ordem de impacto"]
}`;

const list = (v: any) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 8) : []);

export default defineEventHandler(async (event) => {
  const { job, cvText = '' } = (await readBody(event)) || {};
  if (!job?.title || String(cvText).trim().length < 80) throw createError({ statusCode: 400, message: 'Faltam a vaga ou o currículo.' });
  const desc = job.jobDesc || (await jobDescription(job)) || job.desc || '';

  const ai = await generateAI({
    systemPrompt: SYSTEM,
    messages: [{ role: 'user', content: `VAGA: ${job.title} — ${job.company}\n${desc.slice(0, 6000)}\n\nCURRÍCULO:\n${String(cvText).slice(0, 12000)}` }],
    json: true,
    temperature: 0.1,
    creds: aiCreds(event),
  });
  const d = parseJSON(ai.text);
  if (!d) {
    throw createError({ statusCode: 400, message: ai.keyError || 'A simulação de triagem precisa de IA: configure uma chave em Ajustes.' });
  }
  const decision = ['avanca', 'talvez', 'reprovado'].includes(d.decision) ? d.decision : 'talvez';
  return {
    decision,
    score: Math.max(0, Math.min(100, Math.round(Number(d.score) || 0))),
    summary: String(d.summary || '').trim(),
    knockouts: list(d.knockouts),
    strengths: list(d.strengths),
    fixes: list(d.fixes),
    provider: ai.provider,
    keyError: ai.keyError,
  };
});
