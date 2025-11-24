// utils/smarter/overview_dashboards/semantic-dashboard-queries.ts
import { extractAllDimensionNames, extractAllMeasureNames } from "../dashboard_utils/semantic-config.ts";

/**
 * Dashboard query configuration format
 */
export interface DashboardQuery {
  id: string;
  table: "sessions" | "users";
  title: string;
  dimensions: string[];
  measures: string[];
  filters?: string[] | null;
  chartType: "kpi" | "bar" | "line" | "funnel" | "area";
}

/**
 * Sessions dashboard queries using semantic layer
 * Uses actual measures from semantic-sessions-metadata.json
 */
export const sessionsDashboardQueries: DashboardQuery[] = [
  {
    id: "revenue_kpi",
    table: "sessions",
    title: "Total Revenue",
    dimensions: [],
    measures: ["total_revenue"],
    filters: ["session_date >= CURRENT_DATE - INTERVAL '30 days'"],
    chartType: "kpi"
  },
  {
    id: "sessions_kpi",
    table: "sessions",
    title: "Total Sessions",
    dimensions: [],
    measures: ["session_count"],
    filters: ["session_date >= CURRENT_DATE - INTERVAL '30 days'"],
    chartType: "kpi"
  },
  {
    id: "visitors_kpi",
    table: "sessions",
    title: "Unique Visitors",
    dimensions: [],
    measures: ["unique_visitors"],
    filters: ["session_date >= CURRENT_DATE - INTERVAL '30 days'"],
    chartType: "kpi"
  },
  {
    id: "conversion_kpi",
    table: "sessions",
    title: "Trial Signup Rate",
    dimensions: [],
    measures: ["trial_signup_rate"],
    filters: ["session_date >= CURRENT_DATE - INTERVAL '30 days'"],
    chartType: "kpi"
  },
  {
    id: "plan_performance",
    table: "sessions",
    title: "Plan Performance",
    dimensions: ["current_plan_tier"],
    measures: ["session_count", "total_revenue"],
    filters: ["session_date >= CURRENT_DATE - INTERVAL '90 days'"],
    chartType: "bar"
  },
  {
    id: "traffic_source_performance",
    table: "sessions",
    title: "Traffic Source Performance",
    dimensions: ["traffic_source"],
    measures: ["session_count", "unique_visitors", "total_revenue"],
    filters: ["session_date >= CURRENT_DATE - INTERVAL '90 days'"],
    chartType: "bar"
  },
  {
    id: "sessions_over_time",
    table: "sessions",
    title: "Sessions Over Time",
    dimensions: ["session_date"],
    measures: ["session_count", "unique_visitors"],
    filters: ["session_date >= CURRENT_DATE - INTERVAL '12 weeks'"],
    chartType: "line"
  },
  {
    id: "lifecycle_funnel",
    table: "sessions",
    title: "Lifecycle Funnel",
    dimensions: ["max_lifecycle_stage"],
    measures: ["unique_visitors"],
    filters: ["session_date >= CURRENT_DATE - INTERVAL '90 days'"],
    chartType: "funnel"
  },
  {
    id: "activation_performance",
    table: "sessions",
    title: "Activation Performance",
    dimensions: ["traffic_source_type"],
    measures: ["total_active_activation_sessions", "session_count"],
    filters: ["session_date >= CURRENT_DATE - INTERVAL '90 days'"],
    chartType: "bar"
  }
];

/**
 * Users dashboard queries using semantic layer
 * Uses actual measures from semantic-users-metadata.json
 */
export const usersDashboardQueries: DashboardQuery[] = [
  {
    id: "users_total_revenue",
    table: "users",
    title: "Total Lifetime Revenue",
    dimensions: [],
    measures: ["total_lifetime_revenue"],
    filters: null,
    chartType: "kpi"
  },
  {
    id: "users_count_kpi",
    table: "users",
    title: "Total Users",
    dimensions: [],
    measures: ["unique_users"],
    filters: null,
    chartType: "kpi"
  },
  {
    id: "paying_customers_kpi",
    table: "users",
    title: "Paying Customers",
    dimensions: [],
    measures: ["total_paying_customers"],
    filters: null,
    chartType: "kpi"
  },
  {
    id: "active_users_30d_kpi",
    table: "users",
    title: "Active Users (30d)",
    dimensions: [],
    measures: ["active_users_30d"],
    filters: null,
    chartType: "kpi"
  },
  {
    id: "activation_rate_kpi",
    table: "users",
    title: "Activation Rate",
    dimensions: [],
    measures: ["activation_rate"],
    filters: null,
    chartType: "kpi"
  },
  {
    id: "lifecycle_distribution",
    table: "users",
    title: "Users by Lifecycle Stage",
    dimensions: ["current_lifecycle_stage"],
    measures: ["unique_users", "total_lifetime_revenue"],
    filters: null,
    chartType: "bar"
  },
  {
    id: "acquisition_performance",
    table: "users",
    title: "Acquisition Source Performance",
    dimensions: ["first_traffic_source"],
    measures: ["unique_users", "total_activated_users", "total_paying_customers"],
    filters: null,
    chartType: "bar"
  },
  {
    id: "plan_distribution",
    table: "users",
    title: "Revenue by Plan Tier",
    dimensions: ["plan_tier"],
    measures: ["unique_users", "total_lifetime_revenue", "avg_revenue_per_user"],
    filters: ["current_plan_tier IS NOT NULL", "current_plan_tier != ''"],
    chartType: "bar"
  },
  {
    id: "engagement_cohorts",
    table: "users",
    title: "User Engagement Cohorts",
    dimensions: ["recent_activity"],
    measures: ["unique_users", "avg_events_30d", "avg_revenue_30d"],
    filters: null,
    chartType: "bar"
  },
  {
    id: "customer_type_breakdown",
    table: "users",
    title: "Customer Type Breakdown",
    dimensions: ["customer_type"],
    measures: ["unique_users", "total_lifetime_revenue", "avg_revenue_per_user"],
    filters: null,
    chartType: "bar"
  }
];

/**
 * Get available dimensions and measures for a table
 * Useful for building dynamic query builders
 */
export function getAvailableFields(table: "sessions" | "users") {
  return {
    dimensions: extractAllDimensionNames(table),
    measures: extractAllMeasureNames(table)
  };
}
