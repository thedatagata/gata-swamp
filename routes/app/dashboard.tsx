// routes/app/dashboard.tsx
import { PageProps, Handlers } from "$fresh/server.ts";
import DashboardRouter from "../../islands/onboarding/DashboardRouter.tsx";
import { getSession } from "../../utils/models/session.ts";
import { getUser } from "../../utils/models/user.ts";
import { getVariation } from "../../utils/launchdarkly/server.ts";
import { FLAGS } from "../../utils/launchdarkly/flags.ts";
import { buildUserContext } from "../../utils/launchdarkly/context-builder.ts";

interface DashboardData {
  motherDuckToken: string;
  sessionId: string;
  ldClientId?: string;
  isAllowed: boolean;
  email?: string;
  userPlan: "free" | "premium";
  aiAnalystUnlocked: boolean;
  aiAddonUnlocked: boolean;
}

export const handler: Handlers<DashboardData> = {
  async GET(_req, ctx) {
    const sessionId = (ctx.state as any).sessionId as string | undefined;
    
    // 1. Check Authentication
    if (!sessionId) {
      return new Response("", {
        status: 303,
        headers: { Location: "/auth/signin" },
      });
    }

    const session = await getSession(sessionId);
    if (!session) {
       // Invalid session
       return new Response("", {
        status: 303,
        headers: { Location: "/auth/signin" },
      });
    }

    // 2. Get full user record for model tier preference
    const user = await getUser(session.username);
    const preferredModelTier = user?.preferred_model_tier || "3b";

    // 3. Check Allowlist via LaunchDarkly
    // If user has a linked demo email, use that for the allowlist check
    const allowlistKey = user?.demoEmail || session.username;
    const context = buildUserContext(allowlistKey, preferredModelTier);
    const isAllowed = await getVariation(context, FLAGS.DEMO_ACCESS_ALLOWLIST, false);

    const motherDuckToken = Deno.env.get("MOTHERDUCK_TOKEN") || "";
    const ldClientId = Deno.env.get("LAUNCHDARKLY_CLIENT_ID");
    
    // SECURITY: Only pass the token if the user is allowed
    return ctx.render({ 
      motherDuckToken: isAllowed ? motherDuckToken : "", 
      sessionId,
      ldClientId,
      isAllowed,
      email: session.username,
      userPlan: user?.plan_tier || "free",
      aiAnalystUnlocked: user?.ai_analyst_unlocked || false,
      aiAddonUnlocked: user?.ai_addon_unlocked || false
    });
  }
};

export default function DashboardPage({ data }: PageProps<DashboardData>) {
  const { motherDuckToken, sessionId, ldClientId, isAllowed, email, userPlan, aiAnalystUnlocked, aiAddonUnlocked } = data;

  // 1. Access Denied State
  if (!isAllowed) {
    return (
      <div class="min-h-screen bg-gradient-to-br from-[#172217] to-[#186018] flex items-center justify-center p-4">
        <div class="max-w-md w-full bg-[#172217] border border-[#90C137]/30 rounded-2xl p-8 shadow-2xl">
          <div class="text-center">
            <div class="w-16 h-16 bg-[#90C137]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span class="text-3xl">🔒</span>
            </div>
            <h1 class="text-2xl font-bold text-[#F8F6F0] mb-2">Private Demo Access</h1>
            <p class="text-[#F8F6F0]/70 mb-6">
              Thanks for checking out Data Gata! This is currently a private demo environment.
            </p>
            <div class="bg-[#90C137]/5 border border-[#90C137]/20 rounded-lg p-4 mb-6">
              <p class="text-sm text-[#90C137]">
                Logged in as: <span class="font-semibold">{email}</span>
              </p>
              <p class="text-xs text-[#F8F6F0]/50 mt-1">
                Your email is not currently on the allowlist.
              </p>
            </div>
            <a 
              href="/"
              class="block w-full py-3 bg-[#90C137] text-[#172217] font-bold rounded-lg hover:bg-[#a0d147] transition-colors"
            >
              Return Home
            </a>
          </div>
        </div>
      </div>
    );
  }

  // 2. Configuration Missing State (Admin safeguard)
  if (!motherDuckToken) {
    return (
      <div class="min-h-screen bg-gradient-to-br from-[#172217] to-[#186018] p-8">
        <div class="max-w-2xl mx-auto">
          <div class="bg-[#90C137]/10 border-2 border-[#90C137] rounded-lg p-6">
            <h2 class="font-bold text-[#90C137] text-2xl">Configuration Required</h2>
            <p class="text-[#F8F6F0]/90 mt-2">
              Please set the MOTHERDUCK_TOKEN environment variable.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 3. Dashboard State (Allowed)
  return (
    <DashboardRouter 
      motherDuckToken={motherDuckToken}
      sessionId={sessionId}
      ldClientId={ldClientId}
      userPlan={userPlan}
      aiAnalystUnlocked={aiAnalystUnlocked}
      aiAddonUnlocked={aiAddonUnlocked}
    />
  );
}
