import { db } from '../../utils/db';
import { requireUser } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  try {
    const rows = await db.all(`
      SELECT 
        a.id as application_id,
        a.status,
        a.match_score,
        a.notes,
        a.updated_at,
        j.id as job_id,
        j.url,
        j.title,
        j.company,
        j.location,
        j.mode,
        j.source,
        j.published_at,
        j.applicants
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      WHERE a.user_id = ?
      ORDER BY a.updated_at DESC
    `, [user.id]) as any[];

    const columns: Record<string, any[]> = {
      saved: [],
      applied: [],
      interview: [],
      offer: [],
      rejected: []
    };

    for (const r of rows) {
      if (columns[r.status]) {
        columns[r.status].push(r);
      } else {
        columns.saved.push(r);
      }
    }

    return { columns, total: rows.length };
  } catch (err) {
    console.warn('[Banco:Kanban fetch error]', err);
    return { columns: { saved: [], applied: [], interview: [], offer: [], rejected: [] }, total: 0 };
  }
});
