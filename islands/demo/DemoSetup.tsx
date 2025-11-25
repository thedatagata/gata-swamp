import { useState } from "preact/hooks";

interface DemoSetupProps {
  demoEmail: string;
}

export default function DemoSetup({ demoEmail }: DemoSetupProps) {
  const [step, setStep] = useState<'plan' | 'configuration' | 'checkout'>('plan');
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'smarter'>('starter');
  const [addons, setAddons] = useState({
    ai_sql: false,
    ai_analyst: false
  });
  // Prefill credentials for demo
  const [credentials, setCredentials] = useState({ username: 'test_user_1', password: 'password123' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prices = {
    starter: 9.99,
    smarter: 49.99,
    ai_sql: 9.00,
    ai_analyst: 19.00
  };

  const calculateTotal = () => {
    let total = prices[selectedPlan];
    if (addons.ai_sql) total += prices.ai_sql;
    if (addons.ai_analyst) total += prices.ai_analyst;
    return total;
  };

  const handlePlanSelect = (plan: 'starter' | 'smarter') => {
    setSelectedPlan(plan);
    setAddons({ ai_sql: false, ai_analyst: false });
    setStep('configuration');
  };

  const handleConfigurationSubmit = (e: Event) => {
    e.preventDefault();
    setStep('checkout');
  };

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);

    try {
      // Create demo account
      const res = await fetch('/api/demo/create-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: credentials.username,
          password: credentials.password,
          plan: selectedPlan,
          ai_addon_unlocked: addons.ai_sql,
          ai_analyst_unlocked: addons.ai_analyst,
          demoEmail // Link dummy account to demo user
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Account creation failed');
      }

      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Redirect to dashboard
      globalThis.location.href = '/app/dashboard';

    } catch (err) {
      setError((err as Error).message);
      setStep('configuration');
    } finally {
      setLoading(false);
    }
  };

  // --- RENDER STEPS ---

  if (step === 'plan') {
    return (
      <div class="min-h-screen bg-gradient-to-br from-[#172217] to-[#186018] flex items-center justify-center p-4">
        <div class="max-w-6xl w-full">
          <div class="text-center mb-12">
            <h1 class="text-4xl font-bold text-[#F8F6F0] mb-3">Choose Your Analytics Experience</h1>
            <p class="text-lg text-[#F8F6F0]/80">Select the dashboard that fits your needs</p>
          </div>

          <div class="grid md:grid-cols-2 gap-8">
            {/* Starter */}
            <div class="bg-[#172217]/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border-2 border-[#90C137]/30 hover:border-[#90C137] transition-all">
              <div class="text-center mb-6">
                <h2 class="text-2xl font-bold text-[#F8F6F0]">Starter Dashboard</h2>
                <p class="text-3xl font-bold text-[#90C137] mt-2">${prices.starter}<span class="text-sm text-[#F8F6F0]/60">/mo</span></p>
              </div>
              <ul class="space-y-3 mb-8 text-[#F8F6F0]/80">
                <li>✓ Manual table selection</li>
                <li>✓ Basic SQL generation</li>
                <li>✓ Observable Plot visualizations</li>
              </ul>
              <button type="button" onClick={() => handlePlanSelect('starter')} class="w-full py-3 bg-[#90C137] text-[#172217] rounded-lg font-bold hover:bg-[#a0d147]">
                Select Starter
              </button>
            </div>

            {/* Smarter */}
            <div class="bg-[#172217]/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border-2 border-[#90C137] hover:border-[#a0d147] transition-all">
              <div class="text-center mb-6">
                <h2 class="text-2xl font-bold text-[#F8F6F0]">Smarter Dashboard</h2>
                <p class="text-3xl font-bold text-[#90C137] mt-2">${prices.smarter}<span class="text-sm text-[#F8F6F0]/60">/mo</span></p>
              </div>
              <ul class="space-y-3 mb-8 text-[#F8F6F0]/80">
                <li>✓ AI-powered semantic analytics</li>
                <li>✓ Natural language queries</li>
                <li>✓ Automatic chart generation</li>
              </ul>
              <button type="button" onClick={() => handlePlanSelect('smarter')} class="w-full py-3 bg-[#90C137] text-[#172217] rounded-lg font-bold hover:bg-[#a0d147]">
                Select Smarter
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'configuration') {
    return (
      <div class="min-h-screen bg-gradient-to-br from-[#172217] to-[#186018] flex items-center justify-center p-4">
        <div class="max-w-2xl w-full bg-[#172217]/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-[#90C137]/30">
          <h2 class="text-3xl font-bold text-[#F8F6F0] mb-6 text-center">Setup Your Account</h2>
          
          {error && (
            <div class="mb-4 p-3 bg-red-900/50 border border-red-500/50 rounded text-red-200 text-sm">
              {error}
            </div>
          )}
          <style>{`
            .demo-input {
              background-color: white !important;
              color: black !important;
              -webkit-text-fill-color: black !important;
            }
          `}</style>

          {/* Demo Notice */}
          <div class="bg-blue-900/20 border border-blue-500/30 p-4 rounded-lg mb-8 flex items-start gap-3">
            <div class="text-2xl">ℹ️</div>
            <div>
              <h3 class="text-blue-200 font-bold mb-1">Demo Environment</h3>
              <p class="text-blue-200/80 text-sm">
                This is a demo environment. Please use a dummy username and password. 
                <br/>
                <span class="font-bold text-blue-100">Do not use your real email or password.</span>
                <br/>
                We've prefilled some test credentials for you below.
              </p>
            </div>
          </div>

          <form onSubmit={handleConfigurationSubmit} class="space-y-8">
            {/* Account Section */}
            <div class="space-y-4">
              <h3 class="text-xl font-bold text-[#F8F6F0] border-b border-[#90C137]/20 pb-2">1. Create Account</h3>
              <div class="grid md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm text-[#F8F6F0]/80 mb-1">Username</label>
                  <input 
                    type="text" 
                    required 
                    value={credentials.username}
                    onInput={(e) => setCredentials({...credentials, username: (e.target as HTMLInputElement).value})}
                    class="demo-input w-full p-3 !bg-white border border-[#90C137]/30 rounded-lg !text-black focus:border-[#90C137] outline-none"
                    style={{ backgroundColor: 'white', color: 'black' }}
                  />
                </div>
                <div>
                  <label class="block text-sm text-[#F8F6F0]/80 mb-1">Password</label>
                  <input 
                    type="password" 
                    required 
                    value={credentials.password}
                    onInput={(e) => setCredentials({...credentials, password: (e.target as HTMLInputElement).value})}
                    class="demo-input w-full p-3 !bg-white border border-[#90C137]/30 rounded-lg !text-black focus:border-[#90C137] outline-none"
                    style={{ backgroundColor: 'white', color: 'black' }}
                  />
                </div>
              </div>
            </div>

            {/* Add-ons Section */}
            <div class="space-y-4">
              <div class="flex justify-between items-center border-b border-[#90C137]/20 pb-2">
                 <h3 class="text-xl font-bold text-[#F8F6F0]">2. Customize Plan</h3>
                 <span class="text-[#90C137] text-sm font-medium">Selected: {selectedPlan === 'starter' ? 'Starter' : 'Smarter'}</span>
              </div>

              {/* AI SQL Addon - Only for Starter */}
              {selectedPlan === 'starter' && (
                <div class="flex items-center justify-between p-4 border border-[#90C137]/20 rounded-lg bg-[#172217]">
                  <div>
                    <h3 class="font-bold text-[#F8F6F0]">AI SQL Generation</h3>
                    <p class="text-sm text-[#F8F6F0]/60">Generate SQL from natural language</p>
                  </div>
                  <div class="flex items-center gap-4">
                    <span class="text-[#90C137] font-bold">+${prices.ai_sql}/mo</span>
                    <input 
                      type="checkbox" 
                      checked={addons.ai_sql} 
                      onChange={(e) => setAddons({...addons, ai_sql: (e.target as HTMLInputElement).checked})}
                      class="w-6 h-6 accent-[#90C137]"
                    />
                  </div>
                </div>
              )}

              {/* AI Analyst Addon - Only for Smarter */}
              {selectedPlan === 'smarter' && (
                <div class="flex items-center justify-between p-4 border border-[#90C137]/20 rounded-lg bg-[#172217]">
                  <div>
                    <h3 class="font-bold text-[#F8F6F0]">AI Assistant Analyst</h3>
                    <p class="text-sm text-[#F8F6F0]/60">Deep insights and anomaly detection</p>
                  </div>
                  <div class="flex items-center gap-4">
                    <span class="text-[#90C137] font-bold">+${prices.ai_analyst}/mo</span>
                    <input 
                      type="checkbox" 
                      checked={addons.ai_analyst} 
                      onChange={(e) => setAddons({...addons, ai_analyst: (e.target as HTMLInputElement).checked})}
                      class="w-6 h-6 accent-[#90C137]"
                    />
                  </div>
                </div>
              )}
              
              {/* No addons available message if none apply (though logic above covers both plans) */}
            </div>

            {/* Total */}
            <div class="pt-4 border-t border-[#90C137]/20 flex justify-between items-center text-xl font-bold text-[#F8F6F0]">
              <span>Total Monthly</span>
              <span>${calculateTotal().toFixed(2)}</span>
            </div>

            {/* Buttons */}
            <div class="flex gap-4">
              <button type="button" onClick={() => setStep('plan')} class="flex-1 py-3 border border-[#90C137]/50 text-[#F8F6F0] rounded-lg hover:bg-[#90C137]/10">
                Back
              </button>
              <button type="submit" class="flex-1 py-3 bg-[#90C137] text-[#172217] rounded-lg font-bold hover:bg-[#a0d147]">
                Review Order
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (step === 'checkout') {
    return (
      <div class="min-h-screen bg-gradient-to-br from-[#172217] to-[#186018] flex items-center justify-center p-4">
        <div class="max-w-md w-full bg-[#172217]/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-[#90C137]/30">
          <h2 class="text-3xl font-bold text-[#F8F6F0] mb-6 text-center">Checkout</h2>
          
          <div class="bg-[#172217] p-4 rounded-lg mb-6 border border-[#90C137]/20">
            <div class="flex justify-between mb-2 text-[#F8F6F0]/80">
              <span>{selectedPlan === 'starter' ? 'Starter Plan' : 'Smarter Plan'}</span>
              <span>${prices[selectedPlan]}</span>
            </div>
            {addons.ai_sql && (
              <div class="flex justify-between mb-2 text-[#F8F6F0]/80">
                <span>AI SQL Addon</span>
                <span>${prices.ai_sql}</span>
              </div>
            )}
            {addons.ai_analyst && (
              <div class="flex justify-between mb-2 text-[#F8F6F0]/80">
                <span>AI Analyst Addon</span>
                <span>${prices.ai_analyst}</span>
              </div>
            )}
            <div class="border-t border-[#90C137]/20 my-2 pt-2 flex justify-between font-bold text-[#90C137] text-lg">
              <span>Total Due</span>
              <span>${calculateTotal().toFixed(2)}</span>
            </div>
          </div>

          <div class="bg-yellow-900/20 border border-yellow-500/30 p-3 rounded mb-6 text-yellow-200 text-sm text-center">
            ⚠️ This is a mock checkout. No real payment will be processed.
          </div>

          <div class="flex gap-4">
            <button type="button" onClick={() => setStep('configuration')} disabled={loading} class="flex-1 py-3 border border-[#90C137]/50 text-[#F8F6F0] rounded-lg hover:bg-[#90C137]/10 disabled:opacity-50">
              Back
            </button>
            <button type="button" onClick={handleCheckout} disabled={loading} class="flex-1 py-3 bg-[#90C137] text-[#172217] rounded-lg font-bold hover:bg-[#a0d147] disabled:opacity-50 flex justify-center items-center">
              {loading ? (
                <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-[#172217]"></div>
              ) : (
                `Pay $${calculateTotal().toFixed(2)}`
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
