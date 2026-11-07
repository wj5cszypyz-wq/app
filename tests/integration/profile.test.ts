import { beforeAll, describe, expect, it } from "vitest";
import "../helpers/request";
import { db } from "../../lib/db";
import type { StoreCtx } from "../../lib/scope";
import { makeStore, type StoreFixture } from "../helpers/fixtures";

let a: StoreFixture;
let ownerA: StoreCtx;
let staffA: StoreCtx;

beforeAll(async () => {
  a = await makeStore("prof-a");
  const base = { storeId: a.store.id, slug: a.store.slug, storeName: a.store.name, customerId: null };
  ownerA = { ...base, userId: a.owner.id, role: "owner" };
  staffA = { ...base, userId: a.staff.id, role: "staff" };
});

describe("store profile", () => {
  it("owner can set look, accent, wording and what they sell", async () => {
    const { updateProfile } = await import("../../lib/data/store-profile");
    const r = await updateProfile(ownerA, { look: "craft", accent: "#ffff00", fulfillment: "pickup", unitKinds: ["count", "packed"], about: "Hand-made lamps", name: "Prof A Lamps" });
    expect(r.accentAdjusted).toBe(true);
    const s = await db.store.findUniqueOrThrow({ where: { id: a.store.id } });
    expect(s).toMatchObject({ look: "craft", fulfillment: "pickup", about: "Hand-made lamps", name: "Prof A Lamps", unitKinds: '["count","packed"]' });
    expect(s.accent).not.toBe("#ffff00");
  });

  it("invalid look, wording or units are refused", async () => {
    const { updateProfile } = await import("../../lib/data/store-profile");
    await expect(updateProfile(ownerA, { look: "neon" })).rejects.toThrow("Pick one of the looks.");
    await expect(updateProfile(ownerA, { fulfillment: "teleport" })).rejects.toThrow(/delivery or pickup/);
    await expect(updateProfile(ownerA, { unitKinds: ["potions"] })).rejects.toThrow(/kinds/);
    await expect(updateProfile(ownerA, { name: "" })).rejects.toThrow(/name/);
  });

  it("staff can't change the store profile", async () => {
    const { updateProfile } = await import("../../lib/data/store-profile");
    await expect(updateProfile(staffA, { look: "clean" })).rejects.toThrow(/owner/);
  });
});
