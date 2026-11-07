// Gives an existing account access to the platform admin page (/admin).
// Usage: npm run make-admin -- someone@example.com
import { PrismaClient } from "@prisma/client";

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run make-admin -- someone@example.com");
  process.exit(1);
}
const db = new PrismaClient();
db.user
  .update({ where: { email }, data: { isPlatformAdmin: true } })
  .then(() => console.log(`${email} can now open /admin.`))
  .catch(() => {
    console.error(`No account with the email ${email}. Sign up first.`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
