// islands/dashboard/smarter_dashboard/dashboard_landing_view/LandingOverview.tsx
// islands/dashboard/smarter_dashboard/dashboard_landing_view/LandingOverview.tsx
import { useEffect, useState } from "preact/hooks";
import KPICard from "../../../../components/charts/KPICard.tsx";
import { getModelConfig } from "../../../../utils/smarter/semantic-config.ts";
import { getSessionsKPIs, getUsersKPIs } from "../../../../utils/smarter/kpi-queries.ts";

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

interface LandingOverviewProps {
  db: any;
  webllmEngine: any;
  onSelectTable: (table: "sessions" | "users") => void;
}

export default function LandingOverview({ db, webllmEngine, onSelectTable }: LandingOverviewProps) {
  const [loading, setLoading] = useState(true);
  const [sessionsKPI, setSessionsKPI] = useState<any>({});
  const [usersKPI, setUsersKPI] = useState<any>({});
  const [aiInsights, setAiInsights] = useState<string>("");
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOverview() {
      setLoading(true);
      setError(null);
      
      try {
        // Get KPIs directly (bypass semantic layer for window functions)
        const sessionsKPIData = await getSessionsKPIs(db);
        setSessionsKPI({ sessions_kpi: { data: [sessionsKPIData] } });
        
        const usersKPIData = await getUsersKPIs(db);
        setUsersKPI({ users_kpi: { data: [usersKPIData] } });

        // Generate AI insights if webllmEngine is available
        if (webllmEngine) {
          generateInsights(sessionsKPIData, usersKPIData);
        }
      } catch (err) {
        console.error("Overview load error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (db) loadOverview();
  }, [db]);

  const generateInsights = async (sessionsData: any, usersData: any) => {
    if (!webllmEngine) return;
    
    setInsightsLoading(true);
    try {
      // Extract KPI values from direct query results
      const revCurrent = sessionsData.revenue_last_30d || 0;
      const revPrevious = sessionsData.revenue_previous_30d || 0;
      const revGrowth = sessionsData.revenue_growth_rate || 0;
      
      const sessCurrent = sessionsData.sessions_last_30d || 0;
      const sessPrevious = sessionsData.sessions_previous_30d || 0;
      const sessGrowth = sessionsData.sessions_growth_rate || 0;
      
      const convCurrent = sessionsData.conversion_rate_last_30d || 0;
      const convPrevious = sessionsData.conversion_rate_previous_30d || 0;
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
    } catch (error) {
      console.error("Failed to generate insights:", error);
      setAiInsights("Unable to generate insights at this time.");
    } finally {
      setInsightsLoading(false);
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
  
  const newSessionsCurrent = getKPIValue(sessionsKPI, 'new_sessions_last_30d');
  const newSessionsPrevious = getKPIValue(sessionsKPI, 'new_sessions_previous_30d');
  
  const activationsCurrent = getKPIValue(sessionsKPI, 'activation_last_30d');
  const activationsPrevious = getKPIValue(sessionsKPI, 'activation_previous_30d');
  const activationsGrowth = getKPIValue(sessionsKPI, 'activation_growth_rate');
  
  const activationRateCurrent = getKPIValue(usersKPI, 'activation_rate_last_30d');
  const activationRatePrevious = getKPIValue(usersKPI, 'activation_rate_previous_30d');
  
  const avgDealSizeCurrent = getKPIValue(usersKPI, 'avg_deal_size_last_30d');
  const avgDealSizePrevious = getKPIValue(usersKPI, 'avg_deal_size_previous_30d');
  
  const activeCustomersCurrent = getKPIValue(usersKPI, 'active_customers_last_30d');
  const activeCustomersPrevious = getKPIValue(usersKPI, 'active_customers_previous_30d');

  const sessionsConfig = getModelConfig("sessions");
  const usersConfig = getModelConfig("users");

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
        <h2 class="text-xl font-bold text-gata-cream mb-3 flex items-center">
          <span class="mr-2">🤖</span> AI Insights & Recommendations
        </h2>
        {insightsLoading ? (
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
              title="New Sessions (30d)" 
              value={newSessionsCurrent} 
              previousValue={newSessionsPrevious} 
              format="number" 
              description="First-time sessions: Last 30d vs previous 30d" 
              loading={loading} 
            />
            <KPICard 
              title="Activations (30d)" 
              value={activationsCurrent} 
              previousValue={activationsPrevious}
              changePercent={activationsGrowth} 
              format="number" 
              description="Total activations: Last 30d vs previous 30d" 
              loading={loading} 
            />
            <KPICard 
              title="Total Revenue (30d)" 
              value={revenueCurrent} 
              previousValue={revenuePrevious} 
              changePercent={revenueGrowth} 
              format="currency" 
              decimals={0} 
              description="Last 30d vs previous 30d" 
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
              title="Trial to Activation Rate" 
              value={activationRateCurrent} 
              previousValue={activationRatePrevious}
              format="percentage" 
              decimals={1}
              description="Users reaching activation: Last 30d vs previous 30d" 
              loading={loading} 
            />
            <KPICard 
              title="Avg Deal Size" 
              value={avgDealSizeCurrent} 
              previousValue={avgDealSizePrevious}
              format="currency" 
              decimals={0}
              description="Average revenue per user: Last 30d vs previous 30d" 
              loading={loading} 
            />
            <KPICard 
              title="Active Customers" 
              value={activeCustomersCurrent} 
              previousValue={activeCustomersPrevious}
              format="number" 
              description="Customers with revenue: Last 30d vs previous 30d" 
              loading={loading} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}