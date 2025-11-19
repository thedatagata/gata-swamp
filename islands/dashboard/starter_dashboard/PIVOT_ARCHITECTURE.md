# WebDataRocks Pivot Architecture

## Overview

This document describes the architecture for WebDataRocks pivot table integration in DATA_GATA, including the evolution from previous charting approaches.

## Architecture Evolution

### 1st Iteration: Observable Plot
- **Why it failed**: Server-side SVG generation incompatible with Fresh's island architecture
- **Key learning**: Need client-side rendering for interactivity

### 2nd Iteration: Recharts  
- **Why it failed**: React-specific library incompatible with Fresh's Preact foundation
- **Key learning**: Framework compatibility is critical

### 3rd Iteration: Chart.js (Current - Charts)
- **Status**: ✅ Success for line/bar/area charts
- **Architecture**: Islands-first with client-side canvas rendering
- **Component**: `AutoChart.tsx` handles multiple chart types with semantic layer integration

### 3rd Iteration: WebDataRocks (Current - Pivots)
- **Status**: ✅ Active implementation
- **Use case**: Interactive pivot tables for multi-dimensional analysis
- **Architecture**: Two-phase data preparation → slice generation

---

## Core Components

### 1. `slice-object-generator.ts` 
**Location**: `utils/semantic/slice-object-generator.ts`

**Purpose**: Auto-generates WebDataRocks slice configurations from query columns

**Key Functions**:
- `generateSliceObject(columns)` - Auto-categorizes and builds slice
- `buildCustomSlice(config)` - Manual slice control
- `categorizeColumns(columns)` - Groups columns by type

**Column Categorization**:
```typescript
Sequences    → columns  // dates, funnel steps (time-ordered)
Dimensions   → rows     // traffic source, plan tier (categories)
Binary flags → rows     // is_anonymous, trial_signup (0/1 flags)
Measures     → measures // revenue, events (numeric aggregates)
IDs          → measures // session_id, cookie_id (count/distinctcount)
```

**Hierarchies**: Auto-detects hierarchy fields and adds:
- `drills: { drillAll: true }`
- `expands: { expandAll: true }`

---

### 2. `sessions_pivot_src_metadata.json`
**Location**: `static/sessions_pivot_src_metadata.json`

**Purpose**: Schema definition for all columns in `sessions_pivot_src` table

**Type System**:
```json
{
  "session_date": { "type": "date" },
  "traffic_source_type": { 
    "type": "level", 
    "hierarchy": "Traffic" 
  },
  "traffic_source": { 
    "type": "level", 
    "hierarchy": "Traffic",
    "parent": "traffic_source_type" 
  },
  "session_revenue": { "type": "number" }
}
```

**Types**: string, number, date, datetime, month, weekday, level (hierarchy)

---

### 3. `pivot-query-builder.ts`
**Location**: `utils/semantic/pivot-query-builder.ts`

**Purpose**: SQL → Report translation layer

**Key Functions**:
- `buildReportFromSQL(sql)` - Extracts columns, generates slice, returns config
- `prepareDataForWebDataRocks(rows)` - Prepends metadata object to data array
- `extractColumnsFromSQL(sql)` - Parses SELECT clause for column names
- `validateQueryColumns(columns)` - Checks against metadata

**Process**:
```
SQL Query 
  → Extract columns
  → Validate against metadata
  → Generate slice (via slice-object-generator)
  → Return {sql, slice, columns, warnings}
```

---

### 4. `WebDataRocksPivot.tsx`
**Location**: `islands/dashboard/starter_dashboard/WebDataRocksPivot.tsx`

**Purpose**: Preact island component that renders WebDataRocks pivots

**Props**:
```typescript
{
  data: any[],              // Query results (with or without metadata)
  initialSlice?: any,       // Optional pre-built slice
  onReportComplete?: (pivot) => void
}
```

**Smart Metadata Detection**:
```typescript
// Detects if metadata already prepended
if (hasMetadata) {
  // Use as-is (from BaseDashboardWizard)
} else {
  // Prepend metadata (standalone usage)
}
```

**Process**:
1. Sanitize data (handle BigInt, Uint8Array)
2. Check for existing metadata
3. Generate or use provided slice
4. Initialize WebDataRocks with config

---

### 5. `BaseDashboardWizard.tsx`
**Location**: `islands/dashboard/starter_dashboard/BaseDashboardWizard.tsx`

**Purpose**: Query builder UI that orchestrates the full pipeline

**Workflow**:
```
User SQL
  ↓
buildReportFromSQL() → {sql, slice, warnings}
  ↓
Execute query via MotherDuck
  ↓
prepareDataForWebDataRocks() → [metadata, ...rows]
  ↓
Pass to WebDataRocksPivot
  ↓
Render interactive pivot
```

**Features**:
- SQL validation and warnings
- Query result preview
- Auto-slice generation from SELECT clause
- 1MB limit handling with upgrade upsell

---

## Data Flow Diagram

```
┌─────────────────────┐
│   User writes SQL   │
│   SELECT a, b, c    │
│   FROM table        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ buildReportFromSQL  │
│  - Extract columns  │
│  - Validate schema  │
│  - Generate slice   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Execute on         │
│  MotherDuck         │
│  (DuckDB WASM)      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ prepareForWDR       │
│ [metadata, ...rows] │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ WebDataRocksPivot   │
│  - Detect metadata  │
│  - Build config     │
│  - Render pivot     │
└─────────────────────┘
```

---

## Critical Implementation Details

### 1. Metadata Object (MUST BE FIRST ELEMENT)

```typescript
const data = [
  // First element: Metadata
  {
    session_date: { type: "date" },
    traffic_source: { type: "level", hierarchy: "Traffic" },
    session_revenue: { type: "number" }
  },
  // Rest: Actual data
  { session_date: "2024-01-01", traffic_source: "google", session_revenue: 100 },
  { session_date: "2024-01-02", traffic_source: "direct", session_revenue: 150 }
];
```

**Why**: WebDataRocks requires type information to properly handle hierarchies, dates, and aggregations

---

### 2. Aggregation Strategy

**Binary Flags** (0/1 values):
```typescript
{
  uniqueName: "trial_signup",
  aggregation: "sum",              // Count of trials
  availableAggregations: ["sum", "avg"]  // Avg = conversion rate
}
```

**ID Fields**:
```typescript
{
  uniqueName: "session_id",
  aggregation: "count",
  availableAggregations: ["count", "distinctcount"]
}
```

**Regular Measures**:
```typescript
{
  uniqueName: "session_revenue",
  aggregation: "sum",
  availableAggregations: ["sum", "max", "min", "avg"]
}
```

---

### 3. Hierarchy Handling

When `type: "level"` detected:
1. Auto-add `drills: { drillAll: true }` to slice
2. Auto-add `expands: { expandAll: true }` to slice
3. Enable parent/child navigation in pivot

Example hierarchy:
```
Traffic (hierarchy)
├─ traffic_source_type (parent: null)
└─ traffic_source (parent: traffic_source_type)
```

---

## Usage Patterns

### Pattern 1: Via DashboardWizard (Most Common)
```tsx
// User writes SQL
SELECT session_date, traffic_source, session_revenue
FROM amplitude.sessions_pivot_src

// Wizard handles everything:
// 1. buildReportFromSQL()
// 2. Execute query
// 3. prepareDataForWebDataRocks()
// 4. Pass to WebDataRocksPivot
```

### Pattern 2: Standalone Component
```tsx
import WebDataRocksPivot from "./WebDataRocksPivot.tsx";
import { generateSliceObject } from "../../../utils/semantic/slice-object-generator.ts";

// Component handles metadata prepending automatically
<WebDataRocksPivot 
  data={queryResults}  // Raw data without metadata
  initialSlice={null}  // Auto-generate slice
/>
```

### Pattern 3: Custom Slice
```tsx
import { buildCustomSlice } from "../../../utils/semantic/slice-object-generator.ts";

const customSlice = buildCustomSlice({
  rows: ["traffic_source"],
  columns: ["session_date"],
  measures: ["session_revenue", "session_id"],
  reportFilters: ["max_lifecycle_stage"]
});

<WebDataRocksPivot 
  data={queryResults}
  initialSlice={customSlice}
/>
```

---

## Key Learnings

### 1. Framework Compatibility First
- Verify library works with Preact before adoption
- Test SSR vs client-side rendering requirements
- Check for React-specific dependencies

### 2. Islands Architecture Benefits
- Client-side canvas rendering for interactivity
- Lazy loading reduces initial bundle size
- Independent component lifecycle management

### 3. Metadata is Critical
- WebDataRocks needs type information upfront
- Always prepend metadata as first array element
- Detect and avoid double-prepending

### 4. Auto-categorization Saves Time
- Smart column categorization beats manual config
- Sequences → columns (time-ordered data)
- Dimensions → rows (categorical data)
- Binary flags → versatile (can be rows/columns/filters)

### 5. Two-Phase Architecture Works
- Phase 1: SQL → Slice generation (query-time)
- Phase 2: Data + Slice → Visualization (render-time)
- Clear separation of concerns

---

## Troubleshooting

### Issue: Pivot shows raw numbers instead of formatted dates
**Fix**: Ensure metadata object is first element with correct `type: "date"`

### Issue: Hierarchies don't drill down
**Fix**: Verify `drills: { drillAll: true }` in slice and hierarchy defined in metadata

### Issue: Measures show wrong aggregation
**Fix**: Check `availableAggregations` array in slice measures

### Issue: Double-prepended metadata
**Fix**: `WebDataRocksPivot` now auto-detects metadata - don't prepend manually

### Issue: Query exceeds 1MB limit
**Fix**: Add WHERE clause with date range or LIMIT (wizard handles error messaging)

---

## Future Enhancements

1. **Slice Switching**: Allow users to change views without re-querying
2. **Saved Pivots**: Store favorite configurations in KV storage
3. **Export Options**: PDF, Excel, CSV export from pivots
4. **Calculated Measures**: UI for creating formulas (e.g., Revenue per Session)
5. **Conditional Formatting**: Highlight cells based on thresholds
6. **Drill-through**: Click cell → see raw data query

---

## Related Files

- `/utils/semantic/semantic-config.ts` - Semantic layer for Chart.js visualizations
- `/static/semantic-layer.json` - Measure definitions for dashboard KPIs
- `/islands/charts/AutoChart.tsx` - Chart.js visualization component
- `/utils/services/motherduck-client.ts` - DuckDB WASM connection handler
