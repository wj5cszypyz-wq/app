import { readJson, str, type Params } from "@/lib/api-input";
import { listCategories } from "@/lib/data/categories";
import { getProfile } from "@/lib/data/store-profile";
import { hit } from "@/lib/rate-limit";
import { MANAGE, storeApi } from "@/lib/scope";
import { suggestionsAvailable, suggestProduct } from "@/lib/suggest";

// Smart product entry: suggests category, unit and pack details for a product name.
// Rate-limited per store and per person so suggestions can't run up costs.
export async function POST(req: Request, { params }: Params) {
  const ctx = await storeApi((await params).slug, MANAGE);
  if (ctx instanceof Response) return ctx;
  if (!suggestionsAvailable()) return Response.json({ available: false, suggestion: null });
  if (hit(`suggest-store:${ctx.storeId}`, 120, 3_600_000) || hit(`suggest-user:${ctx.userId}`, 40, 600_000)) {
    return Response.json({ available: true, suggestion: null, limited: true });
  }
  const b = await readJson(req);
  const [profile, categories] = await Promise.all([getProfile(ctx), listCategories(ctx)]);
  const suggestion = await suggestProduct(
    { name: str(b, "name"), description: str(b, "description") },
    { niche: profile.niche, categories: categories.map((c) => c.name) },
  );
  return Response.json({ available: true, suggestion });
}
