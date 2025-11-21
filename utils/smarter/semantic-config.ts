// utils/smarter/semantic-config.ts
import sessionsMetadata from "../../static/smarter_utils/semantic-amplitude-metadata.json" with { type: "json" };
import usersMetadata from "../../static/smarter_utils/semantic-users-metadata.json" with { type: "json" };

/**
 * Field metadata - complete information about each column
 */
export interface FieldMetadata {
  description: string;
  md_data_type: string;
  ingest_data_type: string;
  sanitize: boolean;
  data_type_category: "nominal" | "categorical" | "ordinal" | "continuous" | "discrete";
  members: any[] | null;
  group: string | null;
  parent: boolean;
}

/**
 * Dimension configuration
 */
export interface DimensionConfig {
  column: string;
  transformation: string | null;
  filter: string | null;
  sort: string;
}

/**
 * Measure configuration
 */
export interface MeasureConfig {
  column: string | null;
  aggregations: string[];
  formula: string;
  description: string;
  format: "number" | "currency" | "percentage";
  currency?: string;
  decimals: number;
}

/**
 * Complete semantic layer metadata
 */
export interface SemanticMetadata {
  table: string;
  description: string;
  fields: Record<string, FieldMetadata>;
  dimensions: Record<string, DimensionConfig>;
  measures: Record<string, MeasureConfig>;
}

const METADATA_REGISTRY: Record<string, SemanticMetadata> = {
  "sessions": sessionsMetadata as SemanticMetadata,
  "users": usersMetadata as SemanticMetadata
};

/**
 * Get semantic metadata for a table
 */
export function getSemanticMetadata(table?: "sessions" | "users"): SemanticMetadata {
  if (!table) return METADATA_REGISTRY["sessions"];
  return METADATA_REGISTRY[table];
}

/**
 * Get model configuration (for backward compatibility)
 */
export function getModelConfig(table: "sessions" | "users") {
  return getSemanticMetadata(table);
}

/**
 * Data sanitization utilities
 */
export function sanitizeValue(value: any, field: FieldMetadata): any {
  if (!field.sanitize) return value;

  if (value instanceof Uint8Array) {
    let result = 0;
    for (let i = 0; i < Math.min(8, value.length); i++) {
      result += value[i] * Math.pow(256, i);
    }
    return result;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  return value;
}

/**
 * Sanitize an entire row of data
 */
export function sanitizeRow(row: Record<string, any>, metadata: SemanticMetadata): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(row)) {
    const field = metadata.fields[key];
    if (field) {
      sanitized[key] = sanitizeValue(value, field);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Get fields by group
 */
export function getFieldsByGroup(group: string, table?: "sessions" | "users"): string[] {
  const metadata = getSemanticMetadata(table);
  return Object.entries(metadata.fields)
    .filter(([_, field]) => field.group === group)
    .map(([name, _]) => name);
}

/**
 * Get parent dimensions (for hierarchies)
 */
export function getParentDimensions(table?: "sessions" | "users"): string[] {
  const metadata = getSemanticMetadata(table);
  return Object.entries(metadata.fields)
    .filter(([_, field]) => field.parent)
    .map(([name, _]) => name);
}

/**
 * Get available aggregations for a measure
 */
export function getAvailableAggregations(measureName: string, table?: "sessions" | "users"): string[] {
  const metadata = getSemanticMetadata(table);
  const measure = metadata.measures[measureName];
  return measure?.aggregations || [];
}

/**
 * Generate optimized WebLLM prompt
 */
export function generatePivotWebLLMPrompt(table?: "sessions" | "users"): string {
  const metadata = getSemanticMetadata(table);
  
  // Organize dimensions by group
  const dimsByGroup: Record<string, string[]> = {};
  Object.entries(metadata.dimensions).forEach(([dimName, dimConfig]) => {
    const field = metadata.fields[dimConfig.column];
    const group = field?.group || "other";
    if (!dimsByGroup[group]) dimsByGroup[group] = [];
    dimsByGroup[group].push(dimName);
  });

  // Organize measures by type
  const eventMeasures = Object.keys(metadata.measures).filter(m => 
    m.includes("_events") || m.includes("event")
  );
  const rateMeasures = Object.keys(metadata.measures).filter(m => 
    m.includes("_rate") || m.includes("_ratio")
  );
  const countMeasures = Object.keys(metadata.measures).filter(m => 
    (m.includes("count") || m.includes("sessions") || m.includes("users")) && !m.includes("_rate")
  );
  const revenueMeasures = Object.keys(metadata.measures).filter(m => 
    m.includes("revenue")
  );

  return `You are a data analyst. Generate query specs in JSON format ONLY.

# Table: ${metadata.table}
**Description**: ${metadata.description}

## Dimensions (Group By)
${Object.entries(dimsByGroup).map(([group, dims]) => 
  `**${group}**: ${dims.join(", ")}`
).join("\n")}

## Measures (Aggregations)
**Event Counts**: ${eventMeasures.join(", ") || "none"}
**Rates**: ${rateMeasures.join(", ") || "none"}
**Counts**: ${countMeasures.join(", ")}
**Revenue**: ${revenueMeasures.join(", ") || "none"}

# Response Format (CRITICAL - JSON ONLY, NO MARKDOWN)
{
  "dimensions": ["dim1", "dim2"],
  "measures": ["measure1", "measure2"],
  "filters": ["optional filter"],
  "explanation": "what this shows"
}

# IMPORTANT RULES
1. Event columns like interest_events, trial_events are MEASURES (aggregations), NOT dimensions
2. "sum of X by Y" means: dimensions=["Y"], measures=["X"]
3. "X by traffic source" means: dimensions=["traffic_source"], measures=["X"]
4. Always use dimensions for grouping (by), measures for aggregating (sum, count, avg)
5. Respond with ONLY valid JSON - no markdown, no code blocks, no extra text

# Examples
"revenue by traffic source" → {"dimensions":["traffic_source"],"measures":["total_revenue"],"explanation":"Revenue by traffic source"}

"active users by lifecycle stage" → {"dimensions":["lifecycle_stage"],"measures":["active_users_30d"],"explanation":"Active users by lifecycle"}`;
}
