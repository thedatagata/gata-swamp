import { useState } from "preact/hooks";
import PlanSelection from "../onboarding/PlanSelection.tsx";

interface DemoSetupProps {
  demoEmail: string;
}

export default function DemoSetup({ demoEmail }: DemoSetupProps) {
  const [step, setStep] = useState<'plan' | 'account'>('plan');
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'smarter' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePlanSelect = (plan: 'starter' | 'smarter') => {
    setSelectedPlan(plan);
    setStep('account');
  };

  const handleCreateAccount = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    try {
      // Create user and login
      const res = await fetch('/api/demo/create-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          plan: selectedPlan,
          demoEmail // Link dummy account to real demo user
        })
      });

      const data = await res.json();

      if (res.ok) {
        globalThis.location.href = '/app/dashboard';
      } else {
        setError(data.error || 'Failed to create account');
      }
    } catch (err) {
      setError('Connection failed');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'plan') {
    return (
      <PlanSelection 
        onSelectPlan={handlePlanSelect}
        userEmail={demoEmail}
      />
    );
  }

  return (
    <div class="min-h-screen bg-gradient-to-br from-[#172217] to-[#186018] flex items-center justify-center p-4">
      <div class="max-w-md w-full bg-[#172217] border border-[#90C137]/30 rounded-2xl p-8 shadow-2xl">
        <div class="text-center mb-8">
          <div class="inline-block p-3 bg-[#90C137]/20 rounded-full mb-4">
            <span class="text-4xl">👤</span>
          </div>
          <h1 class="text-2xl font-bold text-[#F8F6F0] mb-2">Create Test Account</h1>
          <p class="text-[#F8F6F0]/60">
            Create a dummy account to experience the {selectedPlan === 'smarter' ? 'Smarter' : 'Starter'} flow.
          </p>
        </div>

        <form onSubmit={handleCreateAccount} class="space-y-6">
          <div>
            <label class="block text-sm font-medium text-[#F8F6F0]/80 mb-1">
              Test Username
            </label>
            <input 
              type="text" 
              name="username"
              required
              placeholder="test_user_1"
              class="w-full px-4 py-3 bg-[#172217] border border-[#90C137]/30 rounded-lg text-[#F8F6F0] focus:border-[#90C137] outline-none"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-[#F8F6F0]/80 mb-1">
              Test Password
            </label>
            <input 
              type="password" 
              name="password"
              required
              placeholder="password123"
              class="w-full px-4 py-3 bg-[#172217] border border-[#90C137]/30 rounded-lg text-[#F8F6F0] focus:border-[#90C137] outline-none"
            />
          </div>

          {error && (
            <div class="p-3 bg-red-900/30 border border-red-500/30 text-red-200 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div class="flex gap-4">
            <button
              type="button"
              onClick={() => setStep('plan')}
              class="flex-1 py-3 px-4 border border-[#90C137]/30 text-[#F8F6F0] rounded-lg hover:bg-[#90C137]/10 transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              class="flex-1 py-3 px-4 bg-[#90C137] text-[#172217] font-bold rounded-lg hover:bg-[#a0d147] transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Start Demo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
