import { describe, expect, it } from "vitest";
import { loginFailureMessage } from "@/features/shoebox/client/login-error";

describe("public login error messages", () => {
  it("distinguishes setup from an ordinary 503 without exposing details", async () => {
    const response = Response.json(
      {
        error: {
          code: "SETUP_REQUIRED",
          message: "private detail must not appear",
        },
      },
      { status: 503 },
    );
    const message = await loginFailureMessage(response);
    expect(message).toContain("todavía no está configurada");
    expect(message).not.toContain("private detail");
    expect(
      await loginFailureMessage(
        Response.json({ error: { code: "UNAVAILABLE" } }, { status: 503 }),
      ),
    ).toContain("no está disponible ahora mismo");
  });
  it("keeps the status fallback for invalid, empty or non-JSON bodies", async () => {
    for (const body of [
      "",
      "<html>proxy failure</html>",
      "null",
      "{}",
      '{"error":null}',
    ]) {
      expect(
        await loginFailureMessage(new Response(body, { status: 503 })),
      ).toContain("no está disponible ahora mismo");
    }
    expect(
      await loginFailureMessage(new Response("", { status: 401 })),
    ).toContain("Esa no es la contraseña");
  });
});
