// islands/dashboard/smarter_dashboard/dashboard_landing_view/SessionDetailsDashboard.tsx
import { useEffect, useState } from "preact/hooks";
import KPICard from "../../../../components/charts/KPICard.tsx";
import FreshChartsWrapper from "../../../../components/charts/FreshChartsWrapper.tsx";
import FunnelChart from "../../../charts/FunnelChart.tsx";
import { createSemanticTables } from "../../../../utils/smarter/semantic-amplitude.ts";
import { sessionsDashboardQueries } from "../../../../utils/smarter/semantic-dashboard-queries.ts";
import { generateDashboardChartConfig } from "../../../../utils/smarter/dashboard-chart-generator.ts";
import { getModelConfig } from "../../../../utils/smarter/semantic-config.ts";

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
      if (typeof value === 'bigint') {
        newRow[key] = Number(value);
      } else if (value instanceof Uint8Array) {
        newRow[key] = uint8ArrayToNumber(value);
      } else if (value instanceof Date) {
        newRow[key] = value.toISOString().split('T')[0];
      } else if (typeof value === 'number' && value > 1000000000000) {
        newRow[key] = new Date(value).toISOString().split('T')[0];
      } else {
        newRow[key] = value;
      }
    }
    return newRow;
  });
}

interface SessionDetailsDashboardProps {
  db: any;
  webllmEngine: any;
  onBack: () => void;
  onExecuteQuery: (querySpec: any) => void;
}

export default function SessionDetailsDashboard({ 
  db, 
  webllmEngine, 
  onBack, 
  onExecuteQuery 
}: SessionDetailsDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [kpiData, setKpiData] = useState<any>({});
  const [chartData, setChartData] = useState<any>({});
  const [funnelData, setFunnelData] = useState<any>(null);
  const [columnsMetadata, setColumnsMetadata] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [promptInput, setPromptInput] = useState("");
  const [generatedSQL, setGeneratedSQL] = useState("");
  const [sqlExplanation, setSqlExplanation] = useState("");
  const [querySpec, setQuerySpec] = useState<any>(null);
  const [sqlGenerating, setSqlGenerating] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [generatedChart, setGeneratedChart] = useState<any>(null);  // For LLM-generated charts

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setError(null);
      
      try {
        const tables = createSemanticTables(db);
        const results: any = {};
        
        for (const query of sessionsDashboardQueries) {
          const table = tables[query.table];
          if (!table) continue;
          
          const rawData = await table.query({
            dimensions: query.dimensions,
            measures: query.measures,
            filters: query.filters
          });
          const data = sanitizeQueryData(rawData);
          results[query.id] = { query, data };
        }

        const kpis: any = {};
        const charts: any = {};
        
        for (const [id, result] of Object.entries(results)) {
          const { query, data } = result as any;
          if (query.chartType === 'kpi') {
            kpis[id] = { query, data };
          } else if (query.chartType === 'funnel') {
            const labels = data.map((row: any) => row[query.dimensions[0]]);
            const values = data.map((row: any) => row[query.measures[0]]);
            setFunnelData({
              labels,
              datasets: [{
                label: query.title,
                data: values,
                backgroundColor: [
                  'rgba(59, 130, 246, 0.8)',
                  'rgba(147, 197, 253, 0.8)',
                  'rgba(191, 219, 254, 0.8)',
                  'rgba(219, 234, 254, 0.8)',
                  'rgba(239, 246, 255, 0.8)',
                ],
              }]
            });
          } else {
            try {
              if (!data || data.length === 0) continue;
              const config = generateDashboardChartConfig(query, data);
              if (config && typeof config === 'object' && config.type) {
                charts[id] = { query, config };
              }
            } catch (chartError) {
              console.error(`Failed to generate chart ${id}:`, chartError);
            }
          }
        }
        
        setKpiData(kpis);
        setChartData(charts);

        // Build column metadata from semantic layer instead of profiled data
        const sessionsConfig = getModelConfig("sessions");
        const semanticFields = [
          ...Object.entries(sessionsConfig.dimensions).map(([key, config]: [string, any]) => ({
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
          ...Object.entries(sessionsConfig.measures).map(([key, config]: [string, any]) => ({
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
      // Execute query directly
      const { query, data, metrics } = await webllmEngine.generateQuery(promptInput, "sessions");
      
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

  const getKPIValue = (id: string, measure: string) => {
    const kpi = kpiData[id];
    if (!kpi?.data?.[0]) return 0;
    const value = kpi.data[0][measure];
    if (typeof value === 'bigint') return Number(value);
    if (value instanceof Uint8Array) return uint8ArrayToNumber(value);
    return value || 0;
  };

  const sessionsConfig = getModelConfig("sessions");
  
  // Revenue KPI with period comparison
  const revenueCurrent = getKPIValue('revenue_comparison', 'revenue_last_30d');
  const revenuePrevious = getKPIValue('revenue_comparison', 'revenue_prev_30d');
  const revenueGrowth = revenuePrevious > 0 ? ((revenueCurrent - revenuePrevious) / revenuePrevious) * 100 : 0;
  
  // Sessions Count KPI with period comparison
  const sessionsCurrent = getKPIValue('sessions_comparison', 'sessions_last_30d');
  const sessionsPrevious = getKPIValue('sessions_comparison', 'sessions_prev_30d');
  const sessionsGrowth = sessionsPrevious > 0 ? ((sessionsCurrent - sessionsPrevious) / sessionsPrevious) * 100 : 0;
  
  // New vs Returning KPI
  const newVsReturningCurrent = getKPIValue('new_vs_returning', 'new_visitor_sessions');
  const newVsReturningPrevious = getKPIValue('new_vs_returning', 'returning_visitor_sessions');
  const newVsReturningChange = 0;
  

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
          <button
            onClick={onBack}
            class="text-gata-green hover:text-[#a0d147] font-medium mb-2 flex items-center"
          >
            ← Back to Overview
          </button>
          <h2 class="text-2xl font-bold text-gata-cream">📊 Sessions Analytics</h2>
          <p class="text-sm text-gata-cream/70">{sessionsConfig.description}</p>
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
          <h3 class="font-semibold text-gata-green">Sessions Data Catalog</h3>
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p class="font-medium text-gata-cream mb-1">Dimensions:</p>
              <ul class="text-gata-cream/80 space-y-1">
                {Object.entries(sessionsConfig.dimensions).map(([key, dim]: [string, any]) => (
                  <li key={key}>• <code class="bg-gata-green/20 px-1 rounded text-gata-green">{key}</code> - {dim.description}</li>
                ))}
              </ul>
            </div>
            <div>
              <p class="font-medium text-gata-cream mb-1">Key Measures:</p>
              <ul class="text-gata-cream/80 space-y-1">
                <li>• <code class="bg-gata-green/20 px-1 rounded text-gata-green">total_revenue</code> - Total revenue</li>
                <li>• <code class="bg-gata-green/20 px-1 rounded text-gata-green">session_count</code> - Total sessions</li>
                <li>• <code class="bg-gata-green/20 px-1 rounded text-gata-green">unique_visitors</code> - Unique visitors</li>
                <li>• <code class="bg-gata-green/20 px-1 rounded text-gata-green">conversion_rate_last_30d</code> - Conversion rate</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Revenue" value={revenueCurrent} previousValue={revenuePrevious} 
          changePercent={revenueGrowth} format="currency" decimals={0} loading={loading} />
        <KPICard title="Traffic" value={sessionsCurrent} previousValue={sessionsPrevious}
          changePercent={sessionsGrowth} format="number" loading={loading} />
        <KPICard title="New Sessions" value={newVsReturningCurrent} format="number" loading={loading} />
        <KPICard title="Returning Sessions" value={newVsReturningPrevious} format="number" loading={loading} />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {chartData['plan_performance']?.config && (
          <FreshChartsWrapper config={chartData['plan_performance'].config} height={400} loading={loading} />
        )}
        {chartData['traffic_source_performance']?.config && (
          <FreshChartsWrapper config={chartData['traffic_source_performance'].config} height={400} loading={loading} />
        )}
        {chartData['sessions_over_time']?.config && (
          <div class="lg:col-span-2">
            <FreshChartsWrapper config={chartData['sessions_over_time'].config} height={400} loading={loading} />
          </div>
        )}
        {funnelData && (
          <div class="lg:col-span-2">
            <FunnelChart data={funnelData} height={400} />
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
            placeholder="Example: Show conversion rate by traffic source"
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
