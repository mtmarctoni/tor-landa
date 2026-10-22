import { methodNotAllowed } from "@/features/shoebox/server/http";
import { createMediaHandler } from "@/features/shoebox/server/media-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Lazy: no Notion client or service exists until a request is authenticated.
const media = createMediaHandler();
const ALLOW = ["GET", "HEAD"] as const;

type Context = { params: Promise<{ id: string }> };

/** Authenticated bytes for <img>/<audio>, with one optional byte Range. */
export async function GET(
  request: Request,
  context: Context,
): Promise<Response> {
  const { id } = await context.params;
  return media(request, id);
}

/**
 * Explicit, never framework-generated: the same handler (auth, bounded
 * fetch and validation) answers with the GET status and headers, no body.
 */
export async function HEAD(
  request: Request,
  context: Context,
): Promise<Response> {
  const { id } = await context.params;
  return media(request, id);
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
