// utils/smarter/dashboard_utils/semantic-query-validator.ts
import { getSemanticMetadata, findDimensionByAlias, findMeasureByAlias } from "./semantic-config.ts";

/**
 * Parsed query structure with user-friendly aliases
 */
export interface ParsedQuery {
  table: string;
  dimensions: Array<{
    alias: string;
    sourceField: string;
    transformation: string | null;
  }>;
  measures: Array<{
    alias: string;
    sourceField: string;
    aggregation: string | null;
    formula: string | null;
    type: 'aggregation' | 'formula';
  }>;
  filters: string[];
  sql: string;
}

/**
 * Validation result with corrections
 */
export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    type: 'alias_as_column' | 'wrong_aggregation' | 'unknown_column' | 'missing_aggregation';
    column: string;
    message: string;
    correction: string;
    fieldMetadata?: any;
  }>;
  warnings: string[];
  correctionPrompt?: string;
}

/**
 * Visualization categorization
 */
interface CategorizedDimensions {
  temporal: string[];
  sequential: string[];
  categorical: string[];
  binary: string[];
}

interface CategorizedMeasures {
  counts: string[];
  rates: string[];
  revenue: string[];
  events: string[];
  averages: string[];
  totals: string[];
}

/**
 * Comprehensive query validation and analysis
 */
export class SemanticQueryValidator {
  private metadata: ReturnType<typeof getSemanticMetadata>;

  constructor(private table: "sessions" | "users" = "sessions") {
    this.metadata = getSemanticMetadata(table);
  }

  /**
   * Validate and parse SQL query
   */
  validate(sql: string): ValidationResult & { parsed?: ParsedQuery } {
    const errors: ValidationResult['errors'] = [];
    const warnings: string[] = [];

    // Extract columns from SELECT
    const selectedColumns = this.extractSelectedColumns(sql);
    
    // Extract GROUP BY columns (dimensions)
    const groupByColumns = this.extractGroupByColumns(sql);
    
    // Validate each selected column
    selectedColumns.forEach(col => {
      const validation = this.validateColumn(col);
      if (validation.error) {
        errors.push(validation.error);
      }
    });

    // Validate GROUP BY columns
    groupByColumns.forEach(col => {
      const validation = this.validateDimension(col);
      if (validation.error) {
        errors.push(validation.error);
      }
    });

    const valid = errors.length === 0;

    // Generate correction prompt if errors exist
    let correctionPrompt: string | undefined;
    if (!valid) {
      correctionPrompt = this.generateCorrectionPrompt(sql, errors);
    }

    // Parse query structure if valid
    let parsed: ParsedQuery | undefined;
    if (valid) {
      parsed = this.parseQuery(sql, selectedColumns, groupByColumns);
    }

    return {
      valid,
      errors,
      warnings,
      correctionPrompt,
      parsed
    };
  }

  /**
   * Extract selected columns from SELECT clause
   */
  private extractSelectedColumns(sql: string): Array<{
    raw: string;
    alias: string | null;
    expression: string;
  }> {
    const selectMatch = sql.match(/SELECT\s+(.*?)\s+FROM/is);
    if (!selectMatch) return [];

    return selectMatch[1].split(',').map(col => {
      col = col.trim();
      
      // Check for alias
      const aliasMatch = col.match(/(.+)\s+AS\s+(\w+)$/i);
      if (aliasMatch) {
        return {
          raw: col,
          alias: aliasMatch[2],
          expression: aliasMatch[1].trim()
        };
      }

      return {
        raw: col,
        alias: null,
        expression: col
      };
    });
  }

  /**
   * Extract GROUP BY columns
   */
  private extractGroupByColumns(sql: string): string[] {
    const groupByMatch = sql.match(/GROUP\s+BY\s+(.+?)(?=\s*(?:ORDER|LIMIT|;|$))/is);
    if (!groupByMatch) return [];

    return groupByMatch[1]
      .split(',')
      .map(col => col.trim())
      .filter(col => col && col !== '');
  }

  /**
   * Validate a single column (could be dimension or measure)
   */
  private validateColumn(col: {
    raw: string;
    alias: string | null;
    expression: string;
  }): { error?: ValidationResult['errors'][0] } {
    const expr = col.expression;

    // Check if it's an aggregation
    const aggMatch = expr.match(/^(SUM|AVG|COUNT|MAX|MIN|COUNT_DISTINCT)\s*\((.+)\)$/i);
    
    if (aggMatch) {
      const aggType = aggMatch[1].toLowerCase();
      const innerExpr = aggMatch[2].trim();
      
      // Check if alias is used as column reference
      if (!col.alias) {
        return { error: {
          type: 'missing_aggregation',
          column: col.raw,
          message: 'Aggregation should have an alias',
          correction: `Add AS alias_name to: ${col.raw}`
        }};
      }

      // Check if the inner expression is a valid source field
      const baseColumn = innerExpr.replace(/DISTINCT\s+/i, '').trim();
      
      if (!this.metadata.fields[baseColumn]) {
        // Check if it's an alias
        const aliasInfo = findMeasureByAlias(baseColumn, this.table);
        if (aliasInfo) {
          return { error: {
            type: 'alias_as_column',
            column: baseColumn,
            message: `Alias "${baseColumn}" used as column reference in aggregation`,
            correction: aliasInfo.type === 'formula' 
              ? `Use: (${aliasInfo.formulaSQL}) AS ${col.alias}`
              : `Use: ${aliasInfo.aggregationType?.toUpperCase()}(${aliasInfo.sourceColumn}) AS ${col.alias}`,
            fieldMetadata: {
              sourceColumn: aliasInfo.sourceColumn,
              type: aliasInfo.type,
              description: aliasInfo.description
            }
          }};
        }

        return { error: {
          type: 'unknown_column',
          column: baseColumn,
          message: `Unknown column "${baseColumn}" in aggregation`,
          correction: `Available fields: ${Object.keys(this.metadata.fields).slice(0, 10).join(', ')}...`
        }};
      }

      // Validate aggregation type matches metadata
      if (col.alias) {
        const measureInfo = findMeasureByAlias(col.alias, this.table);
        if (measureInfo && measureInfo.type === 'aggregation') {
          const expectedAgg = measureInfo.aggregationType;
          if (expectedAgg !== aggType && 
              !(expectedAgg === 'count_distinct' && aggType === 'count' && innerExpr.includes('DISTINCT'))) {
            return { error: {
              type: 'wrong_aggregation',
              column: col.alias,
              message: `Wrong aggregation type: expected ${expectedAgg}, got ${aggType}`,
              correction: `Use: ${expectedAgg.toUpperCase()}(${measureInfo.sourceColumn}) AS ${col.alias}`,
              fieldMetadata: {
                sourceColumn: measureInfo.sourceColumn,
                expectedAggregation: expectedAgg,
                description: measureInfo.description
              }
            }};
          }
        }
      }
    } else {
      // Non-aggregated column - must be a dimension or formula
      const columnName = expr.replace(/.*\./, '').trim();
      
      // Check if it's a field
      if (!this.metadata.fields[columnName]) {
        // Check if it's an alias
        const aliasInfo = findDimensionByAlias(columnName, this.table) || 
                         findMeasureByAlias(columnName, this.table);
        
        if (aliasInfo) {
          if ('transformation' in aliasInfo && aliasInfo.transformation) {
            return { error: {
              type: 'alias_as_column',
              column: columnName,
              message: `Alias "${columnName}" used as column reference`,
              correction: `Use: (${aliasInfo.transformation}) AS ${col.alias || columnName}`,
              fieldMetadata: {
                sourceColumn: aliasInfo.sourceColumn,
                transformation: aliasInfo.transformation,
                description: aliasInfo.description
              }
            }};
          } else if ('formulaSQL' in aliasInfo && aliasInfo.formulaSQL) {
            return { error: {
              type: 'alias_as_column',
              column: columnName,
              message: `Formula alias "${columnName}" used as column reference`,
              correction: `Use: (${aliasInfo.formulaSQL}) AS ${col.alias || columnName}`,
              fieldMetadata: {
                sourceColumn: 'sourceColumn' in aliasInfo ? aliasInfo.sourceColumn : null,
                formula: aliasInfo.formulaSQL,
                description: aliasInfo.description
              }
            }};
          } else {
            return { error: {
              type: 'alias_as_column',
              column: columnName,
              message: `Alias "${columnName}" used as column reference`,
              correction: `Use source field: ${'sourceColumn' in aliasInfo ? aliasInfo.sourceColumn : columnName}`,
              fieldMetadata: {
                sourceColumn: 'sourceColumn' in aliasInfo ? aliasInfo.sourceColumn : null,
                description: aliasInfo.description
              }
            }};
          }
        }

        // Check for CASE statements (formulas)
        if (expr.toUpperCase().includes('CASE')) {
          // Allow CASE statements - these are transformations/formulas
          return {};
        }

        return { error: {
          type: 'unknown_column',
          column: columnName,
          message: `Unknown column "${columnName}"`,
          correction: `Available fields: ${Object.keys(this.metadata.fields).slice(0, 10).join(', ')}...`
        }};
      }
    }

    return {};
  }

  /**
   * Validate dimension in GROUP BY
   */
  private validateDimension(column: string): { error?: ValidationResult['errors'][0] } {
    const columnName = column.replace(/.*\./, '').trim();

    if (!this.metadata.fields[columnName]) {
      const aliasInfo = findDimensionByAlias(columnName, this.table);
      
      if (aliasInfo) {
        return { error: {
          type: 'alias_as_column',
          column: columnName,
          message: `Alias "${columnName}" used in GROUP BY`,
          correction: aliasInfo.transformation 
            ? `Use: (${aliasInfo.transformation})` 
            : `Use source field: ${aliasInfo.sourceColumn}`,
          fieldMetadata: {
            sourceColumn: aliasInfo.sourceColumn,
            transformation: aliasInfo.transformation,
            description: aliasInfo.description
          }
        }};
      }

      return { error: {
        type: 'unknown_column',
        column: columnName,
        message: `Unknown column "${columnName}" in GROUP BY`,
        correction: `Available dimensions: ${Object.keys(this.metadata.dimensions).slice(0, 10).join(', ')}...`
      }};
    }

    return {};
  }

  /**
   * Parse valid query into structured format
   */
  private parseQuery(
    sql: string,
    selectedColumns: ReturnType<typeof this.extractSelectedColumns>,
    groupByColumns: string[]
  ): ParsedQuery {
    const dimensions: ParsedQuery['dimensions'] = [];
    const measures: ParsedQuery['measures'] = [];

    // Parse dimensions from GROUP BY
    groupByColumns.forEach(col => {
      const columnName = col.replace(/.*\./, '').trim();
      const dimConfig = this.metadata.dimensions[columnName];
      
      if (dimConfig) {
        dimensions.push({
          alias: dimConfig.alias_name,
          sourceField: columnName,
          transformation: dimConfig.transformation
        });
      }
    });

    // Parse measures from SELECT
    selectedColumns.forEach(col => {
      if (col.alias) {
        const measureInfo = findMeasureByAlias(col.alias, this.table);
        if (measureInfo) {
          measures.push({
            alias: col.alias,
            sourceField: measureInfo.sourceColumn,
            aggregation: measureInfo.type === 'aggregation' ? measureInfo.aggregationType || null : null,
            formula: measureInfo.type === 'formula' ? measureInfo.formulaSQL || null : null,
            type: measureInfo.type
          });
        }
      }
    });

    // Extract filters
    const filters: string[] = [];
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:GROUP\s+BY|ORDER\s+BY|LIMIT|$)/is);
    if (whereMatch) {
      filters.push(whereMatch[1].trim());
    }

    return {
      table: this.metadata.table,
      dimensions,
      measures,
      filters,
      sql
    };
  }

  /**
   * Generate correction prompt for LLM
   */
  private generateCorrectionPrompt(sql: string, errors: ValidationResult['errors']): string {
    let prompt = `🚨 SQL VALIDATION ERRORS\n\n`;
    prompt += `Your SQL query has ${errors.length} error(s):\n\n`;

    errors.forEach((err, idx) => {
      prompt += `${idx + 1}. ${err.type.toUpperCase()}: ${err.message}\n`;
      prompt += `   Column: ${err.column}\n`;
      prompt += `   Fix: ${err.correction}\n`;
      
      if (err.fieldMetadata) {
        prompt += `   Metadata:\n`;
        Object.entries(err.fieldMetadata).forEach(([key, val]) => {
          if (val) {
            prompt += `     ${key}: ${val}\n`;
          }
        });
      }
      prompt += `\n`;
    });

    prompt += `📋 AVAILABLE FIELDS IN ${this.metadata.table}:\n\n`;
    
    prompt += `DIMENSIONS (use source name, not alias):\n`;
    Object.entries(this.metadata.dimensions).slice(0, 10).forEach(([source, dim]) => {
      prompt += `  • ${source} → "${dim.alias_name}"`;
      if (dim.transformation) {
        prompt += ` [transformed]`;
      }
      prompt += `\n`;
    });

    prompt += `\nMEASURES (use aggregation on source field):\n`;
    Object.entries(this.metadata.measures).slice(0, 10).forEach(([source, measure]) => {
      if (measure.aggregations) {
        measure.aggregations.forEach((agg: any) => {
          const aggType = Object.keys(agg)[0];
          const aggConfig = agg[aggType];
          prompt += `  • ${aggType.toUpperCase()}(${source}) → "${aggConfig.alias}"\n`;
        });
      }
    });

    prompt += `\n⚠️  CRITICAL: Use source column names (not aliases) in your SQL!\n`;
    prompt += `Table: ${this.metadata.table}\n`;

    return prompt;
  }

  /**
   * Analyze query for visualization recommendations
   */
  analyzeForVisualization(parsed: ParsedQuery): {
    queryType: 'kpi' | 'time_series' | 'distribution' | 'comparison' | 'funnel' | 'breakdown';
    recommendedCharts: Array<{
      type: string;
      reason: string;
      priority: number;
    }>;
    dimensionCategories: CategorizedDimensions;
    measureCategories: CategorizedMeasures;
  } {
    const dimCategories = this.categorizeDimensions(parsed.dimensions.map(d => d.alias));
    const measureCategories = this.categorizeMeasures(parsed.measures.map(m => m.alias));
    
    const queryType = this.detectQueryType(dimCategories, measureCategories);
    const recommendations = this.generateChartRecommendations(queryType, dimCategories, measureCategories);

    return {
      queryType,
      recommendedCharts: recommendations,
      dimensionCategories: dimCategories,
      measureCategories
    };
  }

  private categorizeDimensions(dimensionAliases: string[]): CategorizedDimensions {
    const temporal: string[] = [];
    const sequential: string[] = [];
    const categorical: string[] = [];
    const binary: string[] = [];

    dimensionAliases.forEach(alias => {
      // Find source field
      let sourceField: string | null = null;
      for (const [source, dimConfig] of Object.entries(this.metadata.dimensions)) {
        if (dimConfig.alias_name === alias) {
          sourceField = source;
          break;
        }
      }

      if (!sourceField) return;

      const field = this.metadata.fields[sourceField];
      const dimConfig = this.metadata.dimensions[sourceField];

      if (alias.includes('date') || alias.includes('time') || 
          field?.md_data_type === 'DATE' || field?.md_data_type.includes('TIMESTAMP')) {
        temporal.push(alias);
      } else if (dimConfig?.sort?.startsWith('custom:')) {
        sequential.push(alias);
      } else if (field?.md_data_type === 'BOOLEAN' || alias.includes('is_') || alias.includes('has_')) {
        binary.push(alias);
      } else {
        categorical.push(alias);
      }
    });

    return { temporal, sequential, categorical, binary };
  }

  private categorizeMeasures(measureAliases: string[]): CategorizedMeasures {
    const counts: string[] = [];
    const rates: string[] = [];
    const revenue: string[] = [];
    const events: string[] = [];
    const averages: string[] = [];
    const totals: string[] = [];

    measureAliases.forEach(alias => {
      if (alias.includes('_rate') || alias.includes('_ratio') || alias.includes('rate')) {
        rates.push(alias);
      } else if (alias.includes('revenue')) {
        revenue.push(alias);
      } else if (alias.includes('events') || alias.includes('event')) {
        events.push(alias);
      } else if (alias.startsWith('avg_') || alias.includes('_avg')) {
        averages.push(alias);
      } else if (alias.includes('count') || alias.includes('sessions') || alias.includes('visitors') || alias.includes('users')) {
        counts.push(alias);
      } else {
        totals.push(alias);
      }
    });

    return { counts, rates, revenue, events, averages, totals };
  }

  private detectQueryType(dims: CategorizedDimensions, measures: CategorizedMeasures): 'kpi' | 'time_series' | 'distribution' | 'comparison' | 'funnel' | 'breakdown' {
    const totalDims = dims.temporal.length + dims.sequential.length + dims.categorical.length + dims.binary.length;
    
    if (totalDims === 0) return 'kpi';
    if (dims.temporal.length > 0) return 'time_series';
    if (dims.sequential.length > 0) return 'funnel';
    if (totalDims > 1) return 'breakdown';
    if (measures.rates.length > 0 || Object.values(measures).flat().length > 1) return 'comparison';
    return 'distribution';
  }

  private generateChartRecommendations(
    queryType: ReturnType<typeof this.detectQueryType>,
    dims: CategorizedDimensions,
    measures: CategorizedMeasures
  ) {
    const recs: Array<{ type: string; reason: string; priority: number }> = [];

    switch (queryType) {
      case 'kpi':
        recs.push({ type: 'bar', reason: 'Single metric - horizontal bar', priority: 1 });
        break;
      case 'time_series':
        recs.push({ type: 'line', reason: 'Time dimension - line shows trends', priority: 1 });
        recs.push({ type: 'area', reason: 'Time dimension - area shows volume', priority: 2 });
        break;
      case 'funnel':
        recs.push({ type: 'funnel', reason: 'Sequential dimension - funnel shows progression', priority: 1 });
        recs.push({ type: 'bar', reason: 'Ordered categories alternative', priority: 2 });
        break;
      case 'distribution':
        recs.push({ type: 'pie', reason: 'Distribution - pie shows proportions', priority: 1 });
        recs.push({ type: 'bar', reason: 'Distribution - bar for comparison', priority: 2 });
        break;
      case 'comparison':
        recs.push({ type: 'bar', reason: 'Compare metrics across categories', priority: 1 });
        break;
      case 'breakdown':
        recs.push({ type: 'heatmap', reason: 'Multiple dimensions - heatmap shows relationships', priority: 1 });
        break;
    }

    return recs;
  }
}

/**
 * Factory function
 */
export function createQueryValidator(table: "sessions" | "users" = "sessions"): SemanticQueryValidator {
  return new SemanticQueryValidator(table);
}
