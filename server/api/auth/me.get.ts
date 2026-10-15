import { MODE, getUser } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await getUser(event);
  return {
    mode: MODE,
    user: user ? { id: user.id, email: user.email, name: user.name, isAdmin: !!user.is_admin, local: !!user.local } : null,
    inviteRequired: MODE === 'hosted' && !!process.env.JOBFINDER_CONVITE,
  };
});
