// Time-based one-time codes (RFC 6238, SHA-1, 6 digits, 30-second steps): what authenticator apps
// like Google Authenticator, 1Password and Authy produce.
import { createHmac, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP = 30;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function codeForStep(secret: Buffer, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", secret).update(counter).digest();
  const offset = h[h.length - 1] & 0xf;
  const bin = ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3];
  return String(bin % 1_000_000).padStart(6, "0");
}

/** The 6-digit code for a moment in time (seconds since 1970). */
export function totpAt(secret: Buffer, unixSeconds: number): string {
  return codeForStep(secret, Math.floor(unixSeconds / STEP));
}

/**
 * Checks a code, allowing one step of clock drift either way.
 * Returns the matching time step (so callers can refuse reusing it) or null.
 */
export function verifyTotp(secretB32: string, code: string, unixSeconds = Date.now() / 1000, window = 1): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(secretB32);
  const now = Math.floor(unixSeconds / STEP);
  for (let d = -window; d <= window; d++) {
    const step = now + d;
    if (timingSafeEqual(Buffer.from(codeForStep(secret, step)), Buffer.from(code))) return step;
  }
  return null;
}
