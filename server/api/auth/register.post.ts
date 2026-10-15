import { db } from '../../utils/db';
import { MODE, hashPassword, createSession, rateLimit } from '../../utils/auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default defineEventHandler(async (event) => {
  if (MODE !== 'hosted') throw createError({ statusCode: 400, message: 'Cadastro só existe no modo hospedado.' });
  await rateLimit(event, 'register', 5, 3600e3);
  const { email = '', password = '', name = '', invite = '' } = (await readBody(event)) || {};
  const mail = String(email).trim().toLowerCase();

  // Se JOBFINDER_CONVITE estiver definido, só entra quem tiver o código
  if (process.env.JOBFINDER_CONVITE && invite !== process.env.JOBFINDER_CONVITE) {
    throw createError({ statusCode: 403, message: 'Código de convite inválido.' });
  }
  if (!EMAIL_RE.test(mail)) throw createError({ statusCode: 400, message: 'E-mail inválido.' });
  if (String(password).length < 8) throw createError({ statusCode: 400, message: 'A senha precisa ter pelo menos 8 caracteres.' });
  if (await db.get('SELECT 1 FROM users WHERE email = ?', [mail])) {
    throw createError({ statusCode: 409, message: 'Já existe uma conta com esse e-mail.' });
  }

  // A primeira conta criada vira administradora (gerencia empresas e o índice)
  const first = !(await db.get('SELECT 1 FROM users LIMIT 1'));
  const created = await db.get('INSERT INTO users (email, name, pass_hash, is_admin) VALUES (?, ?, ?, ?) RETURNING id',
    [mail, String(name).trim().slice(0, 80) || null, hashPassword(String(password)), first ? 1 : 0]) as any;
  await createSession(event, created.id);
  return { ok: true };
});
