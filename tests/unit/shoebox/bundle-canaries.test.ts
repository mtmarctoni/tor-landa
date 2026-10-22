import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

it("scans only client assets, detects a canary, and reports names/paths not values", async () => {
  const { scanClientCanaries } = await import(
    "../../../scripts/check-shoebox-bundle.mjs"
  );
  const scratch = join(tmpdir(), "opencode");
  mkdirSync(scratch, { recursive: true });
  const root = mkdtempSync(join(scratch, "shoebox-canary-"));
  mkdirSync(join(root, "static"));
  writeFileSync(join(root, "static", "client.js"), "synthetic-secret-canary");
  writeFileSync(join(root, "server.js"), "synthetic-server-only");
  const hits = scanClientCanaries(join(root, "static"), {
    SESSION_SECRET: "synthetic-secret-canary",
  });
  expect(hits).toEqual([
    { file: join(root, "static", "client.js"), name: "SESSION_SECRET" },
  ]);
  expect(JSON.stringify(hits)).not.toContain("synthetic-secret-canary");
  expect(
    scanClientCanaries(join(root, "static"), { KEY: "synthetic-server-only" }),
  ).toEqual([]);
});
