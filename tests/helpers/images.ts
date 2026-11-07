// Tiny test images.
export const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

export function imageForm(buf: Buffer, kind = "product", name = "photo.png", type = "image/png"): FormData {
  const fd = new FormData();
  fd.set("kind", kind);
  fd.set("file", new File([new Uint8Array(buf)], name, { type }));
  return fd;
}
