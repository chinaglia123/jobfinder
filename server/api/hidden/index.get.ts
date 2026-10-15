import { db } from '../../utils/db';
import { requireUser } from '../../utils/auth';

// Lista de vagas ocultas pela pessoa (para poder desfazer)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  return db.all('SELECT url, title, company, hidden_at FROM hidden_jobs WHERE user_id = ? ORDER BY hidden_at DESC', [user.id]);
});
