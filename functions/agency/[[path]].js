import { requireAgencySession } from '../_shared/github_admin.js';
export async function onRequest(context) {
  const auth=await requireAgencySession(context);
  if(!auth.ok){const url=new URL(context.request.url);return Response.redirect(`${url.origin}/api/admin/github/login?return_to=%2Fagency%2F`,302);}
  return context.env.ASSETS.fetch(context.request);
}
