import { methodNotAllowed, withoutBody } from "@/features/shoebox/server/http";
import { createMemoryHandlers } from "@/features/shoebox/server/memory-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Lazy: no Notion client or service exists until a request is authenticated.
const memories = createMemoryHandlers();
const ALLOW = ["GET", "HEAD", "POST"] as const;

export async function GET(request: Request): Promise<Response> {
  return memories.list(request);
}

/** Same authentication path as GET; only the body is dropped. */
export async function HEAD(request: Request): Promise<Response> {
  return withoutBody(await memories.list(request));
}

/** Multipart create: 201 new, 200 replayed, 202 unknown outcome, 409 conflict. */
export async function POST(request: Request): Promise<Response> {
  return memories.create(request);
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
