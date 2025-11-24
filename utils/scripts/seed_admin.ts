import { createUser, getUser } from "../models/user.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

export default async function seedAdmin() {
  const adminEmail = Deno.env.get("ADMIN_EMAIL");
  // Use SESSION_SECRET as the initial password for simplicity in this script, 
  // or a specific ADMIN_PASSWORD if you prefer. 
  // For now, I'll use a default if not provided to avoid crashing, but you should set it.
  const adminPassword = Deno.env.get("SESSION_SECRET") || "admin-password-change-me";

  if (!adminEmail) {
    console.error("❌ ADMIN_EMAIL not set in environment");
    return; // Don't exit, just return
  }

  console.log(`Checking for admin user: ${adminEmail}...`);
  
  const existing = await getUser(adminEmail);
  if (existing) {
    console.log("✅ Admin user already exists.");
    return;
  }

  console.log("Creating admin user...");
  const salt = await bcrypt.genSalt(8);
  const hash = await bcrypt.hash(adminPassword, salt);

  await createUser(
    adminEmail,
    hash,
    "premium", // Give admin premium access
    true,      // Unlock AI
    true       // Unlock Analyst
  );

  console.log(`✅ Admin user created!`);
  console.log(`Username: ${adminEmail}`);
  console.log(`Password: (Your SESSION_SECRET)`);
}

if (import.meta.main) {
  await seedAdmin();
}
