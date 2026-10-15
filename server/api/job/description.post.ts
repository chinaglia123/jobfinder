import { jobDescription } from '../../utils/job-desc';

// Descrição completa da vaga para o painel de detalhes (baixa do LinkedIn quando necessário, com cache)
export default defineEventHandler(async (event) => {
  const { job } = (await readBody(event)) || {};
  if (!job) throw createError({ statusCode: 400, message: 'Vaga não informada.' });
  return { desc: await jobDescription(job) };
});
