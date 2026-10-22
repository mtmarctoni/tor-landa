import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";
import { smokeWorkerArtifact } from "../../../scripts/shoebox-worker-artifact.mjs";

const require = createRequire(import.meta.url);
// Use the same tracer, glob semantics and matcher as this installed Next build.
const { nodeFileTrace } = require("next/dist/compiled/@vercel/nft");
const glob = require("next/dist/compiled/glob");
const picomatch = require("next/dist/compiled/picomatch");
const root = process.cwd();
const fixture = (name: string) =>
  new Uint8Array(readFileSync(join(root, "tests/fixtures/shoebox", name)));

async function deploymentFiles(route: string): Promise<string[]> {
  const server = await nodeFileTrace(
    [require.resolve("next/dist/server/next-server.js")],
    { base: root },
  );
  const includes = Object.entries(nextConfig.outputFileTracingIncludes ?? {})
    .filter(([pattern]) =>
      picomatch(pattern, { dot: true, contains: true })(route),
    )
    .flatMap(([, files]) => files);
  const matches = await Promise.all(
    includes.map(
      (pattern) =>
        new Promise<string[]>((resolveFiles, reject) => {
          glob(
            pattern,
            { cwd: root, nodir: true, dot: true },
            (error: Error | null, files: string[]) => {
              if (error) reject(error);
              else resolveFiles(files);
            },
          );
        }),
    ),
  );
  return [...new Set<string>([...server.fileList, ...matches.flat()])];
}

const samples = [
  { kind: "photo", mode: "inspect", bytes: fixture("photo-edge-2048.jpg") },
  {
    kind: "photo",
    mode: "validate",
    bytes: fixture("photo-exif-orientation-gps.jpg"),
  },
  {
    kind: "audio",
    mode: "inspect",
    bytes: fixture("audio-webm-opus-2s-no-duration.webm"),
  },
  { kind: "audio", mode: "validate", bytes: fixture("audio-fmp4-aac-2s.m4a") },
];

describe("production media worker packaging", () => {
  it.each([
    "/api/shoebox/memories",
    "/api/shoebox/memories/fixture-id",
    "/api/shoebox/memories/fixture-id/media",
  ])(
    "runs photo/audio workers for %s without source-tree dependencies",
    async (route) => {
      const results = await smokeWorkerArtifact({
        files: await deploymentFiles(route),
        root,
        scratch: resolve(tmpdir(), "opencode"),
        fixtures: samples,
      });
      expect(results).toHaveLength(4);
      expect(results[0]).toMatchObject({
        kind: "photo",
        width: 2048,
        height: 1024,
      });
      expect(results[1]).toMatchObject({
        kind: "photo",
        width: 32,
        height: 64,
      });
      expect(results[2].durationSeconds).toBeGreaterThan(0);
      expect(results[3].durationSeconds).toBeGreaterThan(0);
    },
    30_000,
  );

  it("fails when the deployment omits native libraries instead of borrowing local copies", async () => {
    const files = (
      await deploymentFiles("/api/shoebox/memories/fixture-id/media")
    ).filter(
      (file) =>
        !file.endsWith(".node") &&
        !file.endsWith(".dylib") &&
        !/\.so(?:\.|$)/.test(file),
    );
    await expect(
      smokeWorkerArtifact({
        files,
        root,
        scratch: resolve(tmpdir(), "opencode"),
        fixtures: samples.slice(0, 1),
      }),
    ).rejects.toThrow(/Could not load the "sharp" module/);
  }, 30_000);
});
