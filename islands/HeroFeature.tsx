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
            <div class="flex flex-wrap gap-4 pt-4">
              <a
                href="/app/dashboard"
                onClick={trackSignup}
                class="inline-flex items-center px-6 py-3 bg-[#90C137] text-[#172217] font-medium rounded-md hover:bg-[#a0d147] transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Get Started Building your Personal Pie for Free
                <svg
                  class="ml-2 w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  >
                  </path>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
