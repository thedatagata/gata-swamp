// islands/onboarding/DashboardRouter.tsx
import { useState } from "preact/hooks";
import PlanSelection from "../../islands/onboarding/PlanSelection.tsx";
import BaseDashboard from "../dashboard/starter_dashboard/BaseDashboardWizard.tsx";
import SmartDashLoadingPage from "../dashboard/smarter_dashboard/SmartDashLoadingPage.tsx";
import LandingPageDashboard from "../dashboard/smarter_dashboard/dashboard_landing_view/LandingPageDashboard.tsx";

interface DashboardRouterProps {
  motherDuckToken: string;
  sessionId: string;
}

export default function DashboardRouter({ motherDuckToken, sessionId }: DashboardRouterProps) {
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'smarter' | null>(null);
  const [smartDashInitialized, setSmartDashInitialized] = useState(false);
  const [db, setDb] = useState<any>(null);
  const [webllmEngine, setWebllmEngine] = useState<any>(null);

  // Handle initialization complete callback
  const handleSmartDashReady = (dbConnection: any, engine: any) => {
    setDb(dbConnection);
    setWebllmEngine(engine);
    setSmartDashInitialized(true);
  };

  // Handle upgrade from Starter to Smarter
  const handleUpgrade = () => {
    console.log('🚀 User upgrading to Smarter Dashboard');
    setSelectedPlan('smarter');
    setSmartDashInitialized(false); // Reset to trigger loading page
  };

  if (!selectedPlan) {
    return <PlanSelection onSelectPlan={setSelectedPlan} />;
  }

  if (selectedPlan === 'starter') {
    return (
      <div class="min-h-screen bg-gradient-to-br from-[#172217] to-[#186018]">
        <nav class="fixed w-full z-50 bg-[#172217]/95 backdrop-blur-sm shadow-lg">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center py-4">
              <a href="/app/dashboard" class="flex items-center space-x-2">
                <div class="w-10 h-10 rounded-full overflow-hidden border-2 border-[#90C137]">
                  <img
                    src="/gata_app_utils/nerdy_alligator_headshot.png"
                    alt="DATA_GATA Logo"
                    class="w-full h-full object-cover"
                  />
                </div>
                <span class="text-xl font-bold text-[#F8F6F0]">
                  DATA_<span class="text-[#90C137]">GATA</span>
                </span>
              </a>
              
              <div class="flex items-center space-x-4">
                <button 
                  onClick={() => setSelectedPlan(null)}
                  class="text-[#F8F6F0]/90 hover:text-[#90C137] transition-colors text-sm font-medium"
                >
                  ← Change Plan
                </button>
              </div>
            </div>
          </div>
        </nav>

        <main class="pt-20">
          <BaseDashboard 
            motherDuckToken={motherDuckToken}
            sessionId={sessionId}
            onUpgrade={handleUpgrade}
          />
        </main>
      </div>
    );
  }

  // Smarter plan - show loading then dashboard
  if (!smartDashInitialized) {
    return (
      <SmartDashLoadingPage 
        onComplete={handleSmartDashReady}
        motherDuckToken={motherDuckToken}
      />
    );
  }

  return (
    <div class="min-h-screen bg-gradient-to-br from-gata-dark to-gata-darker">
      <main class="pt-0">
        <LandingPageDashboard
          db={db}
          webllmEngine={webllmEngine}
        />
      </main>
    </div>
  );
}