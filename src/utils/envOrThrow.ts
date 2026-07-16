/**
 * Reads an environment variable or throws if it is missing (for server/runtime safety).
 */
export function envOrThrow(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env: ${name}`);
  return val;
}
