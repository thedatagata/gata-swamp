// routes/checkout.tsx
import { PageProps, Handlers } from "$fresh/server.ts";

interface CheckoutData {
  plan: string;
  feature?: string;
}

export const handler: Handlers<CheckoutData> = {
  GET(req, ctx) {
    const url = new URL(req.url);
    const plan = url.searchParams.get("plan") || "starter";
    const feature = url.searchParams.get("feature") || undefined;
    
    return ctx.render({ plan, feature });
  }
};

export default function CheckoutPage({ data }: PageProps<CheckoutData>) {
  const { plan, feature } = data;
  
  const planDetails = {
    "starter": {
      name: "Starter Dashboard",
      price: "$0",
      features: ["Manual SQL queries", "Observable Plot visualizations", "Basic analytics"]
    },
    "starter-ai": {
      name: "Starter + AI",
      price: "$9/month",
      features: ["Everything in Starter", "Natural language to SQL", "MotherDuck AI query generation"]
    },
    "smarter": {
      name: "Smarter Dashboard",
      price: "$29/month",
      features: ["Everything in Starter + AI", "WebLLM-powered insights", "Advanced visualizations", "Automated analysis"]
    }
  };
  
  const selectedPlan = planDetails[plan as keyof typeof planDetails] || planDetails.starter;
  
  return (
    <div class="min-h-screen bg-gradient-to-br from-[#172217] to-[#186018] flex items-center justify-center p-4">
      <div class="max-w-2xl w-full">
        <div class="bg-[#172217]/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border-2 border-[#90C137]/30">
          <div class="text-center mb-8">
            <h1 class="text-3xl font-bold text-[#F8F6F0] mb-2">Upgrade Your Experience</h1>
            <p class="text-[#F8F6F0]/70">You're upgrading to: <span class="text-[#90C137] font-semibold">{selectedPlan.name}</span></p>
          </div>
          
          <div class="bg-[#90C137]/10 border border-[#90C137]/30 rounded-lg p-6 mb-6">
            <div class="flex justify-between items-baseline mb-4">
              <h2 class="text-2xl font-bold text-[#F8F6F0]">{selectedPlan.name}</h2>
              <span class="text-3xl font-bold text-[#90C137]">{selectedPlan.price}</span>
            </div>
            
            <ul class="space-y-2">
              {selectedPlan.features.map((feature, i) => (
                <li key={i} class="flex items-start">
                  <span class="text-[#90C137] mr-2">✓</span>
                  <span class="text-[#F8F6F0]/80">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
          
          {feature && (
            <div class="bg-amber-500/10 border border-amber-400/30 rounded-lg p-4 mb-6">
              <p class="text-amber-200 text-sm">
                🎯 You requested: <span class="font-semibold">{feature.replace(/_/g, ' ')}</span>
              </p>
            </div>
          )}
          
          <div class="space-y-3">
            <button
              onclick="alert('Payment integration coming soon! This will connect to Stripe.')"
              class="w-full py-4 bg-[#90C137] text-[#172217] font-bold rounded-lg hover:bg-[#a0d147] transition-all shadow-lg"
            >
              Complete Upgrade →
            </button>
            
            <a
              href="/app/dashboard"
              class="block w-full py-3 text-center bg-[#172217]/40 text-[#F8F6F0] border border-[#90C137]/30 rounded-lg hover:bg-[#172217]/60 transition-all"
            >
              ← Back to Dashboard
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
