import { db } from '../../utils/db';
import { requireUser } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const body = (await readBody(event)) || {};
  const json = (v: any, max: number) => (v == null ? null : JSON.stringify(v).slice(0, max));
  await db.run(`INSERT INTO user_data (user_id, profile, cv_text, filters, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      profile = COALESCE(excluded.profile, user_data.profile),
      cv_text = COALESCE(excluded.cv_text, user_data.cv_text),
      filters = COALESCE(excluded.filters, user_data.filters),
      updated_at = CURRENT_TIMESTAMP`, [user.id, 'profile' in body ? json(body.profile, 50_000) ?? 'null' : null,
      'cvText' in body ? String(body.cvText ?? '').slice(0, 60_000) : null,
      'filters' in body ? json(body.filters, 10_000) : null]);
  return { ok: true };
});
