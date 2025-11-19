// utils/semantic/dashboard-queries.ts

export interface DashboardQuery {
  id: string;
  table: "sessions" | "users";
  dimensions?: string[];
  measures: string[];
  filters?: string[];
  title: string;
  description: string;
  chartType: 'kpi' | 'bar' | 'line' | 'funnel' | 'heatmap' | 'scatter';
  chartConfig?: any;
}

// Sessions Dashboard Queries
export const sessionsDashboardQueries: DashboardQuery[] = [
  // KPI Cards for Landing Overview
  {
    id: "sessions_new_vs_returning",
    table: "sessions",
    measures: ["new_sessions_last_30d", "new_sessions_previous_30d"],
    title: "New Sessions (30d)",
    description: "First-time sessions: Last 30d vs previous 30d",
    chartType: "kpi"
  },
  {
    id: "sessions_activations",
    table: "sessions",
    measures: ["activation_last_30d", "activation_previous_30d", "activation_growth_rate"],
    title: "Activations (30d)",
    description: "Total activations: Last 30d vs previous 30d",
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
  
  // Charts
  {
    id: "revenue_by_plan",
    table: "sessions",
    dimensions: ["plan_tier"],
    measures: ["total_revenue", "session_count", "conversion_rate"],
    filters: ["_.plan_tier != ''", "_.plan_tier IS NOT NULL"],
    title: "Revenue by Plan Tier",
    description: "Revenue, sessions, and conversion by subscription tier",
    chartType: "bar",
    chartConfig: {
      barmode: 'group',
      orientation: 'v'
    }
  },
  
  {
    id: "traffic_source_performance",
    table: "sessions",
    dimensions: ["traffic_source"],
    measures: ["session_count", "unique_visitors", "conversion_rate", "total_revenue"],
    title: "Traffic Source Performance",
    description: "Sessions, visitors, conversion, and revenue by source",
    chartType: "bar",
    chartConfig: {
      barmode: 'group',
      orientation: 'v'
    }
  },

  {
    id: "utm_campaign_performance",
    table: "sessions",
    dimensions: ["utm_campaign"],
    measures: ["session_count", "conversion_rate", "total_revenue", "avg_revenue_per_session"],
    filters: ["_.utm_campaign IS NOT NULL"],
    title: "Campaign Performance",
    description: "Performance metrics by UTM campaign",
    chartType: "bar",
    chartConfig: {
      barmode: 'group',
      orientation: 'h'
    }
  },

  {
    id: "utm_source_medium",
    table: "sessions",
    dimensions: ["utm_source", "utm_medium"],
    measures: ["session_count", "conversion_rate", "total_revenue"],
    filters: ["_.utm_source IS NOT NULL", "_.utm_medium IS NOT NULL"],
    title: "Source/Medium Performance",
    description: "Performance by UTM source and medium combination",
    chartType: "bar"
  },

  {
    id: "lifecycle_funnel",
    table: "sessions",
    dimensions: ["max_lifecycle_stage"],
    measures: ["session_count", "unique_visitors"],
    filters: ["_.max_lifecycle_stage IN ('awareness', 'consideration', 'trial', 'activation', 'retention')"],
    title: "Lifecycle Funnel",
    description: "User progression through lifecycle stages",
    chartType: "funnel"
  },

  {
    id: "post_activation_cohort_retention",
    table: "sessions",
    measures: [],
    title: "Post-Activation Cohort Retention",
    description: "Weekly retention by activation cohort (26 weeks)",
    chartType: "heatmap"
  },

  {
    id: "sessions_over_time",
    table: "sessions",
    dimensions: ["session_date"],
    measures: ["session_count", "unique_visitors", "conversion_rate"],
    filters: ["_.session_date >= CURRENT_DATE - INTERVAL '12 weeks'"],
    title: "Session Trends (12 Weeks)",
    description: "Weekly session patterns with conversion",
    chartType: "line"
  },

  {
    id: "engagement_by_plan",
    table: "sessions",
    dimensions: ["plan_tier"],
    measures: ["avg_session_duration", "avg_events_per_session"],
    filters: ["_.plan_tier != ''", "_.plan_tier IS NOT NULL"],
    title: "Engagement by Plan",
    description: "Session duration and event activity by tier",
    chartType: "bar"
  },

  {
    id: "conversion_by_customer_status",
    table: "sessions",
    dimensions: ["is_customer"],
    measures: ["session_count", "conversion_rate", "avg_revenue_per_session"],
    title: "Customer vs Non-Customer Sessions",
    description: "Session behavior comparison",
    chartType: "bar"
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
