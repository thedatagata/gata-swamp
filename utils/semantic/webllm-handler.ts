// utils/semantic/webllm-handler.ts
import { CreateMLCEngine } from "@mlc-ai/web-llm";
import { generateWebLLMPrompt, getSemanticConfig } from "./semantic-config.ts";
import type { SemanticTable } from "./semantic-amplitude.ts";

export interface QueryResponse {
  table: "sessions" | "users";
  dimensions: string[];
  measures: string[];
  filters?: string[];
  explanation: string;
}

export class WebLLMSemanticHandler {
  private engine: any;
  private systemPrompt: string;
  private modelId: string;
  private semanticConfig: any;

  // Model tier options
  private static MODEL_TIERS = {
    small: "Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC",
    medium: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    large: "DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC",
  };

  constructor(
    private semanticTables: { sessions: SemanticTable; users: SemanticTable },
    tier: "small" | "medium" | "large" = "medium",
  ) {
    this.modelId = WebLLMSemanticHandler.MODEL_TIERS[tier];
    this.systemPrompt = generateWebLLMPrompt();
    this.semanticConfig = getSemanticConfig();
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
  }> {
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

    // Aggressive markdown stripping and JSON extraction
    let querySpec: QueryResponse;
    try {
      const cleanedText = responseText
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .replace(/^[^{]*/, "")
        .replace(/[^}]*$/, "")
        .trim();

      querySpec = JSON.parse(cleanedText);

      // Validate required fields
      if (!querySpec.table || !querySpec.measures || !Array.isArray(querySpec.measures)) {
        throw new Error("Invalid query spec structure: missing table or measures");
      }

      querySpec.dimensions = querySpec.dimensions || [];
    } catch (error) {
      console.error("Raw LLM response:", responseText);
      throw new Error(`Failed to parse WebLLM response: ${error.message}`);
    }

    // Validate dimensions/measures exist in semantic layer
    const table = this.semanticTables[querySpec.table];
    const metadata = table.getMetadata();

    querySpec.dimensions?.forEach((dim) => {
      if (!metadata.dimensions[dim]) {
        throw new Error(
          `Unknown dimension: ${dim}. Available: ${Object.keys(metadata.dimensions).join(", ")}`,
        );
      }
    });

    querySpec.measures?.forEach((measure) => {
      if (!metadata.measures[measure]) {
        throw new Error(
          `Unknown measure: ${measure}. Available: ${Object.keys(metadata.measures).join(", ")}`,
        );
      }
    });

    // Execute query using semantic layer
    const data = await table.query({
      dimensions: querySpec.dimensions,
      measures: querySpec.measures,
      filters: querySpec.filters,
    });

    return { query: querySpec, data };
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

    // Parse JSON response
    let querySpec: QueryResponse;
    try {
      const cleanedText = responseText
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .replace(/^[^{]*/, "")
        .replace(/[^}]*$/, "")
        .trim();

      querySpec = JSON.parse(cleanedText);

      if (!querySpec.table || !querySpec.measures) {
        throw new Error("Invalid query spec");
      }

      querySpec.dimensions = querySpec.dimensions || [];
    } catch (error) {
      console.error("Raw LLM response:", responseText);
      throw new Error(`Failed to parse WebLLM response: ${error.message}`);
    }

    // Generate SQL representation
    const table = this.semanticTables[querySpec.table];
    const sql = table.generateSQL({
      dimensions: querySpec.dimensions,
      measures: querySpec.measures,
      filters: querySpec.filters,
    });

    return { ...querySpec, sql };
  }

  async chat(prompt: string): Promise<string> {
    const completion = await this.engine.chat.completions.create({
      messages: [
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    return completion.choices[0].message.content;
  }

  async suggestVisualization(querySpec: QueryResponse, data: any[]) {
    const vizPrompt = `Given this query result:
Table: ${querySpec.table}
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
    };
  }
}
