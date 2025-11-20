// utils/semantic/chart-generator.ts
import type { QueryResponse } from "./webllm-handler.ts";
import type { SemanticConfig } from "./semantic-config.ts";
import { detectChartType } from "./auto-chart-detector.ts";

export interface ChartConfig {
  type: 'bar' | 'line' | 'funnel' | 'pie' | 'stacked-bar' | 'biaxial-bar' | 'area-fill-by-value' | 'kpi';
  title: string;
  xKey: string;
  yKeys: string[];
  data: any[];
  config: {
    colors?: string[];
    stacked?: boolean;
    showLegend?: boolean;
    showGrid?: boolean;
    showTooltip?: boolean;
    orientation?: 'horizontal' | 'vertical';
    isTimeSeries?: boolean;
    format?: {
      [key: string]: {
        type: 'currency' | 'percentage' | 'number';
        decimals?: number;
      }
    };
  };
}

const COLOR_PALETTE = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c',
  '#8dd1e1', '#a4de6c', '#d0ed57', '#ffa07a'
];

export function generateChartConfig(
  query: QueryResponse,
  data: any[],
  semanticConfig: SemanticConfig
): ChartConfig {
  const detection = detectChartType(query, semanticConfig, data);  // Pass data for detection
  const modelConfig = semanticConfig[query.table];
  
  // Handle multiple dimensions + single measure (grouped bar chart)
  let xKey: string;
  let yKeys: string[];
  let formattedData: any[];
  
  if (detection.config?.multiDimensionMultiMeasure && query.dimensions && query.dimensions.length >= 2 && query.measures.length >= 2) {
    // Complex case: Multiple dimensions + multiple measures
    // Strategy: First dimension = X-axis, pivot on second dimension, create bars for each measure
    xKey = query.dimensions[0];
    const groupDimension = query.dimensions[1];
    const measures = query.measures;
    
    // Get unique values for grouping dimension
    const groupValues = [...new Set(data.map(row => row[groupDimension]))];
    
    // Create bar names: dimension_value + measure (e.g., "mobile_revenue", "desktop_revenue")
    yKeys = [];
    groupValues.forEach(groupValue => {
      measures.forEach(measure => {
        yKeys.push(`${String(groupValue)}_${measure}`);
      });
    });
    
    // Pivot the data
    const pivoted = new Map<string, any>();
    data.forEach(row => {
      const xValue = row[xKey];
      const groupValue = String(row[groupDimension]);
      
      if (!pivoted.has(xValue)) {
        pivoted.set(xValue, { [xKey]: xValue });
      }
      
      measures.forEach(measure => {
        const barKey = `${groupValue}_${measure}`;
        pivoted.get(xValue)![barKey] = row[measure];
      });
    });
    
    formattedData = Array.from(pivoted.values());
  } else if (detection.config?.multiDimension && query.dimensions && query.dimensions.length >= 2 && query.measures.length === 1) {
    // Pivot data: first dimension = X-axis, other dimensions = bar groups
    xKey = query.dimensions[0];
    const groupDimension = query.dimensions[1];
    const measure = query.measures[0];
    
    // Get unique values for grouping dimension
    const groupValues = [...new Set(data.map(row => row[groupDimension]))];
    yKeys = groupValues.map(String);
    
    // Pivot the data
    const pivoted = new Map<string, any>();
    data.forEach(row => {
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
    formattedData = data.map((row, idx) => ({
      ...row,
      index: idx
    }));
  }
  
  const format: any = {};
  yKeys.forEach(measure => {
    const measureConfig = modelConfig.measures[measure];
    if (measureConfig) {
      format[measure] = {
        type: measureConfig.format as 'currency' | 'percentage' | 'number',
        decimals: measureConfig.decimals || 0
      };
    }
  });
  
  const isTimeSeries = query.dimensions?.[0]?.includes('date') || 
                       query.dimensions?.[0]?.includes('time') ||
                       modelConfig.dimensions[query.dimensions?.[0] || '']?.is_time_dimension;
  
  const title = generateChartTitle(query, modelConfig);
  
  return {
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
}

function generateChartTitle(query: QueryResponse, modelConfig: any): string {
  const measures = query.measures.map(m => formatLabel(m)).join(' & ');
  const dimensions = query.dimensions?.map(d => formatLabel(d)).join(' by ') || '';
  
  if (dimensions) {
    return `${measures} by ${dimensions}`;
  }
  return measures;
}

function formatLabel(text: string): string {
  return text
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace(/Ltv/g, 'LTV')
    .replace(/30d/g, '(30d)');
}

export function formatValue(
  value: number | string | null | undefined,
  format?: { type: 'currency' | 'percentage' | 'number'; decimals?: number }
): string {
  if (value === null || value === undefined) return 'N/A';
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return String(value);
  
  if (!format) {
    return numValue.toLocaleString();
  }
  
  const decimals = format.decimals ?? 0;
  
  switch (format.type) {
    case 'currency':
      return `$${numValue.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      })}`;
    case 'percentage':
      return `${numValue.toFixed(decimals)}%`;
    case 'number':
    default:
      return numValue.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
  }
}

export function autoGenerateChart(
  query: QueryResponse,
  data: any[],
  semanticConfig: SemanticConfig
): {
  chartConfig: ChartConfig;
  detection: any;
} {
  const chartConfig = generateChartConfig(query, data, semanticConfig);
  const detection = detectChartType(query, semanticConfig, data);  // Pass data for detection

  return {
    chartConfig,
    detection
  };
}
