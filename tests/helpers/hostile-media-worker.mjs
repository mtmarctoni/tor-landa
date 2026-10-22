// Test-only stand-in for media-worker.mjs, selected per validator instance in
// unit tests. The first byte of the transferred media picks a behaviour, so
// the parent's real message protocol is exercised unchanged.
import { parentPort } from "node:worker_threads";

// Modes: 1 = hang, 2 = exhaust the JS heap, 3 = echo the visible env size.
const HOSTILE = { HANG: 1, ALLOCATE: 2, ECHO_ENV: 3 };

parentPort?.once("message", (message) => {
  const mode = message?.bytes?.[0];
  if (mode === HOSTILE.HANG) {
    // Keep the event loop alive and never answer.
    setInterval(() => undefined, 1_000);
    return;
  }
  if (mode === HOSTILE.ALLOCATE) {
    // A falsified "huge allocation": grow the JS heap until the worker's
    // resourceLimits stop it.
    const hoard = [];
    for (;;) hoard.push(new Array(1_000_000).fill(hoard.length));
  }
  if (mode === HOSTILE.ECHO_ENV) {
    // Reports how many environment variables the worker can see as the
    // duration, so the parent test can prove nothing was shared.
    parentPort?.postMessage({
      ok: true,
      kind: "audio",
      container: "webm",
      durationSeconds: Object.keys(process.env).length + 1,
    });
  }
});
