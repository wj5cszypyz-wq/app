import { badRequest } from "@/lib/auth";
import { readJson, str, type Params } from "@/lib/api-input";
import { ensureCategory, listCategories } from "@/lib/data/categories";
import { MANAGE, storeApi } from "@/lib/scope";

export async function GET(_req: Request, { params }: Params) {
  const ctx = await storeApi((await params).slug, MANAGE);
  if (ctx instanceof Response) return ctx;
  return Response.json({ categories: await listCategories(ctx) });
}

// Adds a category (or changes an existing one's emoji).
export async function POST(req: Request, { params }: Params) {
  const ctx = await storeApi((await params).slug, MANAGE);
  if (ctx instanceof Response) return ctx;
  const b = await readJson(req);
  const name = str(b, "name");
  const emoji = str(b, "emoji");
  if (!name || name.length > 60) return badRequest("Add a category name (up to 60 characters).");
  if ([...emoji].length > 8) return badRequest("Use one emoji for the category.");
  await ensureCategory(ctx, name, emoji || null);
  return Response.json({ categories: await listCategories(ctx) }, { status: 201 });
}
