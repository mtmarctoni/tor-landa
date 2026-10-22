import { createAuthHandlers } from "@/features/shoebox/server/auth-handlers";
import { methodNotAllowed } from "@/features/shoebox/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const auth = createAuthHandlers();
const ALLOW = ["POST"] as const;

export async function POST(request: Request): Promise<Response> {
  return auth.logout(request);
}

function notAllowed(): Response {
  return methodNotAllowed(ALLOW);
}

export {
  notAllowed as DELETE,
  notAllowed as GET,
  notAllowed as HEAD,
  notAllowed as OPTIONS,
  notAllowed as PATCH,
  notAllowed as PUT,
};
