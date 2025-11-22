// utils/scripts/fix-semantic-metadata.ts
// Script to fix semantic metadata structure issues

import sessionsMetadata from "../../static/smarter_utils/semantic-amplitude-metadata.json" with { type: "json" };
import usersMetadata from "../../static/smarter_utils/semantic-users-metadata.json" with { type: "json" };

interface MeasureConfig {
  column: string | null;
  aggregations: string[];
  formula: string;
  description: string;
  format: string;
  currency?: string;
  decimals: number;
}

function fixMetadata(metadata: any): any {
  const fixed = { ...metadata };
  const newMeasures: Record<string, MeasureConfig> = {};
  
  // Event columns that need splitting
  const eventColumns = [
    'interest_events',
    'consideration_events', 
    'trial_events',
    'activation_events',
    'retention_events',
    'total_events'
  ];
  
  for (const [name, measure] of Object.entries(metadata.measures) as [string, MeasureConfig][]) {
    // CASE 1: Event measures with multiple aggregations - split them
    if (eventColumns.includes(name)) {
      const aggs = measure.aggregations || [];
      
      if (aggs.includes('sum')) {
        newMeasures[`total_${name}`] = {
          column: measure.column,
          aggregations: [],
          formula: `SUM(${measure.column})`,
          description: `Total ${measure.description.toLowerCase()}`,
          format: measure.format,
          decimals: measure.decimals
        };
      }
      
      if (aggs.includes('avg')) {
        newMeasures[`avg_${name}`] = {
          column: measure.column,
          aggregations: [],
          formula: `AVG(${measure.column})`,
          description: `Average ${measure.description.toLowerCase()} per session`,
          format: measure.format,
          decimals: 1 // Averages typically need 1 decimal
        };
      }
      
      // Don't add the original ambiguous measure
      continue;
    }
    
    // CASE 2: Rate measures - remove aggregations array (it's in the formula)
    if (name.includes('_rate') || name.includes('_ratio')) {
      newMeasures[name] = {
        ...measure,
        aggregations: [] // Rate is already calculated in formula
      };
      continue;
    }
    
    // CASE 3: All other measures - keep as-is but ensure single aggregation
    if (measure.aggregations && measure.aggregations.length > 1) {
      console.warn(`⚠️  Measure ${name} has multiple aggregations but no split logic`);
    }
    
    newMeasures[name] = measure;
  }
  
  fixed.measures = newMeasures;
  return fixed;
}

// Fix both metadata files
console.log('🔧 Fixing sessions metadata...');
const fixedSessions = fixMetadata(sessionsMetadata);

console.log('🔧 Fixing users metadata...');
const fixedUsers = fixMetadata(usersMetadata);

// Write fixed files
await Deno.writeTextFile(
  './static/smarter_utils/semantic-amplitude-metadata.json',
  JSON.stringify(fixedSessions, null, 2)
);

await Deno.writeTextFile(
  './static/smarter_utils/semantic-users-metadata.json',
  JSON.stringify(fixedUsers, null, 2)
);

console.log('✅ Metadata files fixed!');
console.log('\nChanges made:');
console.log('- Split event measures (interest_events → total_interest_events + avg_interest_events)');
console.log('- Removed aggregations array from rate measures (already in formula)');
console.log('- Each measure now has single unambiguous purpose');
