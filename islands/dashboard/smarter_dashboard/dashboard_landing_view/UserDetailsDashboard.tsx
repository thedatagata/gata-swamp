// islands/dashboard/smarter_dashboard/dashboard_landing_view/UserDetailsDashboard.tsx
import { useEffect, useState } from "preact/hooks";
import KPICard from "../../../../components/charts/KPICard.tsx";
import FreshChartsWrapper from "../../../../components/charts/FreshChartsWrapper.tsx";
import { createSemanticTables } from "../../../../utils/smarter/dashboard_utils/semantic-amplitude.ts";
import { usersDashboardQueries } from "../../../../utils/smarter/overview_dashboards/semantic-dashboard-queries.ts";
import { generateDashboardChartConfig } from "../../../../utils/smarter/autovisualization_dashboard/dashboard-chart-generator.ts";
import { getSemanticMetadata } from "../../../../utils/smarter/dashboard_utils/semantic-config.ts";
import { getUsersKPIs } from "../../../../utils/smarter/overview_dashboards/kpi-queries.ts";

function uint8ArrayToNumber(arr: Uint8Array): number {
  let result = 0;
  for (let i = 0; i < Math.min(8, arr.length); i++) {
    result += arr[i] * Math.pow(256, i);
  }
  return result;
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

interface UserDetailsDashboardProps {
  db: any;
  webllmEngine: any;
  onBack: () => void;
  onExecuteQuery: (querySpec: any) => void;
}

export default function UserDetailsDashboard({ db, webllmEngine, onBack, onExecuteQuery }: UserDetailsDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [kpiData, setKpiData] = useState<any>({});
  const [chartData, setChartData] = useState<any>({});
  const [columnsMetadata, setColumnsMetadata] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [promptInput, setPromptInput] = useState("");
  const [generatedSQL, setGeneratedSQL] = useState("");
  const [sqlExplanation, setSqlExplanation] = useState("");
  const [querySpec, setQuerySpec] = useState<any>(null);
  const [sqlGenerating, setSqlGenerating] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [generatedChart, setGeneratedChart] = useState<any>(null);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setError(null);
      try {
        // Load KPIs using the same query as LandingOverview
        const usersKPIRaw = await getUsersKPIs(db);
        const usersKPIData = sanitizeQueryData([usersKPIRaw])[0];
        
        // Build KPI data structure
        const kpis: any = {
          trial_users: {
            query: { title: "Trial Users" },
            data: [{ value: usersKPIData.trial_users_last_30d }]
          },
          onboarding_users: {
            query: { title: "Onboarding Users" },
            data: [{ value: usersKPIData.onboarding_users_last_30d }]
          },
          customer_users: {
            query: { title: "Active Customers" },
            data: [{ value: usersKPIData.customer_users_last_30d }]
          }
        };
        setKpiData(kpis);
        
        // Load charts using semantic queries
        const tables = createSemanticTables(db);
        const charts: any = {};
        for (const query of usersDashboardQueries) {
          if (query.chartType === 'kpi') continue; // Skip KPIs, we handle them above
          const table = tables[query.table];
          if (!table) continue;
          const rawData = await table.query({ dimensions: query.dimensions, measures: query.measures, filters: query.filters });
          const data = sanitizeQueryData(rawData);
          try {
            if (!data || data.length === 0) continue;
            const config = generateDashboardChartConfig(query, data);
            if (config && typeof config === 'object' && config.type) {
              charts[query.id] = { query, config };
            }
          } catch (chartError) {
            console.error(`Failed to generate chart ${query.id}:`, chartError);
          }
        }
        setChartData(charts);

        // Build column metadata from semantic layer
        const usersConfig = getSemanticMetadata("users");
        const semanticFields = [
          ...Object.entries(usersConfig.dimensions).map(([key, config]: [string, any]) => ({
            column_name: key,
            type: 'DIMENSION',
            description: config.transformation || config.column,
            isNumeric: false,
            isDate: config.column?.includes('date'),
            isBoolean: false,
            uniqueCount: null,
            nullPercentage: null,
            minValue: null,
            maxValue: null,
            meanValue: null
          })),
          ...Object.entries(usersConfig.measures).map(([key, config]: [string, any]) => ({
            column_name: key,
            type: 'MEASURE',
            description: config.description,
            isNumeric: true,
            isDate: false,
            isBoolean: false,
            uniqueCount: null,
            nullPercentage: null,
            minValue: null,
            maxValue: null,
            meanValue: null
          }))
        ];
        setColumnsMetadata(semanticFields);
      } catch (err) {
        console.error("Dashboard load error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    if (db) loadDashboard();
  }, [db]);

  const handleGenerateSQL = async () => {
    if (!promptInput.trim() || !webllmEngine) return;
    setSqlGenerating(true);
    setError(null);
    setGeneratedChart(null);
    
    try {
      const { query, data, metrics } = await webllmEngine.generateQuery(promptInput, "users");
      
      console.log('✅ Query executed:', { 
        dimensions: query.dimensions, 
        measures: query.measures,
        rows: data.length,
        attempts: metrics.attemptCount
      });
      
      setGeneratedSQL(query.sql);
      setSqlExplanation(query.explanation);
      
      // Generate chart from data
      if (data.length > 0) {
        const chartConfig = generateDashboardChartConfig(
          {
            dimensions: query.dimensions,
            measures: query.measures,
            chartType: 'bar',
            title: promptInput
          },
          data
        );
        
        if (chartConfig) {
          setGeneratedChart(chartConfig);
          console.log('📊 Chart generated:', chartConfig.type);
        }
      }
      
    } catch (error) {
      console.error("Failed to execute query:", error);
      setError(`Query failed: ${error.message}`);
    } finally {
      setSqlGenerating(false);
    }
  };

  const getKPIValue = (id: string) => {
    const kpi = kpiData[id];
    if (!kpi?.data?.[0]) return 0;
    const value = kpi.data[0].value;
    if (typeof value === 'bigint') return Number(value);
    if (value instanceof Uint8Array) return uint8ArrayToNumber(value);
    return value || 0;
  };

  const usersConfig = getSemanticMetadata("users");
  const trialUsersCurrent = getKPIValue('trial_users');
  const onboardingUsersCurrent = getKPIValue('onboarding_users');
  const customerUsersCurrent = getKPIValue('customer_users');

  if (error) {
    return (
      <div class="bg-red-900/30 border border-red-500/50 rounded-lg p-4 backdrop-blur-sm">
        <h3 class="font-semibold text-red-400 mb-2">Error</h3>
        <p class="text-red-300 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <button onClick={onBack} class="text-gata-green hover:text-[#a0d147] font-medium mb-2 flex items-center">
            ← Back to Overview
          </button>
          <h2 class="text-2xl font-bold text-gata-cream">👥 User Analytics</h2>
          <p class="text-sm text-gata-cream/70">{usersConfig.description}</p>
        </div>
        <button
          onClick={() => setShowCatalog(!showCatalog)}
          class="px-4 py-2 bg-gata-dark/60 hover:bg-gata-dark/80 border border-gata-green/30 rounded-lg text-sm font-medium text-gata-cream"
        >
          {showCatalog ? 'Hide' : 'Show'} Data Catalog
        </button>
      </div>

      {showCatalog && (
        <div class="bg-gata-dark/60 border border-gata-green/30 rounded-lg p-4 space-y-3 backdrop-blur-sm">
          <h3 class="font-semibold text-gata-green">Users Data Catalog</h3>
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p class="font-medium text-gata-cream mb-1">Dimensions:</p>
              <ul class="text-gata-cream/80 space-y-1">
                {Object.entries(usersConfig.dimensions).map(([key, dim]: [string, any]) => (
                  <li key={key}>• <code class="bg-gata-green/20 px-1 rounded text-gata-green">{key}</code> - {dim.description}</li>
                ))}
              </ul>
            </div>
            <div>
              <p class="font-medium text-gata-cream mb-1">Key Measures:</p>
              <ul class="text-gata-cream/80 space-y-1">
                <li>• <code class="bg-gata-green/20 px-1 rounded text-gata-green">total_revenue</code> - Total lifetime value</li>
                <li>• <code class="bg-gata-green/20 px-1 rounded text-gata-green">active_users_30d</code> - Active user count</li>
                <li>• <code class="bg-gata-green/20 px-1 rounded text-gata-green">paying_customers</code> - Paying customers</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard 
          title="Trial Users" 
          value={trialUsersCurrent} 
          format="number" 
          decimals={0}
          loading={loading} 
        />
        <KPICard 
          title="Onboarding Users" 
          value={onboardingUsersCurrent} 
          format="number" 
          decimals={0}
          loading={loading} 
        />
        <KPICard 
          title="Active Customers" 
          value={customerUsersCurrent} 
          format="number" 
          decimals={0}
          loading={loading} 
        />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {chartData['lifecycle_distribution']?.config && (
          <FreshChartsWrapper config={chartData['lifecycle_distribution'].config} height={400} loading={loading} />
        )}
        {chartData['acquisition_performance']?.config && (
          <FreshChartsWrapper config={chartData['acquisition_performance'].config} height={400} loading={loading} />
        )}
        {chartData['plan_distribution']?.config && (
          <div class="lg:col-span-2">
            <FreshChartsWrapper config={chartData['plan_distribution'].config} height={400} loading={loading} />
          </div>
        )}
      </div>

      <div class="bg-gata-dark/60 border border-gata-green/20 rounded-lg p-6 shadow-sm backdrop-blur-sm">
        <h3 class="text-lg font-semibold text-gata-cream mb-4">📋 Semantic Layer Fields</h3>
        {columnsMetadata && columnsMetadata.length > 0 ? (
          <div class="bg-gata-dark/40 rounded-lg overflow-hidden">
            <div class="overflow-x-auto max-h-96">
              <table class="min-w-full text-sm">
                <thead class="bg-gata-green/20 border-b border-gata-green/30 sticky top-0">
                  <tr>
                    <th class="px-4 py-2 text-left font-semibold text-gata-cream">Field</th>
                    <th class="px-4 py-2 text-left font-semibold text-gata-cream">Type</th>
                    <th class="px-4 py-2 text-left font-semibold text-gata-cream">Definition</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gata-green/20">
                  {columnsMetadata.map((col, idx) => (
                    <tr key={idx} class="hover:bg-gata-green/10">
                      <td class="px-4 py-2 font-medium text-gata-cream">{col.column_name}</td>
                      <td class="px-4 py-2 text-gata-cream/80">
                        <span class={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                          col.type === 'MEASURE' ? 'bg-blue-900/40 text-blue-300' : 'bg-green-900/40 text-green-300'
                        }`}>
                          {col.type}
                        </span>
                      </td>
                      <td class="px-4 py-2 text-gata-cream/80 text-xs">{col.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div class="bg-gata-dark/40 rounded-lg p-4 text-sm text-gata-cream/70">
            {loading ? 'Loading fields...' : 'No fields available'}
          </div>
        )}
      </div>

      <div class="bg-gata-dark/60 border border-gata-green/20 rounded-lg p-6 shadow-sm backdrop-blur-sm">
        <h3 class="text-lg font-semibold text-gata-cream mb-4">💬 Ask a Question</h3>
        <div class="flex gap-3 mb-3">
          <textarea
            value={promptInput}
            onChange={(e) => setPromptInput(e.currentTarget.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleGenerateSQL();
              }
            }}
            placeholder="Example: Show users by plan tier"
            class="flex-1 p-3 rounded-lg border border-gata-green/30 bg-gata-dark/40 text-gata-cream placeholder-gata-cream/50 focus:border-gata-green focus:ring-2 focus:ring-gata-green/20 focus:outline-none"
            rows={2}
            disabled={sqlGenerating}
          />
          <button
            onClick={handleGenerateSQL}
            disabled={!promptInput.trim() || sqlGenerating}
            class={`px-6 py-2 rounded-lg font-medium transition-colors self-end ${
              promptInput.trim() && !sqlGenerating
                ? "bg-gata-green text-gata-dark hover:bg-[#a0d147]"
                : "bg-gata-dark/40 text-gata-cream/40 cursor-not-allowed border border-gata-green/20"
            }`}
          >
            {sqlGenerating ? "Generating..." : "Generate SQL"}
          </button>
        </div>

        {generatedSQL && (
          <div class="space-y-3">
            <div>
              <h4 class="font-semibold text-gata-cream mb-2">Generated SQL:</h4>
              <pre class="bg-gata-dark text-gata-green p-4 rounded-lg text-sm overflow-x-auto font-mono border border-gata-green/30">{generatedSQL}</pre>
            </div>
            {sqlExplanation && (
              <div class="bg-gata-green/10 border border-gata-green/30 rounded-lg p-3 backdrop-blur-sm">
                <p class="text-gata-cream/90 text-sm">{sqlExplanation}</p>
              </div>
            )}
            {generatedChart && (
              <div>
                <h4 class="font-semibold text-gata-cream mb-3">📊 Generated Chart:</h4>
                <FreshChartsWrapper config={generatedChart} height={400} loading={false} />
              </div>
            )}
            <div class="flex gap-3">
              <button
                onClick={() => querySpec && onExecuteQuery(querySpec)}
                class="px-6 py-2 bg-gata-green text-gata-dark rounded-lg font-medium hover:bg-[#a0d147]"
              >
                Execute & Visualize →
              </button>
              <button
                onClick={() => {
                  setGeneratedSQL("");
                  setSqlExplanation("");
                  setQuerySpec(null);
                  setGeneratedChart(null);
                }}
                class="px-6 py-2 bg-gata-dark/60 text-gata-cream border border-gata-green/30 rounded-lg font-medium hover:bg-gata-dark/80"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
