import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, totpAt, verifyTotp } from "../lib/totp";

const RFC_SECRET = Buffer.from("12345678901234567890"); // RFC 6238 SHA-1 test key

describe("TOTP (RFC 6238)", () => {
  it("matches the RFC test vectors (last 6 digits)", () => {
    expect(totpAt(RFC_SECRET, 59)).toBe("287082");
    expect(totpAt(RFC_SECRET, 1111111109)).toBe("081804");
    expect(totpAt(RFC_SECRET, 1234567890)).toBe("005924");
    expect(totpAt(RFC_SECRET, 2000000000)).toBe("279037");
  });

  it("base32 round-trips", () => {
    expect(base32Encode(RFC_SECRET)).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(base32Decode("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ").equals(RFC_SECRET)).toBe(true);
  });

  it("accepts the current code and one step either side, nothing else", () => {
    const b32 = base32Encode(RFC_SECRET);
    const now = 1111111109;
    expect(verifyTotp(b32, totpAt(RFC_SECRET, now), now)).toBe(Math.floor(now / 30));
    expect(verifyTotp(b32, totpAt(RFC_SECRET, now - 30), now)).toBe(Math.floor(now / 30) - 1);
    expect(verifyTotp(b32, totpAt(RFC_SECRET, now - 90), now)).toBeNull();
    expect(verifyTotp(b32, "12345", now)).toBeNull();
    expect(verifyTotp(b32, "abcdef", now)).toBeNull();
  });
});
