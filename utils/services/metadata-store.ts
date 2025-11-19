// utils/services/metadata-store.ts
import type { ColumnMetadata } from "./table-profiler.ts";

const DB_NAME = "dasgata_metadata";
const DB_VERSION = 2; // ← Bumped from 1 to 2
const STORE_NAME = "table_profiles";

interface TableProfile {
  table_name: string;
  columns: ColumnMetadata[];
  createdAt: number;
}

class MetadataStore {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Delete old store if it exists
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }
        
        // Create new store with correct schema
        const store = db.createObjectStore(STORE_NAME, { keyPath: "table_name" });
        store.createIndex("table_name", "table_name", { unique: true });
        store.createIndex("createdAt", "createdAt", { unique: false });
      };
    });
  }

  async saveTableMetadata(tableName: string, columns: ColumnMetadata[]): Promise<void> {
    if (!this.db) await this.init();
    
    if (!tableName) {
      throw new Error("Table name is required");
    }

    if (columns.length === 0) {
      throw new Error("Cannot save empty column metadata");
    }

    const profile: TableProfile = {
      table_name: tableName,
      columns: columns,
      createdAt: Math.floor(Date.now() / 1000)
    };
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(profile);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getTableMetadata(table_name: string): Promise<ColumnMetadata[] | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(table_name);

      request.onsuccess = () => {
        const profile = request.result as TableProfile | undefined;
        resolve(profile ? profile.columns : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllTableMetadata(): Promise<TableProfile[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteTableMetadata(table_name: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(table_name);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearAll(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const metadataStore = new MetadataStore();
