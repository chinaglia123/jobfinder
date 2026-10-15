import { linkedInDetail } from './search';
import { db } from './db';


/** Descrição completa da vaga: usa a que veio na busca ou baixa do LinkedIn quando faltar. */
export async function jobDescription(job) {
  const have = job?.desc || '';
  const indexed = job?.url ? await db.get('SELECT description FROM index_jobs WHERE url = ?', [job.url]) : null;
  if (indexed?.description && indexed.description.length > have.length) return indexed.description;
  if (have.length >= 1200 || job?.source !== 'LinkedIn' || !job?.id) return have;
  try { return (await linkedInDetail(job.id)).desc || have; }
  catch { return have; }
}
