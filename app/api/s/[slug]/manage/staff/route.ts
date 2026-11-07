import { readJson, str, type Params } from "@/lib/api-input";
import { respond } from "@/lib/data/errors";
import { inviteStaff } from "@/lib/data/invites";
import { OWNER, storeApi } from "@/lib/scope";

// The owner invites someone to help run the store.
export async function POST(req: Request, { params }: Params) {
  const ctx = await storeApi((await params).slug, OWNER);
  if (ctx instanceof Response) return ctx;
  const email = str(await readJson(req), "email");
  return respond(() => inviteStaff(ctx, email), () => Response.json({ message: `Invite sent to ${email.toLowerCase()}.` }, { status: 201 }));
}
