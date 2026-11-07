// Image checks and processing. We look at the file's actual bytes (never its name or the
// browser's claimed type), then re-encode it with sharp, which strips hidden data (EXIF, GPS...)
// and turns anything odd into a plain, safe WebP picture.
import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export type UploadKind = "logo" | "banner" | "product";
export const UPLOAD_KINDS: UploadKind[] = ["logo", "banner", "product"];

export function sniffImageType(buf: Buffer): "jpeg" | "png" | "webp" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length >= 12 && buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  return null;
}

export async function processImage(buf: Buffer, kind: UploadKind) {
  let img = sharp(buf, { limitInputPixels: 50_000_000, failOn: "error" }).rotate();
  if (kind === "logo") img = img.resize(512, 512, { fit: "inside", withoutEnlargement: true });
  else if (kind === "banner") img = img.resize(2000, 600, { fit: "cover", withoutEnlargement: true });
  else img = img.resize(1600, 1600, { fit: "inside", withoutEnlargement: true });
  const { data, info } = await img.webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}
