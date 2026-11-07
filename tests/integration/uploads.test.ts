import { existsSync, readFileSync } from "node:fs";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { callRoute } from "../helpers/request";
import { db } from "../../lib/db";
import { makeStore, type StoreFixture } from "../helpers/fixtures";
import { imageForm, PNG_1X1 } from "../helpers/images";

let a: StoreFixture;
let b: StoreFixture;

beforeAll(async () => {
  a = await makeStore("up-a");
  b = await makeStore("up-b");
});

async function upload(token: string | undefined, slug: string, form: FormData) {
  const { POST } = await import("../../app/api/s/[slug]/manage/uploads/route");
  return callRoute(POST, { method: "POST", url: `/api/s/${slug}/manage/uploads`, token, params: { slug }, form });
}

async function fetchFile(token: string | undefined, id: string) {
  const { GET } = await import("../../app/api/files/[id]/route");
  return callRoute(GET, { method: "GET", url: `/api/files/${id}`, token, params: { id } });
}

describe("uploads", () => {
  it("a real photo is re-encoded to WebP, with hidden data stripped", async () => {
    const withExif = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: "#c33" } })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Artist: "secret-person" } } })
      .toBuffer();
    const res = await upload(a.tokens.owner, "up-a", imageForm(withExif, "product", "p.jpg", "image/jpeg"));
    expect(res.status).toBe(201);
    const { id } = await res.json();
    const row = await db.upload.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ storeId: a.store.id, kind: "product", width: 1600, height: 800 });
    const saved = readFileSync(row.path);
    expect(saved.subarray(8, 12).toString()).toBe("WEBP");
    expect(saved.includes(Buffer.from("secret-person"))).toBe(false);
  });

  it("disguised file: HTML or SVG named .jpg is refused", async () => {
    const html = Buffer.from("<html><script>alert(1)</script></html>");
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    for (const buf of [html, svg]) {
      const res = await upload(a.tokens.owner, "up-a", imageForm(buf, "product", "cat.jpg", "image/jpeg"));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/JPEG, PNG or WebP/);
    }
  });

  it("files over 8 MB are refused", async () => {
    const big = Buffer.concat([PNG_1X1, Buffer.alloc(8 * 1024 * 1024)]);
    const res = await upload(a.tokens.owner, "up-a", imageForm(big));
    expect(res.status).toBe(413);
    expect((await res.json()).error).toMatch(/8 MB/);
  });

  it("logo is kept small and square-ish; unknown kinds refused", async () => {
    const logo = await sharp({ create: { width: 1000, height: 1000, channels: 3, background: "#123" } }).png().toBuffer();
    const res = await upload(a.tokens.owner, "up-a", imageForm(logo, "logo"));
    const row = await db.upload.findUniqueOrThrow({ where: { id: (await res.json()).id } });
    expect(row.width).toBeLessThanOrEqual(512);
    expect((await upload(a.tokens.owner, "up-a", imageForm(PNG_1X1, "avatar"))).status).toBe(400);
  });

  it("photo of another store → 404; own members (any role) can see it; signed out → 401", async () => {
    const res = await upload(a.tokens.owner, "up-a", imageForm(PNG_1X1));
    const { id } = await res.json();
    expect((await fetchFile(b.tokens.owner, id)).status).toBe(404);
    expect((await fetchFile(b.tokens.buyerA, id)).status).toBe(404);
    expect((await fetchFile(undefined, id)).status).toBe(401);
    const mine = await fetchFile(a.tokens.buyerA, id);
    expect(mine.status).toBe(200);
    expect(mine.headers.get("content-type")).toBe("image/webp");
    expect(mine.headers.get("cache-control")).toContain("private");
    expect((await fetchFile(a.tokens.owner, "../../etc/passwd")).status).toBe(404);
  });

  it("products can't use another store's photos", async () => {
    const res = await upload(b.tokens.owner, "up-b", imageForm(PNG_1X1));
    const { id } = await res.json();
    const { updateProduct } = await import("../../lib/data/products");
    const ctx = { userId: a.owner.id, storeId: a.store.id, slug: "up-a", storeName: "A", role: "owner" as const, customerId: null };
    await expect(updateProduct(ctx, a.product.id, { imageIds: [id] })).rejects.toThrow(/photo/i);
    expect(existsSync((await db.upload.findUniqueOrThrow({ where: { id } })).path)).toBe(true);
  });
});
