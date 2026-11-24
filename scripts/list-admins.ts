import { storage } from "../server/storage";

async function main() {
  const users = await storage.getAllUsers();
  const admins = users.filter((u) => u.role === "admin");

  console.log(`\nFound ${admins.length} admin account(s):\n`);
  for (const u of admins) {
    console.log(`  id:        ${u.id}`);
    console.log(`  email:     ${u.email}`);
    console.log(`  banned:    ${u.banned === 1 ? "YES" : "no"}`);
    console.log(`  createdAt: ${u.createdAt}`);
    console.log("  ---");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
