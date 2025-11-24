import { Handlers } from "$fresh/server.ts";
import { updateUserContext } from "../../utils/models/context.ts";
import { getSession } from "../../utils/models/session.ts";
import { updateUser } from "../../utils/models/user.ts";

export const handler: Handlers = {
  async POST(req) {
    try {
      const body = await req.json();
      const { sessionId, upgradeType, feature } = body;

      if (!sessionId) {
        return new Response(JSON.stringify({ error: "Missing sessionId" }), { 
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      console.log(`💸 API: Processing mock checkout for ${sessionId} (${upgradeType}, feature: ${feature})`);

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      let updates: Record<string, boolean | "premium">;
      
      if (upgradeType === 'plan') {
        updates = { plan_tier: 'premium' as const };
      } else if (upgradeType === 'feature') {
        // Handle specific feature unlocks
        if (feature === 'ai_analyst_access') {
          updates = { ai_analyst_unlocked: true };
        } else {
          updates = { ai_addon_unlocked: true };
        }
      } else {
        // Default to ai_addon for backward compatibility
        updates = { ai_addon_unlocked: true };
      }

      // 1. Update Legacy Context (for anonymous/legacy flow)
      await updateUserContext(sessionId, updates);

      // 2. Update User Model (if logged in)
      const session = await getSession(sessionId);
      if (session) {
        console.log(`👤 Linking checkout to user: ${session.username}`, updates);
        await updateUser(session.username, updates);
      }

      return new Response(JSON.stringify({ success: true, updates }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Checkout failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return new Response(JSON.stringify({ 
        error: "Internal Server Error",
        message: errorMessage 
      }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  },
};
