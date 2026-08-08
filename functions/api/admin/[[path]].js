import { handleAdminRoute } from '../../_shared/github_admin.js';
export async function onRequest(context) {
  const raw=context.params.path;
  const segments=Array.isArray(raw)?raw:(raw?[raw]:[]);
  return handleAdminRoute(context,segments);
}
