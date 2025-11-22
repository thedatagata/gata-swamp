// utils/launchdarkly/server.ts
import * as ld from "@launchdarkly/node-server-sdk";

let ldServerClient: any = null;

export async function initializeLDServer() {
  if (ldServerClient) return ldServerClient;
  
  const sdkKey = Deno.env.get("LAUNCHDARKLY_SDK_KEY");
  if (!sdkKey) {
    console.warn("LaunchDarkly SDK key not configured");
    return null;
  }

  ldServerClient = ld.init(sdkKey);
  await ldServerClient.waitForInitialization();
  console.log("✅ LaunchDarkly server SDK initialized");
  
  return ldServerClient;
}

export function getLDServerClient() {
  return ldServerClient;
}

// Track custom events
export function trackEvent(context: any, eventKey: string, data?: any) {
  if (!ldServerClient) return;
  ldServerClient.track(eventKey, context, data);
}
