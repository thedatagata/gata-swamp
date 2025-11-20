// islands/dashboard/smarter_dashboard/dashboard_landing_view/UserDetailsDashboard.tsx
import { useEffect, useState } from "preact/hooks";
import KPICard from "../../../../components/charts/KPICard.tsx";
import FreshChartsWrapper from "../../../../components/charts/FreshChartsWrapper.tsx";
import { createSemanticTables } from "../../../../utils/smarter/semantic-amplitude.ts";
import { usersDashboardQueries } from "../../../../utils/smarter/dashboard-queries.ts";
import { generateDashboardChartConfig } from "../../../../utils/smarter/dashboard-chart-generator.ts";
import { getModelConfig } from "../../../../utils/smarter/semantic-config.ts";
import { metadataStore } from "../../../../utils/services/metadata-store.ts";

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

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setError(null);
      try {
        const tables = createSemanticTables(db);
        const results: any = {};
        for (const query of usersDashboardQueries) {
          const table = tables[query.table];
          if (!table) continue;
          const rawData = await table.query({ dimensions: query.dimensions, measures: query.measures, filters: query.filters });
          const data = sanitizeQueryData(rawData);
          results[query.id] = { query, data };
        }
        const kpis: any = {};
        const charts: any = {};
        for (const [id, result] of Object.entries(results)) {
          const { query, data } = result as any;
          if (query.chartType === 'kpi') {
            kpis[id] = { query, data };
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

        // Load column metadata
        const columns = await metadataStore.getTableMetadata("users_dim");
        setColumnsMetadata(columns);
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
    try {
      const result = await webllmEngine.generateSQLPreview(promptInput);
      setGeneratedSQL(result.sql);
      setSqlExplanation(result.explanation);
      setQuerySpec(result.querySpec || null);
    } catch (error) {
      console.error("Failed to generate SQL:", error);
      setSqlExplanation(`Error: ${error.message}`);
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

  const usersConfig = getModelConfig("users");
  const totalLTV = getKPIValue('users_total_revenue', 'total_ltv');
  const payingCustomers = getKPIValue('users_total_customers', 'paying_customers');

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
                <li>• <code class="bg-gata-green/20 px-1 rounded text-gata-green">total_ltv</code> - Total lifetime value</li>
                <li>• <code class="bg-gata-green/20 px-1 rounded text-gata-green">avg_ltv</code> - Average LTV per user</li>
                <li>• <code class="bg-gata-green/20 px-1 rounded text-gata-green">active_users</code> - Active user count</li>
                <li>• <code class="bg-gata-green/20 px-1 rounded text-gata-green">paying_customers</code> - Paying customers</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KPICard title="Total LTV" value={totalLTV} format="currency" decimals={0} loading={loading} />
        <KPICard title="Paying Customers" value={payingCustomers} format="number" loading={loading} />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {chartData['lifecycle_distribution']?.config && (
          <FreshChartsWrapper config={chartData['lifecycle_distribution'].config} height={400} loading={loading} />
        )}
        {chartData['ltv_by_plan']?.config && (
          <FreshChartsWrapper config={chartData['ltv_by_plan'].config} height={400} loading={loading} />
        )}
        {chartData['cohort_retention']?.config && (
          <div class="lg:col-span-2">
            <FreshChartsWrapper config={chartData['cohort_retention'].config} height={400} loading={loading} />
          </div>
        )}
      </div>

      <div class="bg-gata-dark/60 border border-gata-green/20 rounded-lg p-6 shadow-sm backdrop-blur-sm">
        <h3 class="text-lg font-semibold text-gata-cream mb-4">📋 Column Metadata</h3>
        {columnsMetadata && columnsMetadata.length > 0 ? (
          <div class="bg-gata-dark/40 rounded-lg overflow-hidden">
            <div class="overflow-x-auto max-h-96">
              <table class="min-w-full text-sm">
                <thead class="bg-gata-green/20 border-b border-gata-green/30 sticky top-0">
                  <tr>
                    <th class="px-4 py-2 text-left font-semibold text-gata-cream">Column</th>
                    <th class="px-4 py-2 text-left font-semibold text-gata-cream">Type</th>
                    <th class="px-4 py-2 text-right font-semibold text-gata-cream">Unique</th>
                    <th class="px-4 py-2 text-right font-semibold text-gata-cream">Null %</th>
                    <th class="px-4 py-2 text-left font-semibold text-gata-cream">Min</th>
                    <th class="px-4 py-2 text-left font-semibold text-gata-cream">Max</th>
                    <th class="px-4 py-2 text-right font-semibold text-gata-cream">Mean</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gata-green/20">
                  {columnsMetadata.map((col, idx) => (
                    <tr key={idx} class="hover:bg-gata-green/10">
                      <td class="px-4 py-2 font-medium text-gata-cream">{col.column_name}</td>
                      <td class="px-4 py-2 text-gata-cream/80">
                        <span class={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                          col.isNumeric ? 'bg-blue-900/40 text-blue-300' :
                          col.isDate ? 'bg-green-900/40 text-green-300' :
                          col.isBoolean ? 'bg-purple-900/40 text-purple-300' :
                          'bg-gata-dark/60 text-gata-cream/70'
                        }`}>
                          {col.type}
                        </span>
                      </td>
                      <td class="px-4 py-2 text-right text-gata-cream/80">{col.uniqueCount?.toLocaleString() || '-'}</td>
                      <td class="px-4 py-2 text-right text-gata-cream/80">{col.nullPercentage?.toFixed(1) || '0.0'}%</td>
                      <td class="px-4 py-2 text-gata-cream/80 truncate max-w-[120px]" title={String(col.minValue || '-')}>
                        {col.minValue !== undefined ? String(col.minValue) : '-'}
                      </td>
                      <td class="px-4 py-2 text-gata-cream/80 truncate max-w-[120px]" title={String(col.maxValue || '-')}>
                        {col.maxValue !== undefined ? String(col.maxValue) : '-'}
                      </td>
                      <td class="px-4 py-2 text-right text-gata-cream/80">
                        {col.meanValue !== undefined ? col.meanValue.toFixed(2) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div class="bg-gata-dark/40 rounded-lg p-4 text-sm text-gata-cream/70">
            {loading ? 'Loading column metadata...' : 'No column metadata available'}
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
