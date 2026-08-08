import { requireAgencySession } from '../_shared/github_admin.js';
export async function onRequest(context) {
  const auth = await requireAgencySession(context);
  if (!auth.ok) return auth.response;
  return context.env.ASSETS.fetch(context.request);
}
