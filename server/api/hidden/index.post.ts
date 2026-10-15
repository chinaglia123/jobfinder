import { db } from '../../utils/db';
import { requireUser } from '../../utils/auth';

// Oculta (hide: true, padrão) ou volta a mostrar (hide: false) uma vaga
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const { url = '', title = '', company = '', hide = true } = (await readBody(event)) || {};
  if (!/^https?:\/\//.test(url)) throw createError({ statusCode: 400, message: 'Vaga inválida.' });
  if (hide) {
    await db.run('INSERT OR IGNORE INTO hidden_jobs (user_id, url, title, company) VALUES (?, ?, ?, ?)',
      [user.id, String(url).slice(0, 600), String(title).slice(0, 200), String(company).slice(0, 120)]);
  } else {
    await db.run('DELETE FROM hidden_jobs WHERE user_id = ? AND url = ?', [user.id, url]);
  }
  return { ok: true };
});
