import { db } from '../../utils/db';

export default defineEventHandler(() => {
  return db.all("SELECT id, ats, slug, name, enabled, last_indexed, job_count, error FROM companies ORDER BY ats = 'feed', name COLLATE NOCASE");
});
