import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ShoeboxLoginPage from "@/app/shoebox/login/page";
import ShoeboxPage from "@/app/shoebox/page";
import { ShoeboxError } from "@/features/shoebox/server/errors";

const { session, redirect } = vi.hoisted(() => ({
  session: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock("@/features/shoebox/server/session", () => ({
  requireShoeboxSession: session,
}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/components/shoebox/ShoeboxArchive", () => ({
  default: () => createElement("p", null, "private archive"),
}));
vi.mock("@/components/shoebox/ShoeboxLogin", () => ({
  default: () => createElement("p", null, "password form"),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe.each([
  ["archive", ShoeboxPage],
  ["login", ShoeboxLoginPage],
] as const)("%s setup guard", (_name, page) => {
  it("renders a public setup notice without private content or config details", async () => {
    session.mockRejectedValueOnce(
      new ShoeboxError("SETUP_REQUIRED", { detail: "SHOEBOX_PASSWORD_HASH" }),
    );
    const html = renderToStaticMarkup(await page());
    expect(html).toContain("La caja todavía no está preparada");
    expect(html).not.toContain("SHOEBOX_");
    expect(html).not.toContain("private archive");
    expect(html).not.toContain("password form");
    expect(redirect).not.toHaveBeenCalled();
  });
  it("does not swallow unexpected errors", async () => {
    const error = new Error("synthetic unexpected error");
    session.mockRejectedValueOnce(error);
    await expect(page()).rejects.toBe(error);
  });
});

it("still redirects unauthenticated archive requests to login", async () => {
  session.mockRejectedValueOnce(new ShoeboxError("UNAUTHORIZED"));
  await expect(ShoeboxPage()).rejects.toThrow("redirect:/shoebox/login");
});
it("still shows the public login form when unauthorized", async () => {
  session.mockRejectedValueOnce(new ShoeboxError("UNAUTHORIZED"));
  expect(renderToStaticMarkup(await ShoeboxLoginPage())).toContain(
    "password form",
  );
});
