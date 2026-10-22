// Runs before every Pages Function and static asset (see _routes.json "/*").
// www -> apex in one 301, then the build-id-keyed edge cache for public
// static responses. Logic and the revocation argument: functions/_shared/edge_cache.js.
import { edgeCache } from './_shared/edge_cache.js';
export const onRequest = [edgeCache];
