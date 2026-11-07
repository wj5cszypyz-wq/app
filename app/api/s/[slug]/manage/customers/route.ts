import { badRequest } from "@/lib/auth";
import { readJson, str, type Params } from "@/lib/api-input";
import { createCustomerWithLogin } from "@/lib/data/customers";
import { respond } from "@/lib/data/errors";
import { MANAGE, storeApi } from "@/lib/scope";

// Adds a customer account plus a login for its contact.
export async function POST(req: Request, { params }: Params) {
  const ctx = await storeApi((await params).slug, MANAGE);
  if (ctx instanceof Response) return ctx;
  const b = await readJson(req);

  const name = str(b, "name");
  const contactName = str(b, "contactName");
  const email = str(b, "email").toLowerCase();
  const phone = str(b, "phone");
  const address = str(b, "address");
  const password = typeof b.password === "string" ? b.password : "";

  if (!name) return badRequest("Add the customer's name.");
  if (!contactName) return badRequest("Add a contact name.");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest("Add a valid login email.");
  if (password.length < 8 || password.length > 200) return badRequest("Temporary password must be 8 to 200 characters.");
  if (name.length > 120 || contactName.length > 120 || phone.length > 40 || address.length > 300) {
    return badRequest("One of the fields is too long.");
  }

  return respond(
    () => createCustomerWithLogin(ctx, { name, contactName, email, phone, address, password }),
    (r) => Response.json(r, { status: 201 }),
  );
}
