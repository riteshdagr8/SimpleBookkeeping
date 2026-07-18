import { prisma } from "@/lib/prisma";

/**
 * Delete all obligations for a specific client.
 * Usage: npm run delete-obligations -- --clientId <id>
 */

const args = process.argv.slice(2);
const clientIdIndex = args.indexOf("--clientId");

if (clientIdIndex === -1 || !args[clientIdIndex + 1]) {
  console.error(
    "Usage: npx tsx scripts/delete-client-obligations.ts --clientId <id>"
  );
  console.error("  or with npm: npm run delete-obligations -- --clientId <id>");
  process.exit(1);
}

const clientId = args[clientIdIndex + 1];

async function main() {
  // First, find the client to confirm it exists
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, fileNumber: true, legalName: true },
  });

  if (!client) {
    console.error(`Client with ID "${clientId}" not found.`);
    process.exit(1);
  }

  console.log(
    `Found client: ${client.fileNumber} - ${client.legalName}`
  );

  // Count obligations before deletion
  const count = await prisma.filingObligation.count({
    where: { clientId },
  });

  if (count === 0) {
    console.log("No obligations to delete.");
    process.exit(0);
  }

  console.log(`\nDeleting ${count} obligation(s)...`);

  // Delete all obligations (cascade will handle related workflow tables)
  const result = await prisma.filingObligation.deleteMany({
    where: { clientId },
  });

  console.log(`✓ Deleted ${result.count} obligation(s).`);
}

main()
  .catch((e) => {
    console.error("Error:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
