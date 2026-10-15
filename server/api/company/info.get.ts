import { db } from '../../utils/db';

const BOARD_URL: Record<string, (slug: string) => string> = {
  greenhouse: (s) => `https://job-boards.greenhouse.io/${s}`,
  lever: (s) => `https://jobs.lever.co/${s}`,
  ashby: (s) => `https://jobs.ashbyhq.com/${s}`,
  workable: (s) => `https://apply.workable.com/${s}/`,
  smartrecruiters: (s) => `https://careers.smartrecruiters.com/${s}`,
  recruitee: (s) => `https://${s}.recruitee.com/`,
};

// Informações públicas da empresa a partir do próprio índice (sem dados de terceiros):
// se acompanhamos o site de carreiras dela, quantas vagas abertas ela tem agora e desde quando.
export default defineEventHandler(async (event) => {
  const name = String(getQuery(event).name || '').trim().slice(0, 120);
  if (!name) throw createError({ statusCode: 400, message: 'Informe a empresa.' });
  const company = await db.get(
    "SELECT id, ats, slug, name, job_count, last_indexed FROM companies WHERE enabled = 1 AND ats != 'feed' AND lower(name) = lower(?) LIMIT 1",
    [name],
  ) as any;
  const open = company
    ? await db.get('SELECT COUNT(*) AS n, MIN(published_at) AS oldest FROM index_jobs WHERE company_id = ?', [company.id]) as any
    : await db.get('SELECT COUNT(*) AS n, MIN(published_at) AS oldest FROM index_jobs WHERE lower(company) = lower(?)', [name]) as any;
  const q = encodeURIComponent(name);
  return {
    name,
    openJobs: open?.n || 0,
    oldestOpening: open?.oldest || null,
    board: company && BOARD_URL[company.ats] ? { ats: company.ats, url: BOARD_URL[company.ats](company.slug) } : null,
    links: [
      { label: 'Avaliações no Glassdoor', url: `https://www.glassdoor.com.br/Search/results.htm?keyword=${q}` },
      { label: 'Reclame Aqui', url: `https://www.reclameaqui.com.br/busca/?q=${q}` },
      { label: 'Página no LinkedIn', url: `https://www.linkedin.com/search/results/companies/?keywords=${q}` },
    ],
  };
});
