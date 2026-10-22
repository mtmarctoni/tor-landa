// Shared with the owner-only Node setup helper. No secrets or browser state.
export const SCRYPT_OPTIONS = Object.freeze({
  N: 32_768,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
});
export const KEY_BYTES = 64;
export const MIN_SALT_BYTES = 16;
