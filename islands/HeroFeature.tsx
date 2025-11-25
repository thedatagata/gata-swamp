import { useEffect, useState } from "preact/hooks";
import { getLDClient, initializeLaunchDarkly, subscribeToFlagChanges, unsubscribeFromFlagChanges } from "../utils/launchdarkly/client.ts";

interface HeroFeatureProps {
  ldClientId?: string;
}

export default function HeroFeature({ ldClientId }: HeroFeatureProps) {
  const [isNewDesign, setIsNewDesign] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      let client = getLDClient();
      
      if (!client && ldClientId) {
        // Initialize if not already done
        const context = {
          kind: "user",
          key: "anonymous-user",
          name: "Anonymous User"
        };
        client = await initializeLaunchDarkly(context, ldClientId);
      }

      if (client) {
        // Initial value
        const flagValue = client.variation("new-hero-design", false);
        setIsNewDesign(flagValue);
        setInitialized(true);

        // Subscribe to changes
        const handleFlagChange = (current: boolean) => {
          console.log("🚩 Flag changed: new-hero-design =", current);
          setIsNewDesign(current);
        };

        subscribeToFlagChanges("new-hero-design", handleFlagChange);

        return () => {
          unsubscribeFromFlagChanges("new-hero-design", handleFlagChange);
        };
      } else {
        // Fallback or wait for client (if initialized elsewhere)
        const checkInterval = setInterval(() => {
          const c = getLDClient();
          if (c) {
            clearInterval(checkInterval);
            init();
          }
        }, 100);
        return () => clearInterval(checkInterval);
      }
    };

    init();
  }, [ldClientId]);

  const trackSignup = () => {
    const client = getLDClient();
    if (client) {
      client.track("click-signup", { location: "hero", variant: isNewDesign ? "new" : "old" });
      console.log("📊 Tracked event: click-signup");
    }
  };

  if (!initialized) {
    return <div class="min-h-screen flex items-center justify-center bg-[#172217] text-[#90C137]">Loading...</div>;
  }

  if (isNewDesign) {
    // --- NEW DESIGN (Variant B) ---
    return (
      <div class="relative min-h-screen flex items-center bg-[#172217] overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-r from-[#90C137]/10 to-transparent"></div>
        <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div class="space-y-8">
              <div class="inline-flex items-center px-3 py-1 rounded-full bg-[#90C137] text-[#172217] text-sm font-bold">
                🚀 New & Improved
              </div>
              <h1 class="text-6xl md:text-8xl font-black text-[#F8F6F0] tracking-tighter">
                DATA<br /><span class="text-transparent bg-clip-text bg-gradient-to-r from-[#90C137] to-[#4ade80]">GATA</span>
              </h1>
              <p class="text-xl text-gray-400 max-w-lg">
                Stop wrestling with data. Start talking to it. The personal data analyst that actually listens.
              </p>
              <div class="flex gap-4">
                <a
                  href="/app/dashboard"
                  onClick={trackSignup}
                  class="px-8 py-4 bg-[#F8F6F0] text-[#172217] font-bold rounded-lg hover:bg-white transition-transform hover:scale-105"
                >
                  Start Free Trial
                </a>
                <a href="#demo" class="px-8 py-4 border border-[#333] text-[#F8F6F0] rounded-lg hover:border-[#90C137] transition-colors">
                  Watch Demo
                </a>
              </div>
            </div>
            <div class="relative">
              <div class="absolute inset-0 bg-[#90C137] blur-[100px] opacity-20"></div>
              <img 
                src="/gata_app_utils/nerdy_alligator_headshot.png" 
                alt="Data Gata" 
                class="relative z-10 w-full max-w-md mx-auto transform rotate-3 hover:-rotate-0 transition-transform duration-500"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- OLD DESIGN (Variant A) ---
  return (
    <div class="relative min-h-screen flex items-center bg-gradient-to-br from-[#172217] to-[#186018] overflow-hidden">
      {/* Background image with overlay */}
      <div class="absolute inset-0">
        <img
          src="/gata_app_utils/nerdy_alligator_swamp.png"
          alt="Data Swamp"
          class="w-full h-full object-cover opacity-30"
        />
        <div class="absolute inset-0 bg-[#172217] opacity-60 mix-blend-multiply"></div>
      </div>

      {/* Content */}
      <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 pt-40">
        <div class="space-y-16">
          {/* Hero Title and Tagline */}
          <div class="space-y-6 max-w-3xl">
            <div class="inline-block px-3 py-1 bg-[#90C137]/20 border border-[#90C137]/30 rounded-full text-[#90C137] text-sm font-medium mb-2">
              Your Personal Data Analyst
            </div>
            <h1 class="text-5xl md:text-7xl lg:text-8xl font-extrabold text-[#F8F6F0] tracking-tight leading-none">
              DATA_<span class="text-[#90C137]">GATA</span>
            </h1>
            <p class="text-lg md:text-xl text-[#F8F6F0]/90 max-w-2xl font-light leading-relaxed">
              Welcome to the small data revolution. Your own personal data platform—like a personal
              pizza where you choose your toppings and don't have to compromise with the team that
              wants pineapple.
            </p>
              <div class="pt-4 max-w-md">
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.target as HTMLFormElement;
                  const emailInput = form.elements.namedItem('email') as HTMLInputElement;
                  const passwordInput = form.elements.namedItem('password') as HTMLInputElement;
                  const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
                  const msg = document.getElementById('access-msg');
                  
                  if (btn) btn.disabled = true;
                  if (msg) msg.textContent = 'Verifying...';
                  
                  try {
                    // Step 1: Check email against LaunchDarkly allowlist
                    if (passwordInput.style.display === 'none' || !passwordInput.value) {
                      const res = await fetch('/api/demo/check-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: emailInput.value })
                      });
                      
                      if (res.ok) {
                        // Email is in allowlist, show password field
                        passwordInput.style.display = 'block';
                        passwordInput.parentElement!.style.display = 'block';
                        emailInput.disabled = true;
                        if (msg) {
                          msg.textContent = '✅ Email verified! Enter your access code.';
                          msg.className = 'text-[#90C137] text-sm mt-2';
                        }
                        if (btn) {
                          btn.disabled = false;
                          btn.textContent = 'Access Demo';
                        }
                      } else {
                        const data = await res.json();
                        if (msg) {
                          msg.textContent = '❌ ' + (data.error || 'Email not authorized');
                          msg.className = 'text-red-400 text-sm mt-2';
                        }
                        if (btn) btn.disabled = false;
                      }
                    } else {
                      // Step 2: Verify password
                      const res = await fetch('/api/demo/access', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: emailInput.value, password: passwordInput.value })
                      });
                      
                      if (res.ok) {
                        globalThis.location.href = '/demo/setup';
                      } else {
                        const data = await res.json();
                        if (msg) {
                          msg.textContent = '❌ ' + (data.error || 'Invalid password');
                          msg.className = 'text-red-400 text-sm mt-2';
                        }
                        if (btn) btn.disabled = false;
                      }
                    }
                  } catch (_err) {
                    if (msg) {
                      msg.textContent = '❌ Connection failed';
                      msg.className = 'text-red-400 text-sm mt-2';
                    }
                    if (btn) btn.disabled = false;
                  }
                }} class="space-y-4">
                  <div>
                    <label htmlFor="email-input" class="block text-sm font-medium text-[#F8F6F0]/80 mb-1">
                      Enter your email to access the demo
                    </label>
                    <div class="flex gap-2">
                      <input 
                        id="email-input"
                        type="email" 
                        name="email"
                        required
                        placeholder="name@company.com"
                        class="flex-1 px-4 py-3 bg-white border border-[#90C137]/30 rounded-lg text-black placeholder-gray-500 focus:border-[#90C137] focus:ring-1 focus:ring-[#90C137] outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div style="display: none;">
                    <label htmlFor="password-input" class="block text-sm font-medium text-[#F8F6F0]/80 mb-1">
                      Access Code
                    </label>
                    <input 
                      id="password-input"
                      type="password" 
                      name="password"
                      placeholder="Enter your access code"
                      style="display: none;"
                      class="w-full px-4 py-3 bg-white border border-[#90C137]/30 rounded-lg text-black placeholder-gray-500 focus:border-[#90C137] focus:ring-1 focus:ring-[#90C137] outline-none transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    class="w-full px-6 py-3 bg-[#90C137] text-[#172217] font-bold rounded-lg hover:bg-[#a0d147] transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Verify Email
                  </button>
                  <div id="access-msg" class="text-[#F8F6F0]/60 text-sm mt-2"></div>
                </form>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}
