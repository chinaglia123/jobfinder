import { db } from '../../utils/db';
import { requireUser } from '../../utils/auth';

// Remove a vaga do quadro de candidaturas (a vaga continua no histórico de buscas)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const id = Number(getRouterParam(event, 'id'));
  await db.run('DELETE FROM applications WHERE id = ? AND user_id = ?', [id, user.id]);
  return { ok: true };
});
