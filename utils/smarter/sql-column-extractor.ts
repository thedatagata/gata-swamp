// utils/smarter/sql-column-extractor.ts
import { getSemanticMetadata } from "./semantic-config.ts";

/**
 * Extract column names from SQL SELECT clause
 * Strips aggregations, aliases, and table prefixes
 */
export function extractColumnsFromSQL(sql: string): string[] {
  const selectMatch = sql.match(/SELECT\s+(.*?)\s+FROM/is);
  if (!selectMatch) return [];
  
  const columns = selectMatch[1]
    .split(',')
    .map(col => {
      col = col.trim();
      // Remove alias
      col = col.replace(/\s+AS\s+\w+$/i, '');
      // Remove aggregation
      col = col.replace(/^(SUM|AVG|COUNT|MAX|MIN|ANY_VALUE)\s*\(/i, '');
      col = col.replace(/\)$/, '');
      // Remove table prefix
      col = col.replace(/.*\./, '');
      return col.trim();
    })
    .filter(col => col && col !== '*');
  
  return columns;
}

/**
 * Validate SQL columns against semantic metadata
 * Returns valid/invalid dimensions and measures
 */
export function validateSQLColumns(
  sql: string,
  table: "sessions" | "users" = "sessions"
): {
  valid: { dimensions: string[]; measures: string[] };
  invalid: string[];
  suggestions: string[];
} {
  const columns = extractColumnsFromSQL(sql);
  const metadata = getSemanticMetadata(table);
  
  const validDims: string[] = [];
  const validMeas: string[] = [];
  const invalid: string[] = [];
  
  columns.forEach(col => {
    if (metadata.dimensions[col]) {
      validDims.push(col);
    } else if (metadata.measures[col]) {
      validMeas.push(col);
    } else {
      invalid.push(col);
    }
  });
  
  const suggestions: string[] = [];
  if (invalid.length > 0) {
    suggestions.push(`Unknown fields: ${invalid.join(", ")}`);
    suggestions.push(`Available dimensions: ${Object.keys(metadata.dimensions).slice(0, 10).join(", ")}`);
    suggestions.push(`Available measures: ${Object.keys(metadata.measures).slice(0, 10).join(", ")}`);
  }
  
  return {
    valid: { dimensions: validDims, measures: validMeas },
    invalid,
    suggestions
  };
}

/**
 * Generate correction prompt with focused context
 */
export function generateCorrectionPrompt(
  originalPrompt: string,
  invalidColumns: string[],
  table: "sessions" | "users"
): string {
  const metadata = getSemanticMetadata(table);
  
  return `Your previous query used invalid columns: ${invalidColumns.join(", ")}

Original request: "${originalPrompt}"

VALID DIMENSIONS: ${Object.keys(metadata.dimensions).join(", ")}
VALID MEASURES: ${Object.keys(metadata.measures).join(", ")}

Generate corrected SQL using ONLY these field names.`;
}
