// islands/dashboard/smarter_dashboard/SmartDashLoadingPage.tsx
import { useEffect, useState } from "preact/hooks";
import { TableProfiler } from "../../../utils/services/table-profiler.ts";
import { metadataStore } from "../../../utils/services/metadata-store.ts";

export interface LoadingProgress {
  step: "duckdb" | "semantic" | "webllm" | "complete";
  progress: number;
  message: string;
}

interface LoadingPageProps {
  onComplete: (db: any, webllmEngine: any) => void;
  motherDuckToken: string;
}

export default function SmartDashLoadingPage({ onComplete, motherDuckToken }: LoadingPageProps) {
  const [loading, setLoading] = useState<LoadingProgress>({
    step: "duckdb",
    progress: 0,
    message: "Initializing database...",
  });

  useEffect(() => {
    async function initialize() {
      try {
        // Step 1: Initialize MotherDuck connection
        setLoading({
          step: "duckdb",
          progress: 10,
          message: "Loading DuckDB WASM...",
        });

        const { MDConnection, getAsyncDuckDb } = await import("@motherduck/wasm-client");
        
        setLoading({
          step: "duckdb",
          progress: 20,
          message: "Connecting to MotherDuck...",
        });

        const mdConn = await MDConnection.create({ mdToken: motherDuckToken });
        await mdConn.isInitialized();

        setLoading({
          step: "duckdb",
          progress: 30,
          message: "Materializing sessions data locally...",
        });

        // Materialize sessions table using Arrow streaming
        const sessionsResult = await mdConn.evaluateStreamingQuery('SELECT * FROM my_db.amplitude.sessions_fct');
        const sessionsBatches = await sessionsResult.arrowStream.readAll();
        const Arrow = await import('apache-arrow');
        const sessionsArrow = new Arrow.Table(sessionsBatches);

        // Get underlying DuckDB instance for local queries
        const duckdb = await getAsyncDuckDb();
        const localConn = await duckdb.connect();

        // Insert sessions as local table (zero-latency queries)
        await localConn.insertArrowTable(sessionsArrow, { name: 'session_facts' });

        setLoading({
          step: "duckdb",
          progress: 40,
          message: "Materializing users data locally...",
        });

        // Materialize users table
        const usersResult = await mdConn.evaluateStreamingQuery('SELECT * FROM my_db.amplitude.users_fct');
        const usersBatches = await usersResult.arrowStream.readAll();
        const usersArrow = new Arrow.Table(usersBatches);
        await localConn.insertArrowTable(usersArrow, { name: 'users_dim' });

        // Profile tables for WebLLM
        setLoading({
          step: "duckdb",
          progress: 48,
          message: "Profiling sessions table...",
        });
        
        if (await TableProfiler.needsProfiling("session_facts")) {
          const sessionsMetadata = await TableProfiler.profileTable(localConn, "session_facts");
          await metadataStore.saveTableMetadata("session_facts", sessionsMetadata);
        }

        setLoading({
          step: "duckdb",
          progress: 49,
          message: "Profiling users table...",
        });
        
        if (await TableProfiler.needsProfiling("users_dim")) {
              const usersMetadata = await TableProfiler.profileTable(localConn, "users_dim");
              await metadataStore.saveTableMetadata("users_dim", usersMetadata);
        }

        // Step 2: Initialize semantic layer
        setLoading({
          step: "semantic",
          progress: 50,
          message: "Loading semantic layer...",
        });

        const { createSemanticTables } = await import("../../../utils/semantic/semantic-amplitude.ts");
        const semanticTables = createSemanticTables(localConn);

        setLoading({
          step: "semantic",
          progress: 55,
          message: "Semantic layer ready...",
        });

        // Step 3: Initialize WebLLM
        setLoading({
          step: "webllm",
          progress: 60,
          message: "Preparing AI assistant...",
        });

        const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
        
        const engine = await CreateMLCEngine(
          "Llama-3.2-3B-Instruct-q4f16_1-MLC",
          {
            initProgressCallback: (progress) => {
              const webllmProgress = 60 + (progress.progress || 0) * 35;
              setLoading({
                step: "webllm",
                progress: webllmProgress,
                message: progress.text || "Loading language model...",
              });
            },
          },
        );

        setLoading({
          step: "webllm",
          progress: 95,
          message: "Integrating AI with semantic layer...",
        });

        // Step 4: Integrate WebLLM with semantic layer
        const { WebLLMSemanticHandler } = await import("../../../utils/semantic/webllm-handler.ts");
        const llmHandler = new WebLLMSemanticHandler(semanticTables, "medium");
        await llmHandler.initialize();

        setLoading({
          step: "complete",
          progress: 100,
          message: "Setup complete! Loading dashboard...",
        });

        await new Promise((resolve) => setTimeout(resolve, 500));

        // Pass LOCAL connection - all queries run in browser
        onComplete(localConn, llmHandler);
      } catch (error) {
        console.error("Initialization failed:", error);
        setLoading({
          step: "duckdb",
          progress: 0,
          message: `Error: ${error.message}`,
        });
      }
    }

    initialize();
  }, [motherDuckToken]);

  return (
    <div class="min-h-screen bg-gradient-to-br from-gata-dark to-[#186018] flex items-center justify-center p-4">
      <div class="max-w-md w-full">
        <div class="text-center mb-8">
          <h1 class="text-4xl font-bold text-gata-cream mb-2">
            DATA_<span class="text-gata-green">GATA</span> Analytics
          </h1>
          <p class="text-gata-cream/80">Setting up your smart dashboard</p>
        </div>

        <div class="bg-gata-dark/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-gata-green/20">
          <div class="flex justify-center mb-6">
            <div class="relative">
              <div class="w-20 h-20 border-4 border-gata-green/30 rounded-full"></div>
              <div class="w-20 h-20 border-4 border-gata-green rounded-full border-t-transparent animate-spin absolute top-0"></div>
              {loading.step === "complete" && (
                <div class="absolute inset-0 flex items-center justify-center">
                  <svg class="w-10 h-10 text-gata-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
          </div>

          <div class="text-center mb-4">
            <p class="text-lg font-medium text-gata-cream mb-1">
              {loading.message}
            </p>
            <p class="text-sm text-gata-cream/70">
              {loading.step === "duckdb" && "Downloading data from cloud..."}
              {loading.step === "semantic" && "Preparing smart queries..."}
              {loading.step === "webllm" && "Loading AI assistant..."}
              {loading.step === "complete" && "Ready to go!"}
            </p>
          </div>

          <div class="mb-4">
            <div class="flex justify-between text-xs text-gata-cream/70 mb-2">
              <span>Progress</span>
              <span>{Math.round(loading.progress)}%</span>
            </div>
            <div class="w-full bg-gata-dark/60 rounded-full h-3 overflow-hidden border border-gata-green/30">
              <div 
                class="h-3 bg-gradient-to-r from-gata-green to-[#a0d147] rounded-full transition-all duration-500 ease-out"
                style={{ width: `${loading.progress}%` }}
              />
            </div>
          </div>

          <div class="flex justify-between text-xs mt-6">
            <div class={`flex items-center ${loading.progress >= 10 ? "text-gata-green" : "text-gata-cream/40"}`}>
              <div class={`w-2 h-2 rounded-full mr-2 ${loading.progress >= 50 ? "bg-gata-green" : loading.progress >= 10 ? "bg-gata-green/60" : "bg-gata-cream/20"}`} />
              <span class="font-medium">Database</span>
            </div>
            <div class={`flex items-center ${loading.progress >= 50 ? "text-gata-green" : "text-gata-cream/40"}`}>
              <div class={`w-2 h-2 rounded-full mr-2 ${loading.progress >= 60 ? "bg-gata-green" : loading.progress >= 50 ? "bg-gata-green/60" : "bg-gata-cream/20"}`} />
              <span class="font-medium">Semantic</span>
            </div>
            <div class={`flex items-center ${loading.progress >= 60 ? "text-gata-green" : "text-gata-cream/40"}`}>
              <div class={`w-2 h-2 rounded-full mr-2 ${loading.progress >= 95 ? "bg-gata-green" : loading.progress >= 60 ? "bg-gata-green/60" : "bg-gata-cream/20"}`} />
              <span class="font-medium">AI</span>
            </div>
          </div>
        </div>

        <div class="text-center mt-6 text-sm text-gata-cream/70">
          <p>💡 All queries run locally in your browser</p>
        </div>
      </div>
    </div>
  );
}