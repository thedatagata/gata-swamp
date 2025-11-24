import { Handlers } from "$fresh/server.ts";
import { setCookie } from "$std/http/cookie.ts";
import { getVariation } from "../../../utils/launchdarkly/server.ts";
import { buildUserContext } from "../../../utils/launchdarkly/context-builder.ts";
import { FLAGS } from "../../../utils/launchdarkly/flags.ts";

export const handler: Handlers = {
  async POST(req) {
    try {
      const { email } = await req.json();

      if (!email) {
        return new Response(JSON.stringify({ error: "Email required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Check LaunchDarkly Allowlist
      const context = buildUserContext(email);
      const isAllowed = await getVariation(context, FLAGS.DEMO_ACCESS_ALLOWLIST, false);

      if (!isAllowed) {
        return new Response(JSON.stringify({ error: "Access denied. Please request access." }), {
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
        value: email, // Simple email for now, could be signed token
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
