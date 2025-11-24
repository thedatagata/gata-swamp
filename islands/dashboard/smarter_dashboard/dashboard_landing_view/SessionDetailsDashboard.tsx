// islands/dashboard/smarter_dashboard/dashboard_landing_view/SessionDetailsDashboard.tsx
import { useEffect, useState } from "preact/hooks";
import KPICard from "../../../../components/charts/KPICard.tsx";
import FreshChartsWrapper from "../../../../components/charts/FreshChartsWrapper.tsx";
import FunnelChart from "../../../charts/FunnelChart.tsx";
import { createSemanticTables } from "../../../../utils/smarter/dashboard_utils/semantic-amplitude.ts";
import { sessionsDashboardQueries } from "../../../../utils/smarter/overview_dashboards/semantic-dashboard-queries.ts";
import { generateDashboardChartConfig } from "../../../../utils/smarter/autovisualization_dashboard/dashboard-chart-generator.ts";
import { getSemanticMetadata } from "../../../../utils/smarter/dashboard_utils/semantic-config.ts";
import { getSessionsKPIs } from "../../../../utils/smarter/overview_dashboards/kpi-queries.ts";

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
  const [editedSQL, setEditedSQL] = useState("");
  const [sqlExplanation, setSqlExplanation] = useState("");
  const [querySpec, setQuerySpec] = useState<any>(null);
  const [sqlGenerating, setSqlGenerating] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [generatedChart, setGeneratedChart] = useState<any>(null);
  const [kpiResult, setKpiResult] = useState<{value: number, title: string} | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setError(null);
      
      try {
        // Load KPIs using the same query as LandingOverview
        const sessionsKPIRaw = await getSessionsKPIs(db);
        const sessionsKPIData = sanitizeQueryData([sessionsKPIRaw])[0];
        
        // Build KPI data structure with period comparison
        const kpis: any = {
          new_vs_returning: {
            query: { title: "New vs Returning" },
            data: [{ 
              value: sessionsKPIData.new_vs_returning_30d,
              previousValue: sessionsKPIData.new_vs_returning_previous_30d,
              changePercent: sessionsKPIData.new_vs_returning_rate
            }]
          },
          paid_vs_organic: {
            query: { title: "Paid vs Organic" },
            data: [{ 
              value: sessionsKPIData.paid_vs_organic_30d,
              previousValue: sessionsKPIData.paid_vs_organic_previous_30d,
              changePercent: sessionsKPIData.paid_vs_organic_traffic_rate
            }]
          },
          revenue: {
            query: { title: "Revenue" },
            data: [{ 
              value: sessionsKPIData.revenue_last_30d,
              previousValue: sessionsKPIData.revenue_previous_30d,
              changePercent: sessionsKPIData.revenue_growth_rate
            }]
          }
        };
        setKpiData(kpis);
        
        // Load charts using semantic queries
        const tables = createSemanticTables(db);
        const charts: any = {};
        
        for (const query of sessionsDashboardQueries) {
          if (query.chartType === 'kpi') continue; // Skip KPIs, we handle them above
          
          const table = tables[query.table];
          if (!table) continue;
          
          const rawData = await table.query({
            dimensions: query.dimensions,
            measures: query.measures,
            filters: query.filters
          });
          const data = sanitizeQueryData(rawData);
          
          if (query.chartType === 'funnel') {
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
                charts[query.id] = { query, config };
              }
            } catch (chartError) {
              console.error(`Failed to generate chart ${query.id}:`, chartError);
            }
          }
        }
        
        setChartData(charts);

        // Build column metadata from semantic layer instead of profiled data
        const sessionsConfig = getSemanticMetadata("sessions");
        const semanticFields: any[] = [];
        
        // Add dimensions
        Object.entries(sessionsConfig.dimensions).forEach(([key, config]: [string, any]) => {
          const sourceField = sessionsConfig.fields[key];
          const description = sourceField?.description || config.transformation || key;
          semanticFields.push({
            column_name: config.alias_name || key,
            type: 'DIMENSION',
            description: description,
            isNumeric: false,
            isDate: key.includes('date'),
            isBoolean: false
          });
        });
        
        // Add measures - iterate through ALL aliases (aggregations + formulas)
        Object.entries(sessionsConfig.measures).forEach(([key, config]: [string, any]) => {
          const sourceField = sessionsConfig.fields[key];
          const baseDescription = sourceField?.description || config.description || key;
          
          // Add aggregation aliases
          if (config.aggregations && Array.isArray(config.aggregations)) {
            config.aggregations.forEach((aggObj: any) => {
              const aggType = Object.keys(aggObj)[0]; // 'sum', 'avg', 'count', etc.
              const aggConfig = aggObj[aggType];
              if (aggConfig.alias) {
                semanticFields.push({
                  column_name: aggConfig.alias,
                  type: 'MEASURE',
                  description: aggConfig.description || `${aggType.toUpperCase()} of ${baseDescription}`,
                  isNumeric: true,
                  isDate: false,
                  isBoolean: false
                });
              }
            });
          }
          
          // Add formula aliases
          if (config.formula && typeof config.formula === 'object') {
            Object.entries(config.formula).forEach(([formulaAlias, formulaConfig]: [string, any]) => {
              semanticFields.push({
                column_name: formulaAlias,
                type: 'MEASURE',
                description: formulaConfig.description || `Formula: ${formulaAlias}`,
                isNumeric: true,
                isDate: false,
                isBoolean: false
              });
            });
          }
        });
        
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
    setKpiResult(null);
    setLastError(null);
    
    try {
      const { query, data, metrics } = await webllmEngine.generateQuery(promptInput, "sessions");
      
      console.log('✅ Query executed:', { 
        dimensions: query.dimensions, 
        measures: query.measures,
        rows: data.length,
        attempts: metrics.attemptCount
      });
      
      setGeneratedSQL(query.sql);
      setEditedSQL(query.sql);  // Sync edited SQL
      setSqlExplanation(query.explanation);
      
      // Check if this is a KPI (single row, single measure, no dimensions)
      const isKPI = data.length === 1 && query.measures.length === 1 && query.dimensions.length === 0;
      
      if (isKPI && data.length > 0) {
        const measure = query.measures[0];
        const measureKey = measure.alias || measure.sourceField;
        setKpiResult({
          value: data[0][measureKey],
          title: measure.alias?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Result'
        });
      } else if (data.length > 0) {
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
      setLastError(error.message);
      setError(`Query failed: ${error.message}`);
    } finally {
      setSqlGenerating(false);
    }
  };

  const executeEditedSQL = async () => {
    if (!editedSQL.trim()) return;
    setSqlGenerating(true);
    setLastError(null);
    setGeneratedChart(null);
    setKpiResult(null);
    
    try {
      const result = await db.query(editedSQL);
      const data = sanitizeQueryData(Array.from(result));
      
      // Parse the SQL to extract dimensions and measures
      const parsed = webllmEngine.parseQueryForChart(editedSQL);
      
      // Check if this is a KPI (single row, single measure, no dimensions)
      const isKPI = data.length === 1 && parsed.measures.length === 1 && parsed.dimensions.length === 0;
      
      if (isKPI && data.length > 0) {
        const measure = parsed.measures[0];
        const measureKey = measure.alias || measure.sourceField;
        setKpiResult({
          value: data[0][measureKey],
          title: measure.alias?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Result'
        });
      } else if (data.length > 0) {
        const chartConfig = generateDashboardChartConfig(
          {
            dimensions: parsed.dimensions,
            measures: parsed.measures,
            chartType: 'bar',
            title: promptInput || 'Custom Query'
          },
          data
        );
        
        if (chartConfig) {
          setGeneratedChart(chartConfig);
          console.log('📊 Chart generated from edited SQL:', chartConfig.type);
        }
      }
    } catch (error) {
      console.error("SQL execution failed:", error);
      setLastError(error.message);
    } finally {
      setSqlGenerating(false);
    }
  };

  const getKPIValue = (id: string) => {
    const kpi = kpiData[id];
    if (!kpi?.data?.[0]) return { value: 0, previousValue: undefined, changePercent: undefined };
    const data = kpi.data[0];
    const value = typeof data.value === 'bigint' ? Number(data.value) :
                  data.value instanceof Uint8Array ? uint8ArrayToNumber(data.value) : data.value || 0;
    const previousValue = data.previousValue !== undefined && data.previousValue !== null ?
                          (typeof data.previousValue === 'bigint' ? Number(data.previousValue) :
                           data.previousValue instanceof Uint8Array ? uint8ArrayToNumber(data.previousValue) : data.previousValue) :
                          undefined;
    const changePercent = data.changePercent !== undefined && data.changePercent !== null ?
                          (typeof data.changePercent === 'bigint' ? Number(data.changePercent) :
                           data.changePercent instanceof Uint8Array ? uint8ArrayToNumber(data.changePercent) : data.changePercent) :
                          undefined;
    return { value, previousValue, changePercent };
  };

  const sessionsConfig = getSemanticMetadata("sessions");
  
  const newVsReturning = getKPIValue('new_vs_returning');
  const paidVsOrganic = getKPIValue('paid_vs_organic');
  const revenue = getKPIValue('revenue');
  

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
          <h3 class="font-semibold text-gata-green">Sessions Data Catalog - All Fields ({Object.keys(sessionsConfig.fields).length})</h3>
          <div class="bg-gata-dark/40 rounded-lg overflow-hidden">
            <div class="overflow-x-auto max-h-96">
              <table class="min-w-full text-xs">
                <thead class="bg-gata-green/20 border-b border-gata-green/30 sticky top-0">
                  <tr>
                    <th class="px-3 py-2 text-left font-semibold text-gata-cream">Field Name</th>
                    <th class="px-3 py-2 text-left font-semibold text-gata-cream">Type</th>
                    <th class="px-3 py-2 text-left font-semibold text-gata-cream">Category</th>
                    <th class="px-3 py-2 text-left font-semibold text-gata-cream">Description</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gata-green/20">
                  {Object.entries(sessionsConfig.fields).map(([fieldName, fieldConfig]: [string, any]) => (
                    <tr key={fieldName} class="hover:bg-gata-green/10">
                      <td class="px-3 py-2 font-medium text-gata-cream">
                        <code class="bg-gata-green/20 px-1 rounded text-gata-green">{fieldName}</code>
                      </td>
                      <td class="px-3 py-2 text-gata-cream/80">{fieldConfig.md_data_type}</td>
                      <td class="px-3 py-2 text-gata-cream/80">
                        <span class={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                          fieldConfig.data_type_category === 'identifier' ? 'bg-purple-900/40 text-purple-300' :
                          fieldConfig.data_type_category === 'temporal' ? 'bg-blue-900/40 text-blue-300' :
                          fieldConfig.data_type_category === 'categorical' ? 'bg-green-900/40 text-green-300' :
                          fieldConfig.data_type_category === 'numerical' ? 'bg-yellow-900/40 text-yellow-300' :
                          'bg-orange-900/40 text-orange-300'
                        }`}>
                          {fieldConfig.data_type_category}
                        </span>
                      </td>
                      <td class="px-3 py-2 text-gata-cream/80">{fieldConfig.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard 
          title="New vs Returning" 
          value={newVsReturning.value}
          previousValue={newVsReturning.previousValue}
          changePercent={newVsReturning.changePercent}
          format="percentage" 
          decimals={1}
          loading={loading} 
        />
        <KPICard 
          title="Paid vs Organic" 
          value={paidVsOrganic.value}
          previousValue={paidVsOrganic.previousValue}
          changePercent={paidVsOrganic.changePercent}
          format="percentage" 
          decimals={1}
          loading={loading} 
        />
        <KPICard 
          title="Revenue" 
          value={revenue.value}
          previousValue={revenue.previousValue}
          changePercent={revenue.changePercent}
          format="currency" 
          decimals={0}
          loading={loading} 
        />
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
              <h4 class="font-semibold text-gata-cream mb-2">Generated SQL (editable):</h4>
              <textarea
                value={editedSQL}
                onChange={(e) => setEditedSQL(e.currentTarget.value)}
                class="w-full bg-gata-dark text-gata-green p-4 rounded-lg text-sm font-mono border border-gata-green/30 focus:border-gata-green focus:ring-2 focus:ring-gata-green/20 focus:outline-none min-h-[120px]"
              />
            </div>
            {sqlExplanation && (
              <div class="bg-gata-green/10 border border-gata-green/30 rounded-lg p-3 backdrop-blur-sm">
                <p class="text-gata-cream/90 text-sm">{sqlExplanation}</p>
              </div>
            )}
            {lastError && (
              <div class="bg-red-900/30 border border-red-500/50 rounded-lg p-3 backdrop-blur-sm space-y-2">
                <p class="text-red-300 text-sm">{lastError}</p>
                <button
                  onClick={onBack}
                  class="text-sm text-red-300 hover:text-red-200 underline"
                >
                  ← Back to Overview Dashboard
                </button>
              </div>
            )}
            {kpiResult && (
              <div>
                <h4 class="font-semibold text-gata-cream mb-3">📊 Result:</h4>
                <KPICard 
                  title={kpiResult.title}
                  value={kpiResult.value}
                  format={kpiResult.title.toLowerCase().includes('rate') ? 'percentage' : 
                         kpiResult.title.toLowerCase().includes('revenue') ? 'currency' : 'number'}
                  decimals={kpiResult.title.toLowerCase().includes('rate') ? 1 : 0}
                  loading={false}
                />
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
                onClick={executeEditedSQL}
                disabled={!editedSQL.trim() || sqlGenerating}
                class={`px-6 py-2 rounded-lg font-medium ${
                  editedSQL.trim() && !sqlGenerating
                    ? "bg-gata-green text-gata-dark hover:bg-[#a0d147]"
                    : "bg-gata-dark/40 text-gata-cream/40 cursor-not-allowed border border-gata-green/20"
                }`}
              >
                {sqlGenerating ? "Executing..." : "Execute SQL"}
              </button>
              <button
                onClick={handleGenerateSQL}
                disabled={!promptInput.trim() || sqlGenerating}
                class="px-6 py-2 bg-gata-dark/60 hover:bg-gata-dark/80 border border-gata-green/30 rounded-lg font-medium text-gata-cream"
              >
                🔄 Try Again
              </button>
              <button
                onClick={() => {
                  setGeneratedSQL("");
                  setEditedSQL("");
                  setSqlExplanation("");
                  setGeneratedChart(null);
                  setKpiResult(null);
                  setLastError(null);
                }}
                class="px-6 py-2 bg-gata-dark/60 hover:bg-gata-dark/80 border border-gata-green/30 rounded-lg font-medium text-gata-cream"
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
