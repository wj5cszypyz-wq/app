import { badRequest } from "@/lib/auth";
import { readJson, type Params } from "@/lib/api-input";
import { respond } from "@/lib/data/errors";
import { setAllowAccountRequests } from "@/lib/data/requests";
import { updateProfile, type ProfilePatch } from "@/lib/data/store-profile";
import { OWNER, storeApi } from "@/lib/scope";

const PROFILE_KEYS = ["name", "niche", "about", "phone", "email", "address", "look", "accent", "fulfillment", "unitKinds", "logoId", "bannerId", "setupDone"] as const;

// Store settings the owner can change: profile, look, and the account-request switch.
export async function PATCH(req: Request, { params }: Params) {
  const ctx = await storeApi((await params).slug, OWNER);
  if (ctx instanceof Response) return ctx;
  const b = await readJson(req);

  const patch: Record<string, unknown> = {};
  for (const k of PROFILE_KEYS) if (b[k] !== undefined) patch[k] = b[k];
  for (const [k, v] of Object.entries(patch)) {
    const ok =
      k === "unitKinds" ? Array.isArray(v) : k === "setupDone" ? typeof v === "boolean" : v === null || typeof v === "string";
    if (!ok) return badRequest("Some settings weren't valid.");
  }
  const toggle = typeof b.allowAccountRequests === "boolean" ? b.allowAccountRequests : undefined;
  if (toggle === undefined && Object.keys(patch).length === 0) return badRequest("Nothing to update.");

  return respond(
    async () => {
      if (toggle !== undefined) await setAllowAccountRequests(ctx, toggle);
      return Object.keys(patch).length ? updateProfile(ctx, patch as ProfilePatch) : { accentAdjusted: false };
    },
    (r) => Response.json({ ok: true, ...r }),
  );
}
