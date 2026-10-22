import { afterEach, expect, it, vi } from "vitest";
import { createSdkClient } from "@/features/shoebox/server/notion-gateway";

afterEach(() => vi.restoreAllMocks());

it("disables raw SDK logging even when an upstream error embeds private data", async () => {
  const logs = ["log", "warn", "error", "debug", "info"].map((method) =>
    vi.spyOn(console, method as "warn").mockImplementation(() => undefined),
  );
  const client = createSdkClient(
    "synthetic-api-canary",
    async () =>
      new Response(
        JSON.stringify({
          object: "error",
          status: 401,
          code: "unauthorized",
          message:
            "synthetic-private-note https://example.invalid/bearer-canary",
        }),
        { status: 401, headers: { "content-type": "application/json" } },
      ),
  );
  await expect(
    client.databases.retrieve({ database_id: "synthetic-db" }),
  ).rejects.toThrow();
  expect(logs.flatMap((log) => log.mock.calls)).toEqual([]);
});
