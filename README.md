
# System Architecture: Auto-Chart Analytics Dashboard

## High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│                    (DashboardPageWithAutoCharts)                │
└─────────────────────┬───────────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┬─────────────────────────┐
        │                           │                         │
        ▼                           ▼                         ▼
┌───────────────┐          ┌─────────────┐         ┌──────────────┐
│   Sessions    │          │    Users    │         │ Ask Claude   │
│   Dashboard   │          │  Dashboard  │         │  (NL Query)  │
│  (Pre-built)  │          │ (Pre-built) │         │  (Dynamic)   │
└───────┬───────┘          └──────┬──────┘         └──────┬───────┘
        │                         │                       │
        └─────────┬───────────────┘                       │
                  │                                       │
                  │                               ┌───────▼────────┐
                  │                               │   WebLLM 3B    │
                  │                               │  (Query Gen)   │
                  │                               └───────┬────────┘
                  │                                       │
                  │                                       ▼
                  │                            ┌──────────────────┐
                  │                            │  Query Response  │
                  │                            │ {table, dims,    │
                  │                            │  measures}       │
                  │                            └────────┬─────────┘
                  │                                     │
                  └─────────────┬───────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   Semantic Layer      │
                    │  (semantic-amplitude) │
                    └───────────┬───────────┘
                                │
                                ▼
                        ┌───────────────┐
                        │   DuckDB      │
                        │  (sessions_fct│
                        │   users_fct)  │
                        └───────┬───────┘
                                │
                                ▼
                        ┌───────────────┐
                        │  Query Data   │
                        │  [{...}, ...] │
                        └───────┬───────┘
                                │
                ┌───────────────┴───────────────┐
                │                               │
                ▼                               ▼
    ┌───────────────────┐         ┌─────────────────────┐
    │  Pre-built Charts │         │  Auto-Detection     │
    │  (dashboard-      │         │  (chart-detector)   │
    │   queries.ts)     │         │  ⚡ INSTANT         │
    └─────────┬─────────┘         └──────────┬──────────┘
              │                              │
              │                              ▼
              │                   ┌──────────────────────┐
              │                   │  Chart Type Decision │
              │                   │  • Time → Line       │
              │                   │  • Stage → Funnel    │
              │                   │  • 2 Dims → Heatmap  │
              │                   └──────────┬───────────┘
              │                              │
              └──────────────┬───────────────┘
                             │
                             ▼
                 ┌───────────────────────┐
                 │  Plotly Generator     │
                 │ (plotly-auto-generator│
                 │  or plotly-generator) │
                 └───────────┬───────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │ Plotly Config  │
                    │ {data, layout} │
                    └────────┬───────┘
                             │
                             ▼
                   ┌──────────────────┐
                   │   PlotlyChart    │
                   │   Component      │
                   │   (renders)      │
                   └──────────────────┘
```

## Component Responsibilities

### 1. UI Layer

**DashboardPageWithAutoCharts.tsx**
- Tab navigation (Sessions, Users, Ask Claude)
- WebLLM initialization
- Route requests to appropriate dashboards

**SessionsDashboard.tsx / UsersDashboard.tsx**
- Load pre-built queries from dashboard-queries.ts
- Display KPI cards
- Render pre-configured charts

**Ask Claude Tab**
- Natural language input
- Show auto-generated charts with detection reasoning
- Display raw data

### 2. Query Generation Layer

**webllm-handler-auto.ts**
- Convert natural language → semantic query
- Execute query against semantic layer
- Call chart auto-detection
- Return complete result (query + data + chart config)

**Key Method:**
```typescript
async generateQueryWithChart(prompt: string): Promise<{
  query: QueryResponse;        // What was queried
  data: any[];                 // Query results
  plotlyConfig: any;           // Ready-to-render chart
  chartDetection: ChartDetectionResult; // Why this chart
}>
```

### 3. Semantic Layer

**semantic-amplitude.ts (SemanticTable)**
- Translate semantic query → SQL
- Execute against DuckDB
- Return results as array of objects

**config.ts**
- Semantic layer metadata
- Dimension/measure definitions
- Optimized prompts for LLM

### 4. Chart Detection Layer (⭐ NEW)

**chart-detector.ts**
- Analyze query structure
- Apply BSL-style detection rules
- Return chart type + reasoning

**Detection Logic:**
```typescript
if (hasTimeDimension) return 'line';
if (isFunnelDimension) return 'funnel';
if (numDimensions === 2) return 'heatmap';
if (numMeasures > 1) return 'bar' (grouped);
// ... etc
```

### 5. Visualization Layer

**plotly-auto-generator.ts**
- Take query + data + chart type
- Generate Plotly configuration
- Handle all chart types (line, bar, heatmap, etc.)

**plotly-generator.ts** (for pre-built)
- Similar but for dashboard-queries.ts
- Used by SessionsDashboard/UsersDashboard

**PlotlyChart.tsx**
- Wrapper component
- Load Plotly.js dynamically
- Handle loading states

## Data Flow Examples

### Example 1: Pre-Built Dashboard Chart

```
SessionsDashboard loads
  ↓
Reads dashboard-queries.ts
  ↓
For each query:
  ↓
SemanticTable.query({dimensions, measures, filters})
  ↓
DuckDB executes SQL
  ↓
Returns data
  ↓
plotly-generator.ts creates config
  ↓
PlotlyChart renders
```

**Time: 2-5 seconds (on load)**

### Example 2: Natural Language Query with Auto-Chart

```
User types: "conversion rate by traffic source"
  ↓
webllm-handler-auto.generateQueryWithChart()
  ↓
WebLLM 3B model generates:
  {table: "sessions", 
   dimensions: ["traffic_source"],
   measures: ["conversion_rate"]}
  ↓
SemanticTable.query() executes against DuckDB
  ↓
Returns: [{traffic_source: "direct", conversion_rate: 12.5}, ...]
  ↓
chart-detector.ts analyzes:
  - Single dimension ✓
  - Single measure ✓
  → Decision: BAR CHART
  ↓
plotly-auto-generator.ts creates bar chart config
  ↓
Returns complete result with chart
  ↓
PlotlyChart renders
```

**Time: 2-4 seconds total**

## File Dependencies

### Core Dependencies
```
DashboardPageWithAutoCharts
  ├── webllm-handler-auto
  │     ├── config (semantic layer)
  │     ├── semantic-amplitude
  │     ├── chart-detector ⭐
  │     └── plotly-auto-generator ⭐
  ├── SessionsDashboard
  │     ├── dashboard-queries
  │     ├── semantic-amplitude
  │     └── plotly-generator
  ├── UsersDashboard
  │     └── (same as Sessions)
  └── Components
        ├── KPICard
        └── PlotlyChart
```

### Standalone Components
```
SemanticExperience (alternative UI)
  └── webllm-handler-auto
```

## Key Innovations

### 1. BSL-Style Auto-Detection ⭐
**Instead of:** Ask LLM "what chart should I use?"
**We do:** Analyze query structure → apply deterministic rules

**Benefits:**
- 100x faster (<1ms vs 2000ms)
- 100% consistent
- Fully customizable
- No extra LLM calls

### 2. Integrated LLM Query Generation
**Instead of:** Require users to write SQL
**We do:** Natural language → semantic query → auto-chart

**Benefits:**
- Non-technical users can query
- Semantic layer enforces consistency
- Automatic visualization

### 3. Pre-Built + Dynamic Dashboards
**Instead of:** Choose one approach
**We do:** Both! Pre-built for speed, dynamic for flexibility

**Benefits:**
- Fast initial insights (pre-built)
- Exploration capability (dynamic)
- Best of both worlds

## Technology Stack

```
┌─────────────────────────────────────────┐
│ Frontend: Fresh (Deno) + Preact         │
├─────────────────────────────────────────┤
│ Charts: Plotly.js                       │
├─────────────────────────────────────────┤
│ LLM: WebLLM (Qwen2.5-Coder-3B)        │
├─────────────────────────────────────────┤
│ Database: DuckDB WASM                   │
├─────────────────────────────────────────┤
│ Data: Amplitude (sessions + users)      │
└─────────────────────────────────────────┘
```

## Performance Characteristics

| Operation | Time | Notes |
|-----------|------|-------|
| Dashboard load | 2-5s | All pre-built charts |
| NL query (cold) | 2-4s | Query gen + execute + chart |
| NL query (warm) | 1-2s | Model cached |
| Chart detection | <1ms | Instant rule evaluation |
| Chart render | 100-300ms | Plotly rendering |
| Model init | 30-60s | First time only |

## Scaling Considerations

### Current Limits
- Single user (browser-based)
- ~1.5GB memory for 3B model
- DuckDB WASM limited by browser memory
- WebGPU required (Chrome/Edge 113+)

### Production Enhancements
- Server-side LLM for multi-user
- Redis cache for common queries
- Query result pagination
- Background chart generation
- CDN for model files

## Extension Points

### Add New Chart Type
1. Add detection rule in `chart-detector.ts`
2. Implement generator in `plotly-auto-generator.ts`
3. Test with queries matching pattern

### Customize Detection
1. Edit rules in `chart-detector.ts`
2. Adjust thresholds (cardinality, etc.)
3. Add domain-specific patterns

### Add New Data Source
1. Create SemanticTable for new source
2. Add to semantic layer config
3. Update WebLLM prompt with new tables

---

**This architecture enables fast, intelligent, automatic visualization generation while maintaining full customizability and excellent performance.**