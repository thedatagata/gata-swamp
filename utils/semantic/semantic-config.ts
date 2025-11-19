// utils/semantic/config.ts
import semanticConfig from "../../static/semantic-layer.json" with { type: "json" };

export interface SemanticConfig {
  version: number;
  sessions: ModelConfig;
  users: ModelConfig;
  charts: Record<string, ChartConfig>;
}

export interface ModelConfig {
  table: string;
  description: string;
  dimensions: Record<string, DimensionConfig>;
  measures: Record<string, MeasureConfig>;
}

export interface DimensionConfig {
  column?: string;
  sql?: string;
  type: string;
  description: string;
  cardinality?: string;
  values?: string[];
  is_time_dimension?: boolean;
}

export interface MeasureConfig {
  aggregation: string;
  description: string;
  format: string;
  decimals?: number;
  currency?: string;
  unit?: string;
}

export interface ChartConfig {
  model: string;
  type: string;
  title: string;
  description?: string;
  dimensions?: string[];
  measures?: string[];
}

export function getSemanticConfig(): SemanticConfig {
  return semanticConfig as SemanticConfig;
}

export function getModelConfig(modelName: "sessions" | "users"): ModelConfig {
  return semanticConfig[modelName] as ModelConfig;
}

export function getChartConfig(chartName: string): ChartConfig | undefined {
  return semanticConfig.charts?.[chartName] as ChartConfig;
}

// Optimized for 3B model - grouped fields for better discovery
export function generateWebLLMPrompt(): string {
  const config = getSemanticConfig();
  
  return `You are a data analyst. Generate query specs in JSON format ONLY.

# Sessions Table (${config.sessions.table})
**Time Dimensions**: session_date, session_start_time, session_number
**Marketing/Attribution**: traffic_source, utm_source, utm_medium, utm_campaign, utm_content, utm_term
**User Identity**: cookie_id, device_id, session_id, is_identified, is_customer
**Behavior**: plan_tier, max_lifecycle_stage, max_funnel_step, has_conversion, reached_activation, is_conversion_session
**Key Measures**: session_count, unique_visitors, total_revenue, conversion_rate, avg_revenue_per_session
**Engagement**: total_events, avg_events_per_session, avg_session_duration
**Growth Metrics**: revenue_growth_rate, sessions_growth_rate, activation_growth_rate
**Stage Events**: awareness_events, interest_events, consideration_events, trial_events, activation_events, retention_events

# Users Table (${config.users.table})
**Time Dimensions**: first_event_date, last_event_date, first_event_time, last_event_time
**Identity**: user_key, user_id, first_device_id, last_device_id
**Attribution**: first_touch_utm_source, first_touch_utm_medium, first_touch_utm_campaign, last_touch_utm_source, last_touch_utm_medium, last_touch_utm_campaign
**Status**: current_plan_tier, max_lifecycle_stage_name, is_paying_customer, is_active_7d, is_active_30d, has_activated
**Activity Metrics**: days_active_span, days_since_last_event
**Key Measures**: user_count, paying_customers, total_ltv, avg_ltv, active_users_30d
**Engagement**: avg_sessions_per_user, avg_events_per_user, avg_days_active
**Acquisition**: new_users, new_users_7d, returning_users
**Retention**: retention_rate_7d, retention_rate_30d, activation_rate, customer_conversion_rate
**Revenue**: total_revenue_7d, total_revenue_30d, total_revenue_90d, avg_ltv_paying

# Response Format (CRITICAL - JSON ONLY, NO MARKDOWN)
{
  "table": "sessions" | "users",
  "dimensions": ["dim1"],
  "measures": ["measure1"],
  "filters": ["filter"],
  "explanation": "what this shows"
}

# Examples
"conversion rate by source" → {"table":"sessions","dimensions":["traffic_source"],"measures":["conversion_rate"],"explanation":"Conversion rates by traffic source"}

"active users by plan" → {"table":"users","dimensions":["current_plan_tier"],"measures":["active_users_30d"],"filters":["_.current_plan_tier != ''"],"explanation":"Active users by subscription tier"}

"revenue over time" → {"table":"sessions","dimensions":["session_date"],"measures":["total_revenue"],"explanation":"Revenue trends over time"}

"first touch attribution" → {"table":"users","dimensions":["first_touch_utm_source"],"measures":["user_count","total_ltv"],"explanation":"User acquisition and value by initial source"}`;
}