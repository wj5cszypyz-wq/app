import { readFile } from "node:fs/promises";
import { getSession, unauthorized } from "@/lib/auth";
import { notFoundResponse } from "@/lib/data/errors";
import { readableUpload } from "@/lib/data/uploads";

// Serves a store image to members of that store only.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return unauthorized();
  const path = await readableUpload(s.userId, (await params).id);
  if (!path) return notFoundResponse();
  const data = await readFile(path).catch(() => null);
  if (!data) return notFoundResponse();
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
