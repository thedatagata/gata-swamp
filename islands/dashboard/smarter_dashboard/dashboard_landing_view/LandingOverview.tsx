// islands/dashboard/smarter_dashboard/dashboard_landing_view/LandingOverview.tsx
import { useEffect, useState } from "preact/hooks";
import KPICard from "../../../../components/charts/KPICard.tsx";
import { getSemanticMetadata } from "../../../../utils/smarter/dashboard_utils/semantic-config.ts";
import { getSessionsKPIs, getUsersKPIs } from "../../../../utils/smarter/overview_dashboards/kpi-queries.ts";
import { getLDClient, subscribeToFlagChanges, unsubscribeFromFlagChanges } from "../../../../utils/launchdarkly/client.ts";
import { trackView, trackInteraction, trackPerformance } from "../../../../utils/launchdarkly/events.ts";
import UpgradeModal from "../../../../components/UpgradeModal.tsx";
import CacheManagementModal from "../CacheManagementModal.tsx";
import SessionDetailsDashboard from "./SessionDetailsDashboard.tsx";
import UserDetailsDashboard from "./UserDetailsDashboard.tsx";
import AutoVisualizationExperience from "../semantic_dashboard/AutoVisualizationExperience.tsx";

// --- Helper Functions ---

function getSessionId(): string {
  if (typeof sessionStorage === "undefined") return "server-session";
  let id = sessionStorage.getItem("sessionId");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("sessionId", id);
  }
  return id;
}

function uint8ArrayToNumber(arr: Uint8Array): number {
  const view = new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
  return Number(view.getBigUint64(0, true));
}

function sanitizeQueryData(data: any[]): any[] {
  return data.map(row => {
    const newRow: any = {};
    for (const key in row) {
      const value = row[key];
      if (typeof value === 'bigint') newRow[key] = Number(value);
      else if (value instanceof Uint8Array) newRow[key] = uint8ArrayToNumber(value);
      else if (value instanceof Date) newRow[key] = value.toISOString().split('T')[0];
      else if (typeof value === 'number' && value > 1000000000000) newRow[key] = new Date(value).toISOString().split('T')[0];
      else newRow[key] = value;
    }
    return newRow;
  });
}

// --- Types ---

type ViewType = "overview" | "sessions" | "users" | "autoviz";

interface LandingOverviewProps {
  db: any;
  webllmEngine: any;
  aiAnalystUnlocked: boolean;
  // onSelectTable is no longer needed as a prop for the container, but kept for compatibility if needed
  onSelectTable?: (table: "sessions" | "users") => void; 
}

interface OverviewContentProps {
  db: any;
  webllmEngine: any;
  onSelectTable: (table: "sessions" | "users") => void;
  aiAnalystUnlocked: boolean;
}

// --- Inner Component: OverviewContent (Original LandingOverview Logic) ---

function OverviewContent({ db, webllmEngine, onSelectTable, aiAnalystUnlocked }: OverviewContentProps) {
  const [loading, setLoading] = useState(true);
  const [sessionsKPI, setSessionsKPI] = useState<any>({});
  const [usersKPI, setUsersKPI] = useState<any>({});
  const [aiInsights, setAiInsights] = useState<string>("");
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAIAnalyst, setHasAIAnalyst] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    // Check AI analyst access flag OR user unlocked status
    const client = getLDClient();
    let aiAccess = aiAnalystUnlocked;
    
    if (client) {
      // If unlocked via add-on, it's true. Otherwise check LD flag.
      const flagAccess = client.variation("smarter-ai-analyst-access", false);
      aiAccess = aiAccess || flagAccess;
      
      // Track view of analyst feature gate if not accessible
      if (!aiAccess) {
        trackView("gate", "feature_gate", "LandingOverview", {
          plan: "smarter",
          feature: "ai_analyst_assistant",
          gateType: "premium_feature"
        });
      }
    }
    
    setHasAIAnalyst(aiAccess);
  }, [aiAnalystUnlocked]);

  useEffect(() => {
    async function loadOverview() {
      setLoading(true);
      setError(null);
      
      try {
        // Get KPIs directly (bypass semantic layer for window functions)
        const sessionsKPIRaw = await getSessionsKPIs(db);
        const sessionsKPIData = sanitizeQueryData([sessionsKPIRaw])[0];
        setSessionsKPI({ sessions_kpi: { data: [sessionsKPIData] } });
        
        const usersKPIRaw = await getUsersKPIs(db);
        const usersKPIData = sanitizeQueryData([usersKPIRaw])[0];
        setUsersKPI({ users_kpi: { data: [usersKPIData] } });

        // Generate AI insights only if user has access and webllmEngine is available
        if (webllmEngine && hasAIAnalyst) {
          generateInsights(sessionsKPIData, usersKPIData);
        }
      } catch (err) {
        console.error("Overview load error:", err);
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    if (db) loadOverview();
  }, [db, hasAIAnalyst]);

  const generateInsights = async (sessionsData: any, usersData: any) => {
    if (!webllmEngine || !hasAIAnalyst) return;
    
    setInsightsLoading(true);
    const startTime = performance.now();
    
    trackInteraction("click", "ai_analyst_button", "analysis", "LandingOverview", {
      plan: "smarter",
      analysisType: "session_overview"
    });
    
    try {
      // Extract KPI values from direct query results
      const revCurrent = sessionsData.revenue_last_30d || 0;
      const revGrowth = sessionsData.revenue_growth_rate || 0;
      
      const sessCurrent = sessionsData.sessions_last_30d || 0;
      const sessGrowth = sessionsData.sessions_growth_rate || 0;
      
      const convCurrent = sessionsData.conversion_rate_last_30d || 0;
      const convChange = sessionsData.conversion_rate_change || 0;
      
      const ltv = usersData.total_ltv || 0;
      const customers = usersData.paying_customers || 0;

      const prompt = `You are a data analyst reviewing key performance metrics. Analyze these trends and provide 2-3 specific, actionable recommendations for areas to investigate.

SESSIONS METRICS (Last 30d vs Previous 30d):
- Revenue: $${revCurrent.toFixed(0)} (${revGrowth > 0 ? '+' : ''}${revGrowth.toFixed(1)}% vs previous)
- Sessions: ${sessCurrent.toFixed(0)} (${sessGrowth > 0 ? '+' : ''}${sessGrowth.toFixed(1)}% vs previous)  
- Conversion Rate: ${convCurrent.toFixed(1)}% (${convChange > 0 ? '+' : ''}${convChange.toFixed(1)}pp vs previous)

USERS METRICS:
- Total LTV: $${ltv.toFixed(0)}
- Paying Customers: ${customers}

Format your response as:
1. Brief summary of what's happening (2-3 sentences)
2. Specific recommendations to investigate (2-3 bullets pointing to Sessions or Users analysis)

Keep it concise and actionable.`;

      const insights = await webllmEngine.chat(prompt);
      setAiInsights(insights);
      
      // Track successful analysis
      trackPerformance("metric", "ai_analysis", "LandingOverview", {
        plan: "smarter",
        metric: "analysis_time",
        value: performance.now() - startTime,
        success: true
      });
    } catch (error) {
      console.error("Failed to generate insights:", error);
      setAiInsights("Unable to generate insights at this time.");
      
      // Track error
      trackPerformance("error", "ai_analysis", "LandingOverview", {
        plan: "smarter",
        errorType: (error as Error).name,
        errorMessage: (error as Error).message,
        success: false
      });
    } finally {
      setInsightsLoading(false);
    }
  };
  
  const handleAnalystClick = () => {
    if (!hasAIAnalyst) {
      // Track gate interaction
      trackInteraction("click", "ai_analyst_button", "feature_gate", "LandingOverview", {
        plan: "smarter",
        featureRequested: "ai_analyst_access"
      });
      
      setShowUpgradeModal(true);
      return;
    }
    
    // If they have access, manually trigger insights generation
    const sessData = sessionsKPI.sessions_kpi?.data?.[0];
    const usersData = usersKPI.users_kpi?.data?.[0];
    if (sessData && usersData) {
      generateInsights(sessData, usersData);
    }
  };

  const handleUpgradeSuccess = () => {
    // Update the hasAIAnalyst state to unlock the feature
    setHasAIAnalyst(true);
    
    // Trigger AI analysis immediately with existing data
    const sessData = sessionsKPI.sessions_kpi?.data?.[0];
    const usersData = usersKPI.users_kpi?.data?.[0];
    if (sessData && usersData && webllmEngine) {
      console.log("🎉 AI Analyst unlocked! Generating insights...");
      generateInsights(sessData, usersData);
    }
  };

  const getKPIValue = (kpiData: any, measure: string) => {
    const kpi = kpiData.sessions_kpi || kpiData.users_kpi;
    if (!kpi?.data?.[0]) return 0;
    const value = kpi.data[0][measure];
    if (typeof value === 'bigint') return Number(value);
    if (value instanceof Uint8Array) return uint8ArrayToNumber(value);
    return value || 0;
  };

  const revenueCurrent = getKPIValue(sessionsKPI, 'revenue_last_30d');
  const revenuePrevious = getKPIValue(sessionsKPI, 'revenue_previous_30d');
  const revenueGrowth = getKPIValue(sessionsKPI, 'revenue_growth_rate');
  
  const newVsReturningCurrent = getKPIValue(sessionsKPI, 'new_vs_returning_30d');
  const newVsReturningPrevious = getKPIValue(sessionsKPI, 'new_vs_returning_previous_30d');
  const newVsReturningRate = getKPIValue(sessionsKPI, 'new_vs_returning_rate');
  
  const paidVsOrganicCurrent = getKPIValue(sessionsKPI, 'paid_vs_organic_30d');
  const paidVsOrganicPrevious = getKPIValue(sessionsKPI, 'paid_vs_organic_previous_30d');
  const paidVsOrganicRate = getKPIValue(sessionsKPI, 'paid_vs_organic_traffic_rate');
  
  const trialUsersCurrent = getKPIValue(usersKPI, 'trial_users_last_30d');
  const trialUsersPrevious = getKPIValue(usersKPI, 'trial_users_previous_30d');
  const trialUsersGrowth = getKPIValue(usersKPI, 'trial_users_growth_rate');
  
  const onboardingUsersCurrent = getKPIValue(usersKPI, 'onboarding_users_last_30d');
  const onboardingUsersPrevious = getKPIValue(usersKPI, 'onboarding_users_previous_30d');
  const onboardingUsersGrowth = getKPIValue(usersKPI, 'onboarding_users_growth_rate');
  
  const customerUsersCurrent = getKPIValue(usersKPI, 'customer_users_last_30d');
  const customerUsersPrevious = getKPIValue(usersKPI, 'customer_users_previous_30d');
  const customerUsersGrowth = getKPIValue(usersKPI, 'customer_users_growth_rate');

  const sessionsConfig = getSemanticMetadata("sessions");
  const usersConfig = getSemanticMetadata("users");

  if (error) {
    return (
      <div class="bg-red-900/30 border border-red-500/50 rounded-lg p-4 backdrop-blur-sm">
        <h3 class="font-semibold text-red-400 mb-2">Error</h3>
        <p class="text-red-300 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div class="space-y-8">
      {/* AI Insights Section */}
      <div class="bg-gata-dark/60 backdrop-blur-sm rounded-lg border border-gata-green/30 p-6 shadow-lg">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-xl font-bold text-gata-cream flex items-center">
            <span class="mr-2">🤖</span> AI Insights & Recommendations
          </h2>
          {hasAIAnalyst ? (
            <button
              type="button"
              onClick={handleAnalystClick}
              disabled={insightsLoading || !webllmEngine}
              class="px-4 py-2 bg-gata-green/20 text-gata-green rounded-lg hover:bg-gata-green/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {insightsLoading ? "Analyzing..." : "🤖 Refresh Analysis"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAnalystClick}
              class="px-4 py-2 bg-gata-dark border-2 border-gata-green/50 text-gata-cream rounded-lg hover:bg-gata-green/10 transition-colors font-medium flex items-center gap-2"
            >
              <span class="text-lg">🔒</span>
              <span>AI Data Analyst (Premium)</span>
            </button>
          )}
        </div>
        {!hasAIAnalyst ? (
          <div class="bg-gata-dark/40 border border-gata-green/20 rounded-lg p-6 text-center">
            <div class="text-4xl mb-3">🧠</div>
            <h3 class="text-lg font-semibold text-gata-cream mb-2">
              Unlock AI-Powered Data Analysis
            </h3>
            <p class="text-gata-cream/70 text-sm mb-4">
              Get automated insights, pattern detection, and actionable recommendations
            </p>
            <button
              type="button"
              onClick={handleAnalystClick}
              class="px-6 py-2 bg-gradient-to-r from-gata-green to-[#a0d147] text-gata-dark font-bold rounded-lg hover:opacity-90 transition-opacity"
            >
              Upgrade to Premium
            </button>
          </div>
        ) : insightsLoading ? (
          <div class="flex items-center gap-3 text-gata-green">
            <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-gata-green"></div>
            <span class="text-sm">Analyzing your metrics...</span>
          </div>
        ) : aiInsights ? (
          <div class="prose prose-sm max-w-none text-gata-cream/90 whitespace-pre-line">
            {aiInsights}
          </div>
        ) : (
          <p class="text-gata-cream/70 text-sm">AI insights will appear here after data loads...</p>
        )}
      </div>
      
      {showUpgradeModal && (
        <UpgradeModal 
          feature="ai_analyst_access"
          trigger="analysis_request"
          upgradeType="feature"
          sessionId={getSessionId()}
          onClose={() => setShowUpgradeModal(false)}
          onSuccess={handleUpgradeSuccess}
        />
      )}

      <div class="bg-gata-dark/80 backdrop-blur-sm rounded-lg shadow-lg border border-gata-green/20 overflow-hidden">
        <div class="bg-gradient-to-r from-gata-green/20 to-gata-green/10 px-6 py-4 border-b border-gata-green/30">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-2xl font-bold text-gata-cream flex items-center">
                <span class="mr-2">📊</span> Sessions Analytics
              </h2>
              <p class="text-gata-cream/70 text-sm mt-1">{sessionsConfig.description}</p>
            </div>
            <button
              type="button"
              onClick={() => onSelectTable("sessions")}
              class="bg-gata-green text-gata-dark px-6 py-3 rounded-lg font-semibold hover:bg-[#a0d147] transition-all shadow-md hover:shadow-lg"
            >
              Explore Sessions →
            </button>
          </div>
        </div>
        <div class="p-6">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <KPICard 
              title="New vs Returning" 
              value={newVsReturningCurrent} 
              previousValue={newVsReturningPrevious} 
              changePercent={newVsReturningRate}
              format="percentage" 
              decimals={1}
              description="Returning visitor rate: Last 30d vs previous 30d" 
              loading={loading} 
            />
            <KPICard 
              title="Paid vs Organic" 
              value={paidVsOrganicCurrent} 
              previousValue={paidVsOrganicPrevious}
              changePercent={paidVsOrganicRate}
              format="percentage" 
              decimals={1}
              description="Paid traffic rate: Last 30d vs previous 30d" 
              loading={loading} 
            />
            <KPICard 
              title="Revenue" 
              value={revenueCurrent} 
              previousValue={revenuePrevious} 
              changePercent={revenueGrowth} 
              format="currency" 
              decimals={0} 
              description="Total revenue: Last 30d vs previous 30d" 
              loading={loading} 
            />
          </div>
        </div>
      </div>

      <div class="bg-gata-dark/80 backdrop-blur-sm rounded-lg shadow-lg border border-gata-green/20 overflow-hidden">
        <div class="bg-gradient-to-r from-gata-green/20 to-gata-green/10 px-6 py-4 border-b border-gata-green/30">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-2xl font-bold text-gata-cream flex items-center">
                <span class="mr-2">👥</span> User Analytics
              </h2>
              <p class="text-gata-cream/70 text-sm mt-1">{usersConfig.description}</p>
            </div>
            <button
              type="button"
              onClick={() => onSelectTable("users")}
              class="bg-gata-green text-gata-dark px-6 py-3 rounded-lg font-semibold hover:bg-[#a0d147] transition-all shadow-md hover:shadow-lg"
            >
              Explore Users →
            </button>
          </div>
        </div>
        <div class="p-6">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <KPICard 
              title="Trial Users" 
              value={trialUsersCurrent} 
              previousValue={trialUsersPrevious} 
              changePercent={trialUsersGrowth}
              format="number" 
              decimals={0}
              description="Users in trial stage: Last 30d vs previous 30d" 
              loading={loading} 
            />
            <KPICard 
              title="Onboarding Users" 
              value={onboardingUsersCurrent} 
              previousValue={onboardingUsersPrevious}
              changePercent={onboardingUsersGrowth}
              format="number" 
              decimals={0}
              description="Users in activation stage: Last 30d vs previous 30d" 
              loading={loading} 
            />
            <KPICard 
              title="Active Customers" 
              value={customerUsersCurrent} 
              previousValue={customerUsersPrevious}
              changePercent={customerUsersGrowth}
              format="number" 
              decimals={0}
              description="Users in retention stage: Last 30d vs previous 30d" 
              loading={loading} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Main Container Component (Formerly LandingPageDashboard) ---

export default function LandingOverview({ db, webllmEngine, aiAnalystUnlocked }: LandingOverviewProps) {
  const [currentView, setCurrentView] = useState<ViewType>("overview");
  const [querySpec, setQuerySpec] = useState<any>(null);
  const [showCacheModal, setShowCacheModal] = useState(false);
  const [cacheError, setCacheError] = useState<string | null>(null);
  const [cacheFeatureEnabled, setCacheFeatureEnabled] = useState(false);

  // Flag 3: Cache Management Feature Flag
  useEffect(() => {
    const ldClient = getLDClient();
    if (ldClient) {
      const enabled = ldClient.variation("cache-management-enabled", false);
      setCacheFeatureEnabled(enabled);
      
      // Listen for kill switch activation
      const flagHandler = (newValue: boolean) => {
        setCacheFeatureEnabled(newValue);
        if (!newValue && showCacheModal) {
          setShowCacheModal(false);
          setCacheError("Cache management temporarily unavailable");
        }
      };
      
      subscribeToFlagChanges("cache-management-enabled", flagHandler);
      return () => unsubscribeFromFlagChanges("cache-management-enabled", flagHandler);
    }
  }, [showCacheModal]);

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
              {/* Cache Management Button - Flag 3 */}
              {cacheFeatureEnabled && (
                <button
                  type="button"
                  onClick={() => {
                    trackInteraction("click", "cache_button", "cache_management", "LandingPageDashboard", {
                      plan: "smarter"
                    });
                    setShowCacheModal(true);
                  }}
                  class="px-3 py-1.5 bg-gata-dark/60 text-gata-cream border border-gata-green/30 rounded hover:bg-gata-dark/80 transition-colors text-sm flex items-center gap-2"
                >
                  <span>💾</span>
                  <span>Cache</span>
                </button>
              )}

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
                type="button"
                onClick={() => setCacheError(null)}
                class="text-amber-200/60 hover:text-amber-200"
              >
                ✕
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowCacheModal(true)}
              class="mt-3 px-4 py-2 bg-amber-600/20 text-amber-200 border border-amber-600/50 rounded hover:bg-amber-600/30 transition-colors text-sm"
            >
              Manage Cache
            </button>
          </div>
        )}

        {currentView === "overview" && (
          <OverviewContent
            db={db}
            webllmEngine={webllmEngine}
            onSelectTable={(table) => setCurrentView(table)}
            aiAnalystUnlocked={aiAnalystUnlocked}
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
              type="button"
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