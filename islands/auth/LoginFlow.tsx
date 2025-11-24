import { useState } from "preact/hooks";

export default function LoginFlow() {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Redirect to dashboard on success
      globalThis.location.href = '/app/dashboard';

    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="min-h-screen bg-gradient-to-br from-[#172217] to-[#186018] flex items-center justify-center p-4">
      <div class="max-w-md w-full bg-[#172217]/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-[#90C137]/30">
        <div class="text-center mb-8">
          <a href="/" class="inline-block mb-4">
            <div class="w-16 h-16 rounded-full overflow-hidden border-2 border-[#90C137] mx-auto">
              <img
                src="/gata_app_utils/nerdy_alligator_headshot.png"
                alt="DATA_GATA Logo"
                class="w-full h-full object-cover"
              />
            </div>
          </a>
          <h2 class="text-3xl font-bold text-[#F8F6F0]">Welcome Back</h2>
          <p class="text-[#F8F6F0]/60 mt-2">Sign in to your dashboard</p>
        </div>
        
        {error && (
          <div class="mb-4 p-3 bg-red-900/50 border border-red-500/50 rounded text-red-200 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} class="space-y-4">
          <div>
            <label class="block text-sm text-[#F8F6F0]/80 mb-1">Username</label>
            <input 
              type="text" 
              required 
              value={credentials.username}
              onInput={(e) => setCredentials({...credentials, username: (e.target as HTMLInputElement).value})}
              class="w-full p-3 bg-[#172217] border border-[#90C137]/30 rounded-lg text-[#F8F6F0] focus:border-[#90C137] outline-none"
            />
          </div>
          <div>
            <label class="block text-sm text-[#F8F6F0]/80 mb-1">Password</label>
            <input 
              type="password" 
              required 
              value={credentials.password}
              onInput={(e) => setCredentials({...credentials, password: (e.target as HTMLInputElement).value})}
              class="w-full p-3 bg-[#172217] border border-[#90C137]/30 rounded-lg text-[#F8F6F0] focus:border-[#90C137] outline-none"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            class="w-full py-3 bg-[#90C137] text-[#172217] rounded-lg font-bold hover:bg-[#a0d147] disabled:opacity-50 mt-6"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div class="mt-6 text-center">
          <p class="text-sm text-[#F8F6F0]/60">
            Don't have an account?{' '}
            <a href="/app/dashboard" class="text-[#90C137] hover:underline">
              Get Started
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
