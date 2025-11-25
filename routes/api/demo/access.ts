import { Handlers } from "$fresh/server.ts";
import { setCookie } from "$std/http/cookie.ts";
import { getVariation } from "../../../utils/launchdarkly/server.ts";
import { buildUserContext } from "../../../utils/launchdarkly/context-builder.ts";
import { FLAGS } from "../../../utils/launchdarkly/flags.ts";
import { verifyDemoAccess } from "../../../utils/models/demo_access.ts";

export const handler: Handlers = {
  async POST(req) {
    try {
      const { email, password } = await req.json();

      if (!email || !password) {
        return new Response(JSON.stringify({ error: "Email and password required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // 1. Verify credentials against Admin-managed list
      const isValid = await verifyDemoAccess(email, password);
      if (!isValid) {
        return new Response(JSON.stringify({ error: "Invalid email or password" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      // 2. Check LaunchDarkly Allowlist (Optional, but keeps the original logic as a second gate if needed)
      // The user said: "launch darkly allow list allows them to view the demo... they shouldn't be allowed to do anything... without the right email"
      // Since we verified the password for the email, we can trust the email is "right".
      // We can keep the LD check to ensure the email is ALSO in the LD segment if desired, 
      // OR we can rely solely on the KV password check.
      // Given the user wants to "manage demo user access", the KV list is the source of truth.
      // I will keep the LD check as a secondary validation if it was important for feature flags.
      
      const context = buildUserContext(email);
      const isAllowed = await getVariation(context, FLAGS.DEMO_ACCESS_ALLOWLIST, false);

      if (!isAllowed) {
         // If LD blocks it, we respect that too? Or does KV override?
         // User said "launch darkly allow list allows them to view the demo".
         // So if LD says no, they can't view it.
         return new Response(JSON.stringify({ error: "Access denied by policy." }), {
           status: 403,
           headers: { "Content-Type": "application/json" },
         });
      }

      // Create response with cookie
      const headers = new Headers();
      headers.set("Content-Type", "application/json");

      // Set demo access cookie (expires in 24 hours)
      setCookie(headers, {
        name: "demo_access_token",
        value: email, 
        maxAge: 60 * 60 * 24,
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers,
      });

    } catch (error) {
      console.error("Demo access error:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};
