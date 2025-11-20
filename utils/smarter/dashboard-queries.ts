// utils/semantic/dashboard-queries.ts

export interface DashboardQuery {
  id: string;
  table: "sessions" | "users";
  dimensions?: string[];
  measures: string[];
  filters?: string[];
  title: string;
  description: string;
  chartType: 'kpi' | 'bar' | 'line' | 'funnel' | 'pie';
  chartConfig?: any;
}

// Sessions Dashboard Queries
export const sessionsDashboardQueries: DashboardQuery[] = [
  // KPI Cards for Sessions Detail Page
  {
    id: "new_vs_returning",
    table: "sessions",
    measures: ["new_vs_returning_30d", "new_vs_returning_previous_30d"],
    title: "New vs Returning Visitors",
    description: "Ratio of new to returning visitors: Last 30d vs previous 30d",
    chartType: "kpi"
  },
  {
    id: "sessions_total_revenue",
    table: "sessions",
    measures: ["revenue_last_30d", "revenue_previous_30d", "revenue_growth_rate"],
    title: "Total Revenue (30d)",
    description: "Last 30 days vs previous 30 days",
    chartType: "kpi"
  },
  {
    id: "sessions_count_kpi",
    table: "sessions",
    measures: ["sessions_last_30d", "sessions_previous_30d"],
    title: "Total Sessions (30d)",
    description: "Last 30 days vs previous 30 days",
    chartType: "kpi"
  },
  
  {
    id: "traffic_source_performance",
    table: "sessions",
    dimensions: ["traffic_source"],
    measures: ["session_count", "total_revenue"],
    title: "Traffic Source Performance",
    description: "Sessions, visitors, conversion, and revenue by source",
    chartType: "bar",
    chartConfig: {
      barmode: 'group',
      orientation: 'v'
    }
  },

  {
    id: "lifecycle_funnel",
    table: "sessions",
    dimensions: ["max_lifecycle_stage"],
    measures: ["unique_visitors"],
    filters: ["_.max_lifecycle_stage IN ('awareness', 'consideration', 'trial', 'activation', 'retention')"],
    title: "Lifecycle Funnel",
    description: "User progression through lifecycle stages",
    chartType: "funnel"
  },

  {
    id: "sessions_over_time",
    table: "sessions",
    dimensions: ["session_date"],
    measures: ["unique_visitors"],
    filters: ["_.session_date >= CURRENT_DATE - INTERVAL '12 weeks' AND _.is_customer"],
    title: "Session Trends (12 Weeks)",
    description: "Daily session patterns with conversion",
    chartType: "line"
  },

  {
    id: "plan_performance",
    table: "sessions",
    dimensions: ["plan_tier"],
    measures: ["unique_visitors", "total_revenue"],
    filters: ["_.plan_tier != ''", "_.plan_tier IS NOT NULL"],
    title: "Plan Performance",
    description: "Business Driven by Plan Tier",
    chartType: "pie"
  }
];

// Users Dashboard Queries
export const usersDashboardQueries: DashboardQuery[] = [
  // KPI Cards for Landing Overview
  {
    id: "users_activation_conversion",
    table: "users",
    measures: ["activation_rate_last_30d", "activation_rate_previous_30d"],
    title: "Trial to Activation Rate (30d)",
    description: "Conversion from trial to activation: Last 30d vs previous 30d",
    chartType: "kpi"
  },
  {
    id: "users_avg_deal_size",
    table: "users",
    measures: ["avg_deal_size_last_30d", "avg_deal_size_previous_30d"],
    title: "Avg Deal Size (30d)",
    description: "Average revenue per user: Last 30d vs previous 30d",
    chartType: "kpi"
  },
  {
    id: "users_customer_retention",
    table: "users",
    measures: ["active_customers_last_30d", "active_customers_previous_30d"],
    title: "Active Customers (30d)",
    description: "Customers with revenue: Last 30d vs previous 30d",
    chartType: "kpi"
  },
  
  // Charts
  {
    id: "lifecycle_distribution",
    table: "users",
    dimensions: ["max_lifecycle_stage_name"],
    measures: ["user_count", "avg_ltv"],
    title: "Users by Lifecycle Stage",
    description: "Distribution and LTV by lifecycle stage",
    chartType: "bar",
    chartConfig: {
      barmode: 'group',
      orientation: 'h'
    }
  },
  
  {
    id: "ltv_by_plan",
    table: "users",
    dimensions: ["current_plan_tier"],
    measures: ["user_count", "avg_ltv", "avg_sessions_per_user"],
    filters: ["_.current_plan_tier != ''", "_.current_plan_tier IS NOT NULL"],
    title: "LTV by Plan Tier",
    description: "Lifetime value and engagement by tier",
    chartType: "bar",
    chartConfig: {
      barmode: 'group',
      orientation: 'v'
    }
  },
  
  {
    id: "cohort_retention",
    table: "users",
    dimensions: ["first_event_date"],
    measures: ["user_count", "retention_rate_30d", "avg_ltv"],
    filters: ["_.first_event_date >= CURRENT_DATE - INTERVAL '12 months'"],
    title: "Monthly Cohort Retention",
    description: "Retention and LTV by signup cohort",
    chartType: "line"
  },

  {
    id: "first_touch_attribution",
    table: "users",
    dimensions: ["first_touch_utm_source"],
    measures: ["user_count", "total_ltv", "paying_customers", "activation_rate"],
    filters: ["_.first_touch_utm_source IS NOT NULL"],
    title: "First Touch Attribution",
    description: "User acquisition performance by initial source",
    chartType: "bar",
    chartConfig: {
      barmode: 'group',
      orientation: 'h'
    }
  },

  {
    id: "first_touch_campaign_performance",
    table: "users",
    dimensions: ["first_touch_utm_campaign"],
    measures: ["user_count", "avg_ltv", "customer_conversion_rate"],
    filters: ["_.first_touch_utm_campaign IS NOT NULL"],
    title: "Campaign Attribution",
    description: "LTV and conversion by first touch campaign",
    chartType: "bar",
    chartConfig: {
      orientation: 'h'
    }
  },

  {
    id: "activity_segments",
    table: "users",
    dimensions: ["is_active_30d"],
    measures: ["user_count", "avg_ltv", "avg_sessions_per_user"],
    title: "Active vs Inactive Users",
    description: "User behavior by activity status",
    chartType: "bar"
  },

  {
    id: "engagement_depth",
    table: "users",
    dimensions: ["max_lifecycle_stage_name"],
    measures: ["user_count", "avg_sessions_per_user", "avg_events_per_user"],
    title: "Engagement by Lifecycle",
    description: "Session and event activity by stage",
    chartType: "bar"
  },

  {
    id: "revenue_distribution",
    table: "users",
    dimensions: ["is_paying_customer"],
    measures: ["user_count", "total_ltv", "avg_ltv"],
    title: "Revenue Distribution",
    description: "Revenue breakdown by customer status",
    chartType: "bar"
  },

  {
    id: "new_user_trends",
    table: "users",
    dimensions: ["first_event_date"],
    measures: ["user_count", "activation_rate"],
    filters: ["_.first_event_date >= CURRENT_DATE - INTERVAL '12 weeks'"],
    title: "New User Acquisition (12 Weeks)",
    description: "Weekly new user count and activation",
    chartType: "line"
  }
];

export function getQueryById(id: string): DashboardQuery | undefined {
  return [...sessionsDashboardQueries, ...usersDashboardQueries].find(q => q.id === id);
}
