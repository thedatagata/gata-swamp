// utils/scripts/rebuild-semantic-metadata.ts
// Rebuild semantic metadata from database SUMMARIZE

import { MDConnection } from "@motherduck/wasm-client";

const MOTHERDUCK_TOKEN = Deno.env.get("MOTHERDUCK_TOKEN")!;

interface FieldMetadata {
  description: string;
  md_data_type: string;
  ingest_data_type: string;
  sanitize: boolean;
  data_type_category: "categorical" | "continuous" | "numerical";
  members: any[] | null;
}

interface MeasureConfig {
  aggregations: Array<Record<string, { alias: string }>> | [];
  alias_name?: string[];
  formula: string;
  description: string;
  format: "number" | "currency" | "percentage";
  currency?: string;
  decimals: number;
}

async function getSummarize(mdConn: any, table: string) {
  const result = await mdConn.evaluateStreamingQuery(`SUMMARIZE ${table}`);
  const batches = await result.arrowStream.readAll();
  const Arrow = await import('apache-arrow');
  const arrowTable = new Arrow.Table(batches);
  return arrowTable.toArray().map((row: any) => row.toJSON());
}

function categorizeField(summary: any): FieldMetadata {
  const colName = summary.column_name;
  const colType = summary.column_type;
  const approxUnique = summary.approx_unique || 0;
  const min = summary.min;
  const max = summary.max;
  
  // Determine data_type_category
  let category: "categorical" | "continuous" | "numerical";
  let members: any[] | null = null;
  
  if (colType.includes('VARCHAR') || colType.includes('BOOL')) {
    // String/boolean fields
    if (approxUnique <= 20) {
      category = "categorical";
      // For categorical, we'd need to query distinct values separately
      members = []; // Placeholder - would need actual query
    } else {
      category = "categorical";
      members = null;
    }
  } else if (colType.includes('INT') || colType.includes('DECIMAL')) {
    // Numeric fields
    if (approxUnique <= 50) {
      category = "numerical";
      members = null; // Low cardinality numerical don't get members
    } else {
      category = "continuous";
      members = null;
    }
  } else if (colType.includes('DATE') || colType.includes('TIMESTAMP')) {
    category = "continuous";
    members = null;
  } else {
    category = "numerical";
    members = null;
  }
  
  return {
    description: summary.column_name.replace(/_/g, ' '),
    md_data_type: colType,
    ingest_data_type: mapIngestType(colType),
    sanitize: colType.includes('UINT8') || colType.includes('BIGINT'),
    data_type_category: category,
    members
  };
}

function mapIngestType(mdType: string): string {
  if (mdType.includes('VARCHAR')) return 'string';
  if (mdType.includes('INT')) return 'Uint8Array';
  if (mdType.includes('DECIMAL')) return 'number';
  if (mdType.includes('BOOL')) return 'Uint8Array';
  if (mdType.includes('DATE')) return 'date';
  if (mdType.includes('TIMESTAMP')) return 'timestamp';
  return 'string';
}

function buildMeasures(fields: Record<string, FieldMetadata>): Record<string, MeasureConfig> {
  const measures: Record<string, MeasureConfig> = {};
  
  // Event count columns
  const eventCols = ['interest_events', 'consideration_events', 'trial_events', 
                     'activation_events', 'retention_events', 'total_events'];
  
  for (const col of eventCols) {
    if (fields[col]) {
      measures[col] = {
        aggregations: [
          { sum: { alias: `total_${col}` } },
          { avg: { alias: `avg_${col}` } },
          { min: { alias: `min_${col}` } },
          { max: { alias: `max_${col}` } }
        ],
        formula: "",
        description: `Descriptive statistics for ${col.replace(/_/g, ' ')}`,
        format: "number",
        decimals: 1
      };
    }
  }
  
  // Boolean rate columns
  const rateCols = [
    { col: 'trial_signup', alias: 'trial_signup_rate', desc: 'Trial signup conversion rate' },
    { col: 'paying_customer', alias: 'paying_customer_rate', desc: 'Paying customer rate' },
    { col: 'activation_stage_reached', alias: 'activation_rate', desc: 'Activation rate' },
    { col: 'purchased_plan', alias: 'purchase_rate', desc: 'Purchase conversion rate' }
  ];
  
  for (const { col, alias, desc } of rateCols) {
    if (fields[col]) {
      measures[col] = {
        alias_name: [alias],
        aggregations: [],
        formula: `AVG(CASE WHEN ${col} = 1 THEN 100.0 ELSE 0.0 END)`,
        description: desc,
        format: "percentage",
        decimals: 1
      };
    }
  }
  
  // Revenue
  if (fields.session_revenue) {
    measures.session_revenue = {
      aggregations: [
        { sum: { alias: 'total_revenue' } },
        { avg: { alias: 'avg_revenue_per_session' } }
      ],
      formula: "",
      description: "Revenue metrics",
      format: "currency",
      currency: "USD",
      decimals: 2
    };
  }
  
  // Special measures
  measures._count = {
    aggregations: [{ count: { alias: 'session_count' } }],
    formula: "",
    description: "Total sessions",
    format: "number",
    decimals: 0
  };
  
  if (fields.cookie_id) {
    measures.cookie_id = {
      aggregations: [{ count_distinct: { alias: 'unique_visitors' } }],
      formula: "",
      description: "Unique visitors",
      format: "number",
      decimals: 0
    };
  }
  
  return measures;
}

// Main execution
console.log("🔗 Connecting to MotherDuck...");
const mdConn = await MDConnection.create({ mdToken: MOTHERDUCK_TOKEN });
await mdConn.isInitialized();

console.log("📊 Getting SUMMARIZE for sessions...");
const sessionsSummary = await getSummarize(mdConn, "my_db.amplitude.sessions_pivot_src");

console.log("🏗️  Building fields metadata...");
const fields: Record<string, FieldMetadata> = {};
for (const row of sessionsSummary) {
  fields[row.column_name] = categorizeField(row);
}

console.log("📐 Building measures metadata...");
const measures = buildMeasures(fields);

const metadata = {
  table: "session_facts",
  description: "Session-level analytics with lifecycle stages and event tracking",
  fields,
  dimensions: buildDimensions(fields),
  measures
};

await Deno.writeTextFile(
  './static/smarter_utils/semantic-amplitude-metadata.json',
  JSON.stringify(metadata, null, 2)
);

console.log("✅ Metadata rebuilt!");
console.log(`   ${Object.keys(fields).length} fields`);
console.log(`   ${Object.keys(measures).length} measures`);

function buildDimensions(fields: Record<string, FieldMetadata>) {
  const dims: any = {};
  
  for (const [name, field] of Object.entries(fields)) {
    if (field.data_type_category === 'categorical') {
      dims[name] = {
        column: name,
        transformation: null,
        filter: null,
        sort: "none"
      };
    }
  }
  
  return dims;
}
