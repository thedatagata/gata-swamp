// utils/smarter/semantic-amplitude-pivot-config.ts
import semanticMetadata from "../../static/smarter_utils/semantic-amplitude-metadata.json" with { type: "json" };

/**
 * Field metadata - complete information about each column
 */
export interface FieldMetadata {
  description: string;
  md_data_type: string; // VARCHAR, INTEGER, BIGINT, BOOLEAN, DECIMAL, DATE, TIMESTAMP
  ingest_data_type: string; // string, integer, number, Uint8Array, date, timestamp
  sanitize: boolean; // Whether field needs data type transformation
  data_type_category: "nominal" | "categorical" | "ordinal" | "continuous" | "discrete";
  members: any[] | null; // Unique values if categorical/discrete
  group: string | null; // Logical grouping (temporal, lifecycle, conversion, etc)
  parent: boolean; // Whether this is a parent dimension in a hierarchy
}

/**
 * Dimension configuration - how a field should be used as a dimension
 */
export interface DimensionConfig {
  column: string; // References field name
  transformation: string | null; // SQL transformation (e.g., CASE WHEN for labels)
  filter: string | null; // Default filter to apply
  sort: string; // "asc" | "desc" | "none" | "custom:value1,value2,..."
}

/**
 * Measure configuration - how a field should be aggregated
 */
export interface MeasureConfig {
  column: string | null; // References field name (null for COUNT(*))
  aggregations: string[]; // ["sum", "avg", "count", "count_distinct", "min", "max", "complex"]
  formula: string; // SQL aggregation formula
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

/**
 * Get the complete semantic metadata
 */
export function getSemanticMetadata(): SemanticMetadata {
  return semanticMetadata as SemanticMetadata;
}

/**
 * Data sanitization utilities
 */
export function sanitizeValue(value: any, field: FieldMetadata): any {
  if (!field.sanitize) return value;

  // Handle Uint8Array (DuckDB's way of representing small integers)
  if (value instanceof Uint8Array) {
    let result = 0;
    for (let i = 0; i < Math.min(8, value.length); i++) {
      result += value[i] * Math.pow(256, i);
    }
    return result;
  }

  // Handle BigInt
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
export function getFieldsByGroup(group: string): string[] {
  const metadata = getSemanticMetadata();
  return Object.entries(metadata.fields)
    .filter(([_, field]) => field.group === group)
    .map(([name, _]) => name);
}

/**
 * Get parent dimensions (for hierarchies)
 */
export function getParentDimensions(): string[] {
  const metadata = getSemanticMetadata();
  return Object.entries(metadata.fields)
    .filter(([_, field]) => field.parent)
    .map(([name, _]) => name);
}

/**
 * Get available aggregations for a measure
 */
export function getAvailableAggregations(measureName: string): string[] {
  const metadata = getSemanticMetadata();
  const measure = metadata.measures[measureName];
  return measure?.aggregations || [];
}

/**
 * Generate optimized WebLLM prompt for DeepSeek-R1-Distill-8B
 */
export function generatePivotWebLLMPrompt(): string {
  const metadata = getSemanticMetadata();
  
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
    m.includes("count") || m.includes("sessions") && !m.includes("_rate")
  );
  const revenueMeasures = Object.keys(metadata.measures).filter(m => 
    m.includes("revenue")
  );

  return `You are a data analyst. Generate query specs in JSON format ONLY.

# Table: ${metadata.table}
**Description**: ${metadata.description}

## Dimensions (Group By)
**Temporal**: ${dimsByGroup.temporal?.join(", ") || "none"}
**Lifecycle**: ${dimsByGroup.lifecycle?.join(", ") || "none"}
**Marketing**: ${dimsByGroup.marketing_channel?.join(", ") || "none"}
**User Status**: ${dimsByGroup.user_status?.join(", ") || "none"}
**Monetization**: ${dimsByGroup.monetization?.join(", ") || "none"}
**Funnel**: ${dimsByGroup.funnel?.join(", ") || "none"}

## Measures (Aggregations)
**Event Counts**: ${eventMeasures.join(", ")}
**Rates**: ${rateMeasures.join(", ")}
**Session Counts**: ${countMeasures.join(", ")}
**Revenue**: ${revenueMeasures.join(", ")}

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
"sum of interest events by traffic source" → {"dimensions":["traffic_source"],"measures":["interest_events"],"explanation":"Total interest events by traffic source"}

"conversion rate by weekday" → {"dimensions":["session_weekday_name"],"measures":["activation_rate"],"explanation":"Activation rates by day of week"}

"new vs returning visitors" → {"dimensions":[],"measures":["new_visitor_sessions","returning_visitor_sessions"],"explanation":"New vs returning visitor counts"}`;
}
