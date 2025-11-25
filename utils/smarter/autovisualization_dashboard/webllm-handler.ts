// utils/smarter/autovisualization_dashboard/webllm-handler.ts
import { createQueryAnalyzer } from "../dashboard_utils/query-response-analyzer.ts";
import { CreateMLCEngine } from "@mlc-ai/web-llm";
import { getSemanticMetadata, generateSQLPrompt } from "../dashboard_utils/semantic-config.ts";
import { createQueryValidator } from "../dashboard_utils/semantic-query-validator.ts";
import type { SemanticReportObj } from "../dashboard_utils/semantic-amplitude.ts";

export interface QueryResponse {
  table: "sessions" | "users";
  dimensions: Array<{ alias: string; sourceField: string }>;
  measures: Array<{ alias: string; sourceField: string }>;
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
  errorTypes?: string[];
  executionError?: string;
}

export class WebLLMSemanticHandler {
  private engine: any;
  private modelId: string;
  private useValidation: boolean;
  private maxTokens: number;
  private temperature: number;

  private static MODEL_TIERS = {
    "3b": "Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC",
    "7b": "Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC"
  };

  constructor(
    private semanticTables: { sessions: SemanticReportObj; users: SemanticReportObj },
    tier: "3b" | "7b" = "3b",
    private ldClient?: any
  ) {
    // Flag 4: Get model tier from LaunchDarkly
    if (ldClient) {
      const modelTier = ldClient.variation("smarter-model-tier", "3b");
      const tierKey = modelTier as "3b" | "7b";
      
      this.modelId = WebLLMSemanticHandler.MODEL_TIERS[tierKey];
      this.maxTokens = 500;
      this.temperature = 0.0;
      this.useValidation = tierKey === "3b";
      
      console.log(`🤖 [WebLLM] Model tier: ${modelTier}, Validation: ${this.useValidation ? "on" : "off"}`);
    } else {
      this.modelId = WebLLMSemanticHandler.MODEL_TIERS[tier];
      this.maxTokens = 500;
      this.temperature = 0.0;
      this.useValidation = tier === "3b";
    }
  }

  async initialize(onProgress?: (progress: any) => void) {
    const startTime = performance.now();
    
    this.engine = await CreateMLCEngine(this.modelId, {
      initProgressCallback: (progress) => {
        console.log("Loading WebLLM:", progress);
        onProgress?.(progress);
      },
    });
    
    const loadTime = performance.now() - startTime;
    
    if (this.ldClient && typeof window !== "undefined") {
      this.ldClient.track("performance", {
        type: "metric",
        context: "webllm_initialization",
        component: "WebLLMHandler",
        plan: "smarter",
        metric: "load_time",
        value: loadTime,
        success: true,
        model: this.modelId,
        modelTier: this.getModelTier()
      });
    }
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

    console.log("🤖 [WebLLM] Starting SQL generation...");

    // Get validation strategy
    let shouldValidate = this.useValidation;
    if (this.ldClient) {
      const strategy = this.ldClient.variation("query-validation-strategy", "adaptive");
      if (strategy === "strict") shouldValidate = true;
      else if (strategy === "fast") shouldValidate = false;
    }

    const validator = createQueryValidator(preferredTable);
    let sql: string = "";
    let table = preferredTable;
    let data: any[] = [];

    // Attempt loop (max 3 tries)
    while (metrics.attemptCount < 3) {
      metrics.attemptCount++;
      
      // Generate SQL
      if (metrics.attemptCount === 1) {
        const result = await this.generateSQLFromPrompt(userPrompt, preferredTable);
        sql = result.sql;
        table = result.table;

        // Auto-fix: Ensure temporal dimensions are ordered
        try {
          const parsed = this.parseQueryForChart(sql);
          const analyzer = createQueryAnalyzer(table);
          // Analyze dimensions to find temporal ones
          // We need to pass just the alias names to the analyzer
          const dimAliases = parsed.dimensions.map(d => d.alias);
          // Mock analyze call just to get categories
          // We can access categorizeDimensions directly if we make it public, but analyze is fine
          const analysis = analyzer.analyze({
            dimensions: dimAliases,
            measures: parsed.measures.map(m => m.alias)
          });
          
          if (analysis.dimensionCategories.temporal.length > 0) {
            // Check if ORDER BY exists
            if (!sql.toUpperCase().includes("ORDER BY")) {
              const temporalDim = analysis.dimensionCategories.temporal[0];
              console.log(`⏱️ [WebLLM] Auto-appending ORDER BY for temporal dimension: ${temporalDim}`);
              // Use the alias for ordering
              sql += ` ORDER BY ${temporalDim} ASC`;
            }
          }
        } catch (err) {
          console.warn("⚠️ [WebLLM] Failed to auto-order SQL:", err);
        }

      } else if (shouldValidate) {
        // Retry with correction prompt that includes original intent
        metrics.validationUsed = true;
        const validation = validator.validate(sql);
        console.log(`🔄 [WebLLM] Retry ${metrics.attemptCount} with corrections...`);
        
        // Build correction that preserves user intent
        const correctionWithIntent = `${validation.correctionPrompt}

USER'S ORIGINAL REQUEST: "${userPrompt}"

Fix the errors above while answering the user's request.`;
        
        const result = await this.generateSQLFromPrompt(correctionWithIntent, table);
        sql = result.sql;
      } else {
        break; // Fast mode - no retry
      }
      
      // Only validate on retry attempts
      if (metrics.attemptCount > 1) {
        const validation = validator.validate(sql);
        
        if (metrics.attemptCount === 1) {
          metrics.initialValid = validation.valid;
          metrics.errorTypes = validation.errors.map(e => e.type);
        }
        
        if (!validation.valid) {
          console.warn(`⚠️ [WebLLM] Validation failed:`, validation.errors.map(e => e.message));
          
          if (metrics.attemptCount >= 3) {
          // Throw a specific error that indicates an upgrade is available
          const upgradeError = new Error(`SQL validation failed after 3 attempts. Errors: ${validation.errors.map(e => e.message).join('; ')}`);
          (upgradeError as any).code = 'MODEL_UPGRADE_REQUIRED';
          (upgradeError as any).modelTier = this.model_tier;
          throw upgradeError;
        }
          continue;
        }
      }
      
      // Execute SQL
      try {
        console.log(`🚀 [WebLLM] Executing SQL attempt ${metrics.attemptCount}...`);
        const result = await this.semanticTables[table].db.query(sql);
        data = result.toArray().map((row: any) => row.toJSON());
        
        console.log(`✅ [WebLLM] Success - ${data.length} rows`);
        metrics.finalValid = true;
        
        // Parse query to extract dimensions/measures
        const parsed = this.parseQueryForChart(sql);
        
        const querySpec: QueryResponse = {
          table,
          dimensions: parsed.dimensions,
          measures: parsed.measures,
          filters: parsed.filters,
          explanation: `Analyzing ${parsed.measures.map(m => m.alias).join(', ')} ${parsed.dimensions.length > 0 ? 'by ' + parsed.dimensions.map(d => d.alias).join(', ') : ''}`,
          sql
        };

        metrics.totalTimeMs = Date.now() - startTime;
        
        // Track performance
        if (this.ldClient) {
          this.ldClient.track("ai-model-performance", {
            model: this.modelId,
            success: true,
            attempts: metrics.attemptCount,
            totalTimeMs: metrics.totalTimeMs,
            hadErrors: !metrics.initialValid,
            timestamp: Date.now()
          });
        }

        return { query: querySpec, data, metrics };
        
      } catch (error) {
        metrics.executionError = (error as Error).message;
        console.error(`❌ [WebLLM] Execution failed:`, (error as Error).message);
        
        if (metrics.attemptCount >= 3) {
          const upgradeError = new Error(`SQL execution failed after 3 attempts: ${(error as Error).message}`);
          (upgradeError as any).code = 'MODEL_UPGRADE_REQUIRED';
          (upgradeError as any).modelTier = this.model_tier;
          throw upgradeError;
        }
      }
    }

    const upgradeError = new Error("Query generation failed");
    (upgradeError as any).code = 'MODEL_UPGRADE_REQUIRED';
    (upgradeError as any).modelTier = this.model_tier;
    throw upgradeError;
  }

  private async generateSQLFromPrompt(
    prompt: string,
    preferredTable: "sessions" | "users" = "sessions"
  ): Promise<{ sql: string; table: "sessions" | "users" }> {
    const contextPrompt = generateSQLPrompt(preferredTable);
    const fullPrompt = `${contextPrompt}

User request: "${prompt}"

Generate the SQL query:`;

    const completion = await this.engine.chat.completions.create({
      messages: [{ role: "user", content: fullPrompt }],
      temperature: 0.0,
      max_tokens: 500,
    });

    let response = completion.choices[0].message.content.trim();
    
    // Strip markdown
    response = response.replace(/```sql\n?/gi, '').replace(/```\n?/g, '');
    
    // Extract SELECT
    const selectMatch = response.match(/SELECT[\s\S]+?(?:;|$)/i);
    if (!selectMatch) {
      throw new Error(`LLM did not generate valid SQL`);
    }
    
    const sql = selectMatch[0].replace(/;$/, '').trim();
    console.log("✅ [WebLLM] Generated SQL:", sql);
    
    return { sql, table: preferredTable };
  }

  /**
   * Simple parser for chart generation - extracts measures/dimensions from SQL
   */
  private parseQueryForChart(sql: string): {
    dimensions: Array<{ alias: string; sourceField: string }>;
    measures: Array<{ alias: string; sourceField: string }>;
    filters: string[];
  } {
    const dimensions: Array<{ alias: string; sourceField: string }> = [];
    const measures: Array<{ alias: string; sourceField: string }> = [];
    
    // Extract SELECT columns with aliases
    const selectMatch = sql.match(/SELECT\s+(.*?)\s+FROM/is);
    if (selectMatch) {
      const selectText = selectMatch[1];
      
      // Simple split by commas (not perfect but good enough)
      const cols = selectText.split(/,(?![^(]*\))/);
      
      cols.forEach(col => {
        col = col.trim();
        
        // Extract alias
        const aliasMatch = col.match(/\s+[Aa][Ss]\s+(\w+)$/);
        const alias = aliasMatch ? aliasMatch[1] : null;
        
        if (!alias) return;
        
        // Check if it's an aggregation (measure)
        if (/^(SUM|AVG|COUNT|MAX|MIN)\s*\(/i.test(col)) {
          // Extract field from aggregation
          const fieldMatch = col.match(/\(\s*(?:DISTINCT\s+)?(\w+)\s*\)/i);
          const field = fieldMatch ? fieldMatch[1] : alias;
          
          measures.push({ alias, sourceField: field });
        }
      });
    }
    
    // Extract GROUP BY (dimensions)
    const groupByMatch = sql.match(/GROUP\s+BY\s+(.+?)(?:\s+ORDER|\s+LIMIT|$)/is);
    if (groupByMatch) {
      const groupCols = groupByMatch[1].split(',');
      groupCols.forEach(col => {
        col = col.trim();
        dimensions.push({ 
          alias: col, 
          sourceField: col 
        });
      });
    }
    
    // Extract filters
    const filters: string[] = [];
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+GROUP|\s+ORDER|\s+LIMIT|$)/is);
    if (whereMatch) {
      filters.push(whereMatch[1].trim());
    }
    
    return { dimensions, measures, filters };
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
      tier: this.getModelTier(),
      validationEnabled: this.useValidation
    };
  }
  
  private getModelTier(): "3b" | "7b" {
    return Object.entries(WebLLMSemanticHandler.MODEL_TIERS)
      .find(([_, id]) => id === this.modelId)?.[0] as "3b" | "7b" || "3b";
  }
}
