// utils/smarter/semantic-dashboard-queries.ts
import { getSemanticMetadata } from "./semantic-config.ts";

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
 */
export const sessionsDashboardQueries: DashboardQuery[] = [
  {
    id: "revenue_comparison",
    table: "sessions",
    title: "Revenue Comparison",
    dimensions: [],
    measures: ["revenue_last_30d", "revenue_prev_30d"],
    filters: null,
    chartType: "kpi"
  },
  {
    id: "sessions_comparison",
    table: "sessions",
    title: "Sessions Comparison",
    dimensions: [],
    measures: ["sessions_last_30d", "sessions_prev_30d"],
    filters: null,
    chartType: "kpi"
  },
  {
    id: "new_vs_returning",
    table: "sessions",
    title: "New vs Returning",
    dimensions: [],
    measures: ["new_visitor_sessions", "returning_visitor_sessions"],
    filters: null,
    chartType: "kpi"
  },
  {
    id: "plan_performance",
    table: "sessions",
    title: "Plan Performance",
    dimensions: ["plan_tier"],
    measures: ["session_count", "total_revenue"],
    filters: null,
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
    filters: null,
    chartType: "funnel"
  }
];

/**
 * Users dashboard queries using semantic layer
 */
export const usersDashboardQueries: DashboardQuery[] = [
  {
    id: "users_total_revenue",
    table: "users",
    title: "Total Revenue",
    dimensions: [],
    measures: ["total_revenue"],
    filters: null,
    chartType: "kpi"
  },
  {
    id: "users_count_kpi",
    table: "users",
    title: "Total Users",
    dimensions: [],
    measures: ["user_count"],
    filters: null,
    chartType: "kpi"
  },
  {
    id: "active_users_kpi",
    table: "users",
    title: "Active Users (30d)",
    dimensions: [],
    measures: ["active_users_30d"],
    filters: null,
    chartType: "kpi"
  },
  {
    id: "paying_customers_kpi",
    table: "users",
    title: "Paying Customers",
    dimensions: [],
    measures: ["paying_customers"],
    filters: null,
    chartType: "kpi"
  },
  {
    id: "lifecycle_distribution",
    table: "users",
    title: "Users by Lifecycle Stage",
    dimensions: ["lifecycle_stage"],
    measures: ["user_count", "total_revenue"],
    filters: null,
    chartType: "bar"
  },
  {
    id: "acquisition_performance",
    table: "users",
    title: "Acquisition Source Performance",
    dimensions: ["first_touch_source"],
    measures: ["user_count", "activated_users", "paying_customers"],
    filters: null,
    chartType: "bar"
  },
  {
    id: "plan_distribution",
    table: "users",
    title: "Revenue by Plan Tier",
    dimensions: ["plan_tier"],
    measures: ["user_count", "total_revenue"],
    filters: null,
    chartType: "bar"
  }
];
