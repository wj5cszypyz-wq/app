// Saving and serving a store's images. Files sit in UPLOAD_DIR (default ./uploads), never in public/.
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { db } from "../db";
import { resolveMembership, type StoreCtx } from "../scope";
import { MAX_UPLOAD_BYTES, processImage, sniffImageType, UPLOAD_KINDS, type UploadKind } from "../uploads";
import { DataError } from "./errors";
import { asManager } from "./guard";

const uploadDir = () => resolve(process.env.UPLOAD_DIR || "uploads");

export async function saveUpload(ctx: StoreCtx, kind: string, buf: Buffer) {
  const { storeId } = asManager(ctx);
  if (!UPLOAD_KINDS.includes(kind as UploadKind)) throw new DataError("Unknown kind of image.");
  if (buf.length === 0) throw new DataError("Choose a photo to upload.");
  if (buf.length > MAX_UPLOAD_BYTES) throw new DataError("Photos must be 8 MB or smaller.");
  if (!sniffImageType(buf)) throw new DataError("Use a JPEG, PNG or WebP photo.");
  if ((await db.upload.count({ where: { storeId } })) >= 5000) throw new DataError("This store has reached its photo limit.");

  let processed;
  try {
    processed = await processImage(buf, kind as UploadKind);
  } catch {
    throw new DataError("That photo couldn't be read. Try saving it again as a JPEG, PNG or WebP.");
  }
  const row = await db.upload.create({
    data: { storeId, kind, path: "", width: processed.width, height: processed.height, bytes: processed.data.length },
  });
  const dir = join(uploadDir(), storeId);
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${row.id}.webp`);
  await writeFile(path, processed.data);
  await db.upload.update({ where: { id: row.id }, data: { path } });
  return { id: row.id, width: processed.width, height: processed.height };
}

/** The file path if this person may see this image (any member of the image's store); else null. */
export async function readableUpload(userId: string, id: string): Promise<string | null> {
  if (typeof id !== "string" || !/^[a-z0-9]{10,40}$/.test(id)) return null;
  const row = await db.upload.findUnique({ where: { id }, select: { path: true, store: { select: { slug: true } } } });
  if (!row?.path) return null;
  const ctx = await resolveMembership(userId, row.store.slug);
  if (!ctx) return null;
  const path = resolve(row.path);
  return path.startsWith(uploadDir()) ? path : null;
}

/** Throws unless every id is a product photo of this store. */
export async function assertOwnProductPhotos(storeId: string, ids: string[]) {
  if (ids.length === 0) return;
  const n = await db.upload.count({ where: { storeId, kind: "product", id: { in: ids } } });
  if (n !== new Set(ids).size) throw new DataError("One of the photos wasn't found. Upload it again.");
}
