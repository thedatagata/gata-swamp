// utils/smarter/chart-generator-v2.ts
import { createQueryAnalyzer, type VisualizationSpec } from "./query-response-analyzer.ts";
import type { QueryResponse } from "./webllm-handler.ts";

export interface ChartConfig {
  type: "bar" | "line" | "area" | "pie" | "funnel" | "scatter" | "heatmap";
  data: any[];
  layout: any;
  config?: any;
}

export interface ChartGenerationResult {
  chartConfig: ChartConfig;
  visualizationSpec: VisualizationSpec;
  alternativeCharts: ChartConfig[];
}

/**
 * Generate chart using query response analyzer
 */
export function generateChartFromAnalysis(
  queryResponse: QueryResponse,
  data: any[]
): ChartGenerationResult {
  const analyzer = createQueryAnalyzer();
  const vizSpec = analyzer.analyze(queryResponse);

  console.log("📊 [ChartGenerator] Visualization Spec:", vizSpec);
  console.log("🎯 [ChartGenerator] Query Type:", vizSpec.queryType);
  console.log("📈 [ChartGenerator] Top Recommendation:", vizSpec.recommendedCharts[0]);

  const primaryChart = buildChart(
    vizSpec.recommendedCharts[0],
    queryResponse,
    data,
    vizSpec
  );

  const alternativeCharts = vizSpec.recommendedCharts.slice(1).map(rec =>
    buildChart(rec, queryResponse, data, vizSpec)
  );

  return {
    chartConfig: primaryChart,
    visualizationSpec: vizSpec,
    alternativeCharts
  };
}

/**
 * Build specific chart type
 */
function buildChart(
  recommendation: VisualizationSpec["recommendedCharts"][0],
  queryResponse: QueryResponse,
  data: any[],
  vizSpec: VisualizationSpec
): ChartConfig {
  const { type, config } = recommendation;
  const dims = queryResponse.dimensions;
  const measures = queryResponse.measures;

  switch (type) {
    case "line":
    case "area":
      return buildTimeSeriesChart(type, dims, measures, data, vizSpec);

    case "bar":
      return buildBarChart(dims, measures, data, vizSpec, config);

    case "funnel":
      return buildFunnelChart(dims, measures, data, vizSpec);

    case "pie":
      return buildPieChart(dims, measures, data, vizSpec);

    case "heatmap":
      return buildHeatmapChart(dims, measures, data, vizSpec);

    default:
      return buildBarChart(dims, measures, data, vizSpec, config);
  }
}

/**
 * Time series chart (line/area)
 */
function buildTimeSeriesChart(
  type: "line" | "area",
  dimensions: string[],
  measures: string[],
  data: any[],
  vizSpec: VisualizationSpec
): ChartConfig {
  const xAxis = vizSpec.dimensionCategories.temporal[0] || dimensions[0];
  
  const traces = measures.map(measure => ({
    x: data.map(row => row[xAxis]),
    y: data.map(row => row[measure]),
    name: formatMeasureName(measure),
    type: type,
    fill: type === "area" ? "tonexty" : undefined
  }));

  return {
    type,
    data: traces,
    layout: {
      title: `${formatMeasureName(measures[0])} Over Time`,
      xaxis: { title: formatDimensionName(xAxis) },
      yaxis: { title: formatMeasureName(measures[0]) },
      showlegend: measures.length > 1
    }
  };
}

/**
 * Bar chart (horizontal/vertical, grouped/stacked)
 */
function buildBarChart(
  dimensions: string[],
  measures: string[],
  data: any[],
  vizSpec: VisualizationSpec,
  config?: any
): ChartConfig {
  const dimension = dimensions[0] || "metric";
  const orientation = config?.orientation || "v";
  
  if (dimensions.length === 0) {
    // KPI comparison - no grouping dimension
    const trace = {
      x: measures.map(m => formatMeasureName(m)),
      y: measures.map(m => data[0]?.[m] || 0),
      type: "bar",
      orientation: "v"
    };

    return {
      type: "bar",
      data: [trace],
      layout: {
        title: "Metric Comparison",
        showlegend: false
      }
    };
  }

  // Standard grouped/stacked bar
  const traces = measures.map(measure => ({
    x: orientation === "v" ? data.map(row => row[dimension]) : data.map(row => row[measure]),
    y: orientation === "v" ? data.map(row => row[measure]) : data.map(row => row[dimension]),
    name: formatMeasureName(measure),
    type: "bar",
    orientation
  }));

  return {
    type: "bar",
    data: traces,
    layout: {
      title: `${formatMeasureName(measures[0])} by ${formatDimensionName(dimension)}`,
      barmode: config?.barmode || "group",
      showlegend: measures.length > 1
    }
  };
}

/**
 * Funnel chart
 */
function buildFunnelChart(
  dimensions: string[],
  measures: string[],
  data: any[],
  vizSpec: VisualizationSpec
): ChartConfig {
  const dimension = vizSpec.dimensionCategories.sequential[0] || dimensions[0];
  const measure = measures[0];

  // Sort by lifecycle stage order if available
  const sortedData = [...data].sort((a, b) => {
    const stageOrder = ["awareness", "interest", "consideration", "trial", "activation"];
    return stageOrder.indexOf(a[dimension]) - stageOrder.indexOf(b[dimension]);
  });

  const trace = {
    type: "funnel",
    y: sortedData.map(row => formatDimensionValue(row[dimension])),
    x: sortedData.map(row => row[measure]),
    textinfo: "value+percent initial"
  };

  return {
    type: "funnel",
    data: [trace],
    layout: {
      title: `${formatMeasureName(measure)} Funnel`
    }
  };
}

/**
 * Pie chart
 */
function buildPieChart(
  dimensions: string[],
  measures: string[],
  data: any[],
  vizSpec: VisualizationSpec
): ChartConfig {
  const dimension = dimensions[0];
  const measure = measures[0];

  const trace = {
    type: "pie",
    labels: data.map(row => formatDimensionValue(row[dimension])),
    values: data.map(row => row[measure]),
    textinfo: "label+percent"
  };

  return {
    type: "pie",
    data: [trace],
    layout: {
      title: `${formatMeasureName(measure)} Distribution`
    }
  };
}

/**
 * Heatmap chart
 */
function buildHeatmapChart(
  dimensions: string[],
  measures: string[],
  data: any[],
  vizSpec: VisualizationSpec
): ChartConfig {
  const xDim = dimensions[0];
  const yDim = dimensions[1];
  const measure = measures[0];

  // Pivot data for heatmap
  const xValues = [...new Set(data.map(row => row[xDim]))];
  const yValues = [...new Set(data.map(row => row[yDim]))];
  
  const zMatrix = yValues.map(yVal =>
    xValues.map(xVal => {
      const row = data.find(r => r[xDim] === xVal && r[yDim] === yVal);
      return row ? row[measure] : 0;
    })
  );

  const trace = {
    type: "heatmap",
    x: xValues,
    y: yValues,
    z: zMatrix,
    colorscale: "Viridis"
  };

  return {
    type: "heatmap",
    data: [trace],
    layout: {
      title: `${formatMeasureName(measure)} by ${formatDimensionName(xDim)} and ${formatDimensionName(yDim)}`,
      xaxis: { title: formatDimensionName(xDim) },
      yaxis: { title: formatDimensionName(yDim) }
    }
  };
}

/**
 * Formatting helpers
 */
function formatMeasureName(measure: string): string {
  return measure
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDimensionName(dimension: string): string {
  return dimension
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDimensionValue(value: any): string {
  if (typeof value === "string") {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
  return String(value);
}
