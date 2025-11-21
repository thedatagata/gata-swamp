// utils/smarter/kpi-queries.ts
import { createSemanticTables } from "./semantic-amplitude.ts";

/**
 * Get Sessions KPIs with period-over-period comparison
 * Uses window functions for 30d vs previous 30d
 */
export async function getSessionsKPIs(db: any) {
  const tables = createSemanticTables(db);
  
  // Revenue KPI
  const revenueQuery = await tables.sessions.query({
    dimensions: [],
    measures: ["total_revenue"],
    filters: ["session_date >= CURRENT_DATE - INTERVAL '60 days'"]
  });
  
  // Sessions count KPI
  const sessionsQuery = await tables.sessions.query({
    dimensions: [],
    measures: ["session_count"],
    filters: ["session_date >= CURRENT_DATE - INTERVAL '60 days'"]
  });
  
  // New sessions KPI
  const newSessionsQuery = await tables.sessions.query({
    dimensions: [],
    measures: ["new_visitor_sessions"],
    filters: ["session_date >= CURRENT_DATE - INTERVAL '60 days'"]
  });
  
  // Activation KPI
  const activationQuery = await tables.sessions.query({
    dimensions: [],
    measures: ["lifecycle_conversion_sessions"],
    filters: ["session_date >= CURRENT_DATE - INTERVAL '60 days'"]
  });
  
  // Calculate period splits with raw SQL (semantic layer doesn't support window functions)
  const periodSplitSQL = `
    WITH periods AS (
      SELECT
        SUM(CASE WHEN session_date >= CURRENT_DATE - INTERVAL '30 days' 
          THEN session_revenue ELSE 0 END) as revenue_last_30d,
        SUM(CASE WHEN session_date >= CURRENT_DATE - INTERVAL '60 days' 
          AND session_date < CURRENT_DATE - INTERVAL '30 days'
          THEN session_revenue ELSE 0 END) as revenue_previous_30d,
        
        COUNT(CASE WHEN session_date >= CURRENT_DATE - INTERVAL '30 days' 
          THEN 1 END) as sessions_last_30d,
        COUNT(CASE WHEN session_date >= CURRENT_DATE - INTERVAL '60 days' 
          AND session_date < CURRENT_DATE - INTERVAL '30 days'
          THEN 1 END) as sessions_previous_30d,
        
        COUNT(CASE WHEN session_date >= CURRENT_DATE - INTERVAL '30 days' 
          AND session_sequence_number = 1 THEN 1 END) as new_sessions_last_30d,
        COUNT(CASE WHEN session_date >= CURRENT_DATE - INTERVAL '60 days' 
          AND session_date < CURRENT_DATE - INTERVAL '30 days'
          AND session_sequence_number = 1 THEN 1 END) as new_sessions_previous_30d,
        
        COUNT(CASE WHEN session_date >= CURRENT_DATE - INTERVAL '30 days' 
          AND lifecycle_stage_conversion_session = 1 THEN 1 END) as activation_last_30d,
        COUNT(CASE WHEN session_date >= CURRENT_DATE - INTERVAL '60 days' 
          AND session_date < CURRENT_DATE - INTERVAL '30 days'
          AND lifecycle_stage_conversion_session = 1 THEN 1 END) as activation_previous_30d,
        
        AVG(CASE WHEN session_date >= CURRENT_DATE - INTERVAL '30 days' 
          AND activation_stage_reached = 1 THEN 100.0 ELSE 0.0 END) as conversion_rate_last_30d,
        AVG(CASE WHEN session_date >= CURRENT_DATE - INTERVAL '60 days' 
          AND session_date < CURRENT_DATE - INTERVAL '30 days'
          AND activation_stage_reached = 1 THEN 100.0 ELSE 0.0 END) as conversion_rate_previous_30d
      FROM session_facts
    )
    SELECT *,
      CASE WHEN revenue_previous_30d > 0 
        THEN ((revenue_last_30d - revenue_previous_30d) / revenue_previous_30d * 100)
        ELSE 0 END as revenue_growth_rate,
      CASE WHEN sessions_previous_30d > 0 
        THEN ((sessions_last_30d - sessions_previous_30d) / sessions_previous_30d * 100)
        ELSE 0 END as sessions_growth_rate,
      CASE WHEN activation_previous_30d > 0 
        THEN ((activation_last_30d - activation_previous_30d) / activation_previous_30d * 100)
        ELSE 0 END as activation_growth_rate,
      (conversion_rate_last_30d - conversion_rate_previous_30d) as conversion_rate_change
    FROM periods
  `;
  
  const result = await db.query(periodSplitSQL);
  const rows = result.toArray().map((row: any) => row.toJSON());
  return rows[0];
}

/**
 * Get Users KPIs with period-over-period comparison
 */
export async function getUsersKPIs(db: any) {
  const tables = createSemanticTables(db);
  
  // Total LTV
  const ltvQuery = await tables.users.query({
    dimensions: [],
    measures: ["total_revenue"],
    filters: null
  });
  
  // Paying customers
  const customersQuery = await tables.users.query({
    dimensions: [],
    measures: ["paying_customers"],
    filters: null
  });
  
  // Period-over-period with raw SQL
  const periodSplitSQL = `
    WITH periods AS (
      SELECT
        COUNT(CASE WHEN has_activated = 1 
          AND first_event_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as activated_last_30d,
        COUNT(CASE WHEN has_activated = 1 
          AND first_event_date >= CURRENT_DATE - INTERVAL '60 days'
          AND first_event_date < CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as activated_previous_30d,
        
        COUNT(CASE WHEN first_event_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as new_users_last_30d,
        COUNT(CASE WHEN first_event_date >= CURRENT_DATE - INTERVAL '60 days'
          AND first_event_date < CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as new_users_previous_30d,
        
        AVG(CASE WHEN first_event_date >= CURRENT_DATE - INTERVAL '30 days' 
          AND total_revenue > 0 THEN total_revenue ELSE NULL END) as avg_deal_size_last_30d,
        AVG(CASE WHEN first_event_date >= CURRENT_DATE - INTERVAL '60 days'
          AND first_event_date < CURRENT_DATE - INTERVAL '30 days'
          AND total_revenue > 0 THEN total_revenue ELSE NULL END) as avg_deal_size_previous_30d,
        
        COUNT(CASE WHEN first_event_date >= CURRENT_DATE - INTERVAL '30 days'
          AND is_paying_customer THEN 1 END) as active_customers_last_30d,
        COUNT(CASE WHEN first_event_date >= CURRENT_DATE - INTERVAL '60 days'
          AND first_event_date < CURRENT_DATE - INTERVAL '30 days'
          AND is_paying_customer THEN 1 END) as active_customers_previous_30d,
        
        SUM(total_revenue) as total_ltv,
        COUNT(CASE WHEN is_paying_customer THEN 1 END) as paying_customers
      FROM users_dim
    )
    SELECT *,
      CASE WHEN new_users_last_30d > 0 
        THEN (activated_last_30d::FLOAT / new_users_last_30d * 100)
        ELSE 0 END as activation_rate_last_30d,
      CASE WHEN new_users_previous_30d > 0 
        THEN (activated_previous_30d::FLOAT / new_users_previous_30d * 100)
        ELSE 0 END as activation_rate_previous_30d
    FROM periods
  `;
  
  const result = await db.query(periodSplitSQL);
  const rows = result.toArray().map((row: any) => row.toJSON());
  return rows[0];
}
