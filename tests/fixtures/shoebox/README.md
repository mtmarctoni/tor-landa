# Shoebox media fixtures

Synthetic, license-clear test media for Task 4 (`tests/unit/shoebox/media-validation.test.ts`,
`photo-processing.test.ts`) and later browser tests. Expected outcomes per file live in
`tests/helpers/mock-media.ts`.

- **Provenance:** every file is generated: ffmpeg `lavfi` sine tones (440 Hz), digital silence
  (`anullsrc`) and a flat 16x16 colour video, or Sharp-generated gradients/noise. No camera,
  microphone, download or personal data. EXIF/GPS in `photo-exif-orientation-gps.jpg` is made up
  (Make "Synthetic", 41°23'N 2°10'E).
- **Tools (development time only):** ffmpeg 9.0.1 (Homebrew `/opt/homebrew/bin/ffmpeg`), Node 24.21,
  Sharp 0.34.5 from this project. ffmpeg is **not** a runtime or test dependency; tests only read
  these committed bytes.
- **Reproducible:** the script below, run from the repository root as
  `bash generate-fixtures.sh tests/fixtures/shoebox`, reproduced every hash in the table
  byte-for-byte on 2026-10-21 (`-fflags +bitexact -flags +bitexact` removes random Matroska
  SegmentUIDs and Ogg serials). Total: 54 files, 540,198 bytes.

## Files, packet timing and hashes

"Packets" is what Mediabunny 1.61.6 reports with `EncodedPacketSink.packets()` (all tracks,
decode order): count, first presentation timestamp and end of presentation
(`max(timestamp + duration)`) in seconds. The validator's duration is that end value, minus the
Matroska `CodecDelay` for WebM (6,500,000 ns in every WebM/Opus fixture; Mediabunny applies Ogg
pre-skip itself but not Matroska CodecDelay). For example, the WebM 2 s files end at 2.008, so their
duration is 2.0015 s.

| File | Bytes | Packets (Mediabunny 1.61.6) | SHA-256 |
| --- | ---: | --- | --- |
| `audio-fmp4-aac-2s.m4a` | 6253 | audio/aac: 95 pkts, first 0, end 2.021333 | `c173b6933a47d14db5fd80e1f09ab52fa00624c2bb7e45aa37b4e47012d1e807` |
| `audio-m4a-aac-2s-editlist.m4a` | 5784 | audio/aac: 95 pkts, first -0.021333, end 2 | `1501645ed30ed5778760041271378d3c75114c0d3cb741bb3d4959812379d6dd` |
| `audio-m4a-aac-60s-exact.m4a` | 12026 | audio/aac: 2814 pkts, first -0.021333, end 60 | `1d02faaacafe4f0b54078d80c8af7de1eac55bdd8c536c544c74e0c6c1ff61d1` |
| `audio-m4a-aac-61s-forged-5s.m4a` | 12178 | audio/aac: 2861 pkts, first 0, end 61.021333 | `9fac72bdb10ecf157a5c5eb03bb365e47f0c31bd89e4c58a37750cfb18049bae` |
| `audio-mp3-1s.mp3` | 4340 | audio/mp3: 43 pkts, first 0, end 1.032 | `ed9ed01cbb4304a9460d05d4f4724e04df0758bf18b456ecab4037227ffbfb05` |
| `audio-mp3-vbr-no-xing-2s.mp3` | 20081 | audio/mp3: 78 pkts, first 0, end 2.037551 | `8a9aad5a2c64dcf7cd29f68d4ba761a6bbcad3ee8ca638e1136027f3261d0571` |
| `audio-ogg-opus-1s.ogg` | 1084 | audio/opus: 51 pkts, first 0, end 1 | `3d80553f7dc936fd84ae530ee9dbc6b01bf6e577871f4656543ea9605e63c377` |
| `audio-ogg-vorbis-1s.ogg` | 3972 | audio/vorbis: 17 pkts, first 0, end 1.024 | `0aa1ea330017a64c9afb85c981a70388d6c7cb3ce73665639ab30d326d7ea259` |
| `audio-wav-pcm16-1s.wav` | 16044 | audio/pcm-s16: 4 pkts, first 0, end 1 | `45613acc78923052374947c91418cd694f8487094b7cede6c9a31e57f2944e20` |
| `audio-webm-opus-2s-nan-duration.webm` | 2731 | audio/opus: 101 pkts, first 0, end 2.008 | `9f8f477be36301ab112b074b7459c7128d34984237bb6d89437984fd901856ba` |
| `audio-webm-opus-2s-no-duration.webm` | 2677 | audio/opus: 101 pkts, first 0, end 2.008 | `ae60202189a18ce97c9ed005def219d89f40f57111fa546e7591755905e43de2` |
| `audio-webm-opus-2s.webm` | 2731 | audio/opus: 101 pkts, first 0, end 2.008 | `d627df38c491c19e267cf850e5877dabf9c94868465706ae4662da53d61ae330` |
| `audio-webm-opus-59s-no-duration.webm` | 36422 | audio/opus: 2951 pkts, first 0, end 59.008 | `9250d5168440eea23a9d3bee831da4542c884f19cf71663c212dd1a803ad273f` |
| `audio-webm-opus-60.01s-no-duration.webm` | 37031 | audio/opus: 3001 pkts, first 0, end 60.018 | `9a154af40c29fbc4c050db05f08fa76d53d3227ad7e590598d8d5deb1c8b5f34` |
| `audio-webm-opus-60s-no-duration.webm` | 37032 | audio/opus: 3001 pkts, first 0, end 60.008 | `bd6282fe48a7be995e4cde8d8f246aeabb29a5718d089cf6bd4308f6deb9f4ce` |
| `audio-webm-opus-61s-forged-5s.webm` | 37443 | audio/opus: 3051 pkts, first 0, end 61.008 | `9ecb9d8c9baef20cdfd37aeb246c60fd43f6c09ec63fa5f05d97802a0d2b67b5` |
| `audio-webm-opus-61s-nan-duration.webm` | 37443 | audio/opus: 3051 pkts, first 0, end 61.008 | `7b12d3b3ebf957c5b9ef53fdc44662c8c25e16cf83c521d6c2acef174651fc4d` |
| `audio-webm-opus-61s-no-duration.webm` | 37642 | audio/opus: 3051 pkts, first 0, end 61.008 | `02f084bad8aff583a6be288665fbdf04cab0d138360218d3ef139cd29159013c` |
| `hidden-audio-first-video.mp4` | 4894 | audio/aac: 48 pkts, first -0.021333, end 1; video/avc: 5 pkts, first 0, end 1 | `cc8d75096e513fd26d694ae60d7df993ced64221e9405c431ec584f7621b2fa6` |
| `hidden-audio-first-video.webm` | 1976 | audio/opus: 51 pkts, first 0, end 1.008; video/vp8: 5 pkts, first 0, end 1 | `45fb825233b8a3d26555f36e5a9790f3adf321277048e4b1582e3814fabfc40b` |
| `hidden-audio-video.mp4` | 4906 | video/avc: 5 pkts, first 0, end 1; audio/aac: 48 pkts, first -0.021333, end 1 | `cef6bd5995654f71afb3d9d0cedb59cb9c6697aabaefc538edd22734c5dac9be` |
| `hidden-audio-video.webm` | 1976 | video/vp8: 5 pkts, first 0, end 1; audio/opus: 51 pkts, first 0, end 1.008 | `72b87cb6378958f1c68441d906f961488b4473c75286aab2a6df24b976d18826` |
| `hidden-mjpeg-audio.mp4` | 5084 | video/null: 5 pkts, first 0, end 1; audio/aac: 48 pkts, first -0.021333, end 1 | `dd647c5aca632e58a5f661edeeea058bd0d55ef7936644af3831cf7a665d9287` |
| `hidden-mp4-text-track.m4a` | 3882 | audio/aac: 48 pkts, first -0.021333, end 1 | `d947c21e31ed11a23fd2e723ce94349e1cd74bfd1166828cf2ea7ca7d460684e` |
| `hidden-mp4v-audio.mp4` | 4171 | video/null: 5 pkts, first 0, end 1; audio/aac: 48 pkts, first -0.021333, end 1 | `83e17b1107000c97a4bf38e69b3cae28b4b9897b1669600ad8020c1d35e15ee9` |
| `hidden-ogg-opus-vp8.ogg` | 1389 | audio/opus: 51 pkts, first 0, end 1 | `75ba6db8a11ff8a84b20cf3c3b1373673cc09b57368ecb2f2229adc0c4fdc806` |
| `hidden-ogg-two-opus.ogg` | 2114 | audio/opus: 51 pkts, first 0, end 1; audio/opus: 51 pkts, first 0, end 1 | `b2ff585535c000640a9e2ac5ad9176a44a4ddf28aa6c6f75b687c299f4db9034` |
| `hidden-video-only.mp4` | 1657 | video/avc: 5 pkts, first 0, end 1 | `57638f5f906eeb8158619d3bb38ad669d7f04d9332ce72af9cb0b011693cbe63` |
| `hidden-video-only.webm` | 604 | video/vp8: 5 pkts, first 0, end 1 | `b3dcf411b2865aed3d402c9af567d04ab9077dd9d51c96732d5b5d6173fa1a02` |
| `hidden-webm-video-no-pixel-size.webm` | 1976 | audio/opus: 51 pkts, first 0, end 1.008 | `acdb9bec96f680d06e685af30fd3b9e7b3f6674f341f5edea49bc7a6a5485f02` |
| `photo-dimension-bomb.jpg` | 306 | - | `6ea0bc2ced60858ec18c501d54fcd1e9f4df4bfc0200d30bb1626e16173f9b8e` |
| `photo-edge-2048.jpg` | 31586 | - | `0155c99252180b6d76052307458bb923359f2422dc242b958008243141ce5b8f` |
| `photo-edge-2049.jpg` | 2345 | - | `6b907c6e78e22dd501cc1be0ade2f2892be3e289a8cff9ad0ee08437684a7d14` |
| `photo-excessive-pixels.jpg` | 33101 | - | `b2f7b525ec4d36a8104beb6a10cdf1648a9186a956b1bc8b5d7e3a5a71e6503c` |
| `photo-exif-orientation-gps.jpg` | 1350 | - | `d4d034a2bc0e5d70f27c8f83180e387a1ff032d379ea8bfb2dc8e2a233300e9c` |
| `photo-transparent.png` | 148 | - | `6fd606c7f965394dcd162294036bf501c301fbcd1512dbd4133279ce142ee1d8` |
| `photo-truncated.jpg` | 8340 | - | `8aee3bb364ee8459d63d7656323b2d592a859807657055be36a95529bfcd3683` |
| `truncated-fmp4-fragment.m4a` | 4500 | audio/aac: 59 pkts, first 0, end 1.258667 | `2f0131d4dde724129f6c08b897e44d9b35fe1f7ab4a6a7cf5f264411f1287b1c` |
| `truncated-m4a-faststart-mdat.m4a` | 4000 | audio/aac: 56 pkts, first -0.021333, end 1.173333 | `450dd13c1902a1230ba38a594b4a4351334e1b547938dd8c2746e3262f697332` |
| `truncated-m4a-moov-at-end.m4a` | 4000 | no tracks | `fc3cfbe53a785450d47eff858141fb287bb8534de173e44a5d591b6eaddfa2cc` |
| `truncated-mp3-xing.mp3` | 2500 | audio/mp3: 23 pkts, first 0, end 0.552 | `d070bb84bf4f154a82b52232423f4490d86ef94fd6f24e17b519c284d2eb8b71` |
| `truncated-ogg-page.ogg` | 700 | parser: Error | `5e4415e3c160cde75edf6079c0ea8a3c39af8a489d1d703ff9aba67ec0644f2d` |
| `truncated-wav-data.wav` | 9000 | audio/pcm-s16: 3 pkts, first 0, end 0.55975 | `e6b015fbe6d950ea943f6c355cfa80df03a6d00ac401c623345ffb2617709c31` |
| `truncated-webm-cluster.webm` | 8000 | audio/opus: 249 pkts, first 0, end 4.981 | `aa1aac96a7bfa549b64f290da9919dd891bfe90abf88e90458eb9ae87b09a5e6` |
| `truncated-webm-ebml-header.webm` | 20 | parser: UnsupportedInputFormatError | `270370639ec96e581962d2f85097a33b3a1f67e03f2bef7e173e13aba184a47d` |
| `truncated-webm-live-block.webm` | 8000 | audio/opus: 299 pkts, first 0, end 5.981 | `0e032e697759846123e7493f2486c583284eb1e027827d95c455925cae85f25d` |
| `unsupported-adpcm.wav` | 4186 | parser: Error | `fcf9ef10143c96c63ebc528a16daf239f69d81e9c6eb1a9512fce30f18cab0a3` |
| `unsupported-adts.aac` | 2752 | parser: UnsupportedInputFormatError | `e6700081e1c389c70e95af883f1d122d077ef79052d738600ef4e687fd788bcb` |
| `unsupported-alac.m4a` | 19749 | audio/null: 12 pkts, first 0, end 1 | `7695e6df81f7897aa9901e40a94faac97f5d9e8b51e28c406d1060309b885b0f` |
| `unsupported-matroska-opus.mka` | 1691 | parser: UnsupportedInputFormatError | `25dbcff03f319042837e6984f6ba50c20c9682e8ecb13f28296f79bc4a871ee6` |
| `unsupported-mulaw.wav` | 8058 | audio/ulaw: 4 pkts, first 0, end 1 | `51961d46bbb87c850e264c6c1390a44c06e178767f0ee1e28ab648144a112698` |
| `unsupported-native.flac` | 17653 | parser: UnsupportedInputFormatError | `ae95978c87ecfff1fa1e37dc4601b939e295ae9efb8d310859088b551166579c` |
| `unsupported-ogg-flac.ogg` | 17237 | no tracks | `93a5e546b9bafd9b2fce5d42b3959d7b48cc0c8c75c9f8c51c446f3caaeab06f` |
| `unsupported-quicktime-aac.mov` | 3433 | parser: UnsupportedInputFormatError | `a870f37b117008e940d2b567b98e84bcb12f8c0c4c003c0c7db3e7a4302381fb` |

## Structural proofs for the hand-edited and edge-case files

EBML walk (element ID, offset, size) over the top level and `Info` (`0x1549A966`) of the WebM
files. `0x4489` is the Matroska Duration element:

| File | Segment size | Info children | Duration (`0x4489`) |
| --- | --- | --- | --- |
| `audio-webm-opus-2s-no-duration.webm` | unknown (live) | 21 bytes: MuxingApp, WritingApp, TimestampScale only | **absent** |
| `audio-webm-opus-59s-no-duration.webm` | unknown (live) | 21 bytes, same | **absent** |
| `audio-webm-opus-61s-no-duration.webm` | unknown (live) | 21 bytes, same | **absent** |
| `audio-webm-opus-2s.webm` | 2,683 | 32 bytes | 2008 (ms), at byte 238 |
| `audio-webm-opus-61s-forged-5s.webm` | 37,395 | 32 bytes | **5000** (float64 overwritten at byte 238; packets end 61.008 s) |
| `audio-webm-opus-61s-nan-duration.webm` | 37,395 | 32 bytes | **NaN** (`0x7FF8000000000000`; packets end 61.008 s) |
| `audio-webm-opus-2s-nan-duration.webm` | 2,683 | 32 bytes | **NaN** (packets end 2.008 s) |

`-live 1` also writes unknown-size Clusters and no Cues, like Chrome/Firefox MediaRecorder output.
Mediabunny reports `getDurationFromMetadata() === null` for the three live files and both NaN files.

ISOBMFF box walk:

| File | Evidence |
| --- | --- |
| `audio-fmp4-aac-2s.m4a` | `moov` has `mvex`; `mvhd` and `mdhd` duration **0**; samples only in `moof`/`mdat` fragments; `mfra` at end. Mediabunny metadata duration `null`. |
| `audio-m4a-aac-2s-editlist.m4a` | `moov` at end; `elst` 1 entry, `media_time=1024` (AAC priming), `segment_duration=96000` at 48 kHz = 2 s; `mdhd` 97024. First packet timestamp −0.021333 s, end exactly 2. |
| `audio-m4a-aac-60s-exact.m4a` | Same edit-list layout; end exactly 60.000000 s (2,814 packets). |
| `audio-m4a-aac-61s-forged-5s.m4a` | Generated with `-use_editlist 0 -movflags +faststart`; `mvhd`, `tkhd` and `mdhd` durations overwritten with 5 s (240000 at 48 kHz); sample table still runs to 61.021 s. |
| `truncated-m4a-faststart-mdat.m4a` | First 4,000 bytes of a 2 s faststart file: `moov` intact (95 samples indexed), `mdat` cut. Mediabunny silently yields 56 packets; a metadata-only `getNextPacket` still finds the 57th. |
| `truncated-fmp4-fragment.m4a` | First 4,500 of 6,253 bytes: `moof` intact, its `mdat` cut (59 of 95 packets readable). |
| `truncated-m4a-moov-at-end.m4a` | First 4,000 bytes of the moov-at-end file: no `moov`, zero tracks. |

Other cut files: `truncated-webm-cluster.webm` (known-size Cluster 2 runs past EOF; declared Duration
12.008 s vs packets 4.981 s), `truncated-webm-live-block.webm` (unknown-size Cluster ends inside a
SimpleBlock; packets stop at 5.981 s with no error from the parser), `truncated-webm-ebml-header.webm`
(20 bytes), `truncated-ogg-page.ogg` (first 700 of 1,084 bytes; parser assertion),
`truncated-wav-data.wav` (`data` chunk declares 16,000 bytes, 8,956 present), `truncated-mp3-xing.mp3`
(Xing header promises 1.032 s; frames end at 0.552 s).

Photos: `photo-exif-orientation-gps.jpg` is 64x32 with EXIF Orientation 6 (displays 32x64) and a GPS
IFD (tag `0x8825`); `photo-dimension-bomb.jpg` is a valid 16x16 JPEG whose SOF0 height/width were
overwritten with 60000x60000; `photo-truncated.jpg` is the first 60% of a 128x128 noise JPEG;
`photo-transparent.png` is 32x32 RGBA at 40% alpha (for browser flattening tests; the server rejects
PNG).

## Streams hidden from Mediabunny's track list (review fix)

`Input.getTracks()` omits streams the demuxer cannot model. These fixtures show the parser returning a
single `audio` track while the container carries more. The validator counts streams at container
level as well:

| File | Container evidence | Mediabunny `getTracks()` |
| --- | --- | --- |
| `hidden-ogg-opus-vp8.ogg` | 8 pages, 2 BOS pages: `OpusHead` and `OVP80` (VP8) | `audio:opus` only |
| `hidden-ogg-two-opus.ogg` | 2 BOS pages, both `OpusHead` (440 Hz and 660 Hz) | `audio:opus`, `audio:opus` |
| `hidden-webm-video-no-pixel-size.webm` | 2 TrackEntries (TrackType 2 and 1). Byte edit of `hidden-audio-first-video.webm`: in the VP8 Video element (`e0 90`), the PixelWidth (`b0`) and PixelHeight (`ba`) IDs were overwritten with Void (`ec`); every size is unchanged (`e090ec8110ec81109a810255b08455b98101`) | `audio:opus` only |
| `hidden-mp4-text-track.m4a` | `moov` has 2 `trak` boxes, `hdlr` `soun` and `sbtl` (ffmpeg `mov_text` from a one-line synthetic SRT, "hola") | `audio:aac` only |

## CodecDelay boundary fixtures (review fix)

| File | Content | Packets end | CodecDelay | Validator |
| --- | --- | --- | --- | --- |
| `audio-webm-opus-60s-no-duration.webm` | exactly 60 s of silence | 60.008 | 6.5 ms | 60.0015 s, within the 2-tick (2 ms) TimestampScale quantization allowance: accepted, reported as 60 |
| `audio-webm-opus-60.01s-no-duration.webm` | 60.01 s | 60.018 | 6.5 ms | 60.0115 s: rejected (INVALID_INPUT) |

The 1 ms residue comes from ffmpeg's millisecond rounding. It shifts the timeline by round(6.5) = 7 ms, so blocks land at 20k + 1 ms and the last BlockDuration rounds 6.5 ms up to 7 ms. That residue is inherent to TimestampScale quantization.

## Exact generation commands

```bash
#!/usr/bin/env bash
# Development-time only. Run from the repository root:
#   bash generate-fixtures.sh tests/fixtures/shoebox   (script text = the block in README.md)
# Requires ffmpeg 9.0.1 (Homebrew, /opt/homebrew/bin/ffmpeg) and the project's
# installed sharp 0.34.5. Tests never run this; they read the committed files.
set -euo pipefail
OUT="$1"
mkdir -p "$OUT"
TMP="$(mktemp -d)"
trap 'rm -r "$TMP"' EXIT

F="ffmpeg -hide_banner -loglevel error -y -bitexact"
SINE="-f lavfi -i sine=frequency=440:sample_rate=48000"
SILENCE="-f lavfi -i anullsrc=r=48000:cl=mono"
VID="-f lavfi -i color=c=0x88aacc:s=16x16:r=5"

# --- valid audio -------------------------------------------------------------
$F $SINE:duration=1 -ac 1 -ar 8000 -c:a pcm_s16le -map_metadata -1 -fflags +bitexact -flags +bitexact "$OUT/audio-wav-pcm16-1s.wav"
$F $SINE:duration=1 -ac 1 -c:a libmp3lame -b:a 16k -map_metadata -1 -fflags +bitexact -flags +bitexact "$OUT/audio-mp3-1s.mp3"
# VBR with no Xing/Info header, silence first: a bitrate-based estimate says ~5 s.
$F -f lavfi -i anullsrc=r=44100:cl=mono:d=1 -f lavfi -i sine=frequency=440:sample_rate=44100:duration=1 -filter_complex "[0:a][1:a]concat=n=2:v=0:a=1" -c:a libmp3lame -q:a 0 -write_xing 0 -map_metadata -1 -fflags +bitexact -flags +bitexact "$OUT/audio-mp3-vbr-no-xing-2s.mp3"
$F $SINE:duration=1 -ac 1 -c:a libopus -b:a 8k -map_metadata -1 -fflags +bitexact -flags +bitexact "$OUT/audio-ogg-opus-1s.ogg"
$F $SINE:duration=1 -ac 2 -ar 16000 -c:a vorbis -q:a 0 -strict experimental -map_metadata -1 -fflags +bitexact -flags +bitexact "$OUT/audio-ogg-vorbis-1s.ogg"
# Default mp4 muxer: moov at end plus an edit list hiding 1024 samples of AAC priming.
$F $SINE:duration=2 -ac 1 -c:a aac -b:a 16k -map_metadata -1 -fflags +bitexact -flags +bitexact "$OUT/audio-m4a-aac-2s-editlist.m4a"
$F $SILENCE -t 60 -ac 1 -c:a aac -b:a 8k -map_metadata -1 -fflags +bitexact -flags +bitexact "$OUT/audio-m4a-aac-60s-exact.m4a"
$F $SINE:duration=2 -ac 1 -c:a aac -b:a 16k -map_metadata -1 -fflags +bitexact -flags +bitexact -movflags frag_keyframe+empty_moov "$OUT/audio-fmp4-aac-2s.m4a"
$F $SINE:duration=2 -ac 1 -c:a libopus -b:a 8k -map_metadata -1 -fflags +bitexact -flags +bitexact "$OUT/audio-webm-opus-2s.webm"
# -live 1: unknown-size Segment/Clusters, no Duration, no Cues (MediaRecorder-like).
$F $SINE:duration=2 -ac 1 -c:a libopus -b:a 8k -map_metadata -1 -fflags +bitexact -flags +bitexact -f webm -live 1 "$OUT/audio-webm-opus-2s-no-duration.webm"
$F $SILENCE -t 59 -ac 1 -c:a libopus -b:a 6k -map_metadata -1 -fflags +bitexact -flags +bitexact -f webm -live 1 "$OUT/audio-webm-opus-59s-no-duration.webm"
$F $SILENCE -t 61 -ac 1 -c:a libopus -b:a 6k -map_metadata -1 -fflags +bitexact -flags +bitexact -f webm -live 1 "$OUT/audio-webm-opus-61s-no-duration.webm"
# True 60 s and 60.01 s of content: Matroska CodecDelay (6.5 ms pre-skip) must be removed.
$F $SILENCE -t 60 -ac 1 -c:a libopus -b:a 6k -map_metadata -1 -fflags +bitexact -flags +bitexact -f webm -live 1 "$OUT/audio-webm-opus-60s-no-duration.webm"
$F $SILENCE -t 60.01 -ac 1 -c:a libopus -b:a 6k -map_metadata -1 -fflags +bitexact -flags +bitexact -f webm -live 1 "$OUT/audio-webm-opus-60.01s-no-duration.webm"

# --- forged / NaN duration metadata (byte edits below) ------------------------
$F $SILENCE -t 61 -ac 1 -c:a libopus -b:a 6k -map_metadata -1 -fflags +bitexact -flags +bitexact "$TMP/webm-61s.webm"
$F $SINE:duration=2 -ac 1 -c:a libopus -b:a 8k -map_metadata -1 -fflags +bitexact -flags +bitexact "$TMP/webm-2s.webm"
$F $SILENCE -t 61 -ac 1 -c:a aac -b:a 8k -map_metadata -1 -fflags +bitexact -flags +bitexact -use_editlist 0 -movflags +faststart "$TMP/m4a-61s.m4a"

# --- hidden video declared as audio --------------------------------------------
$F $VID:d=1 -c:v libx264 -pix_fmt yuv420p -map_metadata -1 -fflags +bitexact -flags +bitexact "$OUT/hidden-video-only.mp4"
$F $VID:d=1 $SINE:duration=1 -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 16k -ac 1 -shortest -map_metadata -1 -fflags +bitexact -flags +bitexact "$OUT/hidden-audio-video.mp4"
$F $VID:d=1 $SINE:duration=1 -c:v mpeg4 -c:a aac -b:a 16k -ac 1 -shortest -map_metadata -1 -fflags +bitexact -flags +bitexact "$OUT/hidden-mp4v-audio.mp4"
$F $VID:d=1 $SINE:duration=1 -c:v mjpeg -pix_fmt yuvj420p -c:a aac -b:a 16k -ac 1 -shortest -map_metadata -1 -fflags +bitexact -flags +bitexact "$OUT/hidden-mjpeg-audio.mp4"
# Audio track first, video second: the first track alone looks like valid audio.
$F $SINE:duration=1 $VID:d=1 -map 0:a -map 1:v -c:a aac -b:a 16k -ac 1 -c:v libx264 -pix_fmt yuv420p -shortest -map_metadata -1 -fflags +bitexact -flags +bitexact "$OUT/hidden-audio-first-video.mp4"
$F $SINE:duration=1 $VID:d=1 -map 0:a -map 1:v -c:a libopus -b:a 8k -ac 1 -c:v libvpx -b:v 20k -shortest -map_metadata -1 -fflags +bitexact -flags +bitexact "$OUT/hidden-audio-first-video.webm"
$F $VID:d=1 -c:v libvpx -b:v 20k -map_metadata -1 -fflags +bitexact -flags +bitexact "$OUT/hidden-video-only.webm"
# Streams Mediabunny does not surface as tracks.
$F $SINE:duration=1 $VID:d=1 -map 0:a -map 1:v -c:a libopus -b:a 8k -ac 1 -c:v libvpx -b:v 20k -shortest -map_metadata -1 -fflags +bitexact -flags +bitexact -f ogg "$OUT/hidden-ogg-opus-vp8.ogg"
$F $SINE:duration=1 -f lavfi -i sine=frequency=660:sample_rate=48000:duration=1 -map 0:a -map 1:a -c:a libopus -b:a 8k -ac 1 -map_metadata -1 -fflags +bitexact -flags +bitexact -f ogg "$OUT/hidden-ogg-two-opus.ogg"
printf '1\n00:00:00,000 --> 00:00:01,000\nhola\n' > "$TMP/caption.srt"
$F $SINE:duration=1 -i "$TMP/caption.srt" -map 0:a -map 1:s -c:a aac -b:a 16k -ac 1 -c:s mov_text -map_metadata -1 -fflags +bitexact -flags +bitexact "$OUT/hidden-mp4-text-track.m4a"
$F $VID:d=1 $SINE:duration=1 -c:v libvpx -b:v 20k -c:a libopus -b:a 8k -ac 1 -shortest -map_metadata -1 -fflags +bitexact -flags +bitexact "$OUT/hidden-audio-video.webm"

# --- unsupported codecs / containers ----------------------------------------
$F $SINE:duration=1 -ac 1 -c:a flac -map_metadata -1 -fflags +bitexact -flags +bitexact "$OUT/unsupported-ogg-flac.ogg"
$F $SINE:duration=1 -ac 1 -c:a alac -map_metadata -1 -fflags +bitexact -flags +bitexact "$OUT/unsupported-alac.m4a"
$F $SINE:duration=1 -ac 1 -ar 8000 -c:a adpcm_ms -map_metadata -1 -fflags +bitexact -flags +bitexact "$OUT/unsupported-adpcm.wav"
$F $SINE:duration=1 -ac 1 -ar 8000 -c:a pcm_mulaw -map_metadata -1 -fflags +bitexact -flags +bitexact "$OUT/unsupported-mulaw.wav"
$F $SINE:duration=1 -ac 1 -c:a aac -b:a 16k -map_metadata -1 -fflags +bitexact -flags +bitexact "$OUT/unsupported-adts.aac"
$F $SINE:duration=1 -ac 1 -ar 8000 -c:a flac -map_metadata -1 -fflags +bitexact -flags +bitexact "$OUT/unsupported-native.flac"
$F $SINE:duration=1 -ac 1 -c:a aac -b:a 16k -map_metadata -1 -fflags +bitexact -flags +bitexact -f mov "$OUT/unsupported-quicktime-aac.mov"
$F $SINE:duration=1 -ac 1 -c:a libopus -b:a 8k -map_metadata -1 -fflags +bitexact -flags +bitexact -f matroska "$OUT/unsupported-matroska-opus.mka"

# --- truncation sources -------------------------------------------------------
$F $SINE:duration=2 -ac 1 -c:a aac -b:a 16k -map_metadata -1 -fflags +bitexact -flags +bitexact -movflags +faststart "$TMP/m4a-faststart.m4a"
$F $SINE:duration=12 -ac 1 -c:a libopus -b:a 8k -map_metadata -1 -fflags +bitexact -flags +bitexact "$TMP/webm-12s.webm"
$F $SINE:duration=12 -ac 1 -c:a libopus -b:a 8k -map_metadata -1 -fflags +bitexact -flags +bitexact -f webm -live 1 "$TMP/webm-12s-live.webm"
head -c 4000 "$TMP/m4a-faststart.m4a" > "$OUT/truncated-m4a-faststart-mdat.m4a"
head -c 4000 "$OUT/audio-m4a-aac-2s-editlist.m4a" > "$OUT/truncated-m4a-moov-at-end.m4a"
head -c 4500 "$OUT/audio-fmp4-aac-2s.m4a" > "$OUT/truncated-fmp4-fragment.m4a"
head -c 8000 "$TMP/webm-12s.webm" > "$OUT/truncated-webm-cluster.webm"
head -c 8000 "$TMP/webm-12s-live.webm" > "$OUT/truncated-webm-live-block.webm"
head -c 20 "$OUT/audio-webm-opus-2s.webm" > "$OUT/truncated-webm-ebml-header.webm"
head -c 700 "$OUT/audio-ogg-opus-1s.ogg" > "$OUT/truncated-ogg-page.ogg"
head -c 9000 "$OUT/audio-wav-pcm16-1s.wav" > "$OUT/truncated-wav-data.wav"
head -c 2500 "$OUT/audio-mp3-1s.mp3" > "$OUT/truncated-mp3-xing.mp3"

# --- byte edits (Node, no dependencies) ---------------------------------------
TMP="$TMP" OUT="$OUT" node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs";
const { TMP, OUT } = process.env;
// Matroska Duration element: ID 0x4489, size 0x88 (8-byte float, big endian).
function patchWebmDuration(src, dst, value) {
  const b = readFileSync(src);
  const at = b.indexOf(Buffer.from([0x44, 0x89, 0x88]));
  if (at < 0 || b.indexOf(Buffer.from([0x44, 0x89, 0x88]), at + 1) >= 0) throw new Error("Duration not unique in " + src);
  b.writeDoubleBE(value, at + 3);
  writeFileSync(dst, b);
}
patchWebmDuration(`${TMP}/webm-61s.webm`, `${OUT}/audio-webm-opus-61s-forged-5s.webm`, 5000);
patchWebmDuration(`${TMP}/webm-61s.webm`, `${OUT}/audio-webm-opus-61s-nan-duration.webm`, Number.NaN);
patchWebmDuration(`${TMP}/webm-2s.webm`, `${OUT}/audio-webm-opus-2s-nan-duration.webm`, Number.NaN);
// Video TrackEntry without PixelWidth/PixelHeight: their 1-byte IDs (0xB0,
// 0xBA) inside the Video element (0xE0) become Void (0xEC), sizes unchanged.
{
  const w = readFileSync(`${OUT}/hidden-audio-first-video.webm`);
  const codec = w.indexOf(Buffer.from("V_VP8", "latin1"));
  const video = w.indexOf(0xe0, codec);
  if (codec < 0 || video < 0 || w[video + 1] < 0x80) throw new Error("Video element not found");
  const end = video + 2 + (w[video + 1] & 0x7f);
  let at = video + 2, voided = 0;
  while (at < end) {
    const id = w[at], size = w[at + 1] & 0x7f;
    if (id === 0xb0 || id === 0xba) { w[at] = 0xec; voided++; }
    at += 2 + size;
  }
  if (voided !== 2) throw new Error("PixelWidth/PixelHeight not both found");
  writeFileSync(`${OUT}/hidden-webm-video-no-pixel-size.webm`, w);
}
// ISOBMFF mvhd/mdhd (version 0): timescale at +12, duration at +16 after the type;
// tkhd (version 0): duration at +20 after the type, in the movie timescale.
const m = readFileSync(`${TMP}/m4a-61s.m4a`);
let movieScale = 0;
for (const type of ["mvhd", "tkhd", "mdhd"]) {
  const at = m.indexOf(Buffer.from(type, "latin1"));
  if (at < 0 || m[at + 4] !== 0) throw new Error(type + " missing or not version 0");
  if (type === "tkhd") { m.writeUInt32BE(5 * movieScale, at + 4 + 20); continue; }
  const scale = m.readUInt32BE(at + 4 + 12);
  if (type === "mvhd") movieScale = scale;
  m.writeUInt32BE(5 * scale, at + 4 + 16);
}
writeFileSync(`${OUT}/audio-m4a-aac-61s-forged-5s.m4a`, m);
'

# --- photos (sharp 0.34.5 from the project) ------------------------------------
OUT="$OUT" node --input-type=module -e '
import { writeFileSync } from "node:fs";
import sharp from "sharp";
const { OUT } = process.env;
const gradient = (w, h) => {
  const px = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 3;
    px[i] = (x * 255) / Math.max(1, w - 1); px[i + 1] = (y * 255) / Math.max(1, h - 1); px[i + 2] = 160;
  }
  return sharp(px, { raw: { width: w, height: h, channels: 3 } });
};
await gradient(64, 32).jpeg({ quality: 90 }).withExif({
  IFD0: { Make: "Synthetic", Model: "Shoebox fixture" },
  IFD3: { GPSLatitudeRef: "N", GPSLatitude: "41/1 23/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "2/1 10/1 0/1" },
}).withMetadata({ orientation: 6 }).toFile(`${OUT}/photo-exif-orientation-gps.jpg`);
await gradient(2048, 1024).jpeg({ quality: 80 }).toFile(`${OUT}/photo-edge-2048.jpg`);
await gradient(2049, 16).jpeg({ quality: 80 }).toFile(`${OUT}/photo-edge-2049.jpg`);
await gradient(2100, 2100).jpeg({ quality: 60 }).toFile(`${OUT}/photo-excessive-pixels.jpg`);
await sharp({ create: { width: 32, height: 32, channels: 4, background: { r: 200, g: 40, b: 90, alpha: 0.4 } } })
  .png().toFile(`${OUT}/photo-transparent.png`);
// Deterministic pseudo-random noise so truncation removes real entropy-coded data.
let seed = 12345;
const noise = Buffer.alloc(128 * 128 * 3, 0).map(() => (seed = (seed * 1103515245 + 12345) >>> 0) >>> 24);
const full = await sharp(noise, { raw: { width: 128, height: 128, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();
writeFileSync(`${OUT}/photo-truncated.jpg`, full.subarray(0, Math.floor(full.length * 0.6)));
// Dimension bomb: a valid 16x16 JPEG whose SOF0 header claims 60000x60000.
const small = await gradient(16, 16).jpeg({ quality: 80 }).toBuffer();
const sof = small.indexOf(Buffer.from([0xff, 0xc0]));
if (sof < 0) throw new Error("SOF0 not found");
small.writeUInt16BE(60000, sof + 5); // height
small.writeUInt16BE(60000, sof + 7); // width
writeFileSync(`${OUT}/photo-dimension-bomb.jpg`, small);
'
ls -l "$OUT"
```
