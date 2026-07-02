import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "default" },
    update: {},
    create: { name: "Default Firm", slug: "default" },
  });

  const users = [
    { email: "admin@firm.ca", name: "Admin User", role: "Admin", password: "admin123" },
    { email: "staff@firm.ca", name: "Staff User", role: "Staff", password: "staff123" },
  ];

  for (const u of users) {
    const password = await hash(u.password, 12);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, password, tenantId: tenant.id, active: true },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        password,
        tenantId: tenant.id,
        theme: "cloud-white",
      },
    });
    console.log(`Seeded ${u.role.toLowerCase()}: ${u.email}`);
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
