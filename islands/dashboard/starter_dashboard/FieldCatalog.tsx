// islands/dashboard/starter_dashboard/FieldCatalog.tsx
import metadata from "../../../static/starter/users-pivot-metadata.json" with { type: "json" };

interface FieldInfo {
  name: string;
  columnType: string;
  dataType: string;
  description: string;
  drillDown: boolean;
  expand: boolean;
  filter: boolean;
  sort: boolean;
}

const BINARY_FLAGS = [
  'is_currently_anonymous',
  'has_trial_signup',
  'is_paying_customer',
  'has_reached_activation',
  'has_purchased_plan',
  'reached_awareness',
  'reached_interest',
  'reached_consideration',
  'reached_trial',
  'reached_expansion',
  'reached_retention',
  'is_active_30d'
];

const FIELD_DESCRIPTIONS: Record<string, string> = {
  cookie_id: "Unique user identifier",
  first_session_date: "Date of first session",
  last_session_date: "Date of most recent session",
  first_session_time: "Timestamp of first session",
  last_session_time: "Timestamp of most recent session",
  days_active: "Number of days user was active",
  days_since_last_session: "Days since user's last session",
  total_sessions: "Total number of sessions",
  session_frequency: "Session frequency metric",
  returning_sessions: "Count of returning sessions",
  first_traffic_source: "First touch traffic source",
  first_traffic_source_type: "First touch traffic source type",
  is_currently_anonymous: "Whether user is currently anonymous",
  current_lifecycle_stage: "Current lifecycle stage",
  current_plan_tier: "Current subscription plan tier",
  highest_funnel_step_reached: "Highest funnel step reached",
  has_trial_signup: "Whether user has signed up for trial",
  is_paying_customer: "Whether user is paying customer",
  has_reached_activation: "Whether user has reached activation",
  has_purchased_plan: "Whether user has purchased a plan",
  reached_awareness: "Whether user reached awareness stage",
  reached_interest: "Whether user reached interest stage",
  reached_consideration: "Whether user reached consideration stage",
  reached_trial: "Whether user reached trial stage",
  reached_expansion: "Whether user reached expansion stage",
  reached_retention: "Whether user reached retention stage",
  total_funnel_conversions: "Total funnel conversion count",
  lifecycle_journey: "User's lifecycle journey path",
  unique_stages_reached: "Number of unique lifecycle stages reached",
  total_interest_events: "Total interest stage events",
  total_consideration_events: "Total consideration stage events",
  total_trial_events: "Total trial stage events",
  total_activation_events: "Total activation stage events",
  total_retention_events: "Total retention events",
  total_events: "Total lifetime events",
  interest_active_sessions: "Sessions with interest activity",
  consideration_active_sessions: "Sessions with consideration activity",
  trial_active_sessions: "Sessions with trial activity",
  activation_active_sessions: "Sessions with activation activity",
  customer_active_sessions: "Sessions with customer activity",
  lifetime_revenue: "Total lifetime revenue",
  events_30d: "Events in last 30 days",
  revenue_30d: "Revenue in last 30 days",
  is_active_30d: "Whether user is active in last 30 days"
};

function categorizeField(fieldName: string, meta: any): FieldInfo {
  const type = meta.type;
  const hierarchy = meta.hierarchy;
  const isBinary = BINARY_FLAGS.includes(fieldName);
  const isId = fieldName.includes('_id');
  
  let columnType = "measure";
  let dataType = type;
  let drillDown = false;
  let expand = false;
  let filter = false;
  let sort = false;
  
  if (type === "level") {
    columnType = "dimension";
    dataType = "group";
    drillDown = true;
    expand = true;
    filter = true;
  } else if (type === "string" && !isId) {
    columnType = "dimension";
    dataType = "text";
    filter = true;
  } else if (["date", "month", "weekday", "datetime"].includes(type)) {
    columnType = "dimension";
    dataType = type;
    filter = true;
    sort = true;
  } else if (type === "number" && isBinary) {
    columnType = "dimension & measure";
    dataType = "boolean";
    filter = true;
  } else if (type === "number" || isId) {
    columnType = "measure";
    dataType = "number";
    sort = true;
  }
  
  return {
    name: fieldName,
    columnType,
    dataType,
    description: FIELD_DESCRIPTIONS[fieldName] || "Numeric metric for analysis",
    drillDown,
    expand,
    filter,
    sort
  };
}

function getDataTypeColor(dataType: string): { bg: string; text: string } {
  const colorMap: Record<string, { bg: string; text: string }> = {
    'group': { bg: 'bg-[#90C137]/20', text: 'text-gata-lime' },
    'text': { bg: 'bg-[#90C137]/20', text: 'text-gata-sage' },
    'date': { bg: 'bg-[#90C137]/20', text: 'text-gata-chartreuse' },
    'month': { bg: 'bg-[#90C137]/20', text: 'text-gata-chartreuse' },
    'weekday': { bg: 'bg-[#90C137]/20', text: 'text-gata-chartreuse' },
    'datetime': { bg: 'bg-[#90C137]/20', text: 'text-gata-chartreuse' },
    'boolean': { bg: 'bg-[#90C137]/20', text: 'text-gata-yellow' },
    'number': { bg: 'bg-[#186018]', text: 'text-gata-cream' },
  };
  return colorMap[dataType] || { bg: 'bg-[#186018]', text: 'text-gata-cream' };
}

export default function FieldCatalog() {
  const fields: FieldInfo[] = Object.entries(metadata).map(([name, meta]) =>
    categorizeField(name, meta)
  );

  return (
    <div class="bg-gata-dark border border-gata-green/30 rounded-lg shadow-lg p-6 mb-6">
      <h2 class="text-xl font-bold text-gata-cream mb-2">📚 Available Fields</h2>
      <p class="text-sm text-gata-cream/70 mb-4">
        All fields from users_fct table - user-level metrics, cohorts, and attribution
      </p>

      <div class="overflow-x-auto">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="border-b-2 border-gata-green/50">
              <th class="text-left p-3 text-gata-green font-semibold">Column</th>
              <th class="text-left p-3 text-gata-green font-semibold">Column Type</th>
              <th class="text-left p-3 text-gata-green font-semibold">Data Type</th>
              <th class="text-left p-3 text-gata-green font-semibold">Description</th>
              <th class="text-center p-3 text-gata-green font-semibold">Drill Down</th>
              <th class="text-center p-3 text-gata-green font-semibold">Expand</th>
              <th class="text-center p-3 text-gata-green font-semibold">Filter</th>
              <th class="text-center p-3 text-gata-green font-semibold">Sort</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, i) => (
              <tr key={field.name} class={`border-b border-gata-green/10 ${i % 2 === 0 ? 'bg-gata-dark' : 'bg-gata-dark/50'}`}>
                <td class="p-3 text-gata-cream font-mono text-xs">{field.name}</td>
                <td class="p-3 text-gata-cream/80 text-xs">
                  <span class={`px-2 py-1 rounded ${getDataTypeColor(field.dataType).bg} ${getDataTypeColor(field.dataType).text}`}>
                    {field.columnType}
                  </span>
                </td>
                <td class="p-3 text-gata-cream/80 text-xs">
                  <span class={`px-2 py-1 rounded font-mono ${getDataTypeColor(field.dataType).bg} ${getDataTypeColor(field.dataType).text}`}>
                    {field.dataType}
                  </span>
                </td>
                <td class="p-3 text-gata-cream/70 text-xs max-w-md">{field.description}</td>
                <td class="p-3 text-center">
                  {field.drillDown ? <span class="text-green-400 text-lg">✓</span> : <span class="text-gata-red text-lg">✗</span>}
                </td>
                <td class="p-3 text-center">
                  {field.expand ? <span class="text-green-400 text-lg">✓</span> : <span class="text-gata-red text-lg">✗</span>}
                </td>
                <td class="p-3 text-center">
                  {field.filter ? <span class="text-green-400 text-lg">✓</span> : <span class="text-gata-red text-lg">✗</span>}
                </td>
                <td class="p-3 text-center">
                  {field.sort ? <span class="text-green-400 text-lg">✓</span> : <span class="text-gata-red text-lg">✗</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div class="mt-4 p-3 bg-gata-green/10 rounded border border-gata-green/30">
        <p class="text-xs text-gata-cream/70 mb-3">
          <span class="font-semibold text-gata-green">Tip:</span> Dimensions group data (traffic source, date),
          measures aggregate data (revenue, event counts). Binary flags can be both - use as dimensions to split traffic,
          or as measures to count/rate.
        </p>
        <div class="flex flex-wrap gap-3 text-xs">
          <span class="flex items-center gap-1">
            <span class="px-2 py-0.5 rounded bg-gata-lime/20 text-gata-lime font-mono">group</span>
            <span class="text-gata-cream/60">hierarchical</span>
          </span>
          <span class="flex items-center gap-1">
            <span class="px-2 py-0.5 rounded bg-gata-sage/20 text-gata-sage font-mono">text</span>
            <span class="text-gata-cream/60">strings</span>
          </span>
          <span class="flex items-center gap-1">
            <span class="px-2 py-0.5 rounded bg-gata-chartreuse/20 text-gata-chartreuse font-mono">date/time</span>
            <span class="text-gata-cream/60">temporal</span>
          </span>
          <span class="flex items-center gap-1">
            <span class="px-2 py-0.5 rounded bg-gata-yellow/20 text-gata-yellow font-mono">boolean</span>
            <span class="text-gata-cream/60">binary flags</span>
          </span>
          <span class="flex items-center gap-1">
            <span class="px-2 py-0.5 rounded bg-gata-green/20 text-gata-green font-mono">number</span>
            <span class="text-gata-cream/60">metrics</span>
          </span>
        </div>
      </div>
    </div>
  );
}
