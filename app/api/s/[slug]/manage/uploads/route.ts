import { badRequest } from "@/lib/auth";
import type { Params } from "@/lib/api-input";
import { respond } from "@/lib/data/errors";
import { saveUpload } from "@/lib/data/uploads";
import { MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { MANAGE, storeApi } from "@/lib/scope";

const MAX_BODY = MAX_UPLOAD_BYTES + 64 * 1024; // the photo plus the form's own small fields

const tooBig = () => Response.json({ error: "Photos must be 8 MB or smaller." }, { status: 413 });

/** Reads the request body but stops as soon as it passes `max` bytes, whatever Content-Length says. */
async function readCapped(req: Request, max: number): Promise<Uint8Array<ArrayBuffer> | null> {
  if (!req.body) return new Uint8Array(new ArrayBuffer(0));
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(new ArrayBuffer(total));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

// Upload one image (form fields: file, kind = logo | banner | product).
export async function POST(req: Request, { params }: Params) {
  const ctx = await storeApi((await params).slug, MANAGE);
  if (ctx instanceof Response) return ctx;
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return tooBig();
  const body = await readCapped(req, MAX_BODY);
  if (!body) return tooBig();
  const form = await new Request(req.url, { method: "POST", headers: req.headers, body })
    .formData()
    .catch(() => null);
  const file = form?.get("file");
  const kind = form?.get("kind");
  if (!(file instanceof File) || typeof kind !== "string") return badRequest("Choose a photo to upload.");
  if (file.size > MAX_UPLOAD_BYTES) return tooBig();
  const buf = Buffer.from(await file.arrayBuffer());
  return respond(() => saveUpload(ctx, kind, buf), (r) => Response.json(r, { status: 201 }));
}
