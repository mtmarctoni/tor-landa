// Test-only Node preload. Inherited by Next's child processes and workers.
// No app fixture switch, credential access or public-network fallback.
const net = require("node:net");
const tls = require("node:tls");
const dns = require("node:dns");
const { syncBuiltinESMExports } = require("node:module");
const allowed = new Set(["127.0.0.1", "::1", "[::1]", "localhost"]);
let reported = false;
const blocked = () => {
  if (!reported && process.env.SHOEBOX_OFFLINE_AUDIT === "1") {
    console.error("[shoebox-offline] external transport blocked locally");
    reported = true;
  }
  return new Error("offline test guard: outbound network blocked");
};

function hostOf(args) {
  if (Array.isArray(args[0])) return hostOf(args[0]);
  const [first, second] = args;
  if (first && typeof first === "object") {
    if (first.path) return undefined; // local Unix socket
    return first.host ?? first.hostname ?? "localhost";
  }
  if (typeof first === "string" && !/^\d+$/.test(first)) return undefined;
  return typeof second === "string" ? second : "localhost";
}

const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const host = hostOf(args);
  if (host !== undefined && !allowed.has(host)) {
    queueMicrotask(() => this.destroy(blocked()));
    return this;
  }
  return connect.apply(this, args);
};
const tlsConnect = tls.connect;
tls.connect = function (...args) {
  const host = hostOf(args);
  if (host !== undefined && !allowed.has(host)) throw blocked();
  return tlsConnect.apply(this, args);
};
const lookup = dns.lookup;
dns.lookup = function (host, ...args) {
  if (!allowed.has(host)) {
    const callback = args.at(-1);
    if (typeof callback === "function")
      return queueMicrotask(() => callback(blocked()));
    throw blocked();
  }
  return lookup.call(this, host, ...args);
};
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const raw =
    typeof input === "string" || input instanceof URL ? input : input.url;
  if (!allowed.has(new URL(raw).hostname)) return Promise.reject(blocked());
  return originalFetch(input, init);
};
globalThis.__SHOEBOX_OFFLINE__ = true;
syncBuiltinESMExports();
