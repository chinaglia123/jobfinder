import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import type { H3Event } from 'h3';
import { db } from './db';

/**
 * Dois modos:
 *  - "local" (padrão): uma pessoa usando no próprio computador, sem login. Dados ficam no user_id 0.
 *  - "hosted": site no ar para várias pessoas. Exige conta, e cada um vê só os próprios dados.
 */
export const MODE = process.env.JOBFINDER_MODE === 'hosted' ? 'hosted' : 'local';
export const LOCAL_USER = { id: 0, email: 'local', name: 'Você', is_admin: 1, local: true };

const COOKIE = 'jf_session';
const SESSION_DAYS = 30;

export function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string) {
  const [alg, saltHex, hashHex] = (stored || '').split('$');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

export async function createSession(event: H3Event, userId: number) {
  const token = randomBytes(32).toString('base64url');
  const expires = Date.now() + SESSION_DAYS * 864e5;
  await db.run('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [sha(token), userId, expires]);
  const https = getRequestURL(event, { xForwardedProto: true }).protocol === 'https:';
  setCookie(event, COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: https, path: '/', maxAge: SESSION_DAYS * 86400 });
}

export async function destroySession(event: H3Event) {
  const token = getCookie(event, COOKIE);
  if (token) await db.run('DELETE FROM sessions WHERE token_hash = ?', [sha(token)]);
  deleteCookie(event, COOKIE, { path: '/' });
}

/** Usuário da requisição (ou null). No modo local é sempre o usuário local. */
export async function getUser(event: H3Event): Promise<any> {
  if (MODE === 'local') return LOCAL_USER;
  if (event.context.user !== undefined) return event.context.user;
  const token = getCookie(event, COOKIE);
  let user = null;
  if (token) {
    user = await db.get(`SELECT u.id, u.email, u.name, u.is_admin FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?`, [sha(token), Date.now()]);
  }
  event.context.user = user;
  return user;
}

export async function requireUser(event: H3Event) {
  const user = await getUser(event);
  if (!user) throw createError({ statusCode: 401, message: 'Entre na sua conta para continuar.' });
  return user;
}

export async function requireAdmin(event: H3Event) {
  const user = await requireUser(event);
  if (!user.is_admin) throw createError({ statusCode: 403, message: 'Apenas administradores podem fazer isso.' });
  return user;
}

// ===== Limite de uso (por usuário ou IP), guardado no banco =====
// Na Vercel cada execução pode cair numa instância diferente, então a contagem não pode ficar só na memória.

/** Permite `max` chamadas por janela de `windowMs`. Lança 429 quando passar. */
/** Usos de IA por dia que cada pessoa tem com a chave do site (JOBFINDER_IA_POR_DIA) */
export const AI_PER_DAY = Math.max(1, Number(process.env.JOBFINDER_IA_POR_DIA) || 40);

export async function rateLimit(event: H3Event, name: string, max: number, windowMs: number, message?: string) {
  if (MODE === 'local') return;
  const who = (await getUser(event))?.id ?? (getRequestIP(event, { xForwardedFor: true }) || 'anon');
  const key = `${name}:${who}`;
  const now = Date.now();
  const row = await db.get(`INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET
      count = CASE WHEN rate_limits.reset_at <= ? THEN 1 ELSE rate_limits.count + 1 END,
      reset_at = CASE WHEN rate_limits.reset_at <= ? THEN excluded.reset_at ELSE rate_limits.reset_at END
    RETURNING count, reset_at`, [key, now + windowMs, now, now]);
  if (row && row.count > max) {
    const wait = Math.max(1, Math.ceil((row.reset_at - now) / 60000));
    throw createError({ statusCode: 429, message: message || `Muitas solicitações. Tente de novo em ${wait} min.` });
  }
}

/** Limpeza de sessões e contadores vencidos (chamada pelo indexador/cron) */
export async function cleanupAuth() {
  const now = Date.now();
  await db.batch([
    { sql: 'DELETE FROM sessions WHERE expires_at < ?', args: [now] },
    { sql: 'DELETE FROM rate_limits WHERE reset_at < ?', args: [now] },
  ]);
}
