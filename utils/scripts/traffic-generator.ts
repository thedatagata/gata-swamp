// utils/traffic-generator.ts
import { buildMultiContext, type MultiContextData } from "./launchdarkly.ts";

// Sample queries for NYC taxi dataset
const SAMPLE_QUERIES = [
  "What's the average trip distance in Manhattan?",
  "Show me peak taxi usage hours",
  "Compare fare amounts between boroughs",
  "What's the trend in tip percentages?",
  "Find the busiest pickup locations",
  "Calculate average passenger count by hour",
  "What's the correlation between distance and fare?",
  "Show me payment type distribution",
  "Find longest taxi trips by duration",
  "What's the average speed during rush hour?"
];

const TIERS = ["trial", "starter", "premium"] as const;
const ROLES = ["analyst", "viewer", "admin"];
const DEVICES = ["desktop", "mobile", "tablet"] as const;
const COMPLEXITIES = ["simple", "medium", "advanced"] as const;

// Generate random context
function generateRandomContext(): MultiContextData {
  const userId = `user-${Math.random().toString(36).substring(7)}@example.com`;
  const tier = TIERS[Math.floor(Math.random() * TIERS.length)];
  
  return {
    user: {
      key: userId,
      email: userId,
      tier,
      role: ROLES[Math.floor(Math.random() * ROLES.length)],
      sessionStart: new Date().toISOString()
    },
    session: {
      key: crypto.randomUUID(),
      queryComplexity: COMPLEXITIES[Math.floor(Math.random() * COMPLEXITIES.length)],
      deviceType: DEVICES[Math.floor(Math.random() * DEVICES.length)],
      region: "US-EAST"
    }
  };
}

// Generate traffic
export async function generateTraffic(
  numQueries: number,
  delayMs: number = 100
): Promise<{
  total: number;
  successful: number;
  failed: number;
  results: Array<{
    query: string;
    provider: string;
    latency: number;
    cost?: number;
    tier: string;
    success: boolean;
  }>;
}> {
  const results = [];
  let successful = 0;
  let failed = 0;

  console.log(`🚀 Starting traffic generation: ${numQueries} queries`);

  for (let i = 0; i < numQueries; i++) {
    const contextData = generateRandomContext();
    const ldContext = buildMultiContext(contextData);
    const query = SAMPLE_QUERIES[Math.floor(Math.random() * SAMPLE_QUERIES.length)];

    try {
      const response = await fetch("http://localhost:8000/api/ai-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          context: ldContext
        })
      });

      const data = await response.json();

      results.push({
        query,
        provider: data.provider,
        latency: data.latency,
        cost: data.cost,
        tier: contextData.user.tier,
        success: response.ok
      });

      if (response.ok) {
        successful++;
      } else {
        failed++;
      }

      // Progress indicator
      if ((i + 1) % 10 === 0) {
        console.log(`  Progress: ${i + 1}/${numQueries} queries sent`);
      }

    } catch (error) {
      console.error(`Query ${i + 1} failed:`, error);
      failed++;
      results.push({
        query,
        provider: "unknown",
        latency: 0,
        tier: contextData.user.tier,
        success: false
      });
    }

    // Rate limiting delay
    if (delayMs > 0 && i < numQueries - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  console.log(`✅ Traffic generation complete: ${successful} successful, ${failed} failed`);

  return {
    total: numQueries,
    successful,
    failed,
    results
  };
}

// Analyze results
export function analyzeResults(results: Array<{
  provider: string;
  latency: number;
  cost?: number;
  tier: string;
  success: boolean;
}>) {
  const byProvider = results.reduce((acc, r) => {
    if (!acc[r.provider]) {
      acc[r.provider] = {
        count: 0,
        totalLatency: 0,
        totalCost: 0,
        successful: 0
      };
    }
    acc[r.provider].count++;
    acc[r.provider].totalLatency += r.latency;
    acc[r.provider].totalCost += r.cost || 0;
    if (r.success) acc[r.provider].successful++;
    return acc;
  }, {} as Record<string, { count: number; totalLatency: number; totalCost: number; successful: number }>);

  const analysis = Object.entries(byProvider).map(([provider, stats]) => ({
    provider,
    queries: stats.count,
    avgLatency: Math.round(stats.totalLatency / stats.count),
    totalCost: stats.totalCost.toFixed(4),
    successRate: ((stats.successful / stats.count) * 100).toFixed(1) + "%"
  }));

  return analysis;
}