// utils/smarter/dashboard_utils/query-persistence.ts
import { getLDClient } from "../../launchdarkly/client.ts";
import { trackInteraction } from "../../launchdarkly/events.ts";

export interface SavedQuery {
  id: string;
  sql: string;
  prompt: string;
  table: "sessions" | "users";
  dimensions: string[];
  measures: string[];
  results?: any[];
  timestamp: number;
  resultCount?: number;
}

const SESSION_KEY = "session_queries";
const INDEXED_DB_NAME = "dasgata_queries";
const INDEXED_DB_VERSION = 1;
const STORE_NAME = "queries";

/**
 * Save a query to storage (session or IndexedDB based on flag)
 */
export async function saveQuery(query: SavedQuery): Promise<boolean> {
  const client = getLDClient();
  const canPersist = client?.variation("smarter-query-persistence", false);
  
  if (canPersist) {
    // Save to IndexedDB
    await saveToIndexedDB(query);
    
    trackInteraction("click", "save_query", "query_builder", "QueryPersistence", {
      plan: "smarter",
      value: "persist",
      storageType: "indexeddb",
      queryId: query.id
    });
    
    return true;
  } else {
    // Save to sessionStorage only
    const queries = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "[]");
    queries.push(query);
    
    // Keep only last 10 queries in session storage
    const limitedQueries = queries.slice(-10);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(limitedQueries));
    
    trackInteraction("click", "save_query", "query_builder", "QueryPersistence", {
      plan: "smarter",
      value: "session_only",
      storageType: "sessionStorage",
      queryId: query.id
    });
    
    return false;
  }
}

/**
 * Load all saved queries
 */
export async function loadQueries(): Promise<SavedQuery[]> {
  const client = getLDClient();
  const canPersist = client?.variation("smarter-query-persistence", false);
  
  if (canPersist) {
    return await loadFromIndexedDB();
  } else {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "[]");
  }
}

/**
 * Delete a saved query
 */
export async function deleteQuery(queryId: string): Promise<void> {
  const client = getLDClient();
  const canPersist = client?.variation("smarter-query-persistence", false);
  
  if (canPersist) {
    await deleteFromIndexedDB(queryId);
  } else {
    const queries = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "[]");
    const filtered = queries.filter((q: SavedQuery) => q.id !== queryId);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(filtered));
  }
  
  trackInteraction("click", "delete_query", "query_list", "QueryPersistence", {
    plan: "smarter",
    queryId
  });
}

/**
 * Clear all saved queries
 */
export async function clearAllQueries(): Promise<void> {
  const client = getLDClient();
  const canPersist = client?.variation("smarter-query-persistence", false);
  
  if (canPersist) {
    await clearIndexedDB();
  } else {
    sessionStorage.removeItem(SESSION_KEY);
  }
  
  trackInteraction("click", "clear_all_queries", "query_list", "QueryPersistence", {
    plan: "smarter"
  });
}

// ============ IndexedDB Operations ============

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(INDEXED_DB_NAME, INDEXED_DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
  });
}

async function saveToIndexedDB(query: SavedQuery): Promise<void> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(query);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    
    transaction.oncomplete = () => db.close();
  });
}

async function loadFromIndexedDB(): Promise<SavedQuery[]> {
  try {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const queries = request.result as SavedQuery[];
        // Sort by timestamp descending (newest first)
        queries.sort((a, b) => b.timestamp - a.timestamp);
        resolve(queries);
      };
      request.onerror = () => reject(request.error);
      
      transaction.oncomplete = () => db.close();
    });
  } catch (error) {
    console.error("Error loading from IndexedDB:", error);
    return [];
  }
}

async function deleteFromIndexedDB(queryId: string): Promise<void> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(queryId);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    
    transaction.oncomplete = () => db.close();
  });
}

async function clearIndexedDB(): Promise<void> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    
    transaction.oncomplete = () => db.close();
  });
}
