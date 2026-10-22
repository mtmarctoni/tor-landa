// Local test TLS termination only. Fixed loopback upstream, no arbitrary proxy.
import { readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";

if (!globalThis.__SHOEBOX_OFFLINE__) throw Error("Offline preload required");
const [port, upstream, keyPath, certPath] = process.argv.slice(2);
const server = https.createServer(
  { key: readFileSync(keyPath), cert: readFileSync(certPath) },
  (request, response) => {
    const outgoing = http.request(
      {
        hostname: "127.0.0.1",
        port: Number(upstream),
        method: request.method,
        path: request.url,
        headers: { ...request.headers, "x-forwarded-proto": "https" },
      },
      (incoming) => {
        response.writeHead(incoming.statusCode, incoming.headers);
        incoming.pipe(response);
      },
    );
    outgoing.on("error", () => {
      response.writeHead(502);
      response.end();
    });
    request.on("aborted", () => outgoing.destroy());
    request.pipe(outgoing);
  },
);
server.listen(Number(port), "127.0.0.1");
process.once("SIGTERM", () => server.close(() => process.exit(0)));
