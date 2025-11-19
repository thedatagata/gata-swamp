// utils/db.ts
let kv: Deno.Kv | null = null;
let inMemoryStore = new Map();

export async function initDatabase() {
  try {
    if (kv) return; // Already initialized
    
    try {
      // Use hardcoded path in the db directory
      kv = await Deno.openKv("./db/data.kv");
      console.log("Database initialized with local KV store");
    } catch (error) {
      console.log("Failed to initialize local KV:", error.message);
      console.log("Using in-memory fallback store for development");
      // kv will remain null and we'll use the in-memory store
    }
  } catch (error) {
    console.error("Failed to initialize database:", error);
    console.log("Using in-memory fallback store for development");
  }
}

export function getKv() {
  if (kv) return kv;
  
  // Return a mock KV implementation using in-memory Map
  return {
    get: async (key) => {
      const keyStr = JSON.stringify(key);
      return { key, value: inMemoryStore.get(keyStr) || null, versionstamp: null };
    },
    set: async (key, value) => {
      const keyStr = JSON.stringify(key);
      inMemoryStore.set(keyStr, value);
      return { ok: true, versionstamp: null };
    },
    delete: async (key) => {
      const keyStr = JSON.stringify(key);
      inMemoryStore.delete(keyStr);
      return { ok: true, versionstamp: null };
    },
    list: async function* (options) {
      for (const [keyStr, value] of inMemoryStore.entries()) {
        const key = JSON.parse(keyStr);
        if (!options.prefix || key[0] === options.prefix[0]) {
          yield { key, value, versionstamp: null };
        }
      }
    }
  } as unknown as Deno.Kv;
}