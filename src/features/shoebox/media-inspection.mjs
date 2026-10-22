// Browser-safe audio inspection shared by the server media worker
// (server/media-worker.mjs) and the browser composer (client/audio-preview.ts).
//
// Plain ESM with JSDoc types because the Node worker loads it directly, without
// a TypeScript build step. It has no imports: callers pass in the Mediabunny
// module so the worker can import it statically and the browser can load it
// with a dynamic import. Numbers mirror src/features/shoebox/limits.ts; a unit
// test keeps them in step.
//
// This is bounded structural inspection (container, tracks, codec, packet
// timing and framing). It does not decode audio and is not malware scanning.

/** @typedef {"mp4" | "webm" | "ogg" | "mp3" | "wave"} AudioContainer */
/** @typedef {"UNSUPPORTED_MEDIA" | "INVALID_INPUT" | "TOO_LARGE"} RejectionCode */
/**
 * @typedef {object} AudioInspection
 * @property {AudioContainer} container
 * @property {string} codec
 * @property {string} mimeType Canonical MIME type stored with the file.
 * @property {string} extension Canonical filename extension (no dot).
 * @property {number} durationSeconds Packet-derived end of presentation.
 */

/**
 * @type {{
 *   maxFileBytes: number;
 *   maxAudioSeconds: number;
 *   maxAudioPackets: number;
 *   maxImageEdge: number;
 *   maxServerImagePixels: number;
 *   serverJpegQuality: number;
 *   audioContainers: Record<AudioContainer, {
 *     mimeType: string;
 *     extension: string;
 *     codecs: readonly string[];
 *     declaredTypes: readonly string[];
 *   }>;
 * }}
 */
export const MEDIA_RULES = Object.freeze({
  maxFileBytes: 4_000_000,
  maxAudioSeconds: 60,
  maxAudioPackets: 100_000,
  maxImageEdge: 2_048,
  maxServerImagePixels: 4_194_304,
  serverJpegQuality: 90,
  // Design allowlist: MP4/M4A+AAC, MP3, WebM/Opus, Ogg Opus or Vorbis, PCM WAV.
  // Filenames match the extension -> MIME map Task 3 reads back.
  audioContainers: Object.freeze({
    mp4: {
      mimeType: "audio/mp4",
      extension: "m4a",
      codecs: ["aac"],
      declaredTypes: ["audio/mp4", "audio/x-m4a", "audio/m4a"],
    },
    webm: {
      mimeType: "audio/webm",
      extension: "weba",
      codecs: ["opus"],
      declaredTypes: ["audio/webm", "video/webm"],
    },
    ogg: {
      mimeType: "audio/ogg",
      extension: "ogg",
      codecs: ["opus", "vorbis"],
      declaredTypes: ["audio/ogg", "application/ogg", "audio/opus"],
    },
    mp3: {
      mimeType: "audio/mpeg",
      extension: "mp3",
      codecs: ["mp3"],
      declaredTypes: ["audio/mpeg", "audio/mp3", "audio/x-mp3"],
    },
    wave: {
      mimeType: "audio/wav",
      extension: "wav",
      // Linear PCM only (no companded or compressed WAVE codecs).
      codecs: ["pcm-u8", "pcm-s16", "pcm-s24", "pcm-s32", "pcm-f32"],
      declaredTypes: [
        "audio/wav",
        "audio/x-wav",
        "audio/wave",
        "audio/vnd.wave",
      ],
    },
  }),
});

/** Float tolerance when comparing timeline values against the limit. */
const EPSILON = 1e-6;
/** Encoder priming / pre-roll allowed before time zero (AAC, Opus). */
const MAX_PREROLL_SECONDS = 1;
/** Declared duration may exceed packet timing by this much before we call it truncation. */
const DECLARED_SLACK_SECONDS = 0.25;
const DECLARED_SLACK_RATIO = 0.02;
/** Upper bound on the WebM timestamp quantization allowance (2 x 1 ms ticks). */
const MAX_WEBM_QUANTIZATION_SECONDS = 0.002;

export class MediaRejection extends Error {
  /**
   * @param {RejectionCode} code
   * @param {string} reason Safe diagnostic token, never user data.
   */
  constructor(code, reason) {
    super(reason);
    this.name = "MediaRejection";
    this.code = code;
    this.reason = reason;
  }
}

/** @param {string} reason */
const unsupported = (reason) => new MediaRejection("UNSUPPORTED_MEDIA", reason);

/**
 * Whether a browser-declared MIME type is compatible with the sniffed
 * container. Empty types are allowed (the bytes decide); parameters such as
 * `;codecs=opus` are ignored.
 * @param {string} declared
 * @param {AudioContainer} container
 */
export function declaredTypeMatches(declared, container) {
  const base = declared.split(";")[0]?.trim().toLowerCase() ?? "";
  if (base === "") return true;
  return MEDIA_RULES.audioContainers[container].declaredTypes.includes(base);
}

/** @param {AbortSignal | undefined} signal */
function checkAbort(signal) {
  if (signal?.aborted) throw new MediaRejection("UNSUPPORTED_MEDIA", "aborted");
}

// --- container framing --------------------------------------------------------
// Mediabunny silently stops at the last complete packet of a cut file. These
// checks prove the outer framing reaches the end of the bytes exactly.

/**
 * @param {Uint8Array} b
 * @param {number} at
 * @param {boolean} isId
 */
function readVint(b, at, isId) {
  const first = b[at];
  if (first === undefined || first === 0) return null;
  let length = 1;
  while (!(first & (0x80 >> (length - 1)))) length++;
  if (length > (isId ? 4 : 8) || at + length > b.length) return null;
  let value = isId ? first : first & (0xff >> length);
  let allOnes = value === 0xff >> length;
  for (let i = 1; i < length; i++) {
    const byte = /** @type {number} */ (b[at + i]);
    value = value * 256 + byte;
    if (byte !== 0xff) allOnes = false;
  }
  return { value, length, unknown: !isId && allOnes };
}

const EBML_HEADER = 0x1a45dfa3;
const SEGMENT = 0x18538067;
const CLUSTER = 0x1f43b675;
const INFO = 0x1549a966;
const TIMESTAMP_SCALE = 0x2ad7b1;
const TRACKS = 0x1654ae6b;
const TRACK_ENTRY = 0xae;
const TRACK_TYPE = 0x83;
const CODEC_DELAY = 0x56aa;
const TRACK_TYPE_AUDIO = 2;

/**
 * @param {Uint8Array} b
 * @param {number} at
 * @param {number} length
 */
function readUint(b, at, length) {
  if (length > 6) throw unsupported("ebml_uint");
  let value = 0;
  for (let i = 0; i < length; i++) value = value * 256 + (b[at + i] ?? 0);
  return value;
}

/**
 * Iterates the known-size children of a master element's payload.
 * @param {Uint8Array} b
 * @param {number} start
 * @param {number} end
 * @param {(id: number, dataStart: number, size: number) => void} visit
 */
function eachChild(b, start, end, visit) {
  let at = start;
  while (at < end) {
    const id = readVint(b, at, true);
    const size = id && readVint(b, at + id.length, false);
    if (!id || !size || size.unknown) throw unsupported("ebml_child");
    const dataStart = at + id.length + size.length;
    if (dataStart + size.value > end) throw unsupported("ebml_truncated");
    visit(id.value, dataStart, size.value);
    at = dataStart + size.value;
  }
}

/**
 * Walks EBML/WebM framing: every element must end inside its parent and the
 * stream must end exactly at EOF. Unknown-size Segment/Cluster (MediaRecorder
 * style) are entered rather than skipped. Also reads, independently of
 * Mediabunny, every TrackEntry (type and CodecDelay) and the TimestampScale:
 * Mediabunny drops some TrackEntries (e.g. video without PixelWidth) and never
 * applies CodecDelay.
 * @param {Uint8Array} b
 */
function walkEbml(b) {
  let at = 0;
  let end = b.length;
  let steps = 0;
  let sawSegment = false;
  /** @type {{ type: number | null; codecDelayNs: number }[]} */
  const tracks = [];
  let timestampScaleNs = 1_000_000;
  while (at < end) {
    if (++steps > 2 * MEDIA_RULES.maxAudioPackets + 10_000) {
      throw unsupported("ebml_elements");
    }
    const id = readVint(b, at, true);
    const size = id && readVint(b, at + id.length, false);
    if (!id || !size) throw unsupported("ebml_truncated");
    if (at === 0 && id.value !== EBML_HEADER) throw unsupported("ebml_header");
    const dataStart = at + id.length + size.length;
    if (id.value === SEGMENT && !sawSegment) {
      sawSegment = true;
      if (!size.unknown) {
        end = dataStart + size.value;
        if (end > b.length) throw unsupported("ebml_truncated");
      }
      at = dataStart;
      continue;
    }
    if (size.unknown) {
      if (id.value !== CLUSTER) throw unsupported("ebml_unknown_size");
      at = dataStart; // children follow; the next Cluster ends this one
      continue;
    }
    const elementEnd = dataStart + size.value;
    if (elementEnd > end) throw unsupported("ebml_truncated");
    if (sawSegment && id.value === INFO) {
      eachChild(b, dataStart, elementEnd, (child, start, length) => {
        if (child === TIMESTAMP_SCALE)
          timestampScaleNs = readUint(b, start, length);
      });
    }
    if (sawSegment && id.value === TRACKS) {
      eachChild(b, dataStart, elementEnd, (child, start, length) => {
        if (child !== TRACK_ENTRY) return;
        /** @type {{ type: number | null; codecDelayNs: number }} */
        const track = { type: null, codecDelayNs: 0 };
        eachChild(
          b,
          start,
          start + length,
          (field, fieldStart, fieldLength) => {
            if (field === TRACK_TYPE)
              track.type = readUint(b, fieldStart, fieldLength);
            if (field === CODEC_DELAY) {
              track.codecDelayNs = readUint(b, fieldStart, fieldLength);
            }
          },
        );
        tracks.push(track);
      });
    }
    at = elementEnd;
  }
  if (!sawSegment) throw unsupported("ebml_segment");
  if (!(timestampScaleNs > 0)) throw unsupported("ebml_timestamp_scale");
  return { tracks, timestampScaleNs };
}

/**
 * Ogg: pages must tile the file exactly, and there must be exactly one
 * logical stream (one BOS page, every page carrying its serial). Mediabunny
 * silently ignores streams it cannot identify (e.g. VP8/Theora).
 * @param {Uint8Array} b
 */
function walkOgg(b) {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let at = 0;
  /** @type {number | null} */
  let serial = null;
  let bosPages = 0;
  while (at < b.length) {
    if (
      at + 27 > b.length ||
      b[at] !== 0x4f ||
      b[at + 1] !== 0x67 ||
      b[at + 2] !== 0x67 ||
      b[at + 3] !== 0x53
    ) {
      throw unsupported("ogg_framing");
    }
    const flags = b[at + 5] ?? 0;
    const pageSerial = view.getUint32(at + 14, true);
    const segments = b[at + 26] ?? 0;
    if (at + 27 + segments > b.length) throw unsupported("ogg_framing");
    let body = 0;
    for (let i = 0; i < segments; i++) body += b[at + 27 + i] ?? 0;
    if ((flags & 0x02) !== 0) bosPages += 1;
    if (serial === null) serial = pageSerial;
    if (pageSerial !== serial || bosPages > 1) throw unsupported("ogg_streams");
    at += 27 + segments + body;
    if (at > b.length) throw unsupported("ogg_truncated");
  }
  if (bosPages !== 1) throw unsupported("ogg_streams");
}

/**
 * ISOBMFF: top-level boxes must fit; exactly one `moov` holding exactly one
 * `trak`, whose `hdlr` is `soun`. Mediabunny only surfaces vide/soun tracks,
 * so text, subtitle, auxv, hint or meta tracks would otherwise be invisible.
 * @param {Uint8Array} b
 */
function walkIsobmff(b) {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const type = (at) =>
    String.fromCharCode(
      b[at] ?? 0,
      b[at + 1] ?? 0,
      b[at + 2] ?? 0,
      b[at + 3] ?? 0,
    );
  /**
   * @param {number} start
   * @param {number} end
   * @param {(boxType: string, dataStart: number, boxEnd: number) => void} visit
   */
  const eachBox = (start, end, visit) => {
    let at = start;
    while (at < end) {
      if (at + 8 > end) throw unsupported("mp4_framing");
      let size = view.getUint32(at);
      let header = 8;
      if (size === 1) {
        if (at + 16 > end) throw unsupported("mp4_framing");
        size = Number(view.getBigUint64(at + 8));
        header = 16;
      } else if (size === 0) {
        size = end - at;
      }
      if (size < header || at + size > end) throw unsupported("mp4_truncated");
      visit(type(at + 4), at + header, at + size);
      at += size;
    }
  };
  let moovs = 0;
  /** @type {string[]} */
  const handlers = [];
  eachBox(0, b.length, (boxType, start, end) => {
    if (boxType !== "moov") return;
    moovs += 1;
    eachBox(start, end, (child, trakStart, trakEnd) => {
      if (child !== "trak") return;
      let handler = "";
      eachBox(trakStart, trakEnd, (trakChild, mdiaStart, mdiaEnd) => {
        if (trakChild !== "mdia") return;
        eachBox(mdiaStart, mdiaEnd, (mdiaChild, hdlrStart, hdlrEnd) => {
          // FullBox version/flags (4) + pre_defined (4), then handler_type.
          if (mdiaChild === "hdlr" && hdlrStart + 12 <= hdlrEnd) {
            handler = type(hdlrStart + 8);
          }
        });
      });
      handlers.push(handler);
    });
  });
  if (moovs !== 1 || handlers.length !== 1 || handlers[0] !== "soun") {
    throw unsupported("mp4_tracks");
  }
}

/**
 * RIFF/WAVE: every chunk (and its pad byte, except at EOF) must fit.
 * @param {Uint8Array} b
 */
function checkRiffFraming(b) {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b.length < 12) throw unsupported("riff_truncated");
  let at = 12;
  let sawData = false;
  while (at < b.length) {
    if (at + 8 > b.length) throw unsupported("riff_truncated");
    const size = view.getUint32(at + 4, true);
    const chunkEnd = at + 8 + size;
    if (chunkEnd > b.length) throw unsupported("riff_truncated");
    if (
      b[at] === 0x64 &&
      b[at + 1] === 0x61 &&
      b[at + 2] === 0x74 &&
      b[at + 3] === 0x61
    ) {
      sawData = true;
    }
    at = chunkEnd + (size % 2 === 1 && chunkEnd < b.length ? 1 : 0);
  }
  if (!sawData) throw unsupported("riff_data");
}

/**
 * Whether an MP3 carries a Xing/Info/VBRI header (an encoder-written frame
 * count) in its first frame, after any ID3v2 tag.
 * @param {Uint8Array} b
 */
function hasMp3FrameCount(b) {
  let at = 0;
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33 && b.length >= 10) {
    const size =
      (((b[6] ?? 0) & 0x7f) << 21) |
      (((b[7] ?? 0) & 0x7f) << 14) |
      (((b[8] ?? 0) & 0x7f) << 7) |
      ((b[9] ?? 0) & 0x7f);
    at = 10 + size + (((b[5] ?? 0) & 0x10) !== 0 ? 10 : 0);
  }
  const head = new TextDecoder("latin1").decode(b.subarray(at, at + 4096));
  return /Xing|Info|VBRI/.test(head);
}

// --- inspection -------------------------------------------------------------

/**
 * Inspects bytes as one supported audio-only file and returns its
 * packet-derived duration. Throws MediaRejection on anything else.
 *
 * @param {typeof import("mediabunny")} mb The Mediabunny module.
 * @param {Uint8Array} bytes
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<AudioInspection>}
 */
export async function inspectAudio(mb, bytes, options = {}) {
  const { signal } = options;
  checkAbort(signal);
  if (bytes.byteLength === 0) throw unsupported("empty");
  if (bytes.byteLength > MEDIA_RULES.maxFileBytes) {
    throw new MediaRejection("TOO_LARGE", "bytes");
  }

  const input = new mb.Input({
    // Only these five byte-buffer formats; no HLS/URL/path sources.
    formats: [mb.MP4, mb.WEBM, mb.OGG, mb.MP3, mb.WAVE],
    source: new mb.BufferSource(bytes),
  });
  try {
    /** @type {import("mediabunny").InputFormat} */
    let format;
    try {
      format = await input.getFormat();
    } catch {
      throw unsupported("container");
    }
    /** @type {AudioContainer} */
    const container =
      format === mb.MP4
        ? "mp4"
        : format === mb.WEBM
          ? "webm"
          : format === mb.OGG
            ? "ogg"
            : format === mb.MP3
              ? "mp3"
              : format === mb.WAVE
                ? "wave"
                : (() => {
                    throw unsupported("container");
                  })();
    // Container-level stream counts, independent of Mediabunny's track list
    // (which omits streams it cannot parse). WAVE and MP3 carry a single
    // stream by construction; their framing is still checked.
    let codecDelaySeconds = 0;
    let timestampTickSeconds = 0;
    if (container === "webm") {
      const ebml = walkEbml(bytes);
      const entry = ebml.tracks[0];
      if (ebml.tracks.length !== 1 || entry?.type !== TRACK_TYPE_AUDIO) {
        throw unsupported("webm_tracks");
      }
      codecDelaySeconds = entry.codecDelayNs / 1e9;
      timestampTickSeconds = ebml.timestampScaleNs / 1e9;
    }
    if (container === "ogg") walkOgg(bytes);
    if (container === "mp4") walkIsobmff(bytes);
    if (container === "wave") checkRiffFraming(bytes);

    // Every track, of any type: exactly one, and it must be audio.
    const tracks = await input.getTracks();
    const track = tracks[0];
    if (tracks.length !== 1 || !track || !track.isAudioTrack()) {
      throw unsupported("tracks");
    }
    const codec = await track.getCodec();
    const rule = MEDIA_RULES.audioContainers[container];
    if (!codec || !rule.codecs.includes(codec)) throw unsupported("codec");
    checkAbort(signal);

    // Presentation timing from the packets themselves (decode order), with
    // their data, so packets whose bytes are missing are noticed below.
    const sink = new mb.EncodedPacketSink(track);
    let count = 0;
    let minStart = Number.POSITIVE_INFINITY;
    let maxEnd = Number.NEGATIVE_INFINITY;
    let previousStart = Number.NEGATIVE_INFINITY;
    /** @type {import("mediabunny").EncodedPacket | null} */
    let last = null;
    for await (const packet of sink.packets()) {
      if (++count > MEDIA_RULES.maxAudioPackets) throw unsupported("packets");
      if (count % 512 === 0) checkAbort(signal);
      const { timestamp, duration } = packet;
      if (
        !Number.isFinite(timestamp) ||
        !Number.isFinite(duration) ||
        duration < 0
      ) {
        throw unsupported("timing");
      }
      // Audio has no reordering: presentation order equals decode order.
      if (timestamp < previousStart - EPSILON)
        throw unsupported("timing_backwards");
      if (
        packet.data.byteLength !== packet.byteLength ||
        packet.byteLength === 0
      ) {
        throw unsupported("packet_data");
      }
      previousStart = timestamp;
      minStart = Math.min(minStart, timestamp);
      maxEnd = Math.max(maxEnd, timestamp + duration);
      last = packet;
    }
    if (!last) throw unsupported("no_packets");
    checkAbort(signal);

    // The index knows more packets than the bytes contain: truncated.
    if (await sink.getNextPacket(last, { metadataOnly: true })) {
      throw unsupported("truncated");
    }
    // A finite declared duration well beyond the packets also means
    // truncation. (Declared values are never trusted as the duration.) MP3
    // only declares one in a Xing/Info/VBRI frame; without it Mediabunny
    // estimates from the first frame's bitrate, which is wrong for VBR.
    /** @type {number | null} */
    let declared = null;
    if (container !== "mp3" || hasMp3FrameCount(bytes)) {
      try {
        declared = await input.getDurationFromMetadata();
      } catch {
        declared = null;
      }
    }
    if (
      declared !== null &&
      Number.isFinite(declared) &&
      declared >
        maxEnd + DECLARED_SLACK_SECONDS + declared * DECLARED_SLACK_RATIO
    ) {
      throw unsupported("truncated_declared");
    }

    // Priming/pre-roll may start before zero via the parser's presentation
    // timeline (edit lists, codec delay); anything beyond that is impossible.
    if (
      minStart < -MAX_PREROLL_SECONDS ||
      !(maxEnd > minStart) ||
      !(maxEnd > 0)
    ) {
      throw unsupported("timing_range");
    }
    // Duration is the end of the presentation timeline. Matroska's
    // CodecDelay (Opus pre-skip) is not applied by Mediabunny's WebM demuxer
    // (Ogg pre-skip is), so remove it here.
    if (codecDelaySeconds < 0 || codecDelaySeconds > MAX_PREROLL_SECONDS) {
      throw unsupported("codec_delay");
    }
    const end = maxEnd - codecDelaySeconds;
    if (!(end > 0)) throw unsupported("timing_range");
    // WebM block timestamps and durations are quantized to TimestampScale
    // ticks (1 ms in practice), so the last block's end can read up to two
    // ticks long. Only that container-specific error is forgiven, capped at
    // 2 ms; the reported duration then never exceeds the limit.
    const quantization = Math.min(
      2 * timestampTickSeconds,
      MAX_WEBM_QUANTIZATION_SECONDS,
    );
    const limit = MEDIA_RULES.maxAudioSeconds;
    if (end > limit + EPSILON + quantization) {
      throw new MediaRejection("INVALID_INPUT", "duration");
    }
    const durationSeconds = Math.min(Math.round(end * 1e6) / 1e6, limit);
    return {
      container,
      codec,
      mimeType: rule.mimeType,
      extension: rule.extension,
      durationSeconds,
    };
  } catch (error) {
    if (error instanceof MediaRejection) throw error;
    // Parser errors (malformed boxes, assertion failures, unsupported codec
    // tags) are rejections, not crashes.
    throw unsupported("parse");
  } finally {
    input.dispose();
  }
}
