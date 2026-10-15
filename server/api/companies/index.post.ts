import { db } from '../../utils/db';
import { ATS, parseCompanyUrl } from '../../utils/ats';
import { runIndex } from '../../utils/indexer';

// Adiciona uma empresa pelo link da página de vagas (Greenhouse, Lever ou Ashby)
export default defineEventHandler(async (event) => {
  const { url = '', name = '' } = (await readBody(event)) || {};
  const parsed = parseCompanyUrl(url);
  if (!parsed) {
    throw createError({ statusCode: 400, message: 'Link não reconhecido. Use o link da página de vagas no Greenhouse, Lever ou Ashby (ex: https://jobs.lever.co/empresa).' });
  }

  // Confere se o quadro existe e tem vagas antes de salvar
  let jobs: any[] = [];
  try {
    jobs = await ATS[parsed.ats].fetch(parsed.slug);
  } catch (e: any) {
    throw createError({ statusCode: 400, message: `Não encontrei esse quadro de vagas no ${ATS[parsed.ats].label} (${e.message}).` });
  }

  const label = String(name).trim() || jobs.find((j) => j.company)?.company || parsed.slug;
  const row = await db.get(`INSERT INTO companies (ats, slug, name) VALUES (?, ?, ?)
    ON CONFLICT(ats, slug) DO UPDATE SET enabled = 1, last_indexed = NULL RETURNING *`, [parsed.ats, parsed.slug, label]) as any;
  // Indexa já (espera terminar: na Vercel a função encerra ao responder)
  await runIndex({ force: true, companyId: row.id, budgetMs: 60_000 }).catch(() => {});
  return { ...row, preview: jobs.length };
});
