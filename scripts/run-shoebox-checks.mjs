#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { createHash, scryptSync } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  writeFileSync,
} from "node:fs";
import net from "node:net";
import { resolve } from "node:path";

// Explicit allowlist, not {...process.env}. Do not load dotenv or personal files.
const env = {};
for (const name of [
  "PATH",
  "HOME",
  "SHELL",
  "TMPDIR",
  "LANG",
  "LC_ALL",
  "TERM",
  "CI",
  "NO_COLOR",
]) {
  if (process.env[name] !== undefined) env[name] = process.env[name];
}
const salt = Buffer.alloc(16, 7);
Object.assign(env, {
  NODE_OPTIONS: `--require=${JSON.stringify(resolve("scripts/shoebox-offline.cjs"))}`,
  NEXT_TELEMETRY_DISABLED: "1",
  SHOEBOX_OFFLINE_AUDIT: "1",
  SHOEBOX_ISOLATED_CHECK: "1",
  NOTION_API_KEY: "test-notion-key",
  NOTION_DB_ID: "",
  BIRTHDAY_PHOTOS_DB_ID: "",
  TELEGRAM_BOT_TOKEN: "",
  TELEGRAM_CHAT_ID: "",
  NOTION_WEBHOOK_VERIFICATION_TOKEN: "",
  NEXT_PUBLIC_APP_URL: "",
  SHOEBOX_NOTION_DB_ID: "test-shoebox-db",
  SHOEBOX_PASSWORD_HASH: `scrypt-v1$${salt.toString("base64url")}$${scryptSync("caja sintética de prueba", salt, 64, { N: 32768, r: 8, p: 1, maxmem: 67108864 }).toString("base64url")}`,
  SHOEBOX_SESSION_SECRET: createHash("sha256")
    .update("tor-landa synthetic shoebox session secret")
    .digest("base64url"),
});

// Next loads .env files itself even with a clean parent environment. Refuse
// them by name, without reading contents. Use a separate clean worktree later.
for (const file of [
  ".env",
  ".env.local",
  ".env.production",
  ".env.production.local",
  ".env.development",
  ".env.development.local",
  ".env.test",
  ".env.test.local",
]) {
  if (existsSync(file))
    throw new Error(`Offline checks refuse ${file}; no contents were read`);
}
const port = process.env.SHOEBOX_CHECK_PORT ?? "3157";
if (!/^\d+$/.test(port)) throw new Error("Invalid SHOEBOX_CHECK_PORT");
env.SHOEBOX_APP_ORIGIN = `http://127.0.0.1:${port}`;
env.E2E_BASE_URL = env.SHOEBOX_APP_ORIGIN;
const scratch = resolve(
  process.env.SHOEBOX_CHECK_OUTPUT ??
    `${env.TMPDIR ?? "."}/opencode/shoebox-task10`,
);
mkdirSync(scratch, { recursive: true });
env.SHOEBOX_CAPTURE_DIR = resolve(scratch, "captures");
env.SHOEBOX_CHECK_SERVER_LOG = resolve(scratch, "production-server.log");
const gates = [];
function run(name, args, additions = {}) {
  console.log(`\nShoebox gate: ${name}`);
  const result = spawnSync("pnpm", args, {
    env: { ...env, ...additions },
    stdio: "inherit",
  });
  gates.push({ name, exit: result.status ?? 1 });
  writeFileSync(resolve(scratch, "gates.json"), JSON.stringify(gates, null, 2));
  if (result.status !== 0)
    throw new Error(`${name} failed (${result.status ?? result.signal})`);
}

let server;
let proxy;
async function start(production) {
  await new Promise((res, rej) => {
    const check = net.createServer();
    check.once("error", rej);
    check.listen(Number(port), "127.0.0.1", () => check.close(res));
  });
  const log = openSync(
    resolve(
      scratch,
      production ? "production-server.log" : "development-server.log",
    ),
    "w",
  );
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      production ? "start" : "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      port,
    ],
    {
      env: { ...env, NODE_ENV: production ? "production" : "development" },
      stdio: ["ignore", log, log],
    },
  );
  closeSync(log);
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null)
      throw new Error("Owned Next server exited before readiness");
    try {
      const response = await fetch(
        `http://127.0.0.1:${port}/api/shoebox/session`,
      );
      if (response.status === 401) return;
    } catch {}
    await new Promise((res) => setTimeout(res, 1000));
  }
  throw new Error("Owned Next server readiness timed out");
}
async function stop() {
  if (proxy && proxy.exitCode === null && proxy.signalCode === null) {
    const child = proxy;
    await new Promise((res) => {
      child.once("exit", res);
      child.kill("SIGTERM");
    });
    proxy = undefined;
  }
  if (!server || server.exitCode !== null || server.signalCode !== null) return;
  const child = server;
  await new Promise((res) => {
    child.once("exit", res);
    child.kill("SIGTERM");
  });
  server = undefined;
}
async function startProxy() {
  const tlsPort = Number(port) + 1;
  // Refuse an occupied port before creating any child; never reuse a listener.
  await new Promise((res, rej) => {
    const check = net.createServer();
    check.once("error", rej);
    check.listen(tlsPort, "127.0.0.1", () => check.close(res));
  });
  const key = resolve(scratch, "test-tls-key.pem");
  const cert = resolve(scratch, "test-tls-cert.pem");
  const generated = spawnSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      key,
      "-out",
      cert,
      "-days",
      "1",
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=IP:127.0.0.1,DNS:localhost",
    ],
    { env, stdio: "ignore" },
  );
  if (generated.status !== 0)
    throw Error("Synthetic local TLS certificate generation failed");
  proxy = spawn(
    process.execPath,
    ["scripts/shoebox-https-proxy.mjs", String(tlsPort), port, key, cert],
    { env, stdio: "inherit" },
  );
  for (let attempt = 0; attempt < 50; attempt++) {
    if (proxy.exitCode !== null) throw Error("Owned TLS proxy exited");
    const ready = await new Promise((res) => {
      const socket = net.connect(tlsPort, "127.0.0.1");
      socket.once("connect", () => {
        socket.destroy();
        res(true);
      });
      socket.once("error", () => res(false));
    });
    if (ready) return;
    await new Promise((res) => setTimeout(res, 100));
  }
  throw Error("Owned TLS proxy readiness timed out");
}
try {
  const mode = process.argv[2] ?? "all";
  // Vitest isolates web globals in VM contexts; preloading Node fetch before
  // that isolation breaks its Request signal propagation. Unit setup already
  // installs the transport guard inside each context. Next is always preloaded.
  if (mode === "unit")
    run("unit", ["test:unit", ...process.argv.slice(3)], { NODE_OPTIONS: "" });
  else if (mode === "chromium") {
    await start(false);
    run("focused Chromium E2E", [
      "test:e2e",
      ...process.argv.slice(3),
      "--workers=2",
      `--output=${scratch}/focused-chromium`,
    ]);
  } else {
    if (mode === "all") {
      run("unit", ["test:unit"], { NODE_OPTIONS: "" });
      run("original check", ["check"], { NODE_ENV: "production" });
      await start(false);
      run("original Chromium E2E", [
        "test:e2e",
        "--workers=2",
        `--output=${scratch}/chromium`,
      ]);
      await stop();
    } else if (mode !== "production")
      throw new Error("Use all, unit, chromium or production");
    env.SHOEBOX_CHECK_INTERNAL_ORIGIN = `http://127.0.0.1:${port}`;
    env.SHOEBOX_APP_ORIGIN = `https://127.0.0.1:${Number(port) + 1}`;
    env.E2E_BASE_URL = env.SHOEBOX_APP_ORIGIN;
    env.SHOEBOX_E2E_HTTPS = "1";
    if (mode === "production")
      run("synthetic production build", ["build"], { NODE_ENV: "production" });
    await start(true);
    await startProxy();
    run(
      "strict production privacy/auth/media",
      [
        "test:e2e",
        "tests/e2e/shoebox-auth.spec.ts",
        "tests/e2e/shoebox-media-privacy.spec.ts",
        "tests/e2e/shoebox-privacy.spec.ts",
        "--workers=2",
        `--output=${scratch}/production`,
      ],
      { SHOEBOX_E2E_PRODUCTION: "1" },
    );
    run(
      "multi-engine compatibility",
      ["test:shoebox:browsers", "--workers=2", `--output=${scratch}/engines`],
      { SHOEBOX_E2E_PRODUCTION: "1" },
    );
    run("client/HTML/RSC canaries and traced worker", [
      "exec",
      "node",
      "scripts/check-shoebox-bundle.mjs",
    ]);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await stop();
}
