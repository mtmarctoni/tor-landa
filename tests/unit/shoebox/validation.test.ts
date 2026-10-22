import { afterEach, describe, expect, it } from "vitest";
import {
  MAX_CAPTION_CHARACTERS,
  MAX_TEXT_CHARACTERS,
} from "@/features/shoebox/limits";
import {
  validateCorrection,
  validateFields,
} from "@/features/shoebox/validation";
import { textFields } from "../../helpers/shoebox-fixtures";

describe("validateFields", () => {
  it("accepts a valid text memory and returns exactly its fields", () => {
    expect(validateFields(textFields())).toEqual({
      kind: "text",
      text: "x",
      caption: "",
      memoryDate: "2026-10-21",
    });
  });

  it("rejects dates that are not real calendar days", () => {
    for (const memoryDate of [
      "2026-02-30",
      "2026-13-01",
      "2026-00-10",
      "2026-04-31",
      "2100-02-29",
      "2026-1-01",
      "2026-10-21T00:00:00Z",
      "",
    ]) {
      expect(() => validateFields(textFields({ memoryDate }))).toThrow();
    }
    expect(
      validateFields(textFields({ memoryDate: "2024-02-29" })),
    ).toMatchObject({ memoryDate: "2024-02-29" });
    expect(
      validateFields(textFields({ memoryDate: "2000-02-29" })),
    ).toMatchObject({ memoryDate: "2000-02-29" });
  });

  describe("date-only handling across timezones", () => {
    const original = process.env.TZ;
    afterEach(() => {
      if (original === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = original;
      }
    });

    it("returns the same date string in any timezone", () => {
      for (const tz of [
        "Pacific/Kiritimati",
        "Pacific/Pago_Pago",
        "America/Los_Angeles",
        "Europe/Madrid",
      ]) {
        process.env.TZ = tz;
        for (const memoryDate of ["2026-03-29", "2026-10-25", "2026-01-01"]) {
          expect(validateFields(textFields({ memoryDate })).memoryDate).toBe(
            memoryDate,
          );
        }
      }
    });
  });

  it("enforces note length of 1 to 2,000 characters", () => {
    expect(() =>
      validateFields(textFields({ text: "x".repeat(MAX_TEXT_CHARACTERS) })),
    ).not.toThrow();
    expect(() =>
      validateFields(textFields({ text: "x".repeat(MAX_TEXT_CHARACTERS + 1) })),
    ).toThrow();
    expect(() => validateFields(textFields({ text: "" }))).toThrow();
    expect(() => validateFields(textFields({ text: undefined }))).toThrow();
  });

  it("counts Unicode code points, not UTF-16 code units", () => {
    expect(() =>
      validateFields(textFields({ text: "😀".repeat(MAX_TEXT_CHARACTERS) })),
    ).not.toThrow();
    expect(() =>
      validateFields(
        textFields({ text: "😀".repeat(MAX_TEXT_CHARACTERS + 1) }),
      ),
    ).toThrow();
    expect(() =>
      validateFields(
        textFields({ caption: "😀".repeat(MAX_CAPTION_CHARACTERS) }),
      ),
    ).not.toThrow();
  });

  it("enforces caption length of 0 to 500 characters", () => {
    expect(() =>
      validateFields(textFields({ caption: "c".repeat(500) })),
    ).not.toThrow();
    expect(() =>
      validateFields(textFields({ caption: "c".repeat(501) })),
    ).toThrow();
    expect(() => validateFields(textFields({ caption: undefined }))).toThrow();
  });

  it("is strict about keys, kinds and types", () => {
    expect(() => validateFields(textFields({ extra: 1 }))).toThrow();
    expect(() => validateFields(textFields({ requestId: "x" }))).toThrow();
    expect(() => validateFields(textFields({ kind: "video" }))).toThrow();
    expect(() => validateFields(textFields({ kind: undefined }))).toThrow();
    expect(() => validateFields(textFields({ caption: 5 }))).toThrow();
    for (const bad of [null, undefined, "x", 5, [], [textFields()]]) {
      expect(() => validateFields(bad)).toThrow();
    }
  });

  it("allows media kinds without text and rejects text on them", () => {
    expect(
      validateFields({ kind: "photo", caption: "a", memoryDate: "2026-10-21" }),
    ).toEqual({ kind: "photo", caption: "a", memoryDate: "2026-10-21" });
    expect(() =>
      validateFields({
        kind: "audio",
        text: "hidden",
        caption: "",
        memoryDate: "2026-10-21",
      }),
    ).toThrow();
  });
});

describe("whitespace-only text", () => {
  const blanks = [" ", "   ", "\n", " \t\n ", "\u00a0\u2003"];

  it("is invalid on create with the same error as an empty note", () => {
    for (const text of blanks) {
      expect(() => validateFields(textFields({ text }))).toThrow(
        expect.objectContaining({ type: "semantic" }),
      );
    }
    expect(validateFields(textFields({ text: "  hola\n" })).text).toBe(
      "  hola\n",
    );
  });

  it("is invalid on correction with the same rule", () => {
    for (const text of blanks) {
      expect(() =>
        validateCorrection(
          { text, caption: "", memoryDate: "2026-10-21" },
          "text",
        ),
      ).toThrow(expect.objectContaining({ type: "semantic" }));
    }
  });
});

describe("validateCorrection", () => {
  it("requires text for text memories only", () => {
    expect(
      validateCorrection(
        { text: "new", caption: "", memoryDate: "2026-10-21" },
        "text",
      ),
    ).toEqual({ text: "new", caption: "", memoryDate: "2026-10-21" });
    expect(() =>
      validateCorrection({ caption: "", memoryDate: "2026-10-21" }, "text"),
    ).toThrow();
    expect(
      validateCorrection({ caption: "c", memoryDate: "2026-10-21" }, "photo"),
    ).toEqual({ caption: "c", memoryDate: "2026-10-21" });
    expect(() =>
      validateCorrection(
        { text: "no", caption: "c", memoryDate: "2026-10-21" },
        "audio",
      ),
    ).toThrow();
  });

  it("cannot set kind, media or request id and applies the same limits", () => {
    for (const extra of ["kind", "media", "requestId", "mediaPath"]) {
      expect(() =>
        validateCorrection(
          { caption: "", memoryDate: "2026-10-21", [extra]: "x" },
          "photo",
        ),
      ).toThrow();
    }
    expect(() =>
      validateCorrection({ caption: "", memoryDate: "2026-02-30" }, "photo"),
    ).toThrow();
    expect(() =>
      validateCorrection(
        { caption: "c".repeat(501), memoryDate: "2026-10-21" },
        "photo",
      ),
    ).toThrow();
    expect(() =>
      validateCorrection(
        { text: "x".repeat(2001), caption: "", memoryDate: "2026-10-21" },
        "text",
      ),
    ).toThrow();
  });
});
