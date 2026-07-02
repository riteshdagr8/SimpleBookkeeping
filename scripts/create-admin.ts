/**
 * CLI: create an admin user. Creates a default tenant if none exists.
 *
 * Usage:
 *   npx tsx scripts/create-admin.ts --email <e> --password <p> --name "<n>"
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 && i + 1 < args.length ? args[i + 1] : null;
  };
  return {
    email: get("--email"),
    password: get("--password"),
    name: get("--name"),
  };
}

async function main() {
  const { email, password, name } = parseArgs();
  if (!email || !password || !name) {
    console.error("Usage: npx tsx scripts/create-admin.ts --email <e> --password <p> --name \"<n>\"");
    process.exit(1);
  }

  const normalizedEmail = email.toLowerCase().trim();

  const tenant =
    (await prisma.tenant.findUnique({ where: { slug: "default" } })) ??
    (await prisma.tenant.create({ data: { name: "Default Firm", slug: "default" } }));

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    console.error(`User ${normalizedEmail} already exists.`);
    process.exit(1);
  }

  const hashed = await hash(password, 12);
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: normalizedEmail,
      name,
      password: hashed,
      role: "Admin",
      theme: "cloud-white",
    },
  });
  console.log(`Admin created: ${user.email} (${user.name})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
