import "server-only";
import { MAX_LOGIN_JSON_BYTES } from "../limits";
import { readBodyLimited, readJsonLimited } from "./body";
import { getConfig, type ShoeboxConfig } from "./config";
import { ShoeboxError } from "./errors";
import {
  assertMutationOrigin,
  assertSameOriginRead,
  privateEmpty,
  privateJson,
  toErrorResponse,
} from "./http";
import { verifyPassword } from "./password";
import {
  clearedSessionCookie,
  issueSession,
  requireRequestSession,
  sessionCookie,
  sessionKey,
} from "./session";

/** Injectable config and clock. Password verification is always real. */
export type AuthDeps = {
  config?: () => ShoeboxConfig;
  now?: () => number;
};

type Handler = (request: Request) => Promise<Response>;

function parsePassword(body: unknown): string {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ShoeboxError("INVALID_INPUT", { status: 400 });
  }
  const keys = Object.keys(body);
  const { password } = body as { password?: unknown };
  if (keys.length !== 1 || typeof password !== "string") {
    throw new ShoeboxError("INVALID_INPUT", { status: 400 });
  }
  return password;
}

function guarded(handler: Handler): Handler {
  return async (request) => {
    try {
      return await handler(request);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export function createAuthHandlers(deps: AuthDeps = {}): {
  getSession: Handler;
  login: Handler;
  logout: Handler;
} {
  const config = deps.config ?? getConfig;
  const now = deps.now ?? (() => Math.floor(Date.now() / 1000));

  return {
    getSession: guarded(async (request) => {
      assertSameOriginRead(request.headers);
      const session = await requireRequestSession(request, now(), config());
      return privateJson({ expiresAt: session.expiresAt });
    }),

    login: guarded(async (request) => {
      const current = config();
      assertMutationOrigin(request.headers, current.appOrigin);
      const password = parsePassword(
        await readJsonLimited(request, MAX_LOGIN_JSON_BYTES),
      );
      // Fail closed on a broken secret before spending any password work.
      sessionKey(current);
      if (!(await verifyPassword(password, current.passwordHash))) {
        throw new ShoeboxError("UNAUTHORIZED");
      }
      const { token, session } = await issueSession(now(), current);
      const response = privateJson({ expiresAt: session.expiresAt });
      response.headers.append(
        "Set-Cookie",
        sessionCookie(token, session, current),
      );
      return response;
    }),

    logout: guarded(async (request) => {
      const current = config();
      assertMutationOrigin(request.headers, current.appOrigin);
      await readBodyLimited(request, 0);
      return privateEmpty(204, {
        "Set-Cookie": clearedSessionCookie(current),
      });
    }),
  };
}
