import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ApiErrorCode } from "@/types/shoebox";

/**
 * Manifest of the synthetic media fixtures in tests/fixtures/shoebox. Every
 * file is generated (see that folder's README for exact commands and hashes);
 * tests only read the committed bytes, never ffmpeg.
 */

const FIXTURE_DIR = fileURLToPath(
  new URL("../fixtures/shoebox/", import.meta.url),
);

export function fixtureBytes(name: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(readFileSync(`${FIXTURE_DIR}${name}`));
}

export function fixtureFile(name: string, type: string): File {
  return new File([fixtureBytes(name)], name, { type });
}

type Accept = {
  ok: true;
  mimeType: string;
  filename: string;
  /** Packet-derived end of presentation, seconds. */
  durationSeconds?: number;
  width?: number;
  height?: number;
};
type Reject = { ok: false; code: ApiErrorCode };

export type MediaFixture = {
  name: string;
  kind: "photo" | "audio";
  /** Browser-declared MIME type used when building the File. */
  type: string;
  why: string;
  expect: Accept | Reject;
};

const audio = (
  name: string,
  type: string,
  why: string,
  expect: Accept | Reject,
): MediaFixture => ({ name, kind: "audio", type, why, expect });

const photo = (
  name: string,
  type: string,
  why: string,
  expect: Accept | Reject,
): MediaFixture => ({ name, kind: "photo", type, why, expect });

const webm = (durationSeconds: number): Accept => ({
  ok: true,
  mimeType: "audio/webm",
  filename: "memory.weba",
  durationSeconds,
});
const mp4 = (durationSeconds: number): Accept => ({
  ok: true,
  mimeType: "audio/mp4",
  filename: "memory.m4a",
  durationSeconds,
});
const unsupported: Reject = { ok: false, code: "UNSUPPORTED_MEDIA" };
const tooLong: Reject = { ok: false, code: "INVALID_INPUT" };
const tooLarge: Reject = { ok: false, code: "TOO_LARGE" };

export const AUDIO_FIXTURES: MediaFixture[] = [
  audio("audio-wav-pcm16-1s.wav", "audio/wav", "PCM WAV", {
    ok: true,
    mimeType: "audio/wav",
    filename: "memory.wav",
    durationSeconds: 1,
  }),
  audio("audio-mp3-1s.mp3", "audio/mpeg", "MP3 with Xing header", {
    ok: true,
    mimeType: "audio/mpeg",
    filename: "memory.mp3",
    durationSeconds: 1.032,
  }),
  audio(
    "audio-mp3-vbr-no-xing-2s.mp3",
    "audio/mpeg",
    "VBR without Xing: the bitrate estimate (~5 s) is not a truncation signal",
    {
      ok: true,
      mimeType: "audio/mpeg",
      filename: "memory.mp3",
      durationSeconds: 2.037_551,
    },
  ),
  audio("audio-ogg-opus-1s.ogg", "audio/ogg", "Ogg/Opus", {
    ok: true,
    mimeType: "audio/ogg",
    filename: "memory.ogg",
    durationSeconds: 1,
  }),
  audio("audio-ogg-vorbis-1s.ogg", "audio/ogg", "Ogg/Vorbis", {
    ok: true,
    mimeType: "audio/ogg",
    filename: "memory.ogg",
    durationSeconds: 1.024,
  }),
  audio(
    "audio-m4a-aac-2s-editlist.m4a",
    "audio/mp4",
    "AAC priming hidden by an edit list (negative first packet timestamp)",
    mp4(2),
  ),
  audio(
    "audio-m4a-aac-60s-exact.m4a",
    "audio/x-m4a",
    "exactly 60 s on the presentation timeline",
    mp4(60),
  ),
  audio(
    "audio-fmp4-aac-2s.m4a",
    "audio/mp4",
    "fragmented MP4 (empty moov, no declared duration)",
    mp4(2.021_333),
  ),
  audio("audio-webm-opus-2s.webm", "audio/webm", "WebM/Opus", webm(2.0015)),
  audio(
    "audio-webm-opus-2s-no-duration.webm",
    "audio/webm;codecs=opus",
    "recorder-style WebM with no Duration element",
    webm(2.0015),
  ),
  audio(
    "audio-webm-opus-59s-no-duration.webm",
    "",
    "59 s, no Duration, empty browser MIME",
    webm(59.0015),
  ),
  audio(
    "audio-webm-opus-2s-nan-duration.webm",
    "video/webm",
    "NaN Duration ignored; packets are 2 s",
    webm(2.0015),
  ),
  audio(
    "audio-webm-opus-60s-no-duration.webm",
    "audio/webm",
    "true 60 s of content: CodecDelay removed, ms quantization forgiven",
    webm(60),
  ),
  // Over the limit, whatever the container declares.
  audio(
    "audio-webm-opus-60.01s-no-duration.webm",
    "audio/webm",
    "60.01 s of content (60.0115 s after CodecDelay)",
    tooLong,
  ),
  audio(
    "audio-webm-opus-61s-no-duration.webm",
    "audio/webm",
    "61 s of packets, no declared duration",
    tooLong,
  ),
  audio(
    "audio-webm-opus-61s-forged-5s.webm",
    "audio/webm",
    "Duration forged to 5 s, packets run 61 s",
    tooLong,
  ),
  audio(
    "audio-webm-opus-61s-nan-duration.webm",
    "audio/webm",
    "Duration NaN, packets run 61 s",
    tooLong,
  ),
  audio(
    "audio-m4a-aac-61s-forged-5s.m4a",
    "audio/mp4",
    "mvhd/tkhd/mdhd forged to 5 s, sample table runs 61 s",
    tooLong,
  ),
  // Hidden video declared as audio.
  audio("hidden-video-only.mp4", "audio/mp4", "H.264 only", unsupported),
  audio("hidden-audio-video.mp4", "audio/mp4", "H.264 + AAC", unsupported),
  audio(
    "hidden-mp4v-audio.mp4",
    "audio/mp4",
    "MPEG-4 Part 2 + AAC",
    unsupported,
  ),
  audio("hidden-mjpeg-audio.mp4", "audio/mp4", "MJPEG + AAC", unsupported),
  audio(
    "hidden-audio-first-video.mp4",
    "audio/mp4",
    "AAC track first, H.264 second",
    unsupported,
  ),
  audio(
    "hidden-audio-first-video.webm",
    "audio/webm",
    "Opus track first, VP8 second",
    unsupported,
  ),
  audio("hidden-video-only.webm", "audio/webm", "VP8 only", unsupported),
  // Streams Mediabunny's track list does not show.
  audio(
    "hidden-ogg-opus-vp8.ogg",
    "audio/ogg",
    "Opus + VP8 logical streams (VP8 dropped by the parser)",
    unsupported,
  ),
  audio(
    "hidden-ogg-two-opus.ogg",
    "audio/ogg",
    "two Opus logical streams",
    unsupported,
  ),
  audio(
    "hidden-webm-video-no-pixel-size.webm",
    "audio/webm",
    "VP8 TrackEntry without PixelWidth/PixelHeight (dropped by the parser)",
    unsupported,
  ),
  audio(
    "hidden-mp4-text-track.m4a",
    "audio/mp4",
    "AAC + mov_text trak (non-vide/soun handler, invisible to the parser)",
    unsupported,
  ),
  audio("hidden-audio-video.webm", "audio/webm", "VP8 + Opus", unsupported),
  // Unsupported codecs and containers.
  audio("unsupported-ogg-flac.ogg", "audio/ogg", "FLAC in Ogg", unsupported),
  audio("unsupported-alac.m4a", "audio/mp4", "ALAC in MP4", unsupported),
  audio("unsupported-adpcm.wav", "audio/wav", "MS ADPCM WAV", unsupported),
  audio("unsupported-mulaw.wav", "audio/wav", "G.711 mu-law WAV", unsupported),
  audio("unsupported-adts.aac", "audio/aac", "raw ADTS AAC", unsupported),
  audio("unsupported-native.flac", "audio/flac", "native FLAC", unsupported),
  audio(
    "unsupported-quicktime-aac.mov",
    "audio/mp4",
    "QuickTime container",
    unsupported,
  ),
  audio(
    "unsupported-matroska-opus.mka",
    "audio/webm",
    "Matroska (not WebM) DocType",
    unsupported,
  ),
  // Truncation.
  audio(
    "truncated-m4a-faststart-mdat.m4a",
    "audio/mp4",
    "moov intact, mdat cut: sample table points past EOF",
    unsupported,
  ),
  audio("truncated-m4a-moov-at-end.m4a", "audio/mp4", "moov lost", unsupported),
  audio(
    "truncated-fmp4-fragment.m4a",
    "audio/mp4",
    "last fragment's mdat cut",
    unsupported,
  ),
  audio(
    "truncated-webm-cluster.webm",
    "audio/webm",
    "known-size Cluster extends past EOF",
    unsupported,
  ),
  audio(
    "truncated-webm-live-block.webm",
    "audio/webm",
    "unknown-size Cluster ends inside a SimpleBlock",
    unsupported,
  ),
  audio(
    "truncated-webm-ebml-header.webm",
    "audio/webm",
    "EBML header only",
    unsupported,
  ),
  audio("truncated-ogg-page.ogg", "audio/ogg", "Ogg page cut", unsupported),
  audio(
    "truncated-wav-data.wav",
    "audio/wav",
    "data chunk extends past EOF",
    unsupported,
  ),
  audio(
    "truncated-mp3-xing.mp3",
    "audio/mpeg",
    "Xing frame count says 1.032 s, half the frames present",
    unsupported,
  ),
];

export const PHOTO_FIXTURES: MediaFixture[] = [
  photo(
    "photo-exif-orientation-gps.jpg",
    "image/jpeg",
    "64x32 with EXIF Orientation=6 and GPS",
    {
      ok: true,
      mimeType: "image/jpeg",
      filename: "memory.jpg",
      width: 32,
      height: 64,
    },
  ),
  photo("photo-edge-2048.jpg", "", "2048x1024 long edge exactly at limit", {
    ok: true,
    mimeType: "image/jpeg",
    filename: "memory.jpg",
    width: 2048,
    height: 1024,
  }),
  photo("photo-edge-2049.jpg", "image/jpeg", "2049x16 long edge", tooLarge),
  photo(
    "photo-excessive-pixels.jpg",
    "image/jpeg",
    "2100x2100, over 4,194,304 px",
    tooLarge,
  ),
  photo(
    "photo-dimension-bomb.jpg",
    "image/jpeg",
    "SOF claims 60000x60000",
    tooLarge,
  ),
  photo(
    "photo-truncated.jpg",
    "image/jpeg",
    "entropy-coded data cut",
    unsupported,
  ),
  photo("photo-transparent.png", "image/png", "PNG is not JPEG", unsupported),
];
