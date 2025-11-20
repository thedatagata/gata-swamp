// utils/smarter/dashboard-queries-v2.ts
import { QueryGenerator, type QuerySpec, type KPISpec, createDateRangeFilter } from "./query-generator.ts";

/**
 * Dashboard query builder for pre-defined KPIs and charts
 */
export class DashboardQueryBuilder {
  private generator: QueryGenerator;

  constructor() {
    this.generator = new QueryGenerator();
  }

  /**
   * KPI: New Sessions (Last 30d vs Previous 30d)
   */
  getNewSessionsKPI(): { sql: string; spec: KPISpec } {
    const spec: KPISpec = {
      baseMeasure: {
        column: "session_id",
        aggregation: "count_distinct"
      },
      currentPeriodFilter: [
        { column: "session_date", operator: ">=", value: "CURRENT_DATE - INTERVAL '30 days'" },
        { column: "session_sequence_number", operator: "=", value: 1 }
      ],
      previousPeriodFilter: [
        { column: "session_date", operator: ">=", value: "CURRENT_DATE - INTERVAL '60 days'" },
        { column: "session_date", operator: "<", value: "CURRENT_DATE - INTERVAL '30 days'" },
        { column: "session_sequence_number", operator: "=", value: 1 }
      ],
      alias: "new_sessions"
    };

    return {
      sql: this.generator.generateKPISQL(spec),
      spec
    };
  }

  /**
   * KPI: Total Revenue (Last 30d vs Previous 30d)
   */
  getTotalRevenueKPI(): { sql: string; spec: KPISpec } {
    const spec: KPISpec = {
      baseMeasure: {
        column: "session_revenue",
        aggregation: "sum"
      },
      currentPeriodFilter: [
        { column: "session_date", operator: ">=", value: "CURRENT_DATE - INTERVAL '30 days'" }
      ],
      previousPeriodFilter: [
        { column: "session_date", operator: ">=", value: "CURRENT_DATE - INTERVAL '60 days'" },
        { column: "session_date", operator: "<", value: "CURRENT_DATE - INTERVAL '30 days'" }
      ],
      alias: "total_revenue"
    };

    return {
      sql: this.generator.generateKPISQL(spec),
      spec
    };
  }

  /**
   * KPI: Activation Rate (Last 30d vs Previous 30d)
   */
  getActivationRateKPI(): { sql: string; spec: KPISpec } {
    const spec: KPISpec = {
      baseMeasure: {
        column: null,
        aggregation: "count"
      },
      currentPeriodFilter: [
        { column: "session_date", operator: ">=", value: "CURRENT_DATE - INTERVAL '30 days'" },
        { column: "activation_stage_reached", operator: "=", value: 1 }
      ],
      previousPeriodFilter: [
        { column: "session_date", operator: ">=", value: "CURRENT_DATE - INTERVAL '60 days'" },
        { column: "session_date", operator: "<", value: "CURRENT_DATE - INTERVAL '30 days'" },
        { column: "activation_stage_reached", operator: "=", value: 1 }
      ],
      alias: "activations"
    };

    // For rate calculation, we need total sessions too
    const totalSpec: KPISpec = {
      baseMeasure: {
        column: null,
        aggregation: "count"
      },
      currentPeriodFilter: [
        { column: "session_date", operator: ">=", value: "CURRENT_DATE - INTERVAL '30 days'" }
      ],
      previousPeriodFilter: [
        { column: "session_date", operator: ">=", value: "CURRENT_DATE - INTERVAL '60 days'" },
        { column: "session_date", operator: "<", value: "CURRENT_DATE - INTERVAL '30 days'" }
      ],
      alias: "total_sessions"
    };

    // Combined SQL for rate calculation
    const sql = `
SELECT 
  ${this.generator.generateKPISQL(spec).split('FROM')[0].replace('SELECT', '').trim()},
  ${this.generator.generateKPISQL(totalSpec).split('FROM')[0].replace('SELECT', '').trim()},
  CASE WHEN total_sessions_current > 0 
    THEN (activations_current::FLOAT / total_sessions_current) * 100 
    ELSE 0 
  END as activation_rate_current,
  CASE WHEN total_sessions_previous > 0 
    THEN (activations_previous::FLOAT / total_sessions_previous) * 100 
    ELSE 0 
  END as activation_rate_previous
FROM sessions_pivot_src
    `.trim();

    return { sql, spec };
  }

  /**
   * Chart: Traffic Source Performance
   */
  getTrafficSourcePerformance(): { sql: string; spec: QuerySpec } {
    const spec: QuerySpec = {
      dimensions: ["traffic_source"],
      measures: [
        {
          column: null,
          aggregation: "count",
          alias: "session_count"
        },
        {
          column: "cookie_id",
          aggregation: "count_distinct",
          alias: "unique_visitors"
        },
        {
          column: "session_revenue",
          aggregation: "sum",
          alias: "total_revenue",
          decimals: 2
        }
      ],
      filters: [
        { column: "session_date", operator: ">=", value: "CURRENT_DATE - INTERVAL '90 days'" }
      ],
      orderBy: [
        { column: "total_revenue", direction: "desc" }
      ]
    };

    return {
      sql: this.generator.generateSQL(spec),
      spec
    };
  }

  /**
   * Chart: Lifecycle Funnel
   */
  getLifecycleFunnel(): { sql: string; spec: QuerySpec } {
    const spec: QuerySpec = {
      dimensions: ["max_lifecycle_stage"],
      measures: [
        {
          column: "cookie_id",
          aggregation: "count_distinct",
          alias: "unique_visitors"
        }
      ],
      filters: [
        { 
          column: "max_lifecycle_stage", 
          operator: "IN", 
          value: ["awareness", "interest", "consideration", "trial", "activation"]
        }
      ]
    };

    return {
      sql: this.generator.generateSQL(spec),
      spec
    };
  }

  /**
   * Chart: Sessions Over Time (12 weeks)
   */
  getSessionsOverTime(): { sql: string; spec: QuerySpec } {
    const spec: QuerySpec = {
      dimensions: ["session_date"],
      measures: [
        {
          column: "cookie_id",
          aggregation: "count_distinct",
          alias: "unique_visitors"
        },
        {
          column: null,
          aggregation: "count",
          alias: "session_count"
        }
      ],
      filters: [
        { column: "session_date", operator: ">=", value: "CURRENT_DATE - INTERVAL '12 weeks'" }
      ],
      orderBy: [
        { column: "session_date", direction: "asc" }
      ]
    };

    return {
      sql: this.generator.generateSQL(spec),
      spec
    };
  }

  /**
   * Chart: Revenue by Plan Tier
   */
  getRevenueByPlanTier(): { sql: string; spec: QuerySpec } {
    const spec: QuerySpec = {
      dimensions: ["plan_tier"],
      measures: [
        {
          column: "session_revenue",
          aggregation: "sum",
          alias: "total_revenue",
          decimals: 2
        },
        {
          column: "cookie_id",
          aggregation: "count_distinct",
          alias: "unique_customers"
        }
      ],
      filters: [
        { column: "plan_tier", operator: "!=", value: "" },
        { column: "plan_tier", operator: "IS NOT NULL" }
      ],
      orderBy: [
        { column: "total_revenue", direction: "desc" }
      ]
    };

    return {
      sql: this.generator.generateSQL(spec),
      spec
    };
  }

  /**
   * Chart: New vs Returning Sessions by Weekday
   */
  getNewVsReturningByWeekday(): { sql: string; spec: QuerySpec } {
    const spec: QuerySpec = {
      dimensions: ["session_weekday_name"],
      measures: [
        {
          column: null,
          aggregation: "count",
          filters: [
            { column: "session_sequence_number", operator: "=", value: 1 }
          ],
          alias: "new_visitor_sessions"
        },
        {
          column: null,
          aggregation: "count",
          filters: [
            { column: "session_sequence_number", operator: ">", value: 1 }
          ],
          alias: "returning_visitor_sessions"
        }
      ],
      filters: [
        { column: "session_date", operator: ">=", value: "CURRENT_DATE - INTERVAL '90 days'" }
      ]
    };

    return {
      sql: this.generator.generateSQL(spec),
      spec
    };
  }

  /**
   * Get all KPIs for dashboard overview
   */
  getAllKPIs() {
    return {
      newSessions: this.getNewSessionsKPI(),
      totalRevenue: this.getTotalRevenueKPI(),
      activationRate: this.getActivationRateKPI()
    };
  }

  /**
   * Get all charts for sessions dashboard
   */
  getAllSessionCharts() {
    return {
      trafficSource: this.getTrafficSourcePerformance(),
      lifecycle: this.getLifecycleFunnel(),
      overTime: this.getSessionsOverTime(),
      planTier: this.getRevenueByPlanTier(),
      newVsReturning: this.getNewVsReturningByWeekday()
    };
  }
}

// Export singleton instance
export const dashboardQueries = new DashboardQueryBuilder();
