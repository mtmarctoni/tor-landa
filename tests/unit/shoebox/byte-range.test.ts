import { describe, expect, it } from "vitest";
import { parseByteRange } from "@/features/shoebox/server/byte-range";

describe("parseByteRange", () => {
  it("returns null when there is no Range header", () => {
    expect(parseByteRange(null, 10)).toBeNull();
  });

  it("parses closed, open-ended and suffix ranges", () => {
    expect(parseByteRange("bytes=2-4", 10)).toEqual({ start: 2, end: 4 });
    expect(parseByteRange("bytes=4-", 10)).toEqual({ start: 4, end: 9 });
    expect(parseByteRange("bytes=-3", 10)).toEqual({ start: 7, end: 9 });
    expect(parseByteRange("bytes=0-0", 10)).toEqual({ start: 0, end: 0 });
    expect(parseByteRange("bytes=9-9", 10)).toEqual({ start: 9, end: 9 });
  });

  it("clamps an end past the last byte and a suffix longer than the body", () => {
    expect(parseByteRange("bytes=2-40", 10)).toEqual({ start: 2, end: 9 });
    expect(parseByteRange("bytes=-30", 10)).toEqual({ start: 0, end: 9 });
  });

  it("accepts the unit case-insensitively", () => {
    expect(parseByteRange("Bytes=2-4", 10)).toEqual({ start: 2, end: 4 });
  });

  it.each([
    ["start at the size", "bytes=10-"],
    ["start past the size", "bytes=11-12"],
    ["reversed", "bytes=5-4"],
    ["overflowing start", "bytes=99999999999999999999-"],
    ["overflowing end", "bytes=0-99999999999999999999"],
    ["overflowing suffix", "bytes=-99999999999999999999"],
    ["empty suffix", "bytes=-0"],
    ["no numbers", "bytes=-"],
    ["multiple ranges", "bytes=0-1,4-5"],
    ["multiple ranges with spaces", "bytes=0-1, 4-5"],
    ["another unit", "items=0-1"],
    ["missing unit", "0-1"],
    ["negative start", "bytes=-1-2"],
    ["non-digits", "bytes=a-b"],
    ["fractional", "bytes=1.5-2"],
    ["plus sign", "bytes=+1-2"],
    ["empty", ""],
    ["unit only", "bytes="],
  ])("rejects %s", (_label, header) => {
    expect(() => parseByteRange(header, 10)).toThrow();
    try {
      parseByteRange(header, 10);
    } catch (error) {
      expect(error).toMatchObject({ status: 416 });
    }
  });

  it("rejects every range of an empty body", () => {
    expect(() => parseByteRange("bytes=0-", 0)).toThrow();
    expect(() => parseByteRange("bytes=-1", 0)).toThrow();
  });
});
