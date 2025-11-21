// islands/dashboard/smarter_dashboard/dashboard_landing_view/LandingPageDashboard.tsx
import { useState } from "preact/hooks";
import LandingOverview from "./LandingOverview.tsx";
import CacheManagementModal from "../CacheManagementModal.tsx";
import SessionDetailsDashboard from "./SessionDetailsDashboard.tsx";
import UserDetailsDashboard from "./UserDetailsDashboard.tsx";
import AutoVisualizationExperience from "../semantic_dashboard/AutoVisualizationExperience.tsx";
import { metadataStore } from "../../../../utils/services/metadata-store.ts";
import { TableProfiler } from "../../../../utils/services/table-profiler.ts";

type ViewType = "overview" | "sessions" | "users" | "autoviz";

interface LandingPageDashboardProps {
  db: any;
  webllmEngine: any;
}

export default function LandingPageDashboard({ db, webllmEngine }: LandingPageDashboardProps) {
  const [currentView, setCurrentView] = useState<ViewType>("overview");
  const [querySpec, setQuerySpec] = useState<any>(null);
  const [showCacheModal, setShowCacheModal] = useState(false);
  const [cacheError, setCacheError] = useState<string | null>(null);

  async function handleProfileTable(tableName: string) {
    try {
      // Check cache limit first
      const status = await metadataStore.getCacheStatus();
      if (status.isAtLimit) {
        setCacheError(`Cache limit reached (${status.count}/${status.limit} tables)`);
        setShowCacheModal(true);
        return;
      }

      // Profile and save
      const metadata = await TableProfiler.profileTable(db, tableName);
      await metadataStore.saveTableMetadata(tableName, metadata);
      
      console.log('✅ Table profiled and cached');
      
    } catch (err) {
      if (err.message?.includes('CACHE_LIMIT_EXCEEDED')) {
        setCacheError('Cache limit reached. Please delete some tables.');
        setShowCacheModal(true);
      } else {
        console.error('Profiling failed:', err);
      }
    }
  }

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

            <div class="flex items-center space-x-4">
              {/* Cache Management Button */}
              <button
                onClick={() => setShowCacheModal(true)}
                class="px-3 py-1.5 bg-gata-dark/60 text-gata-cream border border-gata-green/30 rounded hover:bg-gata-dark/80 transition-colors text-sm flex items-center gap-2"
              >
                <span>💾</span>
                <span>Cache</span>
              </button>

              <div class="flex items-center space-x-2 text-sm text-gata-green">
                <span class="w-2 h-2 bg-gata-green rounded-full"></span>
                <span>AI Ready</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main class="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Cache Error Banner */}
        {cacheError && (
          <div class="bg-amber-950/30 border border-amber-400/50 rounded-lg p-4 mb-6">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-sm font-semibold text-amber-200 mb-2">⚠️ Cache Limit Reached</p>
                <p class="text-sm text-amber-200/80">{cacheError}</p>
              </div>
              <button
                onClick={() => setCacheError(null)}
                class="text-amber-200/60 hover:text-amber-200"
              >
                ✕
              </button>
            </div>
            <button
              onClick={() => setShowCacheModal(true)}
              class="mt-3 px-4 py-2 bg-amber-600/20 text-amber-200 border border-amber-600/50 rounded hover:bg-amber-600/30 transition-colors text-sm"
            >
              Manage Cache
            </button>
          </div>
        )}

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

      {/* Cache Management Modal */}
      <CacheManagementModal
        isOpen={showCacheModal}
        onClose={() => {
          setShowCacheModal(false);
          setCacheError(null);
        }}
        onCacheCleared={() => {
          setCacheError(null);
          // Optionally refresh your data here
        }}
      />
    </div>
  );
}