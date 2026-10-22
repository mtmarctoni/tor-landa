#!/usr/bin/env node
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { smokeWorkerArtifact } from "./shoebox-worker-artifact.mjs";

/** Only paths and variable names leave this scanner, never canary values. */
export function scanClientCanaries(directory, canaries) {
  const hits = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) hits.push(...scanClientCanaries(file, canaries));
    else {
      const bytes = readFileSync(file);
      for (const [name, value] of Object.entries(canaries)) {
        if (value && bytes.includes(Buffer.from(value)))
          hits.push({ file, name });
      }
    }
  }
  return hits;
}

async function main() {
  assert.equal(
    globalThis.__SHOEBOX_OFFLINE__,
    true,
    "Use the guarded check:shoebox runner",
  );
  const names = [
    "NOTION_API_KEY",
    "SHOEBOX_PASSWORD_HASH",
    "SHOEBOX_SESSION_SECRET",
  ];
  const canaries = Object.fromEntries(
    names.map((name) => {
      assert.ok(process.env[name], `Missing synthetic ${name}`);
      return [name, process.env[name]];
    }),
  );
  const output =
    process.env.SHOEBOX_ISOLATED_CHECK === "1"
      ? ".next/shoebox-check"
      : ".next";
  const hits = scanClientCanaries(join(output, "static"), canaries);
  assert.deepEqual(hits, [], `Client canary hits: ${JSON.stringify(hits)}`);
  // The authenticated valid-file smoke must reach the actual Next process's
  // outbound guard. A fake key/503/browser route alone cannot satisfy this.
  const serverLog = readFileSync(process.env.SHOEBOX_CHECK_SERVER_LOG, "utf8");
  assert.ok(
    serverLog.includes("[shoebox-offline] external transport blocked locally"),
    "No actual Next-process offline guard evidence",
  );
  assert.ok(
    !serverLog.includes("@notionhq/client warn:"),
    "Raw SDK warning in owned server log",
  );
  const origin =
    process.env.SHOEBOX_CHECK_INTERNAL_ORIGIN ?? process.env.SHOEBOX_APP_ORIGIN;
  const login = await fetch(`${origin}/api/shoebox/session`, {
    method: "POST",
    headers: {
      Origin: process.env.SHOEBOX_APP_ORIGIN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password: "caja sintética de prueba" }),
  });
  assert.equal(login.status, 200);
  const Cookie = login.headers.get("set-cookie").split(";")[0];
  for (const path of ["/shoebox/login", "/shoebox", "/shoebox?_rsc=canary"]) {
    const response = await fetch(`${origin}${path}`, {
      headers: {
        ...(path === "/shoebox/login" ? {} : { Cookie }),
        ...(path.includes("_rsc")
          ? { RSC: "1", "Next-Router-Prefetch": "1" }
          : {}),
      },
    });
    assert.equal(response.status, 200);
    const body = await response.text();
    for (const [name, value] of Object.entries(canaries))
      assert.ok(!body.includes(value), `Rendered canary: ${name} in ${path}`);
  }
  // A source-tree worker can borrow untraced packages. Copy the actual emitted
  // files for EACH memory route plus Next's server trace into an isolated root.
  const serverTracePath = join(output, "next-server.js.nft.json");
  const serverFiles = JSON.parse(
    readFileSync(serverTracePath, "utf8"),
  ).files.map((file) => resolve(dirname(serverTracePath), file));
  const fixtures = [
    ["photo", "photo-exif-orientation-gps.jpg", "validate"],
    ["photo", "photo-edge-2048.jpg", "inspect"],
    ["audio", "audio-webm-opus-2s-no-duration.webm", "inspect"],
    ["audio", "audio-fmp4-aac-2s.m4a", "validate"],
  ].map(([kind, name, mode]) => ({
    kind,
    mode,
    bytes: new Uint8Array(readFileSync(`tests/fixtures/shoebox/${name}`)),
  }));
  for (const route of ["", "/[id]", "/[id]/media"]) {
    const tracePath = join(
      output,
      `server/app/api/shoebox/memories${route}/route.js.nft.json`,
    );
    const files = JSON.parse(readFileSync(tracePath, "utf8")).files.map(
      (file) => resolve(dirname(tracePath), file),
    );
    for (const suffix of [
      "src/features/shoebox/server/media-worker.mjs",
      "src/features/shoebox/media-inspection.mjs",
      "mediabunny/package.json",
    ]) {
      assert.ok(
        files.some((file) => file.endsWith(suffix)),
        `Missing traced ${suffix} for memories${route}`,
      );
    }
    await smokeWorkerArtifact({
      files: [...files, ...serverFiles],
      root: process.cwd(),
      scratch: join(tmpdir(), "opencode"),
      fixtures,
    });
  }
  console.log(
    "Client static + HTML/RSC canaries absent; isolated traced JPEG/WebM/fMP4 workers passed for all memory routes",
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
