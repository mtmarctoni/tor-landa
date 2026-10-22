export const MAX_TEXT_CHARACTERS = 2_000;
export const MAX_CAPTION_CHARACTERS = 500;
export const MAX_FILE_BYTES = 4_000_000;
export const MAX_MULTIPART_BYTES = 4_200_000;
export const MAX_LOGIN_JSON_BYTES = 4_096;
export const MAX_MUTATION_JSON_BYTES = 16_384;
export const MAX_METADATA_BYTES = 16_384;
export const MAX_PASSWORD_BYTES = 1_024;
export const MAX_SESSION_TOKEN_BYTES = 2_048;
export const SESSION_LIFETIME_SECONDS = 604_800;
export const MAX_IMAGE_EDGE = 2_048;
export const MAX_AUDIO_SECONDS = 60;
export const MEMORY_BATCH_SIZE = 12;
export const MAX_CURSOR_BYTES = 1_024;

// Photo preparation (browser) and server JPEG normalization.
export const MAX_PHOTO_SOURCE_BYTES = 20_000_000;
export const MAX_PHOTO_SOURCE_PIXELS = 40_000_000;
export const MAX_SERVER_IMAGE_PIXELS = 4_194_304; // 2,048²
export const SERVER_JPEG_QUALITY = 90;
export const PHOTO_JPEG_QUALITIES = [0.9, 0.8, 0.7] as const;
export const PHOTO_FALLBACK_EDGE = 1_600;
export const PHOTO_FALLBACK_QUALITY = 0.75;

// Audio packet inspection and the media worker boundary.
export const MAX_AUDIO_PACKETS = 100_000;
export const MEDIA_WORKER_DEADLINE_MS = 5_000;
export const MEDIA_WORKER_MAX_CONCURRENCY = 2;
export const MEDIA_WORKER_HEAP_MB = 64;

// Authenticated media reads (bounded buffering, no streaming proxy).
export const MEDIA_REQUEST_BUDGET_MS = 15_000;
export const MEDIA_ASSET_TIMEOUT_MS = 10_000;
/** Waiting media reads per instance (one batch is at most 12 memories). */
export const MEDIA_READ_MAX_QUEUED = 16;
