// utils/smarter/webllm-handler.ts
import { CreateMLCEngine } from "@mlc-ai/web-llm";
import { getSemanticMetadata } from "./semantic-config.ts";
import { 
  validateSQLColumns, 
  generateCorrectionPrompt as generateSQLCorrectionPrompt 
} from "./sql-column-extractor.ts";
import type { SemanticReportObj } from "./semantic-amplitude.ts";

export interface QueryResponse {
  table: "sessions" | "users";
  dimensions: string[];
  measures: string[];
  filters?: string[];
  explanation: string;
  sql: string;
}

export interface QueryGenerationMetrics {
  attemptCount: number;
  validationUsed: boolean;
  initialValid: boolean;
  finalValid: boolean;
  totalTimeMs: number;
  invalidColumns?: string[];
  executionError?: string;
}

export class WebLLMSemanticHandler {
  private engine: any;
  private modelId: string;
  private useValidation: boolean;
  private maxTokens: number;
  private temperature: number;

  private static MODEL_TIERS = {
    small: "Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC",
    medium: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    large: "Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC"
  };

  constructor(
    private semanticTables: { sessions: SemanticReportObj; users: SemanticReportObj },
    tier: "small" | "medium" | "large" = "large",
    private ldClient?: any
  ) {
    // Flag 2: Get AI model config from LaunchDarkly
    if (ldClient) {
      const modelConfig = ldClient.variation("webllm-model-config", {
        model: "Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC",
        tier: "large",
        maxTokens: 500,
        temperature: 0.0
      });
      
      this.modelId = modelConfig.model;
      this.maxTokens = modelConfig.maxTokens;
      this.temperature = modelConfig.temperature;
      this.useValidation = modelConfig.tier !== "large";
      
      console.log(`🤖 [WebLLM] Model config from LaunchDarkly:`, modelConfig);
      
      // Track model loaded for experimentation
      ldClient.track("ai-model-loaded", {
        model: this.modelId,
        tier: modelConfig.tier
      });
    } else {
      // Fallback to hardcoded
      this.modelId = WebLLMSemanticHandler.MODEL_TIERS[tier];
      this.maxTokens = 500;
      this.temperature = 0.0;
      this.useValidation = tier !== "large";
    }
    
    console.log(`🤖 [WebLLM] Model: ${this.modelId}, Validation: ${this.useValidation ? "enabled" : "disabled"}`);
  }

  async initialize(onProgress?: (progress: any) => void) {
    this.engine = await CreateMLCEngine(this.modelId, {
      initProgressCallback: (progress) => {
        console.log("Loading WebLLM:", progress);
        onProgress?.(progress);
      },
    });
  }

  async generateQuery(userPrompt: string, preferredTable: "sessions" | "users" = "sessions"): Promise<{
    query: QueryResponse;
    data: any[];
    metrics: QueryGenerationMetrics;
  }> {
    const startTime = Date.now();
    const metrics: QueryGenerationMetrics = {
      attemptCount: 0,
      validationUsed: false,
      initialValid: false,
      finalValid: false,
      totalTimeMs: 0
    };

    console.log("🤖 [WebLLM] Starting SQL generation from prompt...");
    console.log("📝 [WebLLM] User prompt:", userPrompt);

    // Flag 4: Get query validation strategy
    let shouldValidate = this.useValidation; // default based on model tier
    if (this.ldClient) {
      const strategy = this.ldClient.variation("query-validation-strategy", "adaptive");
      console.log(`🔍 [WebLLM] Validation strategy: ${strategy}`);
      
      if (strategy === "strict") {
        shouldValidate = true;
      } else if (strategy === "fast") {
        shouldValidate = false;
      }
      // "adaptive" uses default this.useValidation
    }

    let sql: string;
    let table = preferredTable;
    let data: any[] = [];
    let lastError: Error | null = null;

    // Try up to 3 attempts
    while (metrics.attemptCount < 3) {
      metrics.attemptCount++;
      
      // STEP 1: Generate SQL
      if (metrics.attemptCount === 1) {
        const result = await this.generateSQLFromPrompt(userPrompt, preferredTable);
        sql = result.sql;
        table = result.table;
      } else if (shouldValidate) {
        // Use validation feedback for retry (only if validation enabled)
        metrics.validationUsed = true;
        const validation = validateSQLColumns(sql!, table);
        const correctionPrompt = generateSQLCorrectionPrompt(
          userPrompt,
          validation.invalid,
          table
        );
        console.log(`🔄 [WebLLM] Retry ${metrics.attemptCount} with validation feedback...`);
        const result = await this.generateSQLFromPrompt(correctionPrompt, table);
        sql = result.sql;
      } else {
        // Fast mode - no retry, just fail
        break;
      }
      
      // STEP 2: Try to execute SQL directly
      try {
        console.log(`🚀 [WebLLM] Attempt ${metrics.attemptCount}: Executing SQL...`);
        const semanticTable = this.semanticTables[table];
        
        // Parse columns from SQL to build query spec
        const validation = validateSQLColumns(sql!, table);
        
        if (metrics.attemptCount === 1) {
          metrics.initialValid = validation.invalid.length === 0;
          metrics.invalidColumns = validation.invalid;
        }
        
        // Execute query with validated columns
        data = await semanticTable.query({
          dimensions: validation.valid.dimensions,
          measures: validation.valid.measures
        });
        
        console.log(`✅ [WebLLM] Query succeeded on attempt ${metrics.attemptCount}`);
        metrics.finalValid = true;
        break;
        
      } catch (error) {
        lastError = error as Error;
        metrics.executionError = error.message;
        console.error(`❌ [WebLLM] Attempt ${metrics.attemptCount} failed:`, error.message);
        
        // Don't retry if we've hit max attempts
        if (metrics.attemptCount >= 3) {
          throw new Error(`SQL generation failed after 3 attempts. Last error: ${error.message}`);
        }
      }
    }
    
    // STEP 3: Build final query response
    const validation = validateSQLColumns(sql!, table);
    const querySpec: QueryResponse = {
      table,
      dimensions: validation.valid.dimensions,
      measures: validation.valid.measures,
      explanation: `Generated from: ${userPrompt}`,
      sql: sql!
    };

    metrics.totalTimeMs = Date.now() - startTime;
    console.log(`✅ [WebLLM] Complete in ${metrics.totalTimeMs}ms, attempts: ${metrics.attemptCount}`);

    // Track query performance for experimentation
    if (this.ldClient) {
      this.ldClient.track("ai-model-performance", {
        model: this.modelId,
        success: metrics.finalValid,
        attempts: metrics.attemptCount,
        totalTimeMs: metrics.totalTimeMs,
        timestamp: Date.now()
      });
    }

    return { query: querySpec, data, metrics };
  }

  /**
   * Generate SQL from natural language (returns plain SQL text)
   */
  private async generateSQLFromPrompt(
    prompt: string,
    preferredTable: "sessions" | "users" = "sessions"
  ): Promise<{ sql: string; table: "sessions" | "users" }> {
    const metadata = getSemanticMetadata(preferredTable);
    
    // Build concise context (top 15 fields to prevent token overflow)
    const dims = Object.keys(metadata.dimensions).slice(0, 15).join(", ");
    const meas = Object.keys(metadata.measures).slice(0, 15).join(", ");
    
    const systemPrompt = `You are a SQL generator. Output ONLY SQL code, nothing else.

Request: "${prompt}"
Table: ${metadata.table}
Dimensions: ${dims}
Measures: ${meas}

Generate a SELECT query using these fields. Output SQL only:`;

    const completion = await this.engine.chat.completions.create({
      messages: [{ role: "user", content: systemPrompt }],
      temperature: 0.0,
      max_tokens: 500,  // Increased for DeepSeek reasoning
    });

    let response = completion.choices[0].message.content.trim();
    console.log("🔍 [WebLLM] Raw response:", response);
    
    // Strip everything before SELECT and after semicolon
    const selectMatch = response.match(/SELECT[\s\S]+?(?:;|$)/i);
    if (!selectMatch) {
      throw new Error(`LLM did not generate SQL. Try switching to Qwen model. Response: ${response.substring(0, 200)}`);
    }
    
    const sql = selectMatch[0].replace(/;$/, '').trim();
    console.log("✅ [WebLLM] Extracted SQL:", sql);
    
    return { sql, table: preferredTable };
  }

  async chat(prompt: string): Promise<string> {
    const completion = await this.engine.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
    });

    return completion.choices[0].message.content;
  }

  getModelInfo() {
    return {
      modelId: this.modelId,
      tier: Object.entries(WebLLMSemanticHandler.MODEL_TIERS)
        .find(([_, id]) => id === this.modelId)?.[0] || "unknown",
      validationEnabled: this.useValidation
    };
  }
}
