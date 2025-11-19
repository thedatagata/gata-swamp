// islands/dashboard/starter_dashboard/FieldCatalog.tsx
import metadata from "../../../static/users-pivot-metadata.json" with { type: "json" };

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
  'has_activated',
  'is_active_7d',
  'is_active_30d',
  'is_paying_customer'
];

const FIELD_DESCRIPTIONS: Record<string, string> = {
  user_key: "Unique user identifier - count for total users",
  user_id: "Authenticated user ID - distinctcount for unique authenticated users",
  email: "User email address",
  first_device_id: "First device used by user",
  last_device_id: "Most recent device used by user",
  last_event_time: "Timestamp of user's last activity",
  last_event_date: "Date of user's last activity - group for recency analysis",
  first_event_time: "Timestamp when user first appeared",
  first_event_date: "Date when user first appeared - group for cohort analysis",
  days_since_last_event: "Days since user was last active - recency metric",
  days_active_span: "Total days between first and last event - engagement duration",
  total_events: "Lifetime event count - engagement metric",
  total_days_active: "Total unique days user was active",
  total_sessions: "Lifetime session count",
  total_revenue: "Lifetime revenue from user",
  events_24h: "Events in last 24 hours",
  events_7d: "Events in last 7 days",
  events_30d: "Events in last 30 days",
  events_90d: "Events in last 90 days",
  sessions_24h: "Sessions in last 24 hours",
  sessions_7d: "Sessions in last 7 days",
  sessions_30d: "Sessions in last 30 days",
  sessions_90d: "Sessions in last 90 days",
  days_active_7d: "Days active in last 7 days",
  days_active_30d: "Days active in last 30 days",
  days_active_90d: "Days active in last 90 days",
  revenue_7d: "Revenue in last 7 days",
  revenue_30d: "Revenue in last 30 days",
  revenue_90d: "Revenue in last 90 days",
  largest_transaction: "User's largest single transaction",
  current_plan_tier: "Current subscription tier (starter, premium, enterprise)",
  max_lifecycle_stage: "Furthest lifecycle stage reached (1-7)",
  max_lifecycle_stage_name: "Lifecycle stage name (awareness, interest, trial, etc.)",
  first_touch_utm_source: "First attribution: traffic source - drill to medium and campaign",
  first_touch_utm_medium: "First attribution: traffic medium",
  first_touch_utm_campaign: "First attribution: campaign name",
  last_touch_utm_source: "Last attribution: traffic source - drill to medium and campaign",
  last_touch_utm_medium: "Last attribution: traffic medium",
  last_touch_utm_campaign: "Last attribution: campaign name",
  has_activated: "Binary flag - reached activation milestone, sum for activated users, avg for activation rate",
  is_active_7d: "Binary flag - active in last 7 days, sum for 7d actives, avg for activity rate",
  is_active_30d: "Binary flag - active in last 30 days, sum for 30d actives, avg for activity rate",
  is_paying_customer: "Binary flag - paying customer, sum for customer count, avg for conversion rate"
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
