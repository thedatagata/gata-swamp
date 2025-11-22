// components/UpgradeModal.tsx
import { useEffect } from "preact/hooks";
import { trackView, trackInteraction } from "../utils/launchdarkly/events.ts";

interface UpgradeModalProps {
  feature: "ai_query_access" | "7b_model" | "query_persistence" | "data_limit" | "ai_analyst_access";
  trigger?: string;
  onClose: () => void;
}

interface FeatureContent {
  title: string;
  description: string;
  features: string[];
  emoji: string;
}

export default function UpgradeModal({ feature, trigger, onClose }: UpgradeModalProps) {
  useEffect(() => {
    // Track modal view
    trackView("modal", "upsell", "UpgradeModal", {
      plan: "starter",
      contentType: "upgrade",
      trigger: trigger || feature,
      feature
    });
  }, [feature, trigger]);
  
  const handleUpgradeClick = () => {
    trackInteraction("click", "upgrade_button", "upsell", "UpgradeModal", {
      plan: "starter",
      destination: "/checkout?plan=smarter",
      feature,
      trigger
    });
    
    // Redirect to checkout
    window.location.href = `/checkout?plan=smarter&feature=${feature}`;
  };
  
  const handleDismiss = () => {
    trackInteraction("dismiss", "modal_close", "upsell", "UpgradeModal", {
      plan: "starter",
      feature,
      trigger
    });
    
    onClose();
  };
  
  const content: Record<string, FeatureContent> = {
    ai_query_access: {
      title: "Unlock AI-Powered Queries",
      description: "Generate SQL instantly with natural language prompts",
      features: ["Natural language to SQL", "Query suggestions", "Error corrections"],
      emoji: "🤖"
    },
    "7b_model": {
      title: "Upgrade to 7B AI Model",
      description: "More accurate queries with our premium AI model",
      features: ["Higher accuracy", "Better context understanding", "Faster query generation"],
      emoji: "🚀"
    },
    query_persistence: {
      title: "Save Your Queries Forever",
      description: "Keep your queries across sessions with persistent storage",
      features: ["Unlimited query storage", "Access from any device", "Query history tracking"],
      emoji: "💾"
    },
    data_limit: {
      title: "Need More Data?",
      description: "Upgrade to Smarter for unlimited data processing",
      features: ["Unlimited data size", "WebLLM semantic layer", "Query persistence"],
      emoji: "📊"
    },
    ai_analyst_access: {
      title: "Add Your Personal Data Analyst",
      description: "AI-powered insights and recommendations for your analytics",
      features: [
        "Automated pattern detection",
        "Anomaly identification", 
        "Actionable recommendations",
        "Natural language explanations"
      ],
      emoji: "🧠"
    }
  };
  
  const currentContent = content[feature];
  
  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleDismiss}
    >
      <div 
        className="bg-gata-dark border-2 border-gata-green rounded-2xl shadow-2xl max-w-md w-full p-8 transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">{currentContent.emoji}</div>
          <h2 className="text-3xl font-bold text-gata-cream mb-2">
            {currentContent.title}
          </h2>
          <p className="text-gata-cream/80">
            {currentContent.description}
          </p>
        </div>
        
        <div className="bg-gata-dark/60 border border-gata-green/30 rounded-lg p-4 mb-6">
          <ul className="space-y-3">
            {currentContent.features.map((f, i) => (
              <li key={i} className="flex items-start text-gata-cream">
                <span className="text-gata-green mr-2 mt-1">✓</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={handleUpgradeClick}
            className="flex-1 bg-gradient-to-r from-gata-green to-[#a0d147] text-gata-dark font-bold py-3 px-6 rounded-lg hover:opacity-90 transition-opacity"
          >
            Upgrade to Smarter
          </button>
          <button
            onClick={handleDismiss}
            className="px-6 py-3 border border-gata-green/50 text-gata-cream rounded-lg hover:bg-gata-green/10 transition-colors"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
