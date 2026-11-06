import bcrypt from "bcryptjs";
import { apiSession, badRequest, unauthorized } from "@/lib/auth";
import { db } from "@/lib/db";

// Adds a restaurant account plus a login for its staff.
export async function POST(req: Request) {
  const s = await apiSession("supplier");
  if (!s) return unauthorized();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (k: string) => (typeof b[k] === "string" ? (b[k] as string).trim() : "");

  const name = str("name");
  const contactName = str("contactName");
  const email = str("email").toLowerCase();
  const phone = str("phone");
  const address = str("address");
  const password = typeof b.password === "string" ? b.password : "";

  if (!name) return badRequest("Add the restaurant's name.");
  if (!contactName) return badRequest("Add a contact name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest("Add a valid login email.");
  if (password.length < 8 || password.length > 200) return badRequest("Temporary password must be 8 to 200 characters.");
  if (name.length > 120 || contactName.length > 120 || phone.length > 40 || address.length > 300) {
    return badRequest("One of the fields is too long.");
  }
  if (await db.user.findUnique({ where: { email } })) return badRequest("That email already has a login.");

  const restaurant = await db.restaurant.create({
    data: {
      supplierId: s.supplierId,
      name,
      contactName,
      email,
      phone: phone || null,
      address: address || null,
      users: {
        create: {
          email,
          name: contactName,
          role: "buyer",
          supplierId: s.supplierId,
          passwordHash: await bcrypt.hash(password, 10),
        },
      },
    },
  });
  return Response.json({ id: restaurant.id }, { status: 201 });
}
