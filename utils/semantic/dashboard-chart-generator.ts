// utils/semantic/dashboard-chart-generator.ts
import type { ChartConfig } from "./chart-generator.ts";
import { detectChartType } from "./auto-chart-detector.ts";
import { getSemanticConfig } from "./semantic-config.ts";

const COLOR_PALETTE = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c',
  '#8dd1e1', '#a4de6c', '#d0ed57', '#ffa07a'
];

function formatLabel(text: string): string {
  return text
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace(/Ltv/g, 'LTV')
    .replace(/30d/g, '(30d)');
}

// Convert Uint8Array to Number (for DuckDB integer values)
function uint8ArrayToNumber(arr: Uint8Array): number {
  // Read as little-endian 64-bit integer (first 8 bytes)
  let result = 0;
  for (let i = 0; i < Math.min(8, arr.length); i++) {
    result += arr[i] * Math.pow(256, i);
  }
  return result;
}

// Helper to sanitize data - convert BigInt and Uint8Array to Number
function sanitizeValue(value: any): any {
  if (typeof value === 'bigint') {
    return Number(value);
  } else if (value instanceof Uint8Array) {
    return uint8ArrayToNumber(value);
  } else if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  return value;
}

function sanitizeData(data: any[]): any[] {
  return data.map(row => {
    const newRow: any = {};
    for (const key in row) {
      newRow[key] = sanitizeValue(row[key]);
    }
    return newRow;
  });
}

export function generateDashboardChartConfig(
  query: any,
  data: any[]
): ChartConfig {
  console.log('generateDashboardChartConfig called with:', { query, data });
  
  if (!query) {
    throw new Error('Query is required');
  }
  
  if (!Array.isArray(data)) {
    throw new Error('Data must be an array');
  }

  // Sanitize data early - convert BigInt and Uint8Array to Number
  const sanitizedData = sanitizeData(data);
  console.log('Sanitized data:', sanitizedData);

  const semanticConfig = getSemanticConfig();
  
  if (!semanticConfig[query.table]) {
    throw new Error(`Table ${query.table} not found in semantic config`);
  }

  const detection = detectChartType(
    {
      table: query.table,
      dimensions: query.dimensions || [],
      measures: query.measures || [],
      filters: query.filters || [],
      explanation: query.title || ""
    },
    semanticConfig,
    sanitizedData
  );

  console.log('Chart detection result:', detection);

  // Handle multiple dimensions + single measure (grouped bar chart)
  let xKey: string;
  let yKeys: string[];
  let formattedData: any[];
  
  if (detection.config?.multiDimension && query.dimensions && query.dimensions.length >= 2 && query.measures.length === 1) {
    // Pivot data: first dimension = X-axis, other dimensions = bar groups
    xKey = query.dimensions[0];
    const groupDimension = query.dimensions[1];
    const measure = query.measures[0];

    // Get unique values for grouping dimension
    const groupValues = [...new Set(sanitizedData.map(row => row[groupDimension]))];
    console.log('Group values before String conversion:', groupValues);
    yKeys = groupValues.map(v => {
      if (typeof v === 'object' && v !== null) {
        console.error('Found object in groupValues:', v);
        return JSON.stringify(v);
      }
      return String(v);
    });
    
    // Pivot the data
    const pivoted = new Map<string, any>();
    sanitizedData.forEach(row => {
      const xValue = row[xKey];
      const groupValue = String(row[groupDimension]);
      const measureValue = row[measure];
      
      if (!pivoted.has(xValue)) {
        pivoted.set(xValue, { [xKey]: xValue });
      }
      pivoted.get(xValue)![groupValue] = measureValue;
    });
    
    formattedData = Array.from(pivoted.values());
  } else {
    // Standard case
    xKey = query.dimensions?.[0] || 'index';
    yKeys = query.measures || [];
    
    if (yKeys.length === 0) {
      throw new Error('No measures specified for chart');
    }
    
    formattedData = sanitizedData.map((row, idx) => ({
      ...row,
      index: idx
    }));
  }

  const modelConfig = semanticConfig[query.table];
  const format: any = {};
  
  yKeys.forEach(measure => {
    const measureConfig = modelConfig.measures[measure];
    if (measureConfig) {
      format[measure] = {
        type: measureConfig.format,
        decimals: measureConfig.decimals || 0
      };
    }
  });

  const isTimeSeries = query.dimensions?.[0]?.includes('date') || 
                       query.dimensions?.[0]?.includes('time');

  const title = query.title || generateTitle(yKeys, query.dimensions);

  const config: RechartsConfig = {
    type: detection.type,
    title,
    xKey,
    yKeys,
    data: formattedData,
    config: {
      colors: COLOR_PALETTE.slice(0, yKeys.length),
      stacked: detection.config?.barmode === 'stack',
      showLegend: yKeys.length > 1,
      showGrid: true,
      showTooltip: true,
      orientation: detection.config?.orientation === 'h' ? 'horizontal' : 'vertical',
      isTimeSeries,
      format
    }
  };

  console.log('Generated RechartsConfig:', config);
  
  return config;
}

function generateTitle(measures: string[], dimensions?: string[]): string {
  const measuresLabel = measures.map(m => formatLabel(m)).join(' & ');
  const dimensionsLabel = dimensions?.map(d => formatLabel(d)).join(' by ') || '';
  
  if (dimensionsLabel) {
    return `${measuresLabel} by ${dimensionsLabel}`;
  }
  return measuresLabel;
}
