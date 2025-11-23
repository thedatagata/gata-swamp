// utils/smarter/overview_dashboards/kpi-queries.ts
import { createSemanticTables } from "../dashboard_utils/semantic-amplitude.ts";

/**
 * Get Sessions KPIs with period-over-period comparison
 * Uses semantic layer for standard metrics and raw SQL for period comparisons
 */
export async function getSessionsKPIs(db: any) {
  const periodSplitSQL = `
    WITH periods AS (
      SELECT
        -- New vs Returning (convert to percentage 0-100)
        AVG(CASE WHEN session_date >= today() - INTERVAL '30 days' 
          THEN is_returning_user * 100.0 END) as new_vs_returning_30d,
        AVG(CASE WHEN session_date >= today() - INTERVAL '60 days' 
          AND session_date < today() - INTERVAL '30 days'
          THEN is_returning_user * 100.0 END) as new_vs_returning_previous_30d,

        -- Paid vs Organic (convert to percentage 0-100)
        AVG(CASE 
          WHEN session_date >= today() - INTERVAL '30 days' 
            AND traffic_source IN ('facebook_paid','google_paid', 'facebook_organic', 'google_organic', 'direct')
          THEN CASE WHEN traffic_source IN ('facebook_paid', 'google_paid') THEN 100.0 ELSE 0.0 END
          ELSE NULL
        END) as paid_vs_organic_30d,
        AVG(CASE 
          WHEN session_date >= today() - INTERVAL '60 days' 
            AND session_date < today() - INTERVAL '30 days'
            AND traffic_source IN ('facebook_paid','google_paid', 'facebook_organic', 'google_organic', 'direct')
          THEN CASE WHEN traffic_source IN ('facebook_paid', 'google_paid') THEN 100.0 ELSE 0.0 END
          ELSE NULL
        END) as paid_vs_organic_previous_30d,
      
        -- Revenue metrics
        SUM(CASE WHEN session_date >= today() - INTERVAL '30 days' 
          THEN session_revenue ELSE 0 END) as revenue_last_30d,
        SUM(CASE WHEN session_date >= today() - INTERVAL '60 days' 
          AND session_date < today() - INTERVAL '30 days'
          THEN session_revenue ELSE 0 END) as revenue_previous_30d

      FROM session_facts
    )
    SELECT *,
      -- Calculate percentage point change for rates
      (new_vs_returning_30d - new_vs_returning_previous_30d) as new_vs_returning_rate,
      (paid_vs_organic_30d - paid_vs_organic_previous_30d) as paid_vs_organic_traffic_rate,

      -- Revenue growth
      CASE WHEN revenue_previous_30d > 0 
        THEN ((revenue_last_30d - revenue_previous_30d) / revenue_previous_30d * 100)
        ELSE 0 END as revenue_growth_rate
  
    FROM periods`
  
  const result = await db.query(periodSplitSQL);
  const rows = result.toArray().map((row: any) => row.toJSON());
  return rows[0];
}

/**
 * Get Users KPIs with period-over-period comparison
 * Uses semantic measures: trial_user_count, onboarding_user_count, customer_user_count
 * Filters by days_since_last_event for period comparison
 */
export async function getUsersKPIs(db: any) {
  const periodSplitSQL = `
    WITH periods AS (
      SELECT
        -- Trial Users (measure: trial_user_count filtered by days_since_last_session)
        SUM(CASE 
          WHEN current_lifecycle_stage = 'trial' AND days_since_last_session < 30
          THEN 1 ELSE 0 
        END) as trial_users_last_30d,
        SUM(CASE 
          WHEN current_lifecycle_stage = 'trial' AND days_since_last_session BETWEEN 30 AND 60
          THEN 1 ELSE 0 
        END) as trial_users_previous_30d,
        
        -- Onboarding Users (measure: onboarding_user_count filtered by days_since_last_session)
        SUM(CASE 
          WHEN current_lifecycle_stage = 'consideration' AND days_since_last_session < 30
          THEN 1 ELSE 0 
        END) as onboarding_users_last_30d,
        SUM(CASE 
          WHEN current_lifecycle_stage = 'consideration' AND days_since_last_session BETWEEN 30 AND 60
          THEN 1 ELSE 0 
        END) as onboarding_users_previous_30d,
        
        -- Customer Users (measure: customer_user_count filtered by days_since_last_session)
        SUM(CASE 
          WHEN current_lifecycle_stage in ('activation','retention') AND days_since_last_session < 30
          THEN 1 ELSE 0 
        END) as customer_users_last_30d,
        SUM(CASE 
          WHEN current_lifecycle_stage in ('activation','retention')  AND days_since_last_session BETWEEN 30 AND 60
          THEN 1 ELSE 0 
        END) as customer_users_previous_30d
      FROM users_dim
    )
    SELECT *,
      -- Calculate growth rates
      CASE WHEN trial_users_previous_30d > 0 
        THEN ((trial_users_last_30d - trial_users_previous_30d)::FLOAT / trial_users_previous_30d * 100)
        ELSE 0 END as trial_users_growth_rate,
      
      CASE WHEN onboarding_users_previous_30d > 0 
        THEN ((onboarding_users_last_30d - onboarding_users_previous_30d)::FLOAT / onboarding_users_previous_30d * 100)
        ELSE 0 END as onboarding_users_growth_rate,
        
      CASE WHEN customer_users_previous_30d > 0 
        THEN ((customer_users_last_30d - customer_users_previous_30d)::FLOAT / customer_users_previous_30d * 100)
        ELSE 0 END as customer_users_growth_rate
    FROM periods
  `;
  
  const result = await db.query(periodSplitSQL);
  const rows = result.toArray().map((row: any) => row.toJSON());
  return rows[0];
}
