// islands/dashboard/smarter_dashboard/semantic_dashboard/SavedQueries.tsx
import { useState, useEffect } from "preact/hooks";
import { getLDClient } from "../../../../utils/launchdarkly/client.ts";
import { 
  loadQueries, 
  deleteQuery, 
  clearAllQueries,
  SavedQuery 
} from "../../../../utils/smarter/dashboard_utils/query-persistence.ts";
import { trackView, trackInteraction } from "../../../../utils/launchdarkly/events.ts";
import UpgradeModal from "../../../../components/UpgradeModal.tsx";

interface SavedQueriesProps {
  onLoadQuery?: (query: SavedQuery) => void;
}

export default function SavedQueries({ onLoadQuery }: SavedQueriesProps) {
  const [canPersist, setCanPersist] = useState(false);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const client = getLDClient();
    if (client) {
      const persist = client.variation("smarter-query-persistence", false);
      setCanPersist(persist);
      
      // Show upgrade prompt after 3rd query for non-persist users
      if (!persist && savedQueries.length >= 3) {
        trackView("gate", "feature_gate", "SavedQueries", {
          plan: "smarter",
          feature: "query_persistence",
          queryCount: savedQueries.length
        });
      }
    }
  }, [savedQueries.length]);
  
  useEffect(() => {
    loadQueriesFromStorage();
  }, []);
  
  const loadQueriesFromStorage = async () => {
    setIsLoading(true);
    try {
      const queries = await loadQueries();
      setSavedQueries(queries);
    } catch (error) {
      console.error("Error loading queries:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeleteQuery = async (queryId: string) => {
    await deleteQuery(queryId);
    await loadQueriesFromStorage();
  };
  
  const handleClearAll = async () => {
    if (confirm("Delete all saved queries?")) {
      await clearAllQueries();
      await loadQueriesFromStorage();
    }
  };
  
  const handleLoadQuery = (query: SavedQuery) => {
    trackInteraction("click", "load_query", "query_list", "SavedQueries", {
      plan: "smarter",
      queryId: query.id,
      table: query.table
    });
    
    onLoadQuery?.(query);
  };
  
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };
  
  if (isLoading) {
    return (
      <div className="p-4 text-gata-cream/70">
        Loading queries...
      </div>
    );
  }
  
  return (
    <div className="bg-gata-dark/60 border border-gata-green/30 rounded-lg">
      <div className="p-4 border-b border-gata-green/20">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gata-cream">
              Saved Queries
            </h3>
            {!canPersist && (
              <p className="text-xs text-gata-cream/60 mt-1">
                Session only • {savedQueries.length}/10 queries
                <button 
                  onClick={() => setShowUpgradeModal(true)}
                  className="ml-2 text-gata-green hover:text-gata-green/80"
                >
                  Upgrade for unlimited storage
                </button>
              </p>
            )}
            {canPersist && (
              <p className="text-xs text-gata-green mt-1">
                ✓ Persistent storage enabled • {savedQueries.length} queries
              </p>
            )}
          </div>
          {savedQueries.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-xs text-gata-cream/60 hover:text-red-400 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      </div>
      
      <div className="max-h-96 overflow-y-auto">
        {savedQueries.length === 0 ? (
          <div className="p-8 text-center text-gata-cream/60">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>No saved queries yet</p>
            <p className="text-xs mt-1">Queries you save will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-gata-green/10">
            {savedQueries.map((query) => (
              <div 
                key={query.id}
                className="p-4 hover:bg-gata-green/5 transition-colors group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gata-green/20 text-gata-green">
                        {query.table}
                      </span>
                      <span className="text-xs text-gata-cream/60">
                        {formatTimestamp(query.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-gata-cream font-medium mb-1 line-clamp-2">
                      {query.prompt}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gata-cream/60">
                      <span>{query.dimensions.length} dimensions</span>
                      <span>•</span>
                      <span>{query.measures.length} measures</span>
                      {query.resultCount !== undefined && (
                        <>
                          <span>•</span>
                          <span>{query.resultCount} rows</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleLoadQuery(query)}
                      className="px-3 py-1.5 text-xs font-medium bg-gata-green/20 text-gata-green rounded hover:bg-gata-green/30 transition-colors"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => handleDeleteQuery(query.id)}
                      className="px-2 py-1.5 text-xs text-gata-cream/60 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete query"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {showUpgradeModal && (
        <UpgradeModal 
          feature="query_persistence"
          trigger="query_limit"
          onClose={() => setShowUpgradeModal(false)}
        />
      )}
    </div>
  );
}
