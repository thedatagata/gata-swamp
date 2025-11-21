// utils/smarter/query-response-analyzer.ts
import { getSemanticMetadata, type FieldMetadata } from "./semantic-config.ts";

/**
 * Categorized dimensions for smart visualization
 */
export interface CategorizedDimensions {
  temporal: string[];      // session_date, session_month_name, session_weekday_name
  sequential: string[];    // max_lifecycle_stage (ordered categories)
  categorical: string[];   // traffic_source, plan_tier (unordered categories)
  binary: string[];        // is_anonymous_label, trial_signup_label
  hierarchies: Array<{ parent: string; children: string[] }>;
}

/**
 * Categorized measures for smart visualization
 */
export interface CategorizedMeasures {
  counts: string[];        // session_count, unique_visitors
  rates: string[];         // activation_rate, trial_signup_rate
  revenue: string[];       // total_revenue, avg_revenue_per_session
  events: string[];        // interest_events, consideration_events
  averages: string[];      // avg_funnel_step, avg_session_sequence
  totals: string[];        // total_events, lifecycle_conversion_sessions
}

/**
 * Visualization recommendation based on categorized query
 */
export interface VisualizationSpec {
  queryType: "kpi" | "time_series" | "distribution" | "comparison" | "funnel" | "breakdown";
  recommendedCharts: Array<{
    type: "bar" | "line" | "area" | "pie" | "funnel" | "scatter" | "heatmap";
    priority: number;
    reason: string;
    config?: any;
  }>;
  dimensionCategories: CategorizedDimensions;
  measureCategories: CategorizedMeasures;
  warnings: string[];
  suggestions: string[];
}

export class QueryResponseAnalyzer {
  private metadata = getSemanticMetadata();

  /**
   * Analyze WebLLM query response and generate visualization recommendations
   */
  analyze(queryResponse: {
    dimensions: string[];
    measures: string[];
    filters?: string[];
    explanation: string;
  }): VisualizationSpec {
    const dimCategories = this.categorizeDimensions(queryResponse.dimensions);
    const measureCategories = this.categorizeMeasures(queryResponse.measures);
    
    const queryType = this.detectQueryType(dimCategories, measureCategories);
    const recommendations = this.generateRecommendations(queryType, dimCategories, measureCategories);
    
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Detect potential issues
    if (queryResponse.dimensions.length === 0 && queryResponse.measures.length > 1) {
      warnings.push("No dimensions - comparing multiple metrics without grouping");
      suggestions.push("Consider adding a dimension like traffic_source or session_date");
    }

    if (dimCategories.temporal.length > 0 && queryResponse.measures.length > 0) {
      suggestions.push("Time series detected - line/area charts recommended");
    }

    if (dimCategories.sequential.length > 0) {
      suggestions.push(`Sequential dimension detected: ${dimCategories.sequential[0]} - consider funnel visualization`);
    }

    if (measureCategories.rates.length > 0) {
      suggestions.push("Rate/percentage measures detected - ensure y-axis formatted as percentage");
    }

    return {
      queryType,
      recommendedCharts: recommendations,
      dimensionCategories: dimCategories,
      measureCategories,
      warnings,
      suggestions
    };
  }

  /**
   * Categorize dimensions based on metadata
   */
  private categorizeDimensions(dimensions: string[]): CategorizedDimensions {
    const temporal: string[] = [];
    const sequential: string[] = [];
    const categorical: string[] = [];
    const binary: string[] = [];
    const hierarchies: Array<{ parent: string; children: string[] }> = [];

    dimensions.forEach(dim => {
      const dimConfig = this.metadata.dimensions[dim];
      if (!dimConfig) return;

      const field = this.metadata.fields[dimConfig.column];
      if (!field) return;

      // Temporal
      if (field.group === "temporal") {
        temporal.push(dim);
      }
      // Sequential (ordinal with custom sort)
      else if (dimConfig.sort?.startsWith("custom:")) {
        sequential.push(dim);
      }
      // Binary (transformed boolean dimensions)
      else if (dimConfig.transformation && field.data_type_category === "categorical" && field.members?.length === 2) {
        binary.push(dim);
      }
      // Categorical
      else if (field.data_type_category === "categorical" || field.data_type_category === "nominal") {
        categorical.push(dim);
      }

      // Hierarchies
      if (field.parent) {
        const children = Object.entries(this.metadata.fields)
          .filter(([_, f]) => f.group === field.group && !f.parent)
          .map(([name, _]) => name);
        
        if (children.length > 0) {
          hierarchies.push({ parent: dim, children });
        }
      }
    });

    return { temporal, sequential, categorical, binary, hierarchies };
  }

  /**
   * Categorize measures based on naming patterns and metadata
   */
  private categorizeMeasures(measures: string[]): CategorizedMeasures {
    const counts: string[] = [];
    const rates: string[] = [];
    const revenue: string[] = [];
    const events: string[] = [];
    const averages: string[] = [];
    const totals: string[] = [];

    measures.forEach(measure => {
      const measureConfig = this.metadata.measures[measure];
      if (!measureConfig) return;

      if (measure.includes("_rate") || measure.includes("_ratio") || measureConfig.format === "percentage") {
        rates.push(measure);
      } else if (measure.includes("revenue")) {
        revenue.push(measure);
      } else if (measure.includes("_events") || measure.includes("event")) {
        events.push(measure);
      } else if (measure.startsWith("avg_")) {
        averages.push(measure);
      } else if (measure.includes("count") || measure.includes("sessions") || measure.includes("visitors")) {
        counts.push(measure);
      } else if (measure.includes("total_")) {
        totals.push(measure);
      } else {
        // Default to totals
        totals.push(measure);
      }
    });

    return { counts, rates, revenue, events, averages, totals };
  }

  /**
   * Detect query type from categorized dimensions/measures
   */
  private detectQueryType(
    dims: CategorizedDimensions,
    measures: CategorizedMeasures
  ): VisualizationSpec["queryType"] {
    // No dimensions = KPI
    if (dims.temporal.length === 0 && dims.sequential.length === 0 && dims.categorical.length === 0) {
      return "kpi";
    }

    // Temporal dimension = time series
    if (dims.temporal.length > 0) {
      return "time_series";
    }

    // Sequential dimension (lifecycle stages) = funnel
    if (dims.sequential.length > 0) {
      return "funnel";
    }

    // Multiple categorical dimensions = breakdown
    if (dims.categorical.length > 1) {
      return "breakdown";
    }

    // Single categorical = distribution or comparison
    if (dims.categorical.length === 1) {
      if (measures.rates.length > 0 || measures.counts.length > 1) {
        return "comparison";
      }
      return "distribution";
    }

    return "comparison";
  }

  /**
   * Generate chart recommendations based on query type
   */
  private generateRecommendations(
    queryType: VisualizationSpec["queryType"],
    dims: CategorizedDimensions,
    measures: CategorizedMeasures
  ): VisualizationSpec["recommendedCharts"] {
    const recommendations: VisualizationSpec["recommendedCharts"] = [];

    switch (queryType) {
      case "kpi":
        recommendations.push({
          type: "bar",
          priority: 1,
          reason: "Single metric comparison - horizontal bar chart",
          config: { orientation: "h" }
        });
        break;

      case "time_series":
        recommendations.push({
          type: "line",
          priority: 1,
          reason: "Temporal dimension - line chart shows trends",
          config: { x: dims.temporal[0] }
        });
        recommendations.push({
          type: "area",
          priority: 2,
          reason: "Temporal dimension - area chart shows volume",
          config: { x: dims.temporal[0] }
        });
        break;

      case "funnel":
        recommendations.push({
          type: "funnel",
          priority: 1,
          reason: "Sequential dimension detected - funnel shows progression",
          config: { dimension: dims.sequential[0] }
        });
        recommendations.push({
          type: "bar",
          priority: 2,
          reason: "Ordered categories - bar chart alternative",
          config: { orientation: "h" }
        });
        break;

      case "distribution":
        if (measures.revenue.length > 0) {
          recommendations.push({
            type: "pie",
            priority: 1,
            reason: "Revenue distribution - pie chart shows proportions"
          });
        }
        recommendations.push({
          type: "bar",
          priority: 2,
          reason: "Distribution - bar chart for comparison",
          config: { orientation: "h" }
        });
        break;

      case "comparison":
        recommendations.push({
          type: "bar",
          priority: 1,
          reason: "Comparing metrics across categories",
          config: { barmode: "group" }
        });
        break;

      case "breakdown":
        recommendations.push({
          type: "heatmap",
          priority: 1,
          reason: "Multiple dimensions - heatmap shows relationships"
        });
        recommendations.push({
          type: "bar",
          priority: 2,
          reason: "Multi-dimensional - stacked bars",
          config: { barmode: "stack" }
        });
        break;
    }

    return recommendations;
  }

  /**
   * Generate prompt enhancement for WebLLM based on analysis
   */
  generatePromptEnhancement(spec: VisualizationSpec): string {
    const parts: string[] = [];

    parts.push(`Query Type: ${spec.queryType}`);

    if (spec.dimensionCategories.temporal.length > 0) {
      parts.push(`Temporal: ${spec.dimensionCategories.temporal.join(", ")}`);
    }
    if (spec.dimensionCategories.sequential.length > 0) {
      parts.push(`Sequential: ${spec.dimensionCategories.sequential.join(", ")}`);
    }
    if (spec.dimensionCategories.categorical.length > 0) {
      parts.push(`Categories: ${spec.dimensionCategories.categorical.join(", ")}`);
    }

    if (spec.recommendedCharts.length > 0) {
      const topChart = spec.recommendedCharts[0];
      parts.push(`Recommended: ${topChart.type} (${topChart.reason})`);
    }

    return parts.join(" | ");
  }
}

/**
 * Factory function
 */
export function createQueryAnalyzer(): QueryResponseAnalyzer {
  return new QueryResponseAnalyzer();
}
