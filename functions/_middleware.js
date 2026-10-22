// Runs before every Pages Function and static asset (_routes.json "/*"):
// www -> apex in one 301, then s-maxage on public 200s for the zone cache.
// Logic, exclusions and the revoke/purge argument: functions/_shared/edge_cache.js.
import { edgeCache } from './_shared/edge_cache.js';
export const onRequest = [edgeCache];
