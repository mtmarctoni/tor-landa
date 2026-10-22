export type MemoryKind = "photo" | "audio" | "text";

export type MemoryBase = {
  id: string;
  caption: string;
  memoryDate: string;
  createdAt: string;
};

export type MemorySummary = MemoryBase &
  (
    | { kind: "text"; text: string }
    | { kind: "photo"; mediaPath: string; width: number; height: number }
    | {
        kind: "audio";
        mediaPath: string;
        durationSeconds: number;
        mimeType: string;
      }
  );

export type MemoryPage = { items: MemorySummary[]; nextCursor: string | null };

export type MemoryFields = {
  kind: MemoryKind;
  text?: string;
  caption: string;
  memoryDate: string;
};

export type MemoryCorrection = {
  text?: string;
  caption: string;
  memoryDate: string;
};

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "TOO_LARGE"
  | "UNSUPPORTED_MEDIA"
  | "NOT_FOUND"
  | "REQUEST_CONFLICT"
  | "OUTCOME_UNKNOWN"
  | "RATE_LIMITED"
  | "UNAVAILABLE"
  | "SETUP_REQUIRED";

export type ApiError = {
  error: {
    code: ApiErrorCode;
    message: string;
    diagnosticId: string;
    retryAfterSeconds?: number;
  };
};

export type RequestStatus =
  | { state: "found"; memory: MemorySummary }
  | { state: "not_found" }
  | { state: "ambiguous" };
