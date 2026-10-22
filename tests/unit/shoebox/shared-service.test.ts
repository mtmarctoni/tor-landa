import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHandlers } from "@/features/shoebox/server/memory-handlers";
import { getMemoryService } from "@/features/shoebox/server/shared-service";
import {
  buildPage,
  createMockNotion,
  memoryId,
} from "../../helpers/mock-notion";

const mock = createMockNotion({
  pages: [buildPage({ id: memoryId(1), kind: "text", text: "hola" })],
});

vi.mock("@/features/shoebox/server/notion-gateway", async (original) => ({
  ...(await original<
    typeof import("@/features/shoebox/server/notion-gateway")
  >()),
  createSdkClient: vi.fn(() => mock.client),
}));

beforeEach(() => {
  vi.stubEnv("SHOEBOX_NOTION_DB_ID", "d4a1c0de-0000-4000-8000-00000000d001");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("shared memory service", () => {
  it("is built after auth only and shared by every handler set", async () => {
    const { createSdkClient } = await import(
      "@/features/shoebox/server/notion-gateway"
    );
    const session = async () => ({ id: "s", issuedAt: 1, expiresAt: 2 });
    const denied = createMemoryHandlers({
      requireSession: async () => {
        throw new Error("no");
      },
    });
    await denied.list(new Request("https://shoebox.test/api/shoebox/memories"));
    expect(createSdkClient).not.toHaveBeenCalled();

    const a = createMemoryHandlers({ requireSession: session });
    const b = createMemoryHandlers({ requireSession: session });
    const request = () =>
      new Request("https://shoebox.test/api/shoebox/memories");
    expect((await a.list(request())).status).toBe(200);
    expect((await b.list(request())).status).toBe(200);
    expect((await b.get(request(), memoryId(1))).status).toBe(200);
    expect(createSdkClient).toHaveBeenCalledTimes(1);
    expect(mock.counters.databasesRetrieve).toBe(1);
    expect(getMemoryService()).toBe(getMemoryService());
  });
});
