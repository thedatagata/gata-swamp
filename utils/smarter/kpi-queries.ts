// utils/semantic/kpi-queries.ts
// Direct SQL queries for KPIs that need window functions

export interface KPIResult {
  [key: string]: number;
}

export async function getSessionsKPIs(db: any): Promise<KPIResult> {
  const sql = `
    WITH date_ranges AS (
      SELECT
        CURRENT_DATE - INTERVAL '30 days' AS period_start_current,
        CURRENT_DATE AS period_end_current,
        CURRENT_DATE - INTERVAL '60 days' AS period_start_previous,
        CURRENT_DATE - INTERVAL '30 days' AS period_end_previous
    ),
    sessions_with_number AS (
      SELECT 
        *,
        ROW_NUMBER() OVER (PARTITION BY cookie_id, device_id ORDER BY session_start_time) AS session_number
      FROM session_facts
    )
    SELECT
      -- New Sessions
      SUM(CASE 
        WHEN session_date >= (SELECT period_start_current FROM date_ranges)
        AND session_number = 1 
        THEN 1 ELSE 0 END) AS new_sessions_last_30d,
      SUM(CASE 
        WHEN session_date >= (SELECT period_start_previous FROM date_ranges)
        AND session_date < (SELECT period_end_previous FROM date_ranges)
        AND session_number = 1 
        THEN 1 ELSE 0 END) AS new_sessions_previous_30d,
      
      -- Activations
      SUM(CASE 
        WHEN session_date >= (SELECT period_start_current FROM date_ranges)
        AND reached_activation = true 
        THEN 1 ELSE 0 END) AS activation_last_30d,
      SUM(CASE 
        WHEN session_date >= (SELECT period_start_previous FROM date_ranges)
        AND session_date < (SELECT period_end_previous FROM date_ranges)
        AND reached_activation = true 
        THEN 1 ELSE 0 END) AS activation_previous_30d,
      
      -- Revenue
      SUM(CASE 
        WHEN session_date >= (SELECT period_start_current FROM date_ranges)
        THEN session_revenue ELSE 0 END) AS revenue_last_30d,
      SUM(CASE 
        WHEN session_date >= (SELECT period_start_previous FROM date_ranges)
        AND session_date < (SELECT period_end_previous FROM date_ranges)
        THEN session_revenue ELSE 0 END) AS revenue_previous_30d,
      
      -- Sessions count
      COUNT(CASE 
        WHEN session_date >= (SELECT period_start_current FROM date_ranges)
        THEN 1 END) AS sessions_last_30d,
      COUNT(CASE 
        WHEN session_date >= (SELECT period_start_previous FROM date_ranges)
        AND session_date < (SELECT period_end_previous FROM date_ranges)
        THEN 1 END) AS sessions_previous_30d,
      
      -- Conversion rates
      CASE WHEN COUNT(CASE WHEN session_date >= (SELECT period_start_current FROM date_ranges) THEN 1 END) > 0
        THEN 100.0 * SUM(CASE WHEN session_date >= (SELECT period_start_current FROM date_ranges) AND has_conversion = true THEN 1 ELSE 0 END) 
             / COUNT(CASE WHEN session_date >= (SELECT period_start_current FROM date_ranges) THEN 1 END)
        ELSE 0 END AS conversion_rate_last_30d,
      CASE WHEN COUNT(CASE WHEN session_date >= (SELECT period_start_previous FROM date_ranges) AND session_date < (SELECT period_end_previous FROM date_ranges) THEN 1 END) > 0
        THEN 100.0 * SUM(CASE WHEN session_date >= (SELECT period_start_previous FROM date_ranges) AND session_date < (SELECT period_end_previous FROM date_ranges) AND has_conversion = true THEN 1 ELSE 0 END) 
             / COUNT(CASE WHEN session_date >= (SELECT period_start_previous FROM date_ranges) AND session_date < (SELECT period_end_previous FROM date_ranges) THEN 1 END)
        ELSE 0 END AS conversion_rate_previous_30d
    FROM sessions_with_number
  `;

  const result = await db.query(sql);
  const row = result.toArray()[0]?.toJSON() || {};
  
  // Convert BigInts to Numbers
  for (const key in row) {
    if (typeof row[key] === 'bigint') {
      row[key] = Number(row[key]);
    }
  }
  
  // Calculate growth rates
  row.revenue_growth_rate = row.revenue_previous_30d > 0 
    ? ((row.revenue_last_30d - row.revenue_previous_30d) / row.revenue_previous_30d) * 100 
    : 0;
  row.sessions_growth_rate = row.sessions_previous_30d > 0 
    ? ((row.sessions_last_30d - row.sessions_previous_30d) / row.sessions_previous_30d) * 100 
    : 0;
  row.activation_growth_rate = row.activation_previous_30d > 0 
    ? ((row.activation_last_30d - row.activation_previous_30d) / row.activation_previous_30d) * 100 
    : 0;
  row.conversion_rate_change = row.conversion_rate_last_30d - row.conversion_rate_previous_30d;
  
  return row;
}

export async function getUsersKPIs(db: any): Promise<KPIResult> {
  const sql = `
    WITH date_ranges AS (
      SELECT
        CURRENT_DATE - INTERVAL '30 days' AS period_start_current,
        CURRENT_DATE AS period_end_current,
        CURRENT_DATE - INTERVAL '60 days' AS period_start_previous,
        CURRENT_DATE - INTERVAL '30 days' AS period_end_previous
    )
    SELECT
      -- Total LTV and customers
      SUM(total_revenue) AS total_revenue,
      SUM(CASE WHEN is_paying_customer = true THEN 1 ELSE 0 END) AS paying_customers,
      
      -- Activation rate
      CASE WHEN COUNT(CASE WHEN first_event_date >= (SELECT period_start_current FROM date_ranges) THEN 1 END) > 0
        THEN 100.0 * SUM(CASE WHEN first_event_date >= (SELECT period_start_current FROM date_ranges) AND has_activated = true THEN 1 ELSE 0 END) 
             / COUNT(CASE WHEN first_event_date >= (SELECT period_start_current FROM date_ranges) THEN 1 END)
        ELSE 0 END AS activation_rate_last_30d,
      CASE WHEN COUNT(CASE WHEN first_event_date >= (SELECT period_start_previous FROM date_ranges) AND first_event_date < (SELECT period_end_previous FROM date_ranges) THEN 1 END) > 0
        THEN 100.0 * SUM(CASE WHEN first_event_date >= (SELECT period_start_previous FROM date_ranges) AND first_event_date < (SELECT period_end_previous FROM date_ranges) AND has_activated = true THEN 1 ELSE 0 END) 
             / COUNT(CASE WHEN first_event_date >= (SELECT period_start_previous FROM date_ranges) AND first_event_date < (SELECT period_end_previous FROM date_ranges) THEN 1 END)
        ELSE 0 END AS activation_rate_previous_30d,
      
      -- Average deal size (LTV per paying customer)
      CASE WHEN SUM(CASE WHEN first_event_date >= (SELECT period_start_current FROM date_ranges) AND is_paying_customer = true THEN 1 ELSE 0 END) > 0
        THEN SUM(CASE WHEN first_event_date >= (SELECT period_start_current FROM date_ranges) AND is_paying_customer = true THEN total_revenue ELSE 0 END) 
             / SUM(CASE WHEN first_event_date >= (SELECT period_start_current FROM date_ranges) AND is_paying_customer = true THEN 1 ELSE 0 END)
        ELSE 0 END AS avg_deal_size_last_30d,
      CASE WHEN SUM(CASE WHEN first_event_date >= (SELECT period_start_previous FROM date_ranges) AND first_event_date < (SELECT period_end_previous FROM date_ranges) AND is_paying_customer = true THEN 1 ELSE 0 END) > 0
        THEN SUM(CASE WHEN first_event_date >= (SELECT period_start_previous FROM date_ranges) AND first_event_date < (SELECT period_end_previous FROM date_ranges) AND is_paying_customer = true THEN total_revenue ELSE 0 END) 
             / SUM(CASE WHEN first_event_date >= (SELECT period_start_previous FROM date_ranges) AND first_event_date < (SELECT period_end_previous FROM date_ranges) AND is_paying_customer = true THEN 1 ELSE 0 END)
        ELSE 0 END AS avg_deal_size_previous_30d,
      
      -- Active customers
      SUM(CASE WHEN is_paying_customer = true AND is_active_30d = true THEN 1 ELSE 0 END) AS active_customers_last_30d,
      SUM(CASE WHEN is_paying_customer = true AND last_event_date >= (SELECT period_start_previous FROM date_ranges) AND last_event_date < (SELECT period_end_previous FROM date_ranges) THEN 1 ELSE 0 END) AS active_customers_previous_30d
    FROM users_dim
  `;

  const result = await db.query(sql);
  return result.toArray()[0]?.toJSON() || {};
}