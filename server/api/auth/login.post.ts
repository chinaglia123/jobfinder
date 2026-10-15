import { db } from '../../utils/db';
import { MODE, verifyPassword, createSession, rateLimit } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  if (MODE !== 'hosted') return { ok: true };
  await rateLimit(event, 'login', 10, 15 * 60e3);
  const { email = '', password = '' } = (await readBody(event)) || {};
  const user = await db.get('SELECT id, pass_hash FROM users WHERE email = ?', [String(email).trim().toLowerCase()]) as any;
  if (!user || !verifyPassword(String(password), user.pass_hash)) {
    throw createError({ statusCode: 401, message: 'E-mail ou senha incorretos.' });
  }
  await createSession(event, user.id);
  return { ok: true };
});
