// utils/smarter/query-generator.ts
import { 
  getSemanticMetadata, 
  type SemanticMetadata,
  type FieldMetadata 
} from "./semantic-config.ts";

/**
 * Filter specification
 */
export interface FilterSpec {
  column: string;
  operator: "=" | "!=" | ">" | "<" | ">=" | "<=" | "IN" | "NOT IN" | "LIKE" | "BETWEEN" | "IS NULL" | "IS NOT NULL";
  value?: any;
  value2?: any; // For BETWEEN
}

/**
 * Measure specification with custom formula support
 */
export interface MeasureSpec {
  column: string | null; // null for COUNT(*)
  aggregation: "count" | "count_distinct" | "sum" | "avg" | "min" | "max";
  filters?: FilterSpec[]; // Inline filters (for CASE WHEN logic)
  alias: string;
  decimals?: number;
}

/**
 * Complete query specification
 */
export interface QuerySpec {
  dimensions?: string[]; // Dimension names from metadata
  measures: MeasureSpec[];
  filters?: FilterSpec[]; // Global filters
  limit?: number;
  orderBy?: { column: string; direction: "asc" | "desc" }[];
}

/**
 * KPI specification (two time periods for comparison)
 */
export interface KPISpec {
  baseMeasure: Omit<MeasureSpec, "alias" | "filters">;
  currentPeriodFilter: FilterSpec[];
  previousPeriodFilter: FilterSpec[];
  alias: string;
}

export class QueryGenerator {
  private metadata: SemanticMetadata;

  constructor() {
    this.metadata = getSemanticMetadata();
  }

  /**
   * Generate SQL for a standard query
   */
  generateSQL(spec: QuerySpec): string {
    const selectParts: string[] = [];

    // Add dimensions
    spec.dimensions?.forEach(dimName => {
      const dimConfig = this.metadata.dimensions[dimName];
      if (!dimConfig) throw new Error(`Unknown dimension: ${dimName}`);
      
      if (dimConfig.transformation) {
        selectParts.push(`(${dimConfig.transformation}) as ${dimName}`);
      } else {
        selectParts.push(`${dimConfig.column} as ${dimName}`);
      }
    });

    // Add measures
    spec.measures.forEach(measure => {
      selectParts.push(this.buildMeasureSQL(measure));
    });

    // Build WHERE clause
    const whereClauses: string[] = [];
    spec.filters?.forEach(filter => {
      whereClauses.push(this.buildFilterSQL(filter));
    });

    // Build ORDER BY
    let orderByClause = "";
    if (spec.orderBy && spec.orderBy.length > 0) {
      orderByClause = `ORDER BY ${spec.orderBy.map(o => `${o.column} ${o.direction.toUpperCase()}`).join(", ")}`;
    }

    const sql = `
SELECT ${selectParts.join(", ")}
FROM ${this.metadata.table}
${whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""}
${spec.dimensions && spec.dimensions.length > 0 ? `GROUP BY ${spec.dimensions.map((_, i) => i + 1).join(", ")}` : ""}
${orderByClause}
${spec.limit ? `LIMIT ${spec.limit}` : ""}
    `.trim();

    return sql;
  }

  /**
   * Generate SQL for KPI card (current vs previous period)
   */
  generateKPISQL(spec: KPISpec): string {
    const currentMeasure: MeasureSpec = {
      ...spec.baseMeasure,
      filters: spec.currentPeriodFilter,
      alias: `${spec.alias}_current`
    };

    const previousMeasure: MeasureSpec = {
      ...spec.baseMeasure,
      filters: spec.previousPeriodFilter,
      alias: `${spec.alias}_previous`
    };

    const sql = `
SELECT 
  ${this.buildMeasureSQL(currentMeasure)},
  ${this.buildMeasureSQL(previousMeasure)}
FROM ${this.metadata.table}
    `.trim();

    return sql;
  }

  /**
   * Build measure SQL with inline filters (for CASE WHEN)
   */
  private buildMeasureSQL(measure: MeasureSpec): string {
    const field = measure.column ? this.metadata.fields[measure.column] : null;
    
    if (measure.filters && measure.filters.length > 0) {
      // Use CASE WHEN for filtered aggregation
      const conditions = measure.filters.map(f => this.buildFilterSQL(f)).join(" AND ");
      
      if (measure.aggregation === "count") {
        return `SUM(CASE WHEN ${conditions} THEN 1 ELSE 0 END) as ${measure.alias}`;
      } else if (measure.aggregation === "count_distinct") {
        // DuckDB doesn't support CASE in COUNT(DISTINCT), so we use conditional aggregation
        return `COUNT(DISTINCT CASE WHEN ${conditions} THEN ${measure.column} ELSE NULL END) as ${measure.alias}`;
      } else {
        return `${measure.aggregation.toUpperCase()}(CASE WHEN ${conditions} THEN ${measure.column} ELSE NULL END) as ${measure.alias}`;
      }
    } else {
      // Standard aggregation
      if (measure.aggregation === "count") {
        return `COUNT(*) as ${measure.alias}`;
      } else if (measure.aggregation === "count_distinct") {
        return `COUNT(DISTINCT ${measure.column}) as ${measure.alias}`;
      } else {
        return `${measure.aggregation.toUpperCase()}(${measure.column}) as ${measure.alias}`;
      }
    }
  }

  /**
   * Build filter SQL
   */
  private buildFilterSQL(filter: FilterSpec): string {
    const column = filter.column;

    switch (filter.operator) {
      case "IN":
        const inValues = Array.isArray(filter.value) ? filter.value : [filter.value];
        return `${column} IN (${inValues.map(v => this.formatValue(v)).join(", ")})`;
      
      case "NOT IN":
        const notInValues = Array.isArray(filter.value) ? filter.value : [filter.value];
        return `${column} NOT IN (${notInValues.map(v => this.formatValue(v)).join(", ")})`;
      
      case "BETWEEN":
        return `${column} BETWEEN ${this.formatValue(filter.value)} AND ${this.formatValue(filter.value2)}`;
      
      case "IS NULL":
        return `${column} IS NULL`;
      
      case "IS NOT NULL":
        return `${column} IS NOT NULL`;
      
      case "LIKE":
        return `${column} LIKE ${this.formatValue(filter.value)}`;
      
      default:
        return `${column} ${filter.operator} ${this.formatValue(filter.value)}`;
    }
  }

  /**
   * Format value for SQL
   */
  private formatValue(value: any): string {
    if (value === null || value === undefined) return "NULL";
    if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`; // Escape quotes
    if (value instanceof Date) return `'${value.toISOString()}'`;
    return String(value);
  }

  /**
   * Get field metadata
   */
  getField(name: string): FieldMetadata | undefined {
    return this.metadata.fields[name];
  }

  /**
   * Get all available dimensions
   */
  getAvailableDimensions(): string[] {
    return Object.keys(this.metadata.dimensions);
  }

  /**
   * Get all available measure base columns
   */
  getAvailableMeasureColumns(): string[] {
    return Object.entries(this.metadata.fields)
      .filter(([_, field]) => 
        field.data_type_category === "discrete" || 
        field.data_type_category === "continuous" ||
        field.md_data_type === "INTEGER" ||
        field.md_data_type === "BIGINT" ||
        field.md_data_type === "DECIMAL"
      )
      .map(([name, _]) => name);
  }
}

/**
 * Helper to create date range filters
 */
export function createDateRangeFilter(
  column: string,
  daysBack: number,
  daysBackEnd?: number
): FilterSpec[] {
  if (daysBackEnd !== undefined) {
    // Period range (e.g., 30-60 days ago)
    return [
      { column, operator: ">=", value: `CURRENT_DATE - INTERVAL '${daysBackEnd} days'` },
      { column, operator: "<", value: `CURRENT_DATE - INTERVAL '${daysBack} days'` }
    ];
  } else {
    // From days back to now
    return [
      { column, operator: ">=", value: `CURRENT_DATE - INTERVAL '${daysBack} days'` }
    ];
  }
}
