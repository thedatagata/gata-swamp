// utils/semantic/chart-detector.ts
import type { QueryResponse } from "./webllm-handler.ts";
import type { SemanticConfig } from "./semantic-config.ts";

export type ChartType = 'bar' | 'line' | 'heatmap' | 'biaxial-bar' | 'stacked-bar' | 'area' | 'area-fill-by-value' | 'kpi' | 'funnel';

export interface ChartDetectionResult {
  type: ChartType;
  reason: string;
  config?: any;
}

/**
 * Auto-detect chart type based on query structure (Boring Semantic Layer style)
 * 
 * Rules:
 * 1. Time dimension + measure(s) → Line chart (or area if net/change metric)
 * 2. Single dimension + multiple measures → Grouped bar chart
 * 3. Two dimensions + measure → Heatmap
 * 4. Single dimension + single measure → Bar chart
 * 5. No dimensions + measures → KPI card (handled separately)
 * 6. Lifecycle stages → Funnel chart
 */
export function detectChartType(
  query: QueryResponse,
  semanticConfig: SemanticConfig,
  data?: any[]  // Optional data to check for positive/negative values
): ChartDetectionResult {
  const numDimensions = query.dimensions?.length || 0;
  const numMeasures = query.measures?.length || 0;

  // Rule 0: No dimensions = KPI card (period-over-period, aggregates)
  if (numDimensions === 0 && numMeasures >= 1) {
    return {
      type: 'kpi',
      reason: 'Single aggregate measure - display as KPI card',
      config: {}
    };
  }

  // Get dimension metadata
  const modelConfig = semanticConfig[query.table];
  const dimensions = query.dimensions?.map(d => ({
    name: d,
    metadata: modelConfig.dimensions[d]
  })) || [];

  // Rule 1: Time dimension + measure(s) → Line chart or Area chart
  const hasTimeDimension = dimensions.some(d => 
    d.metadata?.is_time_dimension || 
    d.name.includes('date') || 
    d.name.includes('time')
  );

  if (hasTimeDimension && numMeasures === 1) {
    const measure = query.measures[0];
    const measureName = measure.toLowerCase();
    
    // Check if it's a net/change metric (swings positive/negative)
    const isNetMetric = measureName.includes('net_') || 
                       measureName.includes('change') ||
                       measureName.includes('delta') ||
                       measureName.includes('growth') ||
                       measureName.startsWith('net');
    
    // If we have data, check for actual positive/negative values
    let hasMixedValues = false;
    if (data && data.length > 0) {
      const values = data.map(row => Number(row[measure])).filter(v => !isNaN(v));
      const hasPositive = values.some(v => v > 0);
      const hasNegative = values.some(v => v < 0);
      hasMixedValues = hasPositive && hasNegative;
    }
    
    if (isNetMetric || hasMixedValues) {
      return {
        type: 'area-fill-by-value',
        reason: 'Time series with net/change metric showing positive and negative values',
        config: {
          mode: 'area',
          fillByValue: true
        }
      };
    }
  }

  if (hasTimeDimension && numMeasures >= 1) {
    return {
      type: 'line',
      reason: 'Time series data detected (date dimension with measures)',
      config: {
        mode: 'lines+markers',
        hovermode: 'x unified'
      }
    };
  }

  // Rule 2: Lifecycle/funnel stages → Funnel chart
  const isFunnelDimension = dimensions.some(d =>
    d.name.includes('lifecycle') || 
    d.name.includes('stage') ||
    d.metadata?.values?.some((v: string) => 
      ['awareness', 'consideration', 'trial', 'activation', 'retention'].includes(v.toLowerCase())
    )
  );

  if (isFunnelDimension && numMeasures === 1) {
    return {
      type: 'funnel',
      reason: 'Lifecycle or conversion stages detected - displayed as funnel chart',
      config: {
        sort: 'descending',
        showValues: true
      }
    };
  }

  // Rule 3: Multiple dimensions + single measure → Grouped or Stacked bar
  if (numDimensions >= 2 && numMeasures === 1) {
    // Check if second dimension has low cardinality (should stack)
    const secondDimension = dimensions[1];
    const isLowCardinality = secondDimension.metadata?.cardinality === 'low' ||
                            (secondDimension.metadata?.values && secondDimension.metadata.values.length <= 6);
    
    return {
      type: isLowCardinality ? 'stacked-bar' : 'bar',
      reason: isLowCardinality 
        ? `${numDimensions} dimensions with low cardinality - stacked comparison`
        : `${numDimensions} dimensions - grouped comparison`,
      config: {
        barmode: isLowCardinality ? 'stack' : 'group',
        orientation: 'v',
        multiDimension: true
      }
    };
  }

  // Rule 4: Single dimension + exactly 2 measures → Biaxial bar (dual Y-axis)
  if (numDimensions === 1 && numMeasures === 2) {
    return {
      type: 'biaxial-bar',
      reason: 'Two measures with different scales - biaxial comparison',
      config: {
        orientation: 'v'
      }
    };
  }

  // Rule 5: Single dimension + multiple measures (3+) → Stacked or Grouped bar
  if (numDimensions === 1 && numMeasures > 2) {
    // Check if measures have the same format (compositional - should stack)
    const measureConfigs = query.measures.map(m => modelConfig.measures[m]);
    const formats = measureConfigs.map(c => c?.format).filter(Boolean);
    const allSameFormat = formats.length > 0 && formats.every(f => f === formats[0]);
    
    return {
      type: allSameFormat ? 'stacked-bar' : 'bar',
      reason: allSameFormat
        ? 'Multiple measures with same unit - compositional stacked view'
        : 'Single dimension with multiple measures - comparing metrics',
      config: {
        barmode: allSameFormat ? 'stack' : 'group',
        orientation: 'v'
      }
    };
  }

  // Rule 6: Multiple dimensions + multiple measures → Grouped bar (complex comparison)
  if (numDimensions >= 2 && numMeasures >= 2) {
    return {
      type: 'bar',
      reason: `${numDimensions} dimensions with ${numMeasures} measures - complex grouped comparison`,
      config: {
        barmode: 'group',
        orientation: 'v',
        multiDimensionMultiMeasure: true
      }
    };
  }

  // Rule 7: Single dimension + single measure → Standard bar chart
  if (numDimensions === 1 && numMeasures === 1) {
    return {
      type: 'bar',
      reason: 'Single categorical dimension with one measure',
      config: {
        orientation: 'v'
      }
    };
  }

  // Default fallback: bar chart
  return {
    type: 'bar',
    reason: 'Default chart type',
    config: {
      orientation: 'v'
    }
  };
}

/**
 * Get chart title from query
 */
export function generateChartTitle(query: QueryResponse): string {
  const measures = query.measures.join(' & ');
  const dimensions = query.dimensions?.join(' by ') || '';
  
  if (dimensions) {
    return `${formatLabel(measures)} by ${formatLabel(dimensions)}`;
  }
  return formatLabel(measures);
}

/**
 * Format label for display
 */
function formatLabel(text: string): string {
  return text
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace(/Ltv/g, 'LTV')
    .replace(/30d/g, '(30d)');
}