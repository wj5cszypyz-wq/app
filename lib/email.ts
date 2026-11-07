// Sends email. In production it uses Resend's HTTP API (RESEND_API_KEY, EMAIL_FROM).
// In development and tests nothing leaves the machine: emails are printed to the terminal and kept
// in `outbox` so you can click the links locally.
export type Email = { to: string; subject: string; text: string };

export const outbox: Email[] = [];

export function appUrl(path: string): string {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  return `${base}${path}`;
}

export async function sendEmail(email: Email): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      console.error("[email] RESEND_API_KEY is not set; email not sent:", email.subject);
      return;
    }
    outbox.push(email);
    if (outbox.length > 50) outbox.shift();
    if (process.env.NODE_ENV !== "test") {
      console.log(`\n[email] To: ${email.to}\n[email] Subject: ${email.subject}\n${email.text}\n`);
    }
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [email.to], subject: email.subject, text: email.text }),
    cache: "no-store",
  });
  if (!res.ok) console.error(`[email] send failed (${res.status}) for "${email.subject}"`);
}
