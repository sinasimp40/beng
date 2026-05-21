import { storage } from "../server/storage";

async function main() {
  const email = process.argv[2];
  const action = (process.argv[3] || "demote").toLowerCase();

  if (!email) {
    console.error("Usage: tsx scripts/remove-admin.ts <email> [demote|delete]");
    console.error("  demote  - changes role from 'admin' to 'user' (default)");
    console.error("  delete  - deletes the user account entirely");
    process.exit(1);
  }

  const user = await storage.getUserByEmail(email);
  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  console.log(`Found user: ${user.email} (id=${user.id}, role=${user.role})`);

  if (action === "delete") {
    await storage.deleteUser(user.id);
    console.log(`DELETED user ${email}`);
  } else {
    await storage.updateUser(user.id, { role: "user" } as any);
    console.log(`Demoted ${email} from admin -> user`);
  }
  console.log("Note: restart the server to invalidate any active sessions for this user.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
