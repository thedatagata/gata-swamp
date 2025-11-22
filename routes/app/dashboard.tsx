// routes/app/dashboard.tsx
import { PageProps, Handlers } from "$fresh/server.ts";
import DashboardRouter from "../../islands/onboarding/DashboardRouter.tsx";

interface DashboardData {
  motherDuckToken: string;
  sessionId: string;
  ldClientId?: string;
}

export const handler: Handlers<DashboardData> = {
  async GET(req, ctx) {
    const motherDuckToken = Deno.env.get("MOTHERDUCK_TOKEN") || "";
    const ldClientId = Deno.env.get("LAUNCHDARKLY_CLIENT_ID");
    const sessionId = ctx.state.sessionId;
    
    return ctx.render({ 
      motherDuckToken,
      sessionId,
      ldClientId
    });
  }
};

export default function DashboardPage({ data }: PageProps<DashboardData>) {
  const { motherDuckToken, sessionId, ldClientId } = data;

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

  return (
    <DashboardRouter 
      motherDuckToken={motherDuckToken}
      sessionId={sessionId}
      ldClientId={ldClientId}
    />
  );
}
