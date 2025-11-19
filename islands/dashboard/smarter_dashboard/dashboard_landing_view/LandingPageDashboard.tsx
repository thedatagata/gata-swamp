// islands/dashboard/smarter_dashboard/dashboard_landing_view/LandingPageDashboard.tsx
import { useState } from "preact/hooks";
import LandingOverview from "./LandingOverview.tsx";
import SessionDetailsDashboard from "./SessionDetailsDashboard.tsx";
import UserDetailsDashboard from "./UserDetailsDashboard.tsx";
import AutoVisualizationExperience from "../semantic_dashboard/AutoVisualizationExperience.tsx";

type ViewType = "overview" | "sessions" | "users" | "autoviz";

interface LandingPageDashboardProps {
  db: any;
  webllmEngine: any;
}

export default function LandingPageDashboard({ db, webllmEngine }: LandingPageDashboardProps) {
  const [currentView, setCurrentView] = useState<ViewType>("overview");
  const [querySpec, setQuerySpec] = useState<any>(null);

  const handleExecuteQuery = (spec: any) => {
    setQuerySpec(spec);
    setCurrentView("autoviz");
  };

  return (
    <div class="min-h-screen bg-gradient-to-br from-gata-dark to-[#186018]">
      <nav class="fixed w-full z-50 bg-gata-dark/95 backdrop-blur-sm shadow-lg">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between items-center py-4">
            <div
              onClick={() => setCurrentView("overview")}
              class="cursor-pointer"
            >
              <h1 class="text-xl font-bold text-gata-cream">
                DATA_<span class="text-gata-green">GATA</span> Analytics
              </h1>
            </div>

            <div class="flex items-center space-x-2 text-sm text-gata-green">
              <span class="w-2 h-2 bg-gata-green rounded-full"></span>
              <span>AI Ready</span>
            </div>
          </div>
        </div>
      </nav>

      <main class="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === "overview" && (
          <LandingOverview
            db={db}
            webllmEngine={webllmEngine}
            onSelectTable={(table) => setCurrentView(table)}
          />
        )}

        {currentView === "sessions" && (
          <SessionDetailsDashboard
            db={db}
            webllmEngine={webllmEngine}
            onBack={() => setCurrentView("overview")}
            onExecuteQuery={handleExecuteQuery}
          />
        )}

        {currentView === "users" && (
          <UserDetailsDashboard
            db={db}
            webllmEngine={webllmEngine}
            onBack={() => setCurrentView("overview")}
            onExecuteQuery={handleExecuteQuery}
          />
        )}

        {currentView === "autoviz" && querySpec && (
          <div>
            <button
              onClick={() => setCurrentView(querySpec.table === "sessions" ? "sessions" : "users")}
              class="text-gata-green hover:text-[#a0d147] font-medium mb-4 flex items-center"
            >
              ← Back to Dashboard
            </button>
            <AutoVisualizationExperience
              db={db}
              querySpec={querySpec}
            />
          </div>
        )}
      </main>
    </div>
  );
}