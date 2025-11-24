// utils/launchdarkly/client.ts
import * as LDClient from "launchdarkly-js-client-sdk";

let ldClient: any = null;

export async function initializeLaunchDarkly(context: any, clientSideId?: string) {
  if (ldClient) return ldClient;
  
  // Use provided clientSideId or try to get from globalThis (passed from server)
  const ldClientId = clientSideId || (globalThis as any).__LD_CLIENT_ID__;
  
  if (!ldClientId) {
    console.warn("LaunchDarkly client ID not configured");
    return null;
  }

  ldClient = LDClient.initialize(ldClientId, context, {
    streaming: true,
  });

  await ldClient.waitForInitialization();
  console.log("✅ LaunchDarkly client initialized");
  
  return ldClient;
}

export function getLDClient() {
  return ldClient;
}

// Real-time flag change listener
export function subscribeToFlagChanges(flagKey: string, callback: (value: any) => void) {
  if (!ldClient) return;
  
  ldClient.on(`change:${flagKey}`, callback);
  console.log(`👂 Listening for changes to flag: ${flagKey}`);
}

export function unsubscribeFromFlagChanges(flagKey: string, callback: (value: any) => void) {
  if (!ldClient) return;
  ldClient.off(`change:${flagKey}`, callback);
}
