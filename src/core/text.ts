export function isWellFormedUnicode(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      if (index + 1 >= value.length) return false;
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return false;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

export function hasUnsafeLineControl(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return (
      codePoint <= 0x1f ||
      (codePoint >= 0x7f && codePoint <= 0x9f) ||
      codePoint === 0x2028 ||
      codePoint === 0x2029
    );
  });
}

const UNSAFE_TERMINAL_CHARACTER = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;

export function escapeUnicodeCodePoint(character: string): string {
  const codePoint = character.codePointAt(0);
  if (codePoint === undefined) throw new TypeError("Cannot escape an empty Unicode character.");
  if (codePoint <= 0xffff) return `\\u${codePoint.toString(16).padStart(4, "0")}`;
  const scalar = codePoint - 0x10000;
  const high = 0xd800 + (scalar >> 10);
  const low = 0xdc00 + (scalar & 0x3ff);
  return `\\u${high.toString(16)}\\u${low.toString(16)}`;
}

export function escapeTerminalText(value: string): string {
  return value.replace(UNSAFE_TERMINAL_CHARACTER, (character) =>
    character === "\n" ? character : escapeUnicodeCodePoint(character),
  );
}

export function escapeTerminalField(value: string): string {
  return value.replace(UNSAFE_TERMINAL_CHARACTER, escapeUnicodeCodePoint);
}

export function stringifyTerminalSafeJson(value: unknown, space?: string | number): string {
  const serialized = JSON.stringify(value, null, space);
  if (serialized === undefined) throw new TypeError("Value must be JSON-serializable.");
  return serialized.replace(UNSAFE_TERMINAL_CHARACTER, (character) => {
    // JSON.stringify escapes controls inside strings. Preserve only its structural whitespace.
    if (character === "\t" || character === "\r" || character === "\n") return character;
    return escapeUnicodeCodePoint(character);
  });
}
