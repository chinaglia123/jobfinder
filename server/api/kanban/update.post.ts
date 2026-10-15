import { db } from '../../utils/db';
import { requireUser } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const { job, status = 'saved', notes = '' } = await readBody(event) || {};
  if (!job || !job.url) {
    throw createError({ statusCode: 400, message: 'Dados da vaga inválidos para o Kanban.' });
  }

  try {
    // 1. Garante que a vaga existe na tabela jobs (devolve o id existente ou o novo)
    const jobRow = await db.get(`
      INSERT INTO jobs (url, title, company, location, mode, source, published_at, applicants, score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(url) DO UPDATE SET title = excluded.title
      RETURNING id`, [
      job.url,
      job.title || 'Sem título',
      job.company || '',
      job.location || '',
      job.mode || 'unknown',
      job.source || 'Manual',
      job.date || job.published_at || null,
      job.applicants ?? null,
      job.matchScore || job.match_score || 0,
    ]) as { id: number };

    // 2. Insere ou atualiza na tabela applications
    await db.run(`
      INSERT INTO applications (user_id, job_id, status, match_score, notes, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, job_id) DO UPDATE SET
        status = excluded.status,
        notes = CASE WHEN excluded.notes != '' THEN excluded.notes ELSE applications.notes END,
        updated_at = CURRENT_TIMESTAMP`,
    [user.id, jobRow.id, status, job.matchScore || job.match_score || 0, notes]);

    return { ok: true, jobId: jobRow.id, status };
  } catch (err: any) {
    console.error('[Banco:Kanban update error]', err);
    throw createError({ statusCode: 500, message: err.message });
  }
});
