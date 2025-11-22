// islands/dashboard/smarter_dashboard/CacheManagementModal.tsx
import { useState, useEffect } from "preact/hooks";
import { metadataStore, type CacheStatus } from "../../../utils/services/metadata-store.ts";
import { trackInteraction, trackView } from "../../../utils/launchdarkly/events.ts";

interface CacheManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCacheCleared: () => void;
}

export default function CacheManagementModal({ 
  isOpen, 
  onClose, 
  onCacheCleared 
}: CacheManagementModalProps) {
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadCacheStatus();
      trackView("modal", "cache_management", "CacheManagementModal", {
        plan: "smarter"
      });
    }
  }, [isOpen]);

  async function loadCacheStatus() {
    const status = await metadataStore.getCacheStatus();
    setCacheStatus(status);
  }

  async function handleDeleteTable(tableName: string) {
    setDeleting(tableName);
    try {
      await metadataStore.deleteTableMetadata(tableName);
      trackInteraction("click", "delete_table", "cache_management", "CacheManagementModal", {
        plan: "smarter",
        value: tableName
      });
      await loadCacheStatus();
      onCacheCleared();
    } catch (err) {
      console.error('Failed to delete table:', err);
    } finally {
      setDeleting(null);
    }
  }

  async function handleClearAll() {
    if (!confirm('Are you sure you want to clear all cached tables?')) return;
    
    try {
      await metadataStore.clearAll();
      trackInteraction("click", "clear_all_cache", "cache_management", "CacheManagementModal", {
        plan: "smarter",
        value: cacheStatus?.count
      });
      await loadCacheStatus();
      onCacheCleared();
      onClose();
    } catch (err) {
      console.error('Failed to clear cache:', err);
    }
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleString();
  }

  if (!isOpen || !cacheStatus) return null;

  return (
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-gata-dark border-2 border-gata-green rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div class="bg-gata-darker border-b border-gata-green/30 p-6">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-2xl font-bold text-gata-cream flex items-center gap-2">
                <span>💾</span>
                Cache Management
              </h2>
              <p class="text-sm text-gata-cream/70 mt-1">
                Manage your cached table profiles
              </p>
            </div>
            <button
              onClick={onClose}
              class="text-gata-cream/60 hover:text-gata-cream transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Status */}
        <div class="p-6 border-b border-gata-green/30">
          <div class="flex items-center justify-between mb-4">
            <div>
              <p class="text-sm text-gata-cream/70">Cache Usage</p>
              <p class="text-2xl font-bold text-gata-cream">
                {cacheStatus.count} / {cacheStatus.limit}
              </p>
            </div>
            {cacheStatus.isAtLimit && (
              <div class="bg-amber-500/20 border border-amber-500/50 rounded-lg px-4 py-2">
                <p class="text-sm font-semibold text-amber-200">⚠️ Cache Limit Reached</p>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div class="w-full bg-gata-darker rounded-full h-2 overflow-hidden">
            <div 
              class={`h-full transition-all ${
                cacheStatus.isAtLimit ? 'bg-amber-500' : 'bg-gata-green'
              }`}
              style={{ width: `${(cacheStatus.count / cacheStatus.limit) * 100}%` }}
            />
          </div>
        </div>

        {/* Table List */}
        <div class="p-6 overflow-y-auto max-h-96">
          {cacheStatus.count === 0 ? (
            <div class="text-center py-8 text-gata-cream/60">
              <p class="text-lg mb-2">🗂️</p>
              <p>No tables cached</p>
            </div>
          ) : (
            <div class="space-y-3">
              {cacheStatus.tables.map((table) => (
                <div 
                  key={table.name}
                  class="bg-gata-darker border border-gata-green/30 rounded-lg p-4 flex items-center justify-between hover:border-gata-green/50 transition-colors"
                >
                  <div class="flex-1">
                    <p class="font-mono text-gata-cream font-semibold">
                      {table.name}
                    </p>
                    <p class="text-xs text-gata-cream/60 mt-1">
                      Cached: {formatDate(table.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteTable(table.name)}
                    disabled={deleting === table.name}
                    class="ml-4 px-4 py-2 bg-rose-600/20 text-rose-200 border border-rose-600/50 rounded hover:bg-rose-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                  >
                    {deleting === table.name ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div class="bg-gata-darker border-t border-gata-green/30 p-6 flex items-center justify-between">
          <button
            onClick={handleClearAll}
            disabled={cacheStatus.count === 0}
            class="px-4 py-2 bg-rose-600/20 text-rose-200 border border-rose-600/50 rounded hover:bg-rose-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            Clear All Cache
          </button>
          
          <button
            onClick={onClose}
            class="px-6 py-2 bg-gata-green text-gata-dark rounded font-semibold hover:bg-gata-hover transition-colors"
          >
            Done
          </button>
        </div>

        {/* Info Box */}
        {cacheStatus.isAtLimit && (
          <div class="bg-amber-950/30 border-t border-amber-400/30 p-4">
            <p class="text-xs text-amber-200">
              💡 <strong>Cache limit reached:</strong> Delete one or more tables to cache new ones. 
              This is a demo limitation - only 5 tables can be cached at once.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}