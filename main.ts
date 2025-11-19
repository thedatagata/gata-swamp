// main.ts
import { start } from "$fresh/server.ts";
import manifest from "./fresh.gen.ts";
import config from "./fresh.config.ts";

if (Deno.env.get("BUILD_PHASE") !== "true") {
  await import("$std/dotenv/load.ts");
}

await start(manifest, config);
