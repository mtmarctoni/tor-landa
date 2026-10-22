import { createAuthHandlers } from "@/features/shoebox/server/auth-handlers";
import { methodNotAllowed, withoutBody } from "@/features/shoebox/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const auth = createAuthHandlers();
const ALLOW = ["GET", "HEAD", "POST"] as const;

export async function GET(request: Request): Promise<Response> {
  return auth.getSession(request);
}

/** Same authentication path as GET; only the body is dropped. */
export async function HEAD(request: Request): Promise<Response> {
  return withoutBody(await auth.getSession(request));
}

export async function POST(request: Request): Promise<Response> {
  return auth.login(request);
}

function notAllowed(): Response {
  return methodNotAllowed(ALLOW);
}

export {
  notAllowed as DELETE,
  notAllowed as OPTIONS,
  notAllowed as PATCH,
  notAllowed as PUT,
};
