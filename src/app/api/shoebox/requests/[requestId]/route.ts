import { methodNotAllowed, withoutBody } from "@/features/shoebox/server/http";
import { createMemoryHandlers } from "@/features/shoebox/server/memory-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const memories = createMemoryHandlers();
const ALLOW = ["GET", "HEAD"] as const;

type Context = { params: Promise<{ requestId: string }> };

/** Read-only reconciliation state for a create Request ID. */
export async function GET(
  request: Request,
  context: Context,
): Promise<Response> {
  const { requestId } = await context.params;
  return memories.status(request, requestId);
}

/** Same authentication path as GET; only the body is dropped. */
export async function HEAD(
  request: Request,
  context: Context,
): Promise<Response> {
  const { requestId } = await context.params;
  return withoutBody(await memories.status(request, requestId));
}

function notAllowed(): Response {
  return methodNotAllowed(ALLOW);
}

export {
  notAllowed as DELETE,
  notAllowed as OPTIONS,
  notAllowed as PATCH,
  notAllowed as POST,
  notAllowed as PUT,
};
