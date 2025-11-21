// utils/smarter/semantic-amplitude.ts
import { 
  getSemanticMetadata, 
  sanitizeRow,
  type SemanticMetadata,
  type DimensionConfig,
  type MeasureConfig 
} from "./semantic-config.ts";

interface QuerySpec {
  dimensions?: string[];
  measures?: string[];
  filters?: string[];
  limit?: number;
}

export class SemanticReportObj {
  private metadata: SemanticMetadata;

  constructor(private db: any, table?: "sessions" | "users") {
    this.metadata = getSemanticMetadata(table);
  }

  /**
   * Execute a semantic query
   */
  async query(opts: QuerySpec) {
    const selectCols = [
      ...(opts.dimensions?.map(d => this.getDimensionSQL(d)) || []),
      ...(opts.measures?.map(m => this.getMeasureSQL(m)) || [])
    ];

    // Apply default filters from dimension configs + user filters
    const allFilters: string[] = [];
    
    // Add dimension default filters
    opts.dimensions?.forEach(dimName => {
      const dimConfig = this.metadata.dimensions[dimName];
      if (dimConfig?.filter) {
        allFilters.push(dimConfig.filter);
      }
    });
    
    // Add user-provided filters
    if (opts.filters) {
      allFilters.push(...opts.filters);
    }

    // Replace _.  placeholders with actual table name
    const filters = allFilters.map(f => 
      f.replace(/_\./g, this.metadata.table + ".")
    );

    const sql = `
      SELECT ${selectCols.join(", ")}
      FROM ${this.metadata.table}
      ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
      ${opts.dimensions?.length ? `GROUP BY ${opts.dimensions.map((_, i) => i + 1).join(", ")}` : ""}
      ${opts.limit ? `LIMIT ${opts.limit}` : ""}
    `.trim();

    console.log("🔍 [SemanticTable] Generated SQL:", sql);

    const result = await this.db.query(sql);
    const rows = result.toArray().map((row: any) => row.toJSON());
    
    // Sanitize data (handle Uint8Array and BigInt)
    const sanitized = rows.map((row: any) => sanitizeRow(row, this.metadata));
    
    console.log(`✅ [SemanticTable] Query returned ${sanitized.length} rows`);
    return sanitized;
  }

  /**
   * Generate dimension SQL with optional transformation
   */
  private getDimensionSQL(name: string): string {
    const dimConfig = this.metadata.dimensions[name];
    if (!dimConfig) {
      throw new Error(`Unknown dimension: ${name}. Available: ${Object.keys(this.metadata.dimensions).join(", ")}`);
    }
    
    // If transformation exists, use it
    if (dimConfig.transformation) {
      const sql = dimConfig.transformation.replace(/_\./g, this.metadata.table + ".");
      return `(${sql}) as ${name}`;
    }
    
    // Otherwise use the column directly
    const column = `${this.metadata.table}.${dimConfig.column}`;
    return `${column} as ${name}`;
  }

  /**
   * Generate measure SQL using formula
   */
  private getMeasureSQL(name: string): string {
    const measureConfig = this.metadata.measures[name];
    if (!measureConfig) {
      throw new Error(`Unknown measure: ${name}. Available: ${Object.keys(this.metadata.measures).join(", ")}`);
    }
    
    // Use the formula, replacing _.  with table name
    const formula = measureConfig.formula.replace(/_\./g, this.metadata.table + ".");
    return `(${formula}) as ${name}`;
  }

  /**
   * Generate SQL for preview/debugging
   */
  generateSQL(opts: QuerySpec): string {
    const selectCols = [
      ...(opts.dimensions?.map(d => this.getDimensionSQL(d)) || []),
      ...(opts.measures?.map(m => this.getMeasureSQL(m)) || [])
    ];

    // Apply default filters from dimension configs + user filters
    const allFilters: string[] = [];
    
    opts.dimensions?.forEach(dimName => {
      const dimConfig = this.metadata.dimensions[dimName];
      if (dimConfig?.filter) {
        allFilters.push(dimConfig.filter);
      }
    });
    
    if (opts.filters) {
      allFilters.push(...opts.filters);
    }

    const filters = allFilters.map(f => 
      f.replace(/_\./g, this.metadata.table + ".")
    );

    return `
      SELECT ${selectCols.join(", ")}
      FROM ${this.metadata.table}
      ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
      ${opts.dimensions?.length ? `GROUP BY ${opts.dimensions.map((_, i) => i + 1).join(", ")}` : ""}
      ${opts.limit ? `LIMIT ${opts.limit}` : ""}
    `.trim();
  }

  /**
   * Get metadata for UI/debugging
   */
  getMetadata() {
    return {
      table: this.metadata.table,
      description: this.metadata.description,
      dimensions: this.metadata.dimensions,
      measures: this.metadata.measures,
      fields: this.metadata.fields
    };
  }
}

/**
 * Factory function to create semantic table
 */
export function createSemanticReportObj(db: any, table?: "sessions" | "users"): SemanticReportObj {
  return new SemanticReportObj(db, table);
}

/**
 * Create semantic tables for both sessions and users
 */
export function createSemanticTables(db: any) {
  return {
    sessions: new SemanticReportObj(db, "sessions"),
    users: new SemanticReportObj(db, "users")
  };
}
