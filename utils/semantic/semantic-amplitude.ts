// utils/semantic/semantic-amplitude.ts
import { getModelConfig, type ModelConfig } from "./semantic-config.ts";

interface QuerySpec {
  dimensions?: string[];
  measures?: string[];
  filters?: string[];
  limit?: number;
}

export class SemanticTable {
  private config: ModelConfig;

  constructor(
    private db: any, // MDConnection
    private modelName: "sessions" | "users"
  ) {
    this.config = getModelConfig(modelName);
  }

  async query(opts: QuerySpec) {
    const selectCols = [
      ...(opts.dimensions?.map(d => this.getDimensionSQL(d)) || []),
      ...(opts.measures?.map(m => this.getMeasureSQL(m)) || [])
    ];

    // Replace _.  with table name in filters
    const filters = opts.filters?.map(f => f.replace(/_\./g, this.config.table + ".")) || [];

    const sql = `
      SELECT ${selectCols.join(", ")}
      FROM ${this.config.table}
      ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
      ${opts.dimensions?.length ? `GROUP BY ${opts.dimensions.map((_, i) => i + 1).join(", ")}` : ""}
      ${opts.limit ? `LIMIT ${opts.limit}` : ""}
    `;

    const result = await this.db.query(sql);
    return result.toArray().map(row => row.toJSON());
  }

  private getDimensionSQL(name: string): string {
    const dim = this.config.dimensions[name];
    if (!dim) throw new Error(`Unknown dimension: ${name}`);
    
    if (dim.sql) {
      const sql = dim.sql.replace(/_\./g, this.config.table + ".");
      return `(${sql}) as ${name}`;
    }
    const column = dim.column?.replace(/_\./g, this.config.table + ".");
    return `${column} as ${name}`;
  }

  private getMeasureSQL(name: string): string {
    const measure = this.config.measures[name];
    if (!measure) throw new Error(`Unknown measure: ${name}`);
    
    const agg = measure.aggregation.replace(/_\./g, this.config.table + ".");
    return `(${agg}) as ${name}`;
  }

  generateSQL(opts: QuerySpec): string {
    const selectCols = [
      ...(opts.dimensions?.map(d => this.getDimensionSQL(d)) || []),
      ...(opts.measures?.map(m => this.getMeasureSQL(m)) || [])
    ];

    return `
      SELECT ${selectCols.join(", ")}
      FROM ${this.config.table}
      ${opts.filters?.length ? `WHERE ${opts.filters.join(" AND ")}` : ""}
      ${opts.dimensions?.length ? `GROUP BY ${opts.dimensions.map((_, i) => i + 1).join(", ")}` : ""}
      ${opts.limit ? `LIMIT ${opts.limit}` : ""}
    `.trim();
  }

  getMetadata() {
    return {
      table: this.config.table,
      description: this.config.description,
      dimensions: this.config.dimensions,
      measures: this.config.measures
    };
  }
}

export function createSemanticTables(db: any) {
  return {
    sessions: new SemanticTable(db, "sessions"),
    users: new SemanticTable(db, "users")
  };
}
