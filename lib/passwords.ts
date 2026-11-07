import bcrypt from "bcryptjs";

export const MIN_PASSWORD = 10;
export const MAX_PASSWORD = 200;

/** Null if the password is acceptable, otherwise what to tell the person. */
export function passwordProblem(pw: unknown): string | null {
  if (typeof pw !== "string" || pw.length < MIN_PASSWORD) return `Use a password of at least ${MIN_PASSWORD} characters.`;
  if (pw.length > MAX_PASSWORD) return `Use a password of at most ${MAX_PASSWORD} characters.`;
  return null;
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);

export function emailProblem(email: string): string | null {
  return email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "Enter a valid email address." : null;
}
