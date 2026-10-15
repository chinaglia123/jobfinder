import { db } from '../../utils/db';
import { requireAdmin } from '../../utils/auth';

// Liga/desliga uma empresa do índice. Ao desligar, as vagas dela saem das buscas.
export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const id = Number(getRouterParam(event, 'id'));
  const { enabled } = (await readBody(event)) || {};
  // Ao religar, zera last_indexed para o indexador baixar as vagas na próxima rodada
  await db.run('UPDATE companies SET enabled = ?, last_indexed = CASE WHEN ? THEN NULL ELSE last_indexed END WHERE id = ?', [enabled ? 1 : 0, enabled ? 1 : 0, id]);
  if (!enabled) await db.run('DELETE FROM index_jobs WHERE company_id = ?', [id]);
  return db.get('SELECT * FROM companies WHERE id = ?', [id]);
});
