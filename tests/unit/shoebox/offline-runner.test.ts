import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it("refuses a runtime dotenv file by name without printing its synthetic contents", () => {
  const scratch = resolve(tmpdir(), "opencode");
  mkdirSync(scratch, { recursive: true });
  const directory = mkdtempSync(resolve(scratch, "shoebox-env-refusal-"));
  writeFileSync(
    resolve(directory, ".env.local"),
    "PRIVATE_CONTENT=synthetic-do-not-print",
  );
  const result = spawnSync(
    process.execPath,
    [resolve("scripts/run-shoebox-checks.mjs"), "unit"],
    {
      cwd: directory,
      env: { PATH: process.env.PATH, NODE_ENV: "test" },
      encoding: "utf8",
    },
  );
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain(
    "Offline checks refuse .env.local; no contents were read",
  );
  expect(result.stderr + result.stdout).not.toContain("synthetic-do-not-print");
});

it("preloads a fail-closed guard in real child and grandchild processes", () => {
  const probe = `
    const assert = require('node:assert/strict');
    assert.equal(globalThis.__SHOEBOX_OFFLINE__, true);
    (async () => {
      for (const url of ['https://example.invalid', 'http://203.0.113.1']) {
        await assert.rejects(fetch(url), /offline test guard/);
      }
      const net = require('node:net');
      for (const host of ['example.invalid', '203.0.113.1']) {
        await new Promise((resolve, reject) => {
          const socket = net.connect({host, port: 443});
          socket.on('connect', () => reject(Error('external connection')));
          socket.on('error', error => {
            try { assert.match(error.message, /offline test guard/); resolve(); }
            catch (error) { reject(error); }
          });
        });
      }
      const server = net.createServer(socket => socket.end());
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      await new Promise((resolve, reject) => {
        const socket = net.connect(server.address().port, '127.0.0.1');
        socket.on('end', resolve); socket.on('error', reject); socket.resume();
      });
      await new Promise(resolve => server.close(resolve));
      assert.throws(() => require('node:tls').connect({host:'203.0.113.1',port:443}), /offline test guard/);
      const redirect = require('node:http').createServer((request, response) => {
        response.writeHead(302, {Location:'https://example.invalid'}); response.end();
      });
      await new Promise(resolve => redirect.listen(0, '127.0.0.1', resolve));
      await assert.rejects(fetch('http://127.0.0.1:' + redirect.address().port),
        error => /offline test guard/.test(error.cause?.message ?? error.message));
      await new Promise(resolve => redirect.close(resolve));
      const child = require('node:child_process').spawnSync(process.execPath,
        ['-e', 'if (!globalThis.__SHOEBOX_OFFLINE__) process.exit(9)'], {env: process.env});
      assert.equal(child.status, 0);
    })().catch(error => { console.error(error.message); process.exitCode = 1; });
  `;
  const result = spawnSync(process.execPath, ["-e", probe], {
    env: {
      NODE_ENV: "test",
      PATH: process.env.PATH,
      NODE_OPTIONS: `--require=${resolve("scripts/shoebox-offline.cjs")}`,
    },
    encoding: "utf8",
    timeout: 15_000,
  });
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
});
