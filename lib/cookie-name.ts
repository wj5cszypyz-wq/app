// Edge-safe (used by middleware). In production the "__Host-" prefix makes the browser refuse the
// cookie unless it is Secure, sent only over HTTPS, scoped to this exact host and path "/".
export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-reorderpal_sid" : "reorderpal_sid";
