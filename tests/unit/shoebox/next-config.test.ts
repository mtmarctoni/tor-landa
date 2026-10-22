import type { NextConfig } from "next";
import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

/** next.config.ts reads NODE_ENV while it loads, so import it fresh. */
async function loadConfig(nodeEnv: string): Promise<NextConfig> {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", nodeEnv);
  return (await import("../../../next.config")).default;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  expect(process.env.NODE_ENV).toBe(ORIGINAL_NODE_ENV);
});

describe("image optimizer allowlist", () => {
  it("optimizes only /images/** with an empty search in production", async () => {
    const config = await loadConfig("production");
    expect(config.images?.localPatterns).toEqual([
      { pathname: "/images/**", search: "" },
    ]);
  });

  it("adds only the dev-only synthetic fixture path outside production", async () => {
    const config = await loadConfig("development");
    expect(config.images?.localPatterns).toEqual([
      { pathname: "/images/**", search: "" },
      { pathname: "/__fixtures/**", search: "" },
    ]);
  });

  it("no remote pattern can reach this app or any shoebox path", async () => {
    for (const env of ["production", "development"]) {
      const config = await loadConfig(env);
      const remote = config.images?.remotePatterns ?? [];
      for (const pattern of remote) {
        const text = JSON.stringify(pattern);
        expect(text, env).not.toMatch(/shoebox|\/api\b/i);
        expect(text, env).not.toMatch(/localhost|127\.0\.0\.1|\[::1\]/);
        const hostname =
          pattern instanceof URL ? pattern.hostname : pattern.hostname;
        expect(hostname, env).not.toContain("*");
      }
      expect(config.images?.dangerouslyAllowLocalIP ?? false).toBe(false);
      expect(config.images?.loader ?? "default").toBe("default");
      expect(config.images?.path ?? "/_next/image").toBe("/_next/image");
    }
  });
});
