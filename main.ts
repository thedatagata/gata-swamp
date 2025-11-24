// main.ts
import { start } from "$fresh/server.ts";
import manifest from "./fresh.gen.ts";
import config from "./fresh.config.ts";

if (Deno.env.get("BUILD_PHASE") !== "true") {
  await import("$std/dotenv/load.ts");
  
  // Seed admin user on startup
  try {
    const { default: seedAdmin } = await import("./utils/scripts/seed_admin.ts");
    await seedAdmin();
  } catch (e) {
    console.error("Failed to seed admin:", e);
  }
}

await start(manifest, config);
