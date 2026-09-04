import { liveTakedownGate } from '../_shared/live_gate.js';
export async function onRequest(context) {
  return liveTakedownGate(context);
}
