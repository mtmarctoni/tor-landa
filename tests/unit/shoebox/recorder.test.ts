import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createVoiceRecorder,
  RECORDER_BYTE_PRECAP,
  RECORDER_STOP_AT_MS,
  type RecorderDependencies,
  type RecorderLike,
  type RecorderSnapshot,
  type RecorderStream,
  type RecorderTrack,
} from "@/features/shoebox/client/recorder";

/**
 * Real controller lifecycle against fake time, a fake MediaRecorder, fake
 * microphone tracks and fake page-lifecycle events. Chromium's fake device in
 * the e2e spec is not evidence of real phone recording compatibility.
 */

const MP4_AAC = "audio/mp4;codecs=mp4a.40.2";
const WEBM_OPUS = "audio/webm;codecs=opus";
const OGG_OPUS = "audio/ogg;codecs=opus";

type Listener = (event: { data?: Blob }) => void;

class FakeTrack implements RecorderTrack {
  readonly stop = vi.fn(() => {
    this.readyState = "ended";
  });
  readyState = "live";
  readonly listeners = new Map<string, Set<() => void>>();
  addEventListener(type: string, listener: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)?.add(listener);
  }
  removeEventListener(type: string, listener: () => void) {
    this.listeners.get(type)?.delete(listener);
  }
  emit(type: string) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener();
  }
  listenerCount() {
    let total = 0;
    for (const set of this.listeners.values()) total += set.size;
    return total;
  }
}

class FakeRecorder implements RecorderLike {
  state: "inactive" | "recording" = "inactive";
  readonly listeners = new Map<string, Set<Listener>>();
  /** Bytes of the final chunk delivered after stop(); 0 for none. */
  finalChunkBytes = 100;
  /** When true the test calls finish() itself. */
  holdStop = false;
  failStart = false;
  timeslice: number | undefined;
  readonly start = vi.fn((timeslice?: number) => {
    if (this.failStart) throw new DOMException("nope", "NotSupportedError");
    this.timeslice = timeslice;
    this.state = "recording";
  });
  readonly stop = vi.fn(() => {
    if (this.state === "inactive") {
      throw new DOMException("inactive", "InvalidStateError");
    }
    this.state = "inactive";
    if (!this.holdStop) queueMicrotask(() => this.finish());
  });

  constructor(
    readonly mimeType: string,
    readonly options: { mimeType?: string; audioBitsPerSecond?: number },
  ) {}

  addEventListener(type: string, listener: Listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)?.add(listener);
  }
  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }
  emit(type: string, event: { data?: Blob } = {}) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      listener(event);
    }
  }
  data(bytes: number, type = this.mimeType) {
    this.emit("dataavailable", {
      data: new Blob([new Uint8Array(bytes)], { type }),
    });
  }
  finish(bytes = this.finalChunkBytes) {
    if (bytes > 0) this.data(bytes);
    this.emit("stop");
  }
  listenerCount() {
    let total = 0;
    for (const set of this.listeners.values()) total += set.size;
    return total;
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = async () => {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
};

function setup(
  options: {
    supported?: string[];
    playable?: string[];
    secure?: boolean;
    getUserMedia?: "absent" | Error | "deferred";
    createRecorder?: "absent" | ((mime: string) => FakeRecorder);
    duration?: number;
  } = {},
) {
  let now = 1_000;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const supported = options.supported ?? [
    MP4_AAC,
    "audio/mp4",
    WEBM_OPUS,
    OGG_OPUS,
  ];
  const playable = options.playable ?? supported;

  const tracks: FakeTrack[] = [];
  const recorders: FakeRecorder[] = [];
  const pendingPermission: ReturnType<typeof deferred<RecorderStream>>[] = [];
  const interruptions = new Set<() => void>();
  const urls: string[] = [];
  const revoked: string[] = [];
  const uploads: unknown[] = [];

  const makeStream = (): RecorderStream => {
    const track = new FakeTrack();
    tracks.push(track);
    return { getTracks: () => [track] };
  };

  const getUserMedia = vi.fn(async (_constraints: MediaStreamConstraints) => {
    if (options.getUserMedia instanceof Error) throw options.getUserMedia;
    if (options.getUserMedia === "deferred") {
      const pending = deferred<RecorderStream>();
      pendingPermission.push(pending);
      return pending.promise;
    }
    return makeStream();
  });

  const inspect = vi.fn(async (blob: Blob, _signal: AbortSignal) => ({
    durationSeconds: options.duration ?? 2,
    mimeType: blob.type.split(";")[0] ?? "",
  }));

  const deps: RecorderDependencies = {
    isSecureContext: () => options.secure ?? true,
    getUserMedia: options.getUserMedia === "absent" ? undefined : getUserMedia,
    createRecorder:
      options.createRecorder === "absent"
        ? undefined
        : (_stream, recorderOptions) => {
            const mime = recorderOptions.mimeType ?? "";
            const recorder =
              typeof options.createRecorder === "function"
                ? options.createRecorder(mime)
                : new FakeRecorder(mime, recorderOptions);
            recorders.push(recorder);
            return recorder;
          },
    isTypeSupported: vi.fn((mime: string) => supported.includes(mime)),
    canPlayType: vi.fn((mime: string) =>
      playable.includes(mime) ? "maybe" : "",
    ),
    now: () => now,
    setTimer: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimer: (id) => {
      timers.delete(id);
    },
    inspect,
    createObjectURL: vi.fn((_blob: Blob) => {
      const url = `blob:fake/${urls.length + 1}`;
      urls.push(url);
      return url;
    }),
    revokeObjectURL: vi.fn((url: string) => {
      revoked.push(url);
    }),
    subscribeInterruptions: (listener) => {
      interruptions.add(listener);
      return () => interruptions.delete(listener);
    },
  };

  const controller = createVoiceRecorder(deps);
  const states: RecorderSnapshot["state"][] = [];
  controller.subscribe(() => states.push(controller.getSnapshot().state));

  return {
    controller,
    deps,
    getUserMedia,
    inspect,
    tracks,
    recorders,
    pendingPermission,
    makeStream,
    interruptions,
    urls,
    revoked,
    uploads,
    states,
    timerCount: () => timers.size,
    advance(ms: number) {
      const target = now + ms;
      for (;;) {
        let due: [number, { at: number; fn: () => void }] | undefined;
        for (const entry of timers) {
          if (entry[1].at <= target && (!due || entry[1].at < due[1].at)) {
            due = entry;
          }
        }
        if (!due) break;
        timers.delete(due[0]);
        now = Math.max(now, due[1].at);
        due[1].fn();
      }
      now = target;
    },
    interrupt() {
      for (const listener of [...interruptions]) listener();
    },
  };
}

let fakeNetwork: { uploads: unknown[] };

beforeEach(() => {
  fakeNetwork = { uploads: [] };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (...args: unknown[]) => {
      fakeNetwork.uploads.push(args);
      throw new Error("the recorder must never use the network");
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("construction and explicit start", () => {
  it("never touches the microphone before an explicit start", async () => {
    const fake = setup();
    const fakeMic = { getUserMedia: fake.getUserMedia };
    const fakeTrack = () => fake.tracks[0] as FakeTrack;
    expect(fakeMic.getUserMedia).not.toHaveBeenCalled();
    expect(fake.controller.getSnapshot()).toEqual({ state: "idle" });

    await fake.controller.start();
    expect(fake.controller.getSnapshot().state).toBe("recording");
    await fake.controller.stop();
    expect(fakeTrack().stop).toHaveBeenCalledOnce();
    expect(fake.controller.getSnapshot().state).toBe("preview");
    expect(fakeNetwork.uploads).toHaveLength(0);
  });

  it("asks permission once, audio only, and records with the modest hints", async () => {
    const fake = setup();
    await fake.controller.start();
    expect(fake.getUserMedia).toHaveBeenCalledOnce();
    const constraints = fake.getUserMedia.mock.calls[0]?.[0];
    expect(constraints).not.toHaveProperty("video");
    expect(constraints?.audio).toMatchObject({
      channelCount: { ideal: 1 },
      echoCancellation: { ideal: true },
    });
    const recorder = fake.recorders[0] as FakeRecorder;
    expect(recorder.options).toEqual({
      mimeType: MP4_AAC,
      audioBitsPerSecond: 64_000,
    });
    expect(recorder.timeslice).toBe(250);
    expect(fake.states).toEqual(["requesting", "recording"]);
  });

  it("prefers MP4/AAC, then plain MP4, WebM/Opus and Ogg/Opus, needing playback too", async () => {
    const cases: [string[], string[], string][] = [
      [[MP4_AAC, WEBM_OPUS], [MP4_AAC, WEBM_OPUS], MP4_AAC],
      [["audio/mp4", WEBM_OPUS], ["audio/mp4", WEBM_OPUS], "audio/mp4"],
      [[MP4_AAC, WEBM_OPUS], [WEBM_OPUS], WEBM_OPUS],
      [[OGG_OPUS], [OGG_OPUS], OGG_OPUS],
    ];
    for (const [supported, playable, expected] of cases) {
      const fake = setup({ supported, playable });
      await fake.controller.start();
      expect(fake.recorders[0]?.options.mimeType, expected).toBe(expected);
      fake.controller.dispose();
    }
  });

  it("refuses without asking when no allowed format can be recorded and played", async () => {
    const fake = setup({ supported: ["audio/x-flac"], playable: [] });
    await fake.controller.start();
    expect(fake.getUserMedia).not.toHaveBeenCalled();
    const snapshot = fake.controller.getSnapshot();
    expect(snapshot.state).toBe("error");
    if (snapshot.state === "error") {
      expect(snapshot.error.reason).toBe("unsupported_format");
      expect(snapshot.error.message).toMatch(/subir un audio/);
    }
  });

  it("explains insecure contexts and missing APIs without asking", async () => {
    for (const [options, reason] of [
      [{ secure: false }, "insecure"],
      [{ getUserMedia: "absent" }, "unsupported"],
      [{ createRecorder: "absent" }, "unsupported"],
    ] as const) {
      const fake = setup(options);
      await fake.controller.start();
      expect(fake.getUserMedia).not.toHaveBeenCalled();
      const snapshot = fake.controller.getSnapshot();
      expect(snapshot.state === "error" && snapshot.error.reason).toBe(reason);
    }
  });

  it("maps denied, missing and busy microphones to recoverable errors", async () => {
    for (const [name, reason] of [
      ["NotAllowedError", "denied"],
      ["SecurityError", "denied"],
      ["NotFoundError", "not_found"],
      ["OverconstrainedError", "not_found"],
      ["NotReadableError", "not_readable"],
      ["AbortError", "not_readable"],
      ["WeirdError", "failed"],
    ] as const) {
      const fake = setup({ getUserMedia: new DOMException("x", name) });
      await fake.controller.start();
      const snapshot = fake.controller.getSnapshot();
      expect(snapshot.state === "error" && snapshot.error.reason, name).toBe(
        reason,
      );
      // A new explicit tap may try again.
      await fake.controller.start();
      expect(fake.getUserMedia).toHaveBeenCalledTimes(2);
    }
  });

  it("falls back to the next format when the constructor throws, and cleans up when all fail", async () => {
    const fallback = setup({
      createRecorder: (mime) => {
        if (mime === MP4_AAC) throw new DOMException("x", "NotSupportedError");
        return new FakeRecorder(mime, {
          mimeType: mime,
          audioBitsPerSecond: 64_000,
        });
      },
    });
    await fallback.controller.start();
    expect(fallback.controller.getSnapshot().state).toBe("recording");
    expect(fallback.recorders[0]?.options.mimeType).toBe("audio/mp4");

    const broken = setup({
      createRecorder: () => {
        throw new DOMException("x", "NotSupportedError");
      },
    });
    await broken.controller.start();
    expect(broken.controller.getSnapshot().state).toBe("error");
    expect(broken.tracks[0]?.stop).toHaveBeenCalledOnce();
  });

  it("falls back when start() throws and detaches the failed recorder", async () => {
    let first = true;
    const fake = setup({
      createRecorder: (mime) => {
        const recorder = new FakeRecorder(mime, {
          mimeType: mime,
          audioBitsPerSecond: 64_000,
        });
        recorder.failStart = first;
        first = false;
        return recorder;
      },
    });
    await fake.controller.start();
    expect(fake.controller.getSnapshot().state).toBe("recording");
    expect(fake.recorders).toHaveLength(2);
    expect(fake.recorders[0]?.listenerCount()).toBe(0);

    const allFail = setup({
      createRecorder: (mime) => {
        const recorder = new FakeRecorder(mime, {
          mimeType: mime,
          audioBitsPerSecond: 64_000,
        });
        recorder.failStart = true;
        return recorder;
      },
    });
    await allFail.controller.start();
    expect(allFail.controller.getSnapshot().state).toBe("error");
    expect(allFail.tracks[0]?.stop).toHaveBeenCalledOnce();
    expect(allFail.recorders.every((r) => r.listenerCount() === 0)).toBe(true);
  });

  it("stops tracks from a permission granted after discard or unmount", async () => {
    for (const cancel of ["discard", "dispose", "stop"] as const) {
      const fake = setup({ getUserMedia: "deferred" });
      const starting = fake.controller.start();
      expect(fake.controller.getSnapshot().state).toBe("requesting");
      if (cancel === "stop") await fake.controller.stop();
      else fake.controller[cancel]();
      expect(fake.controller.getSnapshot().state).toBe("idle");
      fake.pendingPermission[0]?.resolve(fake.makeStream());
      await starting;
      expect(fake.tracks[0]?.stop, cancel).toHaveBeenCalledOnce();
      expect(fake.recorders, cancel).toHaveLength(0);
      expect(fake.controller.getSnapshot().state, cancel).toBe("idle");
    }
  });

  it("ignores start while a preview is waiting for review", async () => {
    const fake = setup();
    await fake.controller.start();
    await fake.controller.stop();
    await fake.controller.start();
    expect(fake.getUserMedia).toHaveBeenCalledOnce();
    expect(fake.controller.getSnapshot().state).toBe("preview");
  });
});

describe("stopping and final validation", () => {
  it("waits for the final dataavailable before building the preview", async () => {
    const fake = setup();
    await fake.controller.start();
    const recorder = fake.recorders[0] as FakeRecorder;
    recorder.holdStop = true;
    recorder.data(1_000);
    let settled = false;
    const stopping = fake.controller.stop().then(() => {
      settled = true;
    });
    await flush();
    expect(settled).toBe(false);
    expect(fake.controller.getSnapshot().state).toBe("stopping");
    // Tracks are released immediately, not after finalization.
    expect(fake.tracks[0]?.stop).toHaveBeenCalledOnce();
    recorder.finish(500);
    await stopping;
    const snapshot = fake.controller.getSnapshot();
    expect(snapshot.state).toBe("preview");
    if (snapshot.state === "preview") {
      expect(snapshot.blob.size).toBe(1_500);
      expect(snapshot.actualMime).toBe(MP4_AAC);
      expect(snapshot.url).toBe("blob:fake/1");
      expect(snapshot.durationSeconds).toBe(2);
      expect(snapshot.interrupted).toBe(false);
    }
    expect(fake.inspect).toHaveBeenCalledOnce();
    expect(recorder.listenerCount()).toBe(0);
    expect(fake.tracks[0]?.listenerCount()).toBe(0);
  });

  it("stops every track when the recorder reports an error", async () => {
    const fake = setup();
    await fake.controller.start();
    (fake.recorders[0] as FakeRecorder).emit("error");
    await flush();
    expect(fake.tracks[0]?.stop).toHaveBeenCalledOnce();
    expect(["preview", "error"]).toContain(fake.controller.getSnapshot().state);
  });

  it(`requests stop at ${RECORDER_STOP_AT_MS} ms of monotonic time`, async () => {
    expect(RECORDER_STOP_AT_MS).toBe(59_500);
    const fake = setup();
    await fake.controller.start();
    const recorder = fake.recorders[0] as FakeRecorder;
    fake.advance(10_000);
    const snapshot = fake.controller.getSnapshot();
    expect(
      snapshot.state === "recording" && snapshot.elapsedMs,
    ).toBeGreaterThanOrEqual(9_750);
    fake.advance(49_499);
    expect(recorder.stop).not.toHaveBeenCalled();
    expect(fake.controller.getSnapshot().state).toBe("recording");
    fake.advance(1);
    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(fake.tracks[0]?.stop).toHaveBeenCalledOnce();
    await flush();
    const done = fake.controller.getSnapshot();
    expect(done.state).toBe("preview");
    if (done.state === "preview") expect(done.stopReason).toBe("limit");
    // The deadline was cleared before finalization: no timer left behind.
    expect(fake.timerCount()).toBe(0);
  });

  it(`stops at the ${RECORDER_BYTE_PRECAP}-byte pre-cap`, async () => {
    expect(RECORDER_BYTE_PRECAP).toBe(3_500_000);
    const fake = setup();
    await fake.controller.start();
    const recorder = fake.recorders[0] as FakeRecorder;
    recorder.data(3_499_999);
    expect(recorder.stop).not.toHaveBeenCalled();
    recorder.data(1);
    expect(recorder.stop).toHaveBeenCalledOnce();
  });

  it("rejects a delayed final chunk that crosses 4,000,000 bytes without truncating", async () => {
    const fake = setup();
    await fake.controller.start();
    const recorder = fake.recorders[0] as FakeRecorder;
    recorder.finalChunkBytes = 600_001;
    recorder.data(3_400_000);
    await fake.controller.stop();
    const snapshot = fake.controller.getSnapshot();
    expect(snapshot.state === "error" && snapshot.error.reason).toBe(
      "too_large",
    );
    expect(fake.inspect).not.toHaveBeenCalled();
    expect(fake.deps.createObjectURL).not.toHaveBeenCalled();
  });

  it("rejects a clip whose packet duration is over 60 s and accepts exactly 60 s", async () => {
    const over = setup({ duration: 60.02 });
    await over.controller.start();
    await over.controller.stop();
    const rejected = over.controller.getSnapshot();
    expect(rejected.state === "error" && rejected.error.reason).toBe(
      "too_long",
    );
    if (rejected.state === "error") {
      expect(rejected.error.message).toMatch(/más corta/);
    }
    expect(over.deps.createObjectURL).not.toHaveBeenCalled();

    const exact = setup({ duration: 60 });
    await exact.controller.start();
    await exact.controller.stop();
    expect(exact.controller.getSnapshot().state).toBe("preview");
  });

  it("rejects an empty Blob and an unsupported actual MIME type", async () => {
    const empty = setup();
    await empty.controller.start();
    (empty.recorders[0] as FakeRecorder).finalChunkBytes = 0;
    await empty.controller.stop();
    const emptySnapshot = empty.controller.getSnapshot();
    expect(emptySnapshot.state === "error" && emptySnapshot.error.reason).toBe(
      "empty",
    );

    const odd = setup({
      createRecorder: (mime) =>
        new FakeRecorder("video/x-matroska;codecs=avc1", {
          mimeType: mime,
          audioBitsPerSecond: 64_000,
        }),
    });
    await odd.controller.start();
    await odd.controller.stop();
    const oddSnapshot = odd.controller.getSnapshot();
    expect(oddSnapshot.state === "error" && oddSnapshot.error.reason).toBe(
      "unsupported_format",
    );
    expect(odd.inspect).not.toHaveBeenCalled();
  });

  it("does not use chunk count as the clock", async () => {
    const fake = setup();
    await fake.controller.start();
    const recorder = fake.recorders[0] as FakeRecorder;
    for (let i = 0; i < 400; i += 1) recorder.data(10);
    expect(recorder.stop).not.toHaveBeenCalled();
    const snapshot = fake.controller.getSnapshot();
    expect(snapshot.state === "recording" && snapshot.elapsedMs).toBe(0);
  });
});

describe("interruptions and cleanup", () => {
  for (const source of [
    "hidden/pagehide",
    "track mute",
    "track ended",
  ] as const) {
    it(`${source} stops capture at once and never resumes`, async () => {
      const fake = setup();
      await fake.controller.start();
      const recorder = fake.recorders[0] as FakeRecorder;
      if (source === "hidden/pagehide") fake.interrupt();
      else fake.tracks[0]?.emit(source === "track mute" ? "mute" : "ended");
      expect(recorder.stop).toHaveBeenCalledOnce();
      expect(fake.tracks[0]?.stop).toHaveBeenCalledOnce();
      await flush();
      const snapshot = fake.controller.getSnapshot();
      expect(snapshot.state).toBe("preview");
      if (snapshot.state === "preview") {
        expect(snapshot.interrupted).toBe(true);
        expect(snapshot.stopReason).toBe("interrupted");
      }
      fake.interrupt();
      fake.advance(120_000);
      expect(fake.getUserMedia).toHaveBeenCalledOnce();
      expect(fake.interruptions.size).toBe(0);
    });
  }

  it("unmount or logout (dispose) ends capture and ignores late recorder events", async () => {
    const fake = setup();
    await fake.controller.start();
    const recorder = fake.recorders[0] as FakeRecorder;
    recorder.holdStop = true;
    recorder.data(1_000);
    fake.controller.dispose();
    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(fake.tracks[0]?.stop).toHaveBeenCalledOnce();
    expect(fake.controller.getSnapshot().state).toBe("idle");
    recorder.finish();
    await flush();
    expect(fake.controller.getSnapshot().state).toBe("idle");
    expect(fake.inspect).not.toHaveBeenCalled();
    expect(fake.interruptions.size).toBe(0);
    expect(fake.timerCount()).toBe(0);
    await fake.controller.start();
    expect(fake.getUserMedia).toHaveBeenCalledOnce();
  });

  it("repeated start/stop does not duplicate listeners or chunks", async () => {
    const fake = setup();
    for (const bytes of [1_000, 2_000]) {
      await fake.controller.start();
      const recorder = fake.recorders.at(-1) as FakeRecorder;
      recorder.data(bytes);
      await fake.controller.stop();
      const snapshot = fake.controller.getSnapshot();
      expect(snapshot.state === "preview" && snapshot.blob.size).toBe(
        bytes + 100,
      );
      expect(recorder.listenerCount()).toBe(0);
      expect(fake.interruptions.size).toBe(0);
      fake.controller.discard();
    }
    expect(fake.tracks.every((track) => track.listenerCount() === 0)).toBe(
      true,
    );
    expect(
      fake.tracks.every((track) => track.stop.mock.calls.length === 1),
    ).toBe(true);
  });

  it("revokes object URLs on discard and dispose", async () => {
    const fake = setup();
    await fake.controller.start();
    await fake.controller.stop();
    fake.controller.discard();
    expect(fake.revoked).toEqual(["blob:fake/1"]);
    expect(fake.controller.getSnapshot()).toEqual({ state: "idle" });

    await fake.controller.start();
    await fake.controller.stop();
    fake.controller.dispose();
    expect(fake.revoked).toEqual(["blob:fake/1", "blob:fake/2"]);
  });

  it("ignores an inspection that finishes after discard", async () => {
    const fake = setup();
    const pending = deferred<{ durationSeconds: number; mimeType: string }>();
    fake.inspect.mockImplementationOnce(() => pending.promise);
    await fake.controller.start();
    const stopping = fake.controller.stop();
    await flush();
    expect(fake.controller.getSnapshot().state).toBe("stopping");
    fake.controller.discard();
    pending.resolve({ durationSeconds: 2, mimeType: "audio/mp4" });
    await stopping;
    await flush();
    expect(fake.controller.getSnapshot().state).toBe("idle");
    expect(fake.deps.createObjectURL).not.toHaveBeenCalled();
    const signal = fake.inspect.mock.calls[0]?.[1];
    expect(signal?.aborted).toBe(true);
  });

  it("notifies subscribers until they unsubscribe", async () => {
    const fake = setup();
    const listener = vi.fn();
    const unsubscribe = fake.controller.subscribe(listener);
    await fake.controller.start();
    expect(listener).toHaveBeenCalled();
    const count = listener.mock.calls.length;
    unsubscribe();
    fake.controller.discard();
    expect(listener).toHaveBeenCalledTimes(count);
  });
});
