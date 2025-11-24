// islands/dashboard/starter_dashboard/BaseDashboardWizard.tsx
import { useEffect, useState } from "preact/hooks";
import { createMotherDuckClient } from "../../../utils/services/motherduck-client.ts";
import WebDataRocksPivot from "./WebDataRocksPivot.tsx";
import FieldCatalog from "./FieldCatalog.tsx";
import { sanitizeQueryData } from "./data-utils.ts";
import { 
  buildReportFromSQL, 
  handle1MBLimitError,
  is1MBLimitError
} from "../../../utils/starter/pivot-query-builder.ts";
import { getLDClient } from "../../../utils/launchdarkly/client.ts";
import { trackView, trackInteraction } from "../../../utils/launchdarkly/events.ts";
import UpgradeModal from "../../../components/UpgradeModal.tsx";

interface BaseDashboardWizardProps {
  motherDuckToken: string;
  sessionId: string;
}

export default function BaseDashboardWizard({ motherDuckToken, sessionId }: BaseDashboardWizardProps) {
  const [client, setClient] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // LaunchDarkly AI access state
  const [hasAIAccess, setHasAIAccess] = useState(false);
  const [upgradeModalConfig, setUpgradeModalConfig] = useState<{
    show: boolean;
    feature: "ai_query_access" | "data_limit";
    upgradeType: "feature" | "plan";
  }>({ show: false, feature: "ai_query_access", upgradeType: "feature" });
  
  const [sqlQuery, setSqlQuery] = useState<string>(`SELECT total_events, lifetime_revenue, current_lifecycle_stage FROM amplitude.users_pivot_src WHERE last_session_date >= CURRENT_DATE - INTERVAL 30 DAYS`);
  
  const [naturalLanguagePrompt, setNaturalLanguagePrompt] = useState<string>(
    "I want to look at [lifetime revenue, activated users] by [first traffic source, lifecycle stage] for the past [3 months]"
  );
  
  const [queryResults, setQueryResults] = useState<any[]>([]);
  const [pivotReport, setPivotReport] = useState<any>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    initializeClient();
    checkAIAccess();
  }, [motherDuckToken]);

  async function initializeClient() {
    try {
      setLoading(true);
      const c = await createMotherDuckClient(motherDuckToken);
      setClient(c);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  function checkAIAccess() {
    const ldClient = getLDClient();
    if (ldClient) {
      // Check flag first
      const flagAccess = ldClient.variation("starter-ai-query-access", false);
      
      // Also check user context directly (in case flag logic relies on it but is slow, or if we want to trust the context)
      const context = ldClient.getContext();
      const contextAccess = context?.custom?.ai_addon_unlocked === true;
      
      const hasAccess = flagAccess || contextAccess;
      setHasAIAccess(hasAccess);
      
      // Track view of gated feature
      if (!hasAccess) {
        trackView("gate", "feature_gate", "BaseDashboardWizard", {
          plan: "starter",
          feature: "ai_query_generation",
          gateType: "plan_upgrade"
        });
      }
    }
  }

  function handleAIPromptClick() {
    if (!hasAIAccess) {
      // Track gate interaction
      trackInteraction("click", "ai_prompt_input", "feature_gate", "BaseDashboardWizard", {
        plan: "starter",
        featureRequested: "ai_query_access"
      });
      
      setUpgradeModalConfig({ show: true, feature: "ai_query_access", upgradeType: "feature" });
      return;
    }
    
    // Allow normal interaction if user has access
    // The textarea is already functional
  }

  async function handleGenerateSQLFromPrompt() {
    if (!client || !naturalLanguagePrompt.trim()) return;
    
    if (!hasAIAccess) {
      trackInteraction("submit", "ai_generate_button", "feature_gate", "BaseDashboardWizard", {
        plan: "starter",
        featureRequested: "ai_query_access"
      });
      setUpgradeModalConfig({ show: true, feature: "ai_query_access", upgradeType: "feature" });
      return;
    }
    
    setLoading(true);
    setError(null);
    setWarnings([]);
    
    // Track AI usage
    trackInteraction("submit", "prompt_input", "query_builder", "BaseDashboardWizard", {
      plan: "starter",
      sqlMode: "ai",
      promptLength: naturalLanguagePrompt.length
    });
    
    try {
      console.log('🤖 Using MotherDuck AI to generate SQL...');
      console.log('Prompt:', naturalLanguagePrompt);
      
      // Use MotherDuck's PROMPT_SQL with include_tables parameter
      const promptSQL = `CALL prompt_sql('${naturalLanguagePrompt.replace(/'/g, "''")}', include_tables=['amplitude.users_pivot_src'])`;
      console.log('📤 Submitting to MotherDuck:', promptSQL);
      
      const result = await client.evaluateQuery(promptSQL);
      const rows = result.data.toRows();
      
      if (rows.length > 0 && rows[0].query) {
        const generatedSQL = rows[0].query;
        console.log('✅ MotherDuck generated SQL:', generatedSQL);
        
        setSqlQuery(generatedSQL);
        setWarnings(['✅ SQL generated by MotherDuck AI - review and execute below']);
      } else {
        console.error('❌ No SQL in response. Full result:', rows);
        throw new Error('No SQL returned from MotherDuck AI');
      }
      
      setLoading(false);
      
    } catch (err) {
      console.error('❌ MotherDuck AI failed');
      setError(`MotherDuck AI Error: ${err instanceof Error ? err.message : String(err)}`);
      setLoading(false);
    }
  }

  async function handleExecuteQuery() {
    if (!client || !sqlQuery.trim()) {
      return;
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 EXECUTING QUERY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Track manual SQL execution
    trackInteraction("submit", "execute_button", "query_builder", "BaseDashboardWizard", {
      plan: "starter",
      sqlMode: "manual",
      queryLength: sqlQuery.length
    });
    
    setLoading(true);
    setError(null);
    setWarnings([]);
    
    try {
      // STEP 1: Build report config from SQL (extracts columns, generates slice)
      const reportConfig = buildReportFromSQL(sqlQuery);
      
      console.log('📋 Extracted columns:', reportConfig.columns);
      console.log('🎨 Generated slice:', reportConfig.slice);
      
      // Show warnings
      if (reportConfig.warnings.length > 0) {
        setWarnings(reportConfig.warnings);
      }
      
      // STEP 2: Execute query
      console.log('⏳ Executing query...');
      const result = await client.evaluateQuery(reportConfig.sql);
      const rawRows = result.data.toRows();
      console.log('✅ Query executed:', rawRows.length, 'rows');
      
      // STEP 3: Sanitize data
      const rows = sanitizeQueryData(rawRows);
      setQueryResults(rows);
      
      // STEP 4: Set pivot config (WebDataRocksPivot handles metadata)
      setPivotReport({
        data: rows,
        slice: reportConfig.slice
      });
      
      // STEP 5: Switch to results view
      setShowResults(true);
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ READY FOR VISUALIZATION');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      setLoading(false);
      
    } catch (err) {
      console.error('❌ Query execution failed:', err);
      
      const errorMsg = err instanceof Error ? err.message : String(err);

      // Handle 1MB limit error with upsell
      if (errorMsg.includes('too large') || 
          errorMsg.includes('1MB') || 
          errorMsg.includes('exceeds')) {
        setError(handle1MBLimitError());
      } else {
        setError(errorMsg);
      }
      
      setLoading(false);
    }
  }

  function handlePivotLoadError(errorMsg: string) {
    console.error('❌ Pivot load error:', errorMsg);
    setError(handle1MBLimitError());
    setPivotReport(null); // Clear pivot to hide component
  }

  // Render error message with optional upgrade button
  function renderError() {
    if (!error) return null;
    
    const isLimitError = is1MBLimitError(error);
    
    return (
      <div class="mb-4 p-4 bg-rose-950/30 border border-rose-400/50 rounded-lg">
        <p class="text-sm font-semibold text-rose-200 mb-2">Error</p>
        <pre class="text-sm text-rose-100 whitespace-pre-wrap mb-4">{error}</pre>
        
        {isLimitError && (
          <button
            type="button"
            onClick={() => setUpgradeModalConfig({ show: true, feature: "data_limit", upgradeType: "plan" })}
            class="w-full py-3 px-6 bg-gradient-to-r from-[#90C137] to-[#a0d147] text-[#172217] rounded-lg font-semibold hover:from-[#a0d147] hover:to-[#b0e157] transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <span class="text-xl">✨</span>
            <span>Upgrade to Smarter Dashboard Now</span>
            <span class="text-xl">🚀</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div class="max-w-7xl mx-auto p-6 space-y-6">
      
      {/* Upgrade Modal */}
      {upgradeModalConfig.show && (
        <UpgradeModal 
          feature={upgradeModalConfig.feature}
          upgradeType={upgradeModalConfig.upgradeType}
          sessionId={sessionId}
          onClose={() => setUpgradeModalConfig({ ...upgradeModalConfig, show: false })}
        />
      )}
      
      {/* Query Builder View */}
      <div style={{ display: !showResults ? 'block' : 'none' }}>
        {/* Field Catalog */}
        <FieldCatalog />
        
        {/* Natural Language Query Builder */}
        <div class="bg-gata-dark border border-gata-green/30 rounded-lg shadow-lg p-6 mb-6">
        <h2 class="text-2xl font-bold text-gata-cream mb-2">
          💬 Your Personal Data Analyst
          {!hasAIAccess && <span class="ml-2 text-sm text-amber-400">🔒 Premium Feature</span>}
        </h2>
        <p class="text-sm text-gata-cream/70 mb-4">
          {hasAIAccess 
            ? "select the data you need to build the pivot table you wanted without having to export the data from the dashboard you didn't want to build in the first place"
            : "AI-powered query generation available with upgrade 🚀"
          }
        </p>

        <div class="space-y-4">
          <div class="relative">
            <textarea
              value={naturalLanguagePrompt}
              onInput={(e) => hasAIAccess && setNaturalLanguagePrompt((e.target as HTMLTextAreaElement).value)}
              onClick={handleAIPromptClick}
              placeholder={hasAIAccess 
                ? "I want to look at [metrics] by [dimensions] over the past [amount of time]"
                : "Upgrade to unlock AI query generation ✨"
              }
              disabled={!hasAIAccess}
              class={`w-full h-32 px-4 py-3 bg-gata-dark/40 border rounded-lg text-base focus:ring-2 transition-all ${
                hasAIAccess 
                  ? 'border-gata-green/30 text-gata-cream placeholder-gata-cream/40 focus:border-gata-green focus:ring-gata-green/20 cursor-text'
                  : 'border-amber-400/30 text-gata-cream/50 placeholder-amber-400/60 cursor-pointer opacity-70'
              }`}
            />
            {!hasAIAccess && (
              <div class="absolute inset-0 bg-gradient-to-t from-amber-500/10 to-transparent pointer-events-none rounded-lg" />
            )}
          </div>

          <button
            type="button"
            onClick={handleGenerateSQLFromPrompt}
            disabled={loading || !naturalLanguagePrompt.trim() || !client}
            class={`w-full py-3 font-semibold rounded-lg transition-all ${
              hasAIAccess
                ? 'bg-gata-green text-gata-dark hover:bg-gata-hover disabled:opacity-50 disabled:cursor-not-allowed'
                : 'bg-amber-500 text-white hover:bg-amber-600 cursor-pointer'
            }`}
          >
            {!hasAIAccess ? '✨ Upgrade to Use AI Generation' : loading ? '🤖 Generating SQL...' : !client ? '⏳ Connecting...' : '🤖 Generate SQL with MotherDuck AI'}
          </button>

          {hasAIAccess && (
            <div class="text-sm text-gata-cream/80 bg-gata-green/10 p-4 rounded-lg border border-gata-green/20">
              <p class="font-semibold mb-2 text-gata-green">📝 Examples:</p>
              <ul class="list-disc list-inside space-y-2">
                <li>I want to look at <span class="text-gata-green font-medium">session revenue, trial signups</span> by <span class="text-cyan-300 font-medium">traffic source type, lifecycle stage</span> over the past <span class="text-amber-300 font-medium">3 months</span></li>
                <li>Show me <span class="text-gata-green font-medium">activation events, conversion rate</span> by <span class="text-cyan-300 font-medium">traffic source, day of week</span> for the last <span class="text-amber-300 font-medium">30 days</span></li>
                <li>I need <span class="text-gata-green font-medium">customer LTV, retention events</span> grouped by <span class="text-cyan-300 font-medium">plan tier, session frequency</span> in <span class="text-amber-300 font-medium">Q4 2024</span></li>
              </ul>
            </div>
          )}
        </div>
      </div>
      
      {/* SQL Query Builder - Always available */}
      <div class="bg-gata-dark border border-gata-green/30 rounded-lg shadow-lg p-6">
        <h2 class="text-2xl font-bold text-gata-cream mb-2">🔍 SQL Query Builder</h2>
        <p class="text-sm text-gata-cream/70 mb-4">
          Or write SQL directly - we'll auto-generate the pivot configuration
        </p>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div class="mb-4 p-4 bg-amber-950/30 border border-amber-400/50 rounded-lg">
            {warnings.map((warning, i) => (
              <p key={i} class="text-sm text-amber-200">{warning}</p>
            ))}
          </div>
        )}

        {/* Error with upgrade button */}
        {renderError()}

        {/* SQL Input */}
        <div class="space-y-4">
          <textarea
            value={sqlQuery}
            onInput={(e) => setSqlQuery((e.target as HTMLTextAreaElement).value)}
            placeholder="SELECT total_events, lifetime_revenue, current_lifecycle_stage FROM amplitude.users_pivot_src WHERE last_session_date >= CURRENT_DATE - INTERVAL 30 DAYS"
            class="w-full h-48 px-3 py-2 bg-gata-dark/40 border border-gata-green/30 rounded-lg text-gata-cream placeholder-gata-cream/40 font-mono text-sm focus:border-gata-green focus:ring-2 focus:ring-gata-green/20"
          />

          <div class="flex gap-3">
            <button
              type="button"
              onClick={handleExecuteQuery}
              disabled={loading || !sqlQuery.trim() || !client}
              class="flex-1 py-3 bg-gata-green text-gata-dark font-semibold rounded-lg hover:bg-gata-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? '⏳ Executing...' : !client ? '⏳ Connecting...' : '▶️ Generate Pivot Table'}
            </button>
          </div>
        </div>
      </div>
      </div>

      {/* Results View */}
      <div style={{ display: showResults ? 'block' : 'none' }} class="space-y-6">
        {/* Back Button */}
        <div class="flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              setShowResults(false);
              setPivotReport(null);
            }}
            class="px-4 py-2 bg-gata-dark/40 text-gata-cream border border-gata-green/30 rounded-lg hover:bg-gata-dark/60 transition-colors"
          >
            ← Back to Query Builder
          </button>
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div class="p-3 bg-amber-950/30 border border-amber-400/50 rounded-lg">
            {warnings.map((warning, i) => (
              <p key={i} class="text-sm text-amber-200">{warning}</p>
            ))}
          </div>
        )}

        {/* Error with upgrade button */}
        {renderError()}

        {/* Pivot Table - Always at Top */}
        {pivotReport && (
          <div class="bg-gata-dark border border-gata-green/30 rounded-lg shadow-lg p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-bold text-gata-cream">📊 Interactive Pivot Table</h3>
              {queryResults.length > 0 && (
                <p class="text-sm text-gata-cream/70">
                  {queryResults.length.toLocaleString()} rows
                </p>
              )}
            </div>
            <WebDataRocksPivot
              data={pivotReport.data}
              initialSlice={pivotReport.slice}
              onLoadError={handlePivotLoadError}
            />
          </div>
        )}

        {/* SQL Preview */}
        {queryResults.length > 0 && (
          <div class="bg-gata-dark border border-gata-green/30 rounded-lg shadow-lg p-6">
            <h3 class="text-lg font-bold text-gata-cream mb-4">
              📊 SQL Results Preview ({queryResults.length.toLocaleString()} rows)
            </h3>

            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-gata-green/30">
                    {Object.keys(queryResults[0]).map(col => (
                      <th key={col} class="text-left p-2 text-gata-green font-mono text-xs">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {queryResults.slice(0, 5).map((row, i) => (
                    <tr key={i} class="border-b border-gata-green/10">
                      {Object.values(row).map((val: any, j) => (
                        <td key={j} class="p-2 text-gata-cream/80 font-mono text-xs">
                          {typeof val === 'number' ? val.toLocaleString() : String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {queryResults.length > 5 && (
              <p class="text-xs text-gata-cream/60 mt-3">
                Showing first 5 of {queryResults.length.toLocaleString()} rows
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Removed inline UpgradeModal in favor of shared component
