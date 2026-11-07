import { readJson, str } from "@/lib/api-input";
import { signUpSeller } from "@/lib/data/signup";
import { clientIp, hit } from "@/lib/rate-limit";

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
  // Same answer whether or not the email already had an account, and no session here: the emailed
  // confirmation link (or signing in with the password) is what signs the new owner in.
  return Response.json({
    message: "Check your email for a link to open your store. (If you already have an account, we've emailed you how to sign in instead.)",
  });
}
