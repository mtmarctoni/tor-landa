import "server-only";
import type { ApiErrorCode } from "@/types/shoebox";

export const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  UNAUTHORIZED: "Necesitas entrar para ver el baúl.",
  FORBIDDEN: "Esta petición no está permitida.",
  INVALID_INPUT: "Revisa los datos e inténtalo de nuevo.",
  TOO_LARGE: "El archivo es demasiado grande.",
  UNSUPPORTED_MEDIA: "Ese tipo de archivo no es compatible.",
  NOT_FOUND: "No encontramos ese recuerdo.",
  REQUEST_CONFLICT: "Esta petición entra en conflicto con otra anterior.",
  OUTCOME_UNKNOWN:
    "No sabemos si el recuerdo se guardó. Comprueba antes de reintentar.",
  RATE_LIMITED: "Demasiados intentos. Espera un momento.",
  UNAVAILABLE: "El baúl no está disponible ahora mismo.",
  SETUP_REQUIRED: "El baúl todavía no está configurado.",
};

export const DEFAULT_STATUS: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  INVALID_INPUT: 422,
  TOO_LARGE: 413,
  UNSUPPORTED_MEDIA: 415,
  NOT_FOUND: 404,
  REQUEST_CONFLICT: 409,
  OUTCOME_UNKNOWN: 202,
  RATE_LIMITED: 429,
  UNAVAILABLE: 503,
  SETUP_REQUIRED: 503,
};

/** Carries only a code and status; the message is always a fixed string. */
export class ShoeboxError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly retryAfterSeconds?: number;
  /** Safe diagnostic token only (an operation code or a variable name). */
  readonly detail?: string;
  /**
   * Server-only: Notion's `additional_data.committed_resource_id` from an
   * ambiguous create. Never logged or serialized by toErrorResponse.
   */
  readonly resourceId?: string;

  constructor(
    code: ApiErrorCode,
    options: {
      status?: number;
      retryAfterSeconds?: number;
      detail?: string;
      resourceId?: string;
    } = {},
  ) {
    super(ERROR_MESSAGES[code]);
    this.name = "ShoeboxError";
    this.code = code;
    this.status = options.status ?? DEFAULT_STATUS[code];
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.detail = options.detail;
    this.resourceId = options.resourceId;
  }
}
