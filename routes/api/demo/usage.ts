import { Handlers } from "$fresh/server.ts";
import { getCookies } from "$std/http/cookie.ts";
import { getVariation } from "../../../utils/launchdarkly/server.ts";
import { buildUserContext } from "../../../utils/launchdarkly/context-builder.ts";
import { FLAGS } from "../../../utils/launchdarkly/flags.ts";
import { incrementUsage, getUsage } from "../../../utils/models/usage.ts";
import { getSession } from "../../../utils/models/session.ts";
import { getUser } from "../../../utils/models/user.ts";

async function getDemoEmail(req: Request): Promise<string | null> {
  const cookies = getCookies(req.headers);
  
  // 1. Check direct demo access token
  if (cookies.demo_access_token) {
    return cookies.demo_access_token;
  }
  
  // 2. Check session
  if (cookies.session_id) {
    const session = await getSession(cookies.session_id);
    if (session) {
      const user = await getUser(session.username);
      if (user?.demoEmail) {
        return user.demoEmail;
      }
    }
  }
  
  return null;
}

export const handler: Handlers = {
  async POST(req) {
    try {
      const email = await getDemoEmail(req);

      if (!email) {
        // If no demo email found, we assume it's a regular user or unauthenticated
        // For now, we'll allow regular users without limits (or handle differently)
        // But to be safe, if they aren't authenticated at all, 401.
        const cookies = getCookies(req.headers);
        if (!cookies.session_id && !cookies.demo_access_token) {
           return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        
        // Regular user (no demo email) -> Unlimited
        return new Response(JSON.stringify({ 
          allowed: true, 
          usage: 0, 
          limit: -1 
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Check LaunchDarkly limit
      const context = buildUserContext(email);
      const limit = await getVariation(context, FLAGS.DEMO_QUERY_LIMIT, 50);

      // Get current usage
      const usageData = await getUsage(email);
      
      // Check if limit reached (if limit is not -1 for unlimited)
      if (limit !== -1 && usageData.queryCount >= limit) {
        return new Response(JSON.stringify({ 
          allowed: false, 
          usage: usageData.queryCount, 
          limit,
          error: "Demo query limit reached" 
        }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Increment usage
      const newUsage = await incrementUsage(email);

      return new Response(JSON.stringify({ 
        allowed: true, 
        usage: newUsage.queryCount, 
        limit 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    } catch (error) {
      console.error("Usage tracking error:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
  
  // GET to just check status without incrementing
  async GET(req) {
    try {
      const email = await getDemoEmail(req);

      if (!email) {
         const cookies = getCookies(req.headers);
         if (!cookies.session_id && !cookies.demo_access_token) {
           return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ allowed: true, usage: 0, limit: -1 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const context = buildUserContext(email);
      const limit = await getVariation(context, FLAGS.DEMO_QUERY_LIMIT, 50);
      const usageData = await getUsage(email);

      return new Response(JSON.stringify({ 
        allowed: limit === -1 || usageData.queryCount < limit, 
        usage: usageData.queryCount, 
        limit 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
};
