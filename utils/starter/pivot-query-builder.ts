// utils/starter/pivot-query-builder.ts
import { generateSliceObject } from "./slice-object-generator.ts";
import metadataJson from "../../static/starter_utils/users-pivot-metadata.json" with { type: "json" };

/**
 * Strip aggregations, aliases, GROUP BY, and LIMIT from SQL to get raw column names
 */
export function extractColumnsFromSQL(sql: string): string[] {
  // Match SELECT ... FROM pattern
  const selectMatch = sql.match(/SELECT\s+(.*?)\s+FROM/is);
  if (!selectMatch) return [];
  
  let selectClause = selectMatch[1];
  
  // Split by comma, clean up each column
  const columns = selectClause
    .split(',')
    .map(col => {
      col = col.trim();
      
      // Strip "AS alias" - get the part before AS
      col = col.replace(/\s+AS\s+\w+$/i, '');
      
      // Strip aggregation functions: SUM(x) → x, MAX(y) → y
      col = col.replace(/^(SUM|AVG|COUNT|MAX|MIN|ANY_VALUE)\s*\(/i, '');
      col = col.replace(/\)$/, '');
      
      return col.trim();
    })
    .filter(col => col && col !== '*');
  
  return columns;
}

/**
 * Validate SQL query against metadata
 */
export function validateQueryColumns(columns: string[]): {
  valid: string[];
  invalid: string[];
} {
  const valid: string[] = [];
  const invalid: string[] = [];
  
  columns.forEach(col => {
    if (metadataJson[col]) {
      valid.push(col);
    } else {
      invalid.push(col);
    }
  });
  
  return { valid, invalid };
}

/**
 * Complete hierarchy by adding missing levels
 * UTM hierarchies: campaign -> medium -> source (3-level hierarchies)
 */
function completeHierarchies(columns: string[]): string[] {
  const result = [...columns];
  
  // Define UTM hierarchy groups
  const utmHierarchies = {
    FirstTouch: ['first_touch_utm_medium', 'first_touch_utm_source'],
    LastTouch: ['last_touch_utm_medium', 'last_touch_utm_source']
  };
  
  const added: string[] = [];
  
  // For each hierarchy, if any field is present, add all missing fields
  for (const [hierarchyName, fields] of Object.entries(utmHierarchies)) {
    const hasAnyField = fields.some(field => columns.includes(field));
    if (hasAnyField) {
      for (const field of fields) {
        if (!columns.includes(field)) {
          result.push(field);
          added.push(field);
          console.log(`🔗 Auto-added hierarchy field: ${field} (${hierarchyName})`);
        }
      }
    }
  }
  
  return result;
}

/**
 * Build report from SQL query
 * Returns { sql, slice, warnings }
 */
export function buildReportFromSQL(userSQL: string) {
  console.log('━━━ BUILDING REPORT FROM SQL ━━━');
  console.log('User SQL:', userSQL);
  
  // Strip aggregations, aliases to get raw column names
  let columns = extractColumnsFromSQL(userSQL);
  console.log('Extracted raw columns:', columns);
  
  const warnings: string[] = [];
  
  if (columns.length === 0) {
    throw new Error('No columns found in query');
  }
  
  // Remove aggregations from user SQL for WebDataRocks
  let cleanSQL = userSQL;
  if (/GROUP\s+BY/i.test(userSQL)) {
    cleanSQL = cleanSQL.replace(/GROUP\s+BY\s+[^;]*/i, '');
    warnings.push('🔄 Removed GROUP BY - WebDataRocks handles grouping');
  }
  if (/LIMIT\s+\d+/i.test(userSQL)) {
    cleanSQL = cleanSQL.replace(/LIMIT\s+\d+/i, '');
    warnings.push('🔄 Removed LIMIT - fetching all data');
  }
  
  // Strip aggregations from SELECT clause
  const selectMatch = cleanSQL.match(/SELECT\s+(.*?)\s+FROM/is);
  if (selectMatch && /SUM\(|AVG\(|COUNT\(|MAX\(|MIN\(/i.test(selectMatch[1])) {
    const originalSelect = selectMatch[1];
    const cleanSelect = originalSelect
      .split(',')
      .map(col => {
        col = col.trim();
        // Remove aliases
        col = col.replace(/\s+AS\s+\w+$/i, '');
        // Remove aggregations
        col = col.replace(/^(SUM|AVG|COUNT|MAX|MIN|ANY_VALUE)\s*\(/i, '');
        col = col.replace(/\)$/, '');
        return col.trim();
      })
      .join(', ');
    
    cleanSQL = cleanSQL.replace(selectMatch[0], `SELECT ${cleanSelect} FROM`);
    warnings.push('🔄 Removed aggregations - WebDataRocks handles aggregation');
  }
  
  // Auto-complete hierarchies
  const columnsWithHierarchies = completeHierarchies(columns);
  const addedFields = columnsWithHierarchies.filter(c => !columns.includes(c));
  const hierarchyAdded = addedFields.length > 0;
  
  if (hierarchyAdded) {
    warnings.push(`✨ Auto-added hierarchy fields: ${addedFields.join(', ')}`);
    
    // Add hierarchy fields to SELECT
    const selectMatch = cleanSQL.match(/SELECT\s+(.*?)\s+FROM/is);
    if (selectMatch) {
      const originalSelect = selectMatch[1];
      const newSelect = `${originalSelect}, ${addedFields.join(', ')}`;
      cleanSQL = cleanSQL.replace(selectMatch[0], `SELECT ${newSelect} FROM`);
      console.log('📝 Updated SELECT with hierarchy fields');
    }
  }
  
  // Generate slice from columns (with hierarchies)
  const slice = generateSliceObject(columnsWithHierarchies);
  console.log('Generated slice:', slice);
  
  return {
    sql: cleanSQL.trim(),
    slice,
    columns: columnsWithHierarchies,
    warnings
  };
}

/**
 * Handle 1MB limit error with upgrade upsell
 */
export function handle1MBLimitError(): string {
  return `
⚠️ **Your query exceeded the 1MB data limit**

Your analysis needs more power than the current plan allows.

**Upgrade to the Smarter Plan:**
✅ **No 1MB limit** - Analyze datasets with millions of rows
✅ **AI Driven Workflow** - Automatically generate queries, visualizations, and insights
✅ **Faster processing** - In Local Memory Querying
✅ **Advanced features** - Load purpose built text to sql AI model and a semantic layer to your browser for faster more accurate queries

**Quick fix for now:**
Add lookback filters or a LIMIT clause to your sql prompt to reduce data size.

**Ready to upgrade?** Visit your account settings to unlock Pro features.
  `.trim();
}
