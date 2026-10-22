import { methodNotAllowed, withoutBody } from "@/features/shoebox/server/http";
import { createMemoryHandlers } from "@/features/shoebox/server/memory-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const memories = createMemoryHandlers();
const ALLOW = ["GET", "HEAD", "PATCH", "DELETE"] as const;

type Context = { params: Promise<{ id: string }> };

export async function GET(
  request: Request,
  context: Context,
): Promise<Response> {
  const { id } = await context.params;
  return memories.get(request, id);
}

/** Same authentication path as GET; only the body is dropped. */
export async function HEAD(
  request: Request,
  context: Context,
): Promise<Response> {
  const { id } = await context.params;
  return withoutBody(await memories.get(request, id));
}

export async function PATCH(
  request: Request,
  context: Context,
): Promise<Response> {
  const { id } = await context.params;
  return memories.correct(request, id);
}

export async function DELETE(
  request: Request,
  context: Context,
): Promise<Response> {
  const { id } = await context.params;
  return memories.remove(request, id);
}

function notAllowed(): Response {
  return methodNotAllowed(ALLOW);
}

export { notAllowed as OPTIONS, notAllowed as POST, notAllowed as PUT };
