import "server-only";

/** Notion caps one rich-text object at 2,000 characters; stay well below. */
const MAX_CODE_POINTS = 1_000;
const MAX_UTF16_UNITS = 2_000;

export type RichTextChunk = { type: "text"; text: { content: string } };

/**
 * Splits outgoing text into rich-text objects of at most 1,000 Unicode code
 * points and 2,000 UTF-16 units. It walks code points, so a surrogate pair
 * (emoji) is never cut, and joining the chunks returns the original string.
 */
export function splitRichText(text: string): RichTextChunk[] {
  const chunks: RichTextChunk[] = [];
  let current = "";
  let codePoints = 0;
  for (const character of text) {
    if (
      codePoints + 1 > MAX_CODE_POINTS ||
      current.length + character.length > MAX_UTF16_UNITS
    ) {
      chunks.push({ type: "text", text: { content: current } });
      current = "";
      codePoints = 0;
    }
    current += character;
    codePoints += 1;
  }
  if (current.length > 0) {
    chunks.push({ type: "text", text: { content: current } });
  }
  return chunks;
}
