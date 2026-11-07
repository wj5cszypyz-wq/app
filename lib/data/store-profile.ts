// The store's profile and look: name, what it sells, contact details, look, accent, logo, banner.
import { readableAccent } from "../color";
import { db } from "../db";
import type { StoreCtx } from "../scope";
import { isUnitKind } from "../units";
import { DataError } from "./errors";
import { asManager } from "./guard";

export const LOOKS = ["fresh", "clean", "craft", "classic"] as const;
export type Look = (typeof LOOKS)[number];
export const FULFILLMENT = ["delivery", "pickup", "both"] as const;

export type ProfilePatch = {
  name?: string;
  niche?: string | null;
  about?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  look?: string;
  accent?: string | null;
  fulfillment?: string;
  unitKinds?: string[];
  logoId?: string | null;
  bannerId?: string | null;
  setupDone?: boolean;
};

export async function getProfile(ctx: StoreCtx) {
  return db.store.findUniqueOrThrow({
    where: { id: ctx.storeId },
    select: {
      name: true, slug: true, niche: true, about: true, phone: true, email: true, address: true, look: true, accent: true,
      logoId: true, bannerId: true, fulfillment: true, unitKinds: true, setupDoneAt: true, status: true, allowAccountRequests: true,
      qboRealmId: true,
    },
  });
}

const clean = (v: string | null | undefined, max: number) => {
  const t = (v ?? "").trim();
  if (t.length > max) throw new DataError(`One of the fields is too long (up to ${max} characters).`);
  return t || null;
};

export async function updateProfile(ctx: StoreCtx, patch: ProfilePatch): Promise<{ accentAdjusted: boolean }> {
  const { storeId } = asManager(ctx);
  if (ctx.role !== "owner") throw new DataError("Only the store owner can change the store's details and look.");
  const data: Record<string, unknown> = {};
  let accentAdjusted = false;

  if (patch.name !== undefined) {
    const n = clean(patch.name, 120);
    if (!n) throw new DataError("Add the store's name.");
    data.name = n;
  }
  if (patch.niche !== undefined) data.niche = clean(patch.niche, 200);
  if (patch.about !== undefined) data.about = clean(patch.about, 1000);
  if (patch.phone !== undefined) data.phone = clean(patch.phone, 40);
  if (patch.email !== undefined) data.email = clean(patch.email, 254);
  if (patch.address !== undefined) data.address = clean(patch.address, 300);
  if (patch.look !== undefined) {
    if (!(LOOKS as readonly string[]).includes(patch.look)) throw new DataError("Pick one of the looks.");
    data.look = patch.look;
  }
  if (patch.accent !== undefined) {
    if (patch.accent === null || patch.accent === "") data.accent = null;
    else {
      const r = readableAccent(patch.accent);
      if (!r) throw new DataError("Pick a color.");
      data.accent = r.hex;
      accentAdjusted = r.adjusted;
    }
  }
  if (patch.fulfillment !== undefined) {
    if (!(FULFILLMENT as readonly string[]).includes(patch.fulfillment)) throw new DataError("Choose delivery or pickup (or both).");
    data.fulfillment = patch.fulfillment;
  }
  if (patch.unitKinds !== undefined) {
    if (!Array.isArray(patch.unitKinds) || patch.unitKinds.length > 6 || !patch.unitKinds.every(isUnitKind)) {
      throw new DataError("Pick from the listed kinds of items.");
    }
    data.unitKinds = JSON.stringify([...new Set(patch.unitKinds)]);
  }
  for (const key of ["logoId", "bannerId"] as const) {
    const v = patch[key];
    if (v === undefined) continue;
    if (v === null) data[key] = null;
    else {
      const kind = key === "logoId" ? "logo" : "banner";
      const up = await db.upload.findFirst({ where: { id: v, storeId, kind }, select: { id: true } });
      if (!up) throw new DataError("That image wasn't found. Upload it again.");
      data[key] = v;
    }
  }
  if (patch.setupDone) data.setupDoneAt = new Date();
  if (Object.keys(data).length === 0) throw new DataError("Nothing to update.");
  await db.store.update({ where: { id: storeId }, data });
  return { accentAdjusted };
}
