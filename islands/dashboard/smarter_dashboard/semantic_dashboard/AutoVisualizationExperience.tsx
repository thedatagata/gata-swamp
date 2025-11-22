// islands/dashboard/smarter_dashboard/semantic_dashboard/AutoVisualizationExperience.tsx
import { useEffect, useState } from "preact/hooks";
import { WebLLMSemanticHandler } from "../../../../utils/smarter/autovisualization_dashboard/webllm-handler.ts";
import { createSemanticTables } from "../../../../utils/smarter/dashboard_utils/semantic-amplitude.ts";
import { generateChartFromAnalysis } from "../../../../utils/smarter/autovisualization_dashboard/chart-generator.ts";
import { getSemanticMetadata } from "../../../../utils/smarter/dashboard_utils/semantic-config.ts";
import FreshChartsWrapper from "../../../../components/charts/FreshChartsWrapper.tsx";
import type { ChartConfig } from "../../../../utils/smarter/autovisualization_dashboard/chart-generator.ts";

interface AutoVisualizationExperienceProps {
  db: any;
  initialQuery?: string;
  querySpec?: any; // Structured query from details pages
  onBack?: () => void;
}

export default function AutoVisualizationExperience({
  db,
  initialQuery,
  querySpec,
  onBack,
}: AutoVisualizationExperienceProps) {
  const [handler, setHandler] = useState<WebLLMSemanticHandler | null>(null);
  const [loading, setLoading] = useState(true);
  const [userInput, setUserInput] = useState(initialQuery || "");
  const [result, setResult] = useState<any>(null);
  const [chartConfig, setChartConfig] = useState<ChartConfig | null>(null);
  const [querying, setQuerying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drill-down/refinement state
  const [drillDownInput, setDrillDownInput] = useState("");
  const [refining, setRefining] = useState(false);
  const [dataAnalysis, setDataAnalysis] = useState<string>("");

  // Initialize WebLLM
  useEffect(() => {
    async function initWebLLM() {
      try {
        const tables = createSemanticTables(db);
        const llmHandler = new WebLLMSemanticHandler(tables, "large");

        await llmHandler.initialize((progress) => {
          console.log("WebLLM initialization:", progress);
        });

        setHandler(llmHandler);
        setLoading(false);

        // If we have querySpec (from details page Execute), run it directly
        if (querySpec) {
          executeQuerySpec(querySpec, tables);
        }
        // If we have an initial query string, run it
        else if (initialQuery) {
          executeQuery(initialQuery, llmHandler);
        }
      } catch (error) {
        console.error("Failed to initialize WebLLM:", error);
        setError("Failed to initialize AI assistant");
        setLoading(false);
      }
    }
    initWebLLM();
  }, [db, initialQuery, querySpec]);

  const executeQuerySpec = async (spec: any, tables: any) => {
    setQuerying(true);
    setError(null);

    try {
      const table = tables[spec.table];
      if (!table) throw new Error(`Table ${spec.table} not found`);

      const data = await table.query({
        dimensions: spec.dimensions,
        measures: spec.measures,
        filters: spec.filters
      });

      // Sanitize data
      const sanitizedData = data.map((row: any) => {
        const newRow: any = {};
        for (const key in row) {
          const value = row[key];
          if (typeof value === 'bigint') newRow[key] = Number(value);
          else if (value instanceof Uint8Array) {
            let result = 0;
            for (let i = 0; i < Math.min(8, value.length); i++) {
              result += value[i] * Math.pow(256, i);
            }
            newRow[key] = result;
          }
          else newRow[key] = value;
        }
        return newRow;
      });

      setResult({ query: spec, data: sanitizedData });
    } catch (error) {
      console.error("Query execution failed:", error);
      setError(error.message);
    } finally {
      setQuerying(false);
    }
  };

  // Generate chart when result changes
  useEffect(() => {
    if (result && result.data.length > 0) {
      try {
        const semanticConfig = getSemanticMetadata(result.query.table);
        const chartResult = generateChartFromAnalysis(
          result.query,
          result.data
        );
        const chartConfig = chartResult.chartConfig;
        setChartConfig(chartConfig);

        // Generate data analysis
        generateDataAnalysis(result.data, result.query);
      } catch (error) {
        console.error("Chart generation failed:", error);
      }
    }
  }, [result]);

  const generateDataAnalysis = async (data: any[], query: any) => {
    if (!handler || data.length === 0) return;

    try {
      const sampleData = data.slice(0, 5);
      const analysisPrompt = `Analyze this data and provide 2-3 key insights in bullet points:
      
Query: ${query.explanation}
Dimensions: ${query.dimensions?.join(", ") || "none"}
Measures: ${query.measures.join(", ")}
Sample data (first 5 rows):
${JSON.stringify(sampleData, null, 2)}

Provide insights in this format:
• [Key insight 1]
• [Key insight 2]
• [Key insight 3 if applicable]`;

      const response = await handler.chat(analysisPrompt);
      setDataAnalysis(response);
    } catch (error) {
      console.error("Analysis generation failed:", error);
      setDataAnalysis("Unable to generate analysis");
    }
  };

  const executeQuery = async (queryText: string, llmHandler?: WebLLMSemanticHandler) => {
    const activeHandler = llmHandler || handler;
    if (!activeHandler || !queryText.trim()) return;

    setError(null);
    setQuerying(true);

    try {
      const { query, data } = await activeHandler.generateQuery(queryText);
      setResult({ query, data });
    } catch (error) {
      console.error("Query failed:", error);
      setError(error.message);
    } finally {
      setQuerying(false);
    }
  };

  const handleQuery = () => executeQuery(userInput);

  const handleDrillDown = async () => {
    if (!handler || !drillDownInput.trim() || !result) return;

    setRefining(true);
    setError(null);

    try {
      const drillDownPrompt = `Based on this current analysis:
Query: ${result.query.explanation}
Table: ${result.query.table}
Dimensions: ${result.query.dimensions?.join(", ") || "none"}
Measures: ${result.query.measures.join(", ")}

User wants to drill down: ${drillDownInput}

Generate a new query that drills into this data based on the user's request.`;

      const { query, data } = await handler.generateQuery(drillDownPrompt);
      setResult({ query, data });
      setDrillDownInput("");
    } catch (error) {
      console.error("Drill-down failed:", error);
      setError(error.message);
    } finally {
      setRefining(false);
    }
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleQuery();
    }
  };

  const handleDrillDownKeyPress = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleDrillDown();
    }
  };

  if (loading) {
    return (
      <div class="min-h-screen bg-gradient-to-br from-gata-dark to-gata-darker flex items-center justify-center">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-gata-green mx-auto mb-4">
          </div>
          <p class="text-gata-cream/80">Initializing AI Assistant...</p>
        </div>
      </div>
    );
  }

  return (
    <div class="min-h-screen bg-gradient-to-br from-gata-dark to-gata-darker">
      {/* Header with Back Button */}
      <div class="bg-gata-dark/95 border-b border-gata-green/20 sticky top-0 z-10 backdrop-blur-sm">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex items-center justify-between h-16">
            <button
              onClick={onBack}
              class="flex items-center space-x-2 text-gata-cream/80 hover:text-gata-green transition-colors"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              <span class="font-medium">Back to Dashboard</span>
            </button>

            <div class="flex items-center space-x-2 text-sm text-gata-green">
              <span class="w-2 h-2 bg-gata-green rounded-full"></span>
              <span>AI Ready</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Query Input (if no initial query) */}
        {!initialQuery && (
          <div class="bg-gata-dark/80 backdrop-blur-sm rounded-lg shadow-md border border-gata-green/20 p-6 mb-6">
            <h2 class="text-xl font-bold text-gata-cream mb-4">Ask Questions, Get Visualizations</h2>

            <div class="mb-4">
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.currentTarget.value)}
                onKeyPress={handleKeyPress}
                placeholder="Example: Show conversion rate by traffic source"
                class="w-full p-3 bg-gata-dark/40 border border-gata-green/30 text-gata-cream placeholder-gata-cream/50 rounded-lg focus:ring-2 focus:ring-gata-green focus:border-gata-green focus:outline-none"
                rows={2}
              />

              <div class="flex justify-end mt-3">
                <button
                  onClick={handleQuery}
                  disabled={!userInput.trim() || querying}
                  class={`px-6 py-2 rounded-lg font-medium transition-colors ${
                    userInput.trim() && !querying
                      ? "bg-gata-green text-gata-dark hover:bg-gata-hover"
                      : "bg-gata-dark/60 text-gata-cream/40 cursor-not-allowed border border-gata-green/20"
                  }`}
                >
                  {querying ? "Generating..." : "Generate Visualization"}
                </button>
              </div>
            </div>

            {error && (
              <div class="bg-gata-red/20 border border-gata-red/50 text-gata-cream p-4 rounded-lg">
                <div class="font-medium">Error</div>
                <div class="text-sm">{error}</div>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {result && (
          <div class="space-y-6">
            {/* Query Summary & Drill Down */}
            <div class="bg-gata-dark/80 backdrop-blur-sm rounded-lg shadow-md border border-gata-green/20 p-6">
              <h3 class="text-xl font-bold text-gata-cream mb-3">{result.query.explanation}</h3>

              <div class="grid grid-cols-2 gap-4 text-sm bg-gata-dark/40 border border-gata-green/20 p-4 rounded-lg mb-4">
                <div>
                  <span class="font-medium text-gata-green">Table:</span>{" "}
                  <span class="text-gata-cream">{result.query.table}</span>
                </div>
                <div>
                  <span class="font-medium text-gata-green">Chart:</span>{" "}
                  <span class="text-gata-cream capitalize">{chartConfig?.type || "N/A"}</span>
                </div>
                <div>
                  <span class="font-medium text-gata-green">Dimensions:</span>{" "}
                  <span class="text-gata-cream">
                    {result.query.dimensions?.length > 0
                      ? result.query.dimensions.join(", ")
                      : "none"}
                  </span>
                </div>
                <div>
                  <span class="font-medium text-gata-green">Measures:</span>{" "}
                  <span class="text-gata-cream">{result.query.measures.join(", ")}</span>
                </div>
              </div>

              {/* Drill-Down Prompt */}
              <div class="border-t border-gata-green/20 pt-4">
                <label class="block text-sm font-medium text-gata-green mb-2">
                  Drill into this data
                </label>
                <div class="flex gap-2">
                  <textarea
                    value={drillDownInput}
                    onChange={(e) => setDrillDownInput(e.currentTarget.value)}
                    onKeyPress={handleDrillDownKeyPress}
                    placeholder="Examples:&#10;• Show only last 7 days&#10;• Filter for paid customers only&#10;• Break down by device type&#10;• Show percentage change"
                    class="flex-1 p-3 bg-gata-dark/40 border border-gata-green/30 text-gata-cream placeholder-gata-cream/50 rounded-lg focus:ring-2 focus:ring-gata-green focus:border-gata-green focus:outline-none text-sm"
                    rows={2}
                  />
                  <button
                    onClick={handleDrillDown}
                    disabled={!drillDownInput.trim() || refining}
                    class={`px-4 py-2 rounded-lg font-medium transition-colors self-end ${
                      drillDownInput.trim() && !refining
                        ? "bg-gata-green text-gata-dark hover:bg-gata-hover"
                        : "bg-gata-dark/60 text-gata-cream/40 cursor-not-allowed border border-gata-green/20"
                    }`}
                  >
                    {refining ? "Drilling..." : "Drill Down"}
                  </button>
                </div>
              </div>
            </div>

            {/* Data Analysis */}
            {dataAnalysis && (
              <div class="bg-gata-green/10 border border-gata-green/30 rounded-lg p-4">
                <h4 class="font-semibold text-gata-green mb-2">📊 Data Insights</h4>
                <div class="text-sm text-gata-cream/90 whitespace-pre-line">
                  {dataAnalysis}
                </div>
              </div>
            )}

            {/* Auto-Generated Chart */}
            {chartConfig && (
              <FreshChartsWrapper config={chartConfig} height={400} loading={querying} />
            )}

            {/* Raw Data Preview */}
            <details class="bg-gata-dark/80 backdrop-blur-sm rounded-lg shadow-md border border-gata-green/20">
              <summary class="cursor-pointer p-4 font-medium text-gata-cream hover:bg-gata-dark/60 rounded-lg transition-colors">
                View Raw Data ({result.data.length} rows)
              </summary>
              <div class="p-4 border-t border-gata-green/20">
                <div class="overflow-auto max-h-96">
                  <pre class="text-xs p-4 bg-gata-dark/40 rounded text-gata-cream/90">
                    {JSON.stringify(result.data.slice(0, 10), null, 2)}
                    {result.data.length > 10 && `\n... and ${result.data.length - 10} more rows`}
                  </pre>
                </div>
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
