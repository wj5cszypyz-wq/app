import { cookies } from "next/headers";
import { readJson, str } from "@/lib/api-input";
import { freshSignup, signUpSeller } from "@/lib/data/signup";
import { clientIp, hit } from "@/lib/rate-limit";
import { cookieOptions, createSession, SESSION_COOKIE } from "@/lib/session";

export async function POST(req: Request) {
  const wait = hit(`signup:${clientIp(req)}`, 5, 60 * 60_000);
  if (wait) return Response.json({ error: "Too many sign-ups from here. Try again later." }, { status: 429 });

  const b = await readJson(req);
  const email = str(b, "email").toLowerCase();
  const result = await signUpSeller({
    name: str(b, "name"),
    email,
    password: typeof b.password === "string" ? b.password : "",
    storeName: str(b, "storeName"),
    slug: str(b, "slug"),
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });

  // Sign the new owner straight in so they can set up while the confirmation email is on its way.
  // (If the email already had an account, nothing was created and we only show the same message.)
  const fresh = await freshSignup(email);
  if (fresh) {
    const jar = await cookies();
    jar.set(SESSION_COOKIE, await createSession(fresh.userId), cookieOptions());
    return Response.json({ redirect: `/s/${fresh.slug}/manage/setup` });
  }
  return Response.json({ message: "Check your email to continue. If you already have an account, we've sent you a sign-in link instead." });
}
