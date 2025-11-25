// utils/smarter/semantic-amplitude.ts
import { 
  getSemanticMetadata, 
  findDimensionByAlias, 
  findMeasureByAlias,
  sanitizeRow,
  type SemanticMetadata
} from "./semantic-config.ts";

interface QuerySpec {
  dimensions?: string[];  // Array of dimension ALIASES
  measures?: string[];    // Array of measure ALIASES
  filters?: string[];
  orderBy?: string[];     // Array of columns to order by
  limit?: number;
}

export class SemanticReportObj {
  private metadata: SemanticMetadata;
  private table: "sessions" | "users";

  constructor(private db: any, table?: "sessions" | "users") {
    this.table = table || "sessions";
    this.metadata = getSemanticMetadata(table);
  }

  /**
   * Execute a semantic query using alias names
   */
  async query(opts: QuerySpec) {
    if (!opts.dimensions && !opts.measures) {
      throw new Error("Query must specify at least one dimension or measure");
    }

    const selectCols = [
      ...(opts.dimensions?.map(alias => this.getDimensionSQL(alias)) || []),
      ...(opts.measures?.map(alias => this.getMeasureSQL(alias)) || [])
    ];

    // Build filters
    const allFilters: string[] = [];
    if (opts.filters) {
      allFilters.push(...opts.filters);
    }

    const sql = `
      SELECT ${selectCols.join(", ")}
      FROM ${this.metadata.table}
      ${allFilters.length ? `WHERE ${allFilters.join(" AND ")}` : ""}
      ${opts.dimensions?.length ? `GROUP BY ${opts.dimensions.map((_, i) => i + 1).join(", ")}` : ""}
      ${opts.orderBy?.length ? `ORDER BY ${opts.orderBy.join(", ")}` : ""}
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
   * Generate dimension SQL from alias name
   * Looks up the source column and transformation
   */
  private getDimensionSQL(aliasName: string): string {
    const dimDef = findDimensionByAlias(aliasName, this.table);
    
    if (!dimDef) {
      throw new Error(`Unknown dimension alias: ${aliasName}. Check data catalog for available dimensions.`);
    }
    
    // If there's a transformation, use it
    if (dimDef.transformation) {
      return `(${dimDef.transformation}) as ${aliasName}`;
    }
    
    // Otherwise use the source column directly
    return `${this.metadata.table}.${dimDef.sourceColumn} as ${aliasName}`;
  }

  /**
   * Generate measure SQL from alias name
   * Looks up whether it's an aggregation or formula
   */
  private getMeasureSQL(aliasName: string): string {
    const measureDef = findMeasureByAlias(aliasName, this.table);
    
    if (!measureDef) {
      throw new Error(`Unknown measure alias: ${aliasName}. Check data catalog for available measures.`);
    }
    
    if (measureDef.type === 'aggregation') {
      // Handle special _count column (COUNT(*))
      const columnRef = measureDef.sourceColumn === '_count' 
        ? '*' 
        : `${this.metadata.table}.${measureDef.sourceColumn}`;
      
      let sql: string;
      
      switch (measureDef.aggregationType) {
        case "sum":
          sql = `SUM(${columnRef})`;
          break;
        case "avg":
          sql = `AVG(${columnRef})`;
          break;
        case "count":
          sql = `COUNT(${columnRef})`;
          break;
        case "count_distinct":
          sql = `COUNT(DISTINCT ${columnRef})`;
          break;
        case "max":
          sql = `MAX(${columnRef})`;
          break;
        case "min":
          sql = `MIN(${columnRef})`;
          break;
        default:
          sql = `${measureDef.aggregationType.toUpperCase()}(${columnRef})`;
      }
      
      return `${sql} as ${aliasName}`;
    } else {
      // Use formula SQL directly
      return `(${measureDef.formulaSQL}) as ${aliasName}`;
    }
  }

  /**
   * Generate SQL for preview/debugging
   */
  generateSQL(opts: QuerySpec): string {
    const selectCols = [
      ...(opts.dimensions?.map(alias => this.getDimensionSQL(alias)) || []),
      ...(opts.measures?.map(alias => this.getMeasureSQL(alias)) || [])
    ];

    const allFilters: string[] = [];
    if (opts.filters) {
      allFilters.push(...opts.filters);
    }

    return `
      SELECT ${selectCols.join(", ")}
      FROM ${this.metadata.table}
      ${allFilters.length ? `WHERE ${allFilters.join(" AND ")}` : ""}
      ${opts.dimensions?.length ? `GROUP BY ${opts.dimensions.map((_, i) => i + 1).join(", ")}` : ""}
      ${opts.orderBy?.length ? `ORDER BY ${opts.orderBy.join(", ")}` : ""}
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
