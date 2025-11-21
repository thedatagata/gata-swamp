// utils/smarter/query-validator.ts
import { getSemanticMetadata } from "./semantic-config.ts";

export interface QueryValidationReport {
  valid: boolean;
  validation: {
    validDimensions: string[];
    invalidDimensions: string[];
    validMeasures: string[];
    invalidMeasures: string[];
  };
  corrections: string[];
}

/**
 * Validate LLM-generated query against semantic metadata
 */
export function validateAndAnalyzeQuery(llmQuerySpec: any, table?: "sessions" | "users"): QueryValidationReport {
  const metadata = getSemanticMetadata(table);
  
  // Validate dimensions
  const validDims: string[] = [];
  const invalidDims: string[] = [];
  llmQuerySpec.dimensions?.forEach((dim: string) => {
    if (metadata.dimensions[dim]) {
      validDims.push(dim);
    } else {
      invalidDims.push(dim);
    }
  });

  // Validate measures
  const validMeasures: string[] = [];
  const invalidMeasures: string[] = [];
  
  llmQuerySpec.measures?.forEach((measure: string) => {
    if (metadata.measures[measure]) {
      validMeasures.push(measure);
    } else {
      invalidMeasures.push(measure);
    }
  });

  // Build corrections
  const corrections: string[] = [];
  if (invalidDims.length > 0) {
    const availableDims = Object.keys(metadata.dimensions).slice(0, 8).join(", ");
    corrections.push(`❌ Unknown dimensions: ${invalidDims.join(", ")}`);
    corrections.push(`✅ Use these dimensions: ${availableDims}`);
  }
  if (invalidMeasures.length > 0) {
    const availableMeasures = Object.keys(metadata.measures).slice(0, 8).join(", ");
    corrections.push(`❌ Unknown measures: ${invalidMeasures.join(", ")}`);
    corrections.push(`✅ Use these measures: ${availableMeasures}`);
  }

  const valid = invalidDims.length === 0 && invalidMeasures.length === 0;

  return {
    valid,
    validation: {
      validDimensions: validDims,
      invalidDimensions: invalidDims,
      validMeasures,
      invalidMeasures
    },
    corrections
  };
}

/**
 * Generate correction prompt with available fields
 */
export function generateCorrectionPrompt(report: QueryValidationReport, originalPrompt: string, table?: "sessions" | "users"): string {
  const metadata = getSemanticMetadata(table);
  
  return `
Your previous query had errors:
${report.corrections.join("\n")}

Original request: "${originalPrompt}"

VALID DIMENSIONS:
${Object.keys(metadata.dimensions).join(", ")}

VALID MEASURES:
${Object.keys(metadata.measures).join(", ")}

Generate a corrected query using ONLY these field names. Respond with JSON only.
  `.trim();
}
