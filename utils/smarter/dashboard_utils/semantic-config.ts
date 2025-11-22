// Import metadata files directly (works in both server and client)
import sessionsMetadataJson from "../../../static/smarter/semantic-sessions-metadata.json" with { type: "json" };
import usersMetadataJson from "../../../static/smarter/semantic-users-metadata.json" with { type: "json" };

// Type definitions for semantic metadata
interface SemanticMetadata {
  table: string;
  description: string;
  fields: {
    [key: string]: {
      description: string;
      md_data_type: string;
      ingest_data_type: string;
      sanitize: boolean;
      data_type_category: string;
      members: any;
    };
  };
  dimensions: {
    [key: string]: {
      alias_name: string;
      transformation: string | null;
      sort?: string;
    };
  };
  measures: {
    [key: string]: {
      aggregations?: any[];
      formula?: any;
      description?: string;
    };
  };
}

/**
 * Get semantic metadata for a table
 * Metadata is imported directly from JSON files, works in both server and client contexts
 */
export function getSemanticMetadata(table?: "sessions" | "users"): SemanticMetadata {
  const selectedTable = table || "sessions";
  return selectedTable === "sessions" ? sessionsMetadataJson : usersMetadataJson;
}

// =============================================================================
// METADATA EXTRACTION FUNCTIONS
// =============================================================================

/**
 * Extract all dimension alias names from metadata
 * These are what users/LLM should use in queries
 */
export function extractAllDimensionNames(table?: "sessions" | "users"): string[] {
  const metadata = getSemanticMetadata(table);
  return Object.values(metadata.dimensions).map(dim => dim.alias_name);
}

/**
 * Extract all measure alias names from metadata
 * Includes both aggregation aliases and formula keys
 */
export function extractAllMeasureNames(table?: "sessions" | "users"): string[] {
  const metadata = getSemanticMetadata(table);
  const measureNames: string[] = [];
  
  Object.entries(metadata.measures).forEach(([baseField, config]) => {
    // Extract aggregation aliases
    if (config.aggregations && Array.isArray(config.aggregations)) {
      config.aggregations.forEach((aggObj: any) => {
        const aggConfig = Object.values(aggObj)[0] as any;
        if (aggConfig.alias) {
          measureNames.push(aggConfig.alias);
        }
      });
    }
    
    // Extract formula keys
    if (config.formula && typeof config.formula === 'object') {
      Object.keys(config.formula).forEach(formulaKey => {
        measureNames.push(formulaKey);
      });
    }
  });
  
  return measureNames;
}

/**
 * Find dimension source column and definition by alias name
 */
export function findDimensionByAlias(aliasName: string, table?: "sessions" | "users"): {
  sourceColumn: string;
  aliasName: string;
  transformation: string | null;
  description: string | null;
} | null {
  const metadata = getSemanticMetadata(table);
  
  for (const [sourceColumn, dimConfig] of Object.entries(metadata.dimensions)) {
    if (dimConfig.alias_name === aliasName) {
      const field = metadata.fields[sourceColumn];
      return {
        sourceColumn,
        aliasName: dimConfig.alias_name,
        transformation: dimConfig.transformation,
        description: field?.description || null
      };
    }
  }
  
  return null;
}

/**
 * Find measure source column and definition by alias name
 * Returns the aggregation type and base column, or formula SQL
 */
export function findMeasureByAlias(aliasName: string, table?: "sessions" | "users"): {
  type: 'aggregation' | 'formula';
  sourceColumn: string;
  aggregationType?: string;  // sum, avg, count, etc.
  formulaSQL?: string;
  description: string | null;
  format?: string;
  decimals?: number;
  currency?: string;
} | null {
  const metadata = getSemanticMetadata(table);
  
  for (const [sourceColumn, measureConfig] of Object.entries(metadata.measures)) {
    // Check aggregations
    if (measureConfig.aggregations && Array.isArray(measureConfig.aggregations)) {
      for (const aggObj of measureConfig.aggregations) {
        const aggType = Object.keys(aggObj)[0];
        const aggConfig = aggObj[aggType];
        
        if (aggConfig.alias === aliasName) {
          return {
            type: 'aggregation',
            sourceColumn,
            aggregationType: aggType,
            description: measureConfig.description || null,
            format: aggConfig.format,
            decimals: aggConfig.decimals,
            currency: aggConfig.currency
          };
        }
      }
    }
    
    // Check formulas
    if (measureConfig.formula && typeof measureConfig.formula === 'object') {
      const formulaConfig = measureConfig.formula[aliasName];
      if (formulaConfig) {
        return {
          type: 'formula',
          sourceColumn,
          formulaSQL: formulaConfig.sql,
          description: formulaConfig.description || measureConfig.description || null,
          format: formulaConfig.format,
          decimals: formulaConfig.decimals,
          currency: formulaConfig.currency
        };
      }
    }
  }
  
  return null;
}

/**
 * Get dimension description by alias for display
 */
export function getDimensionDescription(aliasName: string, table?: "sessions" | "users"): string | null {
  const dim = findDimensionByAlias(aliasName, table);
  return dim?.description || null;
}

/**
 * Get measure description by alias for display
 */
export function getMeasureDescription(aliasName: string, table?: "sessions" | "users"): string | null {
  const measure = findMeasureByAlias(aliasName, table);
  return measure?.description || null;
}

/**
 * Generate comprehensive catalog for UI display
 * Returns alias names with descriptions and source mapping
 */
export function generateDataCatalog(table?: "sessions" | "users"): {
  dimensions: Array<{ 
    alias: string; 
    sourceColumn: string;
    description: string;
    hasTransformation: boolean;
  }>;
  measures: Array<{ 
    alias: string; 
    sourceColumn: string;
    description: string; 
    type: 'aggregation' | 'formula';
    aggregationType?: string;
  }>;
  tableName: string;
  tableDescription: string;
} {
  const metadata = getSemanticMetadata(table);
  
  // Build dimensions catalog
  const dimensions = Object.entries(metadata.dimensions).map(([sourceColumn, dimConfig]) => {
    const field = metadata.fields[sourceColumn];
    return {
      alias: dimConfig.alias_name,
      sourceColumn,
      description: field?.description || `Dimension: ${dimConfig.alias_name}`,
      hasTransformation: !!dimConfig.transformation
    };
  });
  
  // Build measures catalog
  const measures: Array<{
    alias: string;
    sourceColumn: string;
    description: string;
    type: 'aggregation' | 'formula';
    aggregationType?: string;
  }> = [];
  
  Object.entries(metadata.measures).forEach(([sourceColumn, measureConfig]) => {
    // Add aggregations
    if (measureConfig.aggregations && Array.isArray(measureConfig.aggregations)) {
      measureConfig.aggregations.forEach((aggObj: any) => {
        const aggType = Object.keys(aggObj)[0];
        const aggConfig = aggObj[aggType];
        
        if (aggConfig.alias) {
          measures.push({
            alias: aggConfig.alias,
            sourceColumn,
            description: measureConfig.description || `${aggType.toUpperCase()} of ${sourceColumn}`,
            type: 'aggregation',
            aggregationType: aggType
          });
        }
      });
    }
    
    // Add formulas
    if (measureConfig.formula && typeof measureConfig.formula === 'object') {
      Object.entries(measureConfig.formula).forEach(([formulaKey, formulaConfig]: [string, any]) => {
        measures.push({
          alias: formulaKey,
          sourceColumn,
          description: formulaConfig.description || measureConfig.description || `Formula: ${formulaKey}`,
          type: 'formula'
        });
      });
    }
  });
  
  return {
    dimensions,
    measures,
    tableName: metadata.table,
    tableDescription: metadata.description
  };
}

// =============================================================================
// SQL GENERATION FUNCTIONS
// =============================================================================

/**
 * Generate comprehensive SQL generation prompt for LLM
 * Shows LLM how to translate alias names into SQL using source columns
 */
export function generateSQLPrompt(table?: "sessions" | "users"): string {
  const metadata = getSemanticMetadata(table);
  
  // Build dimension translation mappings
  const dimensionMappings: string[] = [];
  Object.entries(metadata.dimensions).forEach(([sourceColumn, dimConfig]) => {
    const alias = dimConfig.alias_name;
    if (dimConfig.transformation) {
      // Has transformation
      dimensionMappings.push(`  "${alias}" → ${dimConfig.transformation}`);
    } else {
      // No transformation - use source column directly
      dimensionMappings.push(`  "${alias}" → ${sourceColumn}`);
    }
  });
  
  // Build measure translation mappings
  const measureMappings: string[] = [];
  Object.entries(metadata.measures).forEach(([sourceColumn, measureConfig]) => {
    // Add aggregations
    if (measureConfig.aggregations && Array.isArray(measureConfig.aggregations)) {
      measureConfig.aggregations.forEach((aggObj: any) => {
        const aggType = Object.keys(aggObj)[0];
        const aggConfig = aggObj[aggType];
        const alias = aggConfig.alias;
        
        let sqlPattern = '';
        switch (aggType) {
          case 'sum':
            sqlPattern = `SUM(${sourceColumn})`;
            break;
          case 'avg':
            sqlPattern = `AVG(${sourceColumn})`;
            break;
          case 'count':
            sqlPattern = `COUNT(${sourceColumn})`;
            break;
          case 'count_distinct':
            sqlPattern = `COUNT(DISTINCT ${sourceColumn})`;
            break;
          case 'max':
            sqlPattern = `MAX(${sourceColumn})`;
            break;
          case 'min':
            sqlPattern = `MIN(${sourceColumn})`;
            break;
          default:
            sqlPattern = `${aggType.toUpperCase()}(${sourceColumn})`;
        }
        
        measureMappings.push(`  "${alias}" → ${sqlPattern}`);
      });
    }
    
    // Add formulas
    if (measureConfig.formula && typeof measureConfig.formula === 'object') {
      Object.entries(measureConfig.formula).forEach(([alias, formulaConfig]: [string, any]) => {
        measureMappings.push(`  "${alias}" → ${formulaConfig.sql}`);
      });
    }
  });

  return `You are a SQL generator for the ${metadata.table} table.
${metadata.description}

USER WILL ASK USING THESE ALIAS NAMES. YOU MUST TRANSLATE TO SQL:

DIMENSIONS (for GROUP BY):
${dimensionMappings.join('\n')}

MEASURES (for SELECT with aggregations):
${measureMappings.join('\n')}

CRITICAL RULES:
1. User uses alias names (e.g., "avg_interest_events")
2. You translate to SQL using the mappings above (e.g., AVG(interest_events))
3. Always use the source column names in your SQL (interest_events, not avg_interest_events)
4. Apply the correct aggregation/transformation as shown in the mapping
5. Table name: ${metadata.table}
6. Output ONLY the SQL query - no markdown, no explanations

EXAMPLES:
User: "avg_interest_events by traffic_source_type"
SQL: SELECT traffic_source_type, AVG(interest_events) as avg_interest_events FROM ${metadata.table} GROUP BY traffic_source_type

User: "total_revenue by session_date"  
SQL: SELECT session_date, SUM(session_revenue) as total_revenue FROM ${metadata.table} GROUP BY session_date

User: "trial_signup_rate by user_status"
SQL: SELECT CASE WHEN is_anonymous = 1 THEN 'Anonymous' ELSE 'Identified' END as user_status, AVG(CASE WHEN trial_signup = 1 THEN 100.0 ELSE 0.0 END) as trial_signup_rate FROM ${metadata.table} GROUP BY user_status`;
}

/**
 * Legacy function - kept for backward compatibility
 * Use generateSQLPrompt instead for SQL generation
 */
export function generatePivotWebLLMPrompt(table?: "sessions" | "users"): string {
  return generateSQLPrompt(table);
}

/**
 * Sanitize a single value (convert Uint8Array and BigInt to Number)
 */
export function sanitizeValue(value: any): any {
  if (typeof value === 'bigint') {
    return Number(value);
  } else if (value instanceof Uint8Array) {
    let result = 0;
    for (let i = 0; i < Math.min(8, value.length); i++) {
      result += value[i] * Math.pow(256, i);
    }
    return result;
  } else if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  return value;
}

/**
 * Sanitize an entire row of data
 */
export function sanitizeRow(row: Record<string, any>, metadata: SemanticMetadata): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(row)) {
    sanitized[key] = sanitizeValue(value);
  }
  
  return sanitized;
}
