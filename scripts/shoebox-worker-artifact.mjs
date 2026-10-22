// Verification tooling only: run the worker using copied deployment files,
// never the checkout's node_modules or credentials.
import assert from "node:assert/strict";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { Worker } from "node:worker_threads";

/** Relocate only declared files and their symlink ancestors, as deployment does. */
export function copyWorkerArtifact(files, root, destination) {
  const sourceRoot = realpathSync(root);
  const relativePath = (source) => {
    const result = relative(sourceRoot, source);
    assert.ok(
      result &&
        !result.startsWith(`..${sep}`) &&
        result !== ".." &&
        !isAbsolute(result),
      "Traced dependency escapes the project root",
    );
    return result;
  };
  for (const file of new Set(files)) {
    const source = resolve(sourceRoot, file);
    const parts = relativePath(source).split(sep);
    // Recreate links without retaining absolute source-machine targets.
    for (let index = 1; index <= parts.length; index++) {
      const ancestor = join(sourceRoot, ...parts.slice(0, index));
      if (!lstatSync(ancestor).isSymbolicLink()) continue;
      const parent = join(
        destination,
        relativePath(realpathSync(dirname(ancestor))),
      );
      const link = join(parent, parts[index - 1]);
      const target = join(destination, relativePath(realpathSync(ancestor)));
      mkdirSync(parent, { recursive: true });
      if (!existsSync(link)) {
        try {
          symlinkSync(relative(parent, target), link);
        } catch (error) {
          if (error.code !== "EEXIST") throw error;
        }
      }
    }
    const actual = realpathSync(source);
    if (!lstatSync(actual).isFile()) continue;
    const target = join(destination, relativePath(actual));
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(actual, target);
  }
}

/** Synthetic bytes only. Every module must resolve inside the isolated copy. */
export async function smokeWorkerArtifact({ files, root, scratch, fixtures }) {
  mkdirSync(scratch, { recursive: true });
  const directory = mkdtempSync(join(scratch, "shoebox-worker-"));
  try {
    copyWorkerArtifact(files, root, directory);
    const results = [];
    for (const fixture of fixtures) {
      const worker = new Worker(
        join(directory, "src/features/shoebox/server/media-worker.mjs"),
        {
          env: {},
          execArgv: [],
          resourceLimits: { maxOldGenerationSizeMb: 64 },
        },
      );
      try {
        const reply = await new Promise((resolveReply, reject) => {
          const timer = setTimeout(
            () => reject(Error("Isolated worker deadline")),
            5000,
          );
          worker.once("message", (value) => {
            clearTimeout(timer);
            resolveReply(value);
          });
          worker.once("error", (error) => {
            clearTimeout(timer);
            reject(error);
          });
          worker.once("exit", (code) => {
            clearTimeout(timer);
            reject(Error(`Isolated worker exited without a reply (${code})`));
          });
          worker.postMessage({
            kind: fixture.kind,
            mode: fixture.mode,
            bytes: fixture.bytes,
          });
        });
        assert.equal(
          reply.ok,
          true,
          `Isolated worker rejected ${fixture.kind}/${fixture.mode}`,
        );
        results.push({
          kind: reply.kind,
          width: reply.width,
          height: reply.height,
          durationSeconds: reply.durationSeconds,
        });
      } finally {
        await worker.terminate();
      }
    }
    return results;
  } finally {
    // Only the directory this invocation created, never a caller's directory.
    rmSync(directory, { recursive: true, force: true });
  }
}
