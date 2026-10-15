import { db } from '../../utils/db';
import { requireUser } from '../../utils/auth';

const parse = (s: any) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };

// Currículo, perfil e filtros salvos da pessoa
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const row = await db.get('SELECT profile, cv_text, filters FROM user_data WHERE user_id = ?', [user.id]) as any;
  return { profile: parse(row?.profile), cvText: row?.cv_text || '', filters: parse(row?.filters) };
});
