// utils/smarter/webllm-handler.ts
import { CreateMLCEngine } from "@mlc-ai/web-llm";
import { generateWebLLMPrompt } from "./semantic-config.ts";
import { validateAndAnalyzeQuery, generateCorrectionPrompt, type QueryValidationReport } from "./query-validator.ts";
import type { SemanticTable } from "./semantic-amplitude.ts";

export interface QueryResponse {
  dimensions: string[];
  measures: string[];
  filters?: string[];
  explanation: string;
}

export interface QueryGenerationMetrics {
  attemptCount: number;
  validationUsed: boolean;
  initialValid: boolean;
  finalValid: boolean;
  totalTimeMs: number;
  validationReport?: QueryValidationReport;
}

export class WebLLMSemanticHandler {
  private engine: any;
  private systemPrompt: string;
  private modelId: string;
  private useValidation: boolean;

  private static MODEL_TIERS = {
    small: "Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC",
    medium: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    large: "DeepSeek-R1-Distill-Llama-8B-q4f16_1-MLC",
  };

  constructor(
    private semanticTable: SemanticTable,
    tier: "small" | "medium" | "large" = "large",
  ) {
    this.modelId = WebLLMSemanticHandler.MODEL_TIERS[tier];
    this.systemPrompt = generateWebLLMPrompt();
    this.useValidation = tier !== "large";
    
    console.log(`🤖 [WebLLM] Model: ${tier}, Validation: ${this.useValidation ? "enabled" : "disabled"}`);
  }

  async initialize(onProgress?: (progress: any) => void) {
    this.engine = await CreateMLCEngine(this.modelId, {
      initProgressCallback: (progress) => {
        console.log("Loading WebLLM:", progress);
        onProgress?.(progress);
      },
    });
  }

  async generateQuery(userPrompt: string): Promise<{
    query: QueryResponse;
    data: any[];
    metrics: QueryGenerationMetrics;
  }> {
    const startTime = Date.now();
    const metrics: QueryGenerationMetrics = {
      attemptCount: 0,
      validationUsed: this.useValidation,
      initialValid: false,
      finalValid: false,
      totalTimeMs: 0
    };

    console.log("🤖 [WebLLM] Starting query generation...");
    console.log("📝 [WebLLM] User prompt:", userPrompt);

    metrics.attemptCount = 1;
    let querySpec = await this.generateQuerySpec(userPrompt);
    
    if (this.useValidation) {
      const report = validateAndAnalyzeQuery(querySpec);
      metrics.validationReport = report;
      metrics.initialValid = report.valid;

      console.log("🔍 [WebLLM] Validation:", {
        valid: report.valid,
        invalidDims: report.validation.invalidDimensions,
        invalidMeasures: report.validation.invalidMeasures
      });

      while (!report.valid && metrics.attemptCount < 3) {
        metrics.attemptCount++;
        console.log(`🔄 [WebLLM] Retry ${metrics.attemptCount}...`);
        
        const correctionPrompt = generateCorrectionPrompt(report, userPrompt);
        querySpec = await this.generateQuerySpec(correctionPrompt);
        
        const retryReport = validateAndAnalyzeQuery(querySpec);
        if (retryReport.valid) {
          console.log("✅ [WebLLM] Correction successful!");
          metrics.validationReport = retryReport;
          break;
        }
      }

      metrics.finalValid = metrics.validationReport?.valid || false;
    } else {
      metrics.initialValid = true;
      metrics.finalValid = true;
    }

    console.log("🚀 [WebLLM] Executing query...");
    const data = await this.semanticTable.query({
      dimensions: querySpec.dimensions,
      measures: querySpec.measures,
      filters: querySpec.filters,
    });

    metrics.totalTimeMs = Date.now() - startTime;
    console.log(`✅ [WebLLM] Complete in ${metrics.totalTimeMs}ms, attempts: ${metrics.attemptCount}`);

    return { query: querySpec, data, metrics };
  }

  private async generateQuerySpec(prompt: string): Promise<QueryResponse> {
    const completion = await this.engine.chat.completions.create({
      messages: [
        { role: "system", content: this.systemPrompt },
        {
          role: "user",
          content: prompt + "\n\nRemember: Respond with ONLY valid JSON, no markdown.",
        },
      ],
      temperature: 0.0,
      max_tokens: 300,
    });

    const responseText = completion.choices[0].message.content;
    console.log("🔍 [WebLLM] Raw response:", responseText);

    const cleanedText = responseText
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .replace(/^[^{]*/, "")
      .replace(/[^}]*$/, "")
      .trim();

    const querySpec = JSON.parse(cleanedText);
    
    if (!querySpec.measures || !Array.isArray(querySpec.measures)) {
      throw new Error("Invalid query spec: missing measures");
    }

    querySpec.dimensions = querySpec.dimensions || [];
    return querySpec;
  }

  async generateSQLPreview(userPrompt: string): Promise<QueryResponse & { sql: string }> {
    const completion = await this.engine.chat.completions.create({
      messages: [
        { role: "system", content: this.systemPrompt },
        {
          role: "user",
          content: userPrompt + "\n\nRemember: Respond with ONLY valid JSON, no markdown.",
        },
      ],
      temperature: 0.0,
      max_tokens: 300,
    });

    const responseText = completion.choices[0].message.content;
    const cleanedText = responseText
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .replace(/^[^{]*/, "")
      .replace(/[^}]*$/, "")
      .trim();

    const querySpec = JSON.parse(cleanedText);
    querySpec.dimensions = querySpec.dimensions || [];

    const sql = this.semanticTable.generateSQL({
      dimensions: querySpec.dimensions,
      measures: querySpec.measures,
      filters: querySpec.filters,
    });

    return { ...querySpec, sql };
  }

  async chat(prompt: string): Promise<string> {
    const completion = await this.engine.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
    });

    return completion.choices[0].message.content;
  }

  async suggestVisualization(querySpec: QueryResponse, data: any[]) {
    const vizPrompt = `Given this query result:
Dimensions: ${querySpec.dimensions.join(", ")}
Measures: ${querySpec.measures.join(", ")}
Row count: ${data.length}

Suggest the best chart type and configuration. Respond with JSON only:
{
  "type": "bar|line|scatter|funnel|pie|area",
  "x": "column_name",
  "y": "column_name",
  "color": "optional_column",
  "title": "Chart title",
  "reason": "Why this chart type"
}`;

    const completion = await this.engine.chat.completions.create({
      messages: [
        { role: "system", content: this.systemPrompt },
        { role: "user", content: vizPrompt },
      ],
      temperature: 0.2,
      max_tokens: 300,
    });

    const responseText = completion.choices[0].message.content;
    const cleanedText = responseText
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .replace(/^[^{]*/, "")
      .replace(/[^}]*$/, "")
      .trim();

    return JSON.parse(cleanedText);
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
