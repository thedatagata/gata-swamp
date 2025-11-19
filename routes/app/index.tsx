import { Head } from "$fresh/runtime.ts";
import Nav from "../../components/Nav.tsx";
import Footer from "../../components/Footer.tsx";

export default function Home() {
  return (
    <>
      <Head>
        <title>DATA_GATA | Analytics Dashboard</title>
      </Head>
      
      <Nav />
      <main class="min-h-screen bg-gradient-to-br from-[#172217] to-[#186018] py-32">
        <div class="max-w-4xl mx-auto px-4">
          <div class="text-center mb-16">
            <h1 class="text-5xl font-bold text-[#F8F6F0] mb-4">
              Analytics Dashboard
            </h1>
            <p class="text-xl text-[#F8F6F0]/80">
              Natural language queries powered by MotherDuck
            </p>
          </div>

          <div class="bg-[#F8F6F0] rounded-lg p-8 shadow-xl max-w-md mx-auto">
            <h2 class="text-3xl font-bold text-[#172217] mb-4">Get Started</h2>
            <ul class="space-y-3 mb-8 text-[#172217]">
              <li class="flex items-start">
                <svg class="w-6 h-6 text-[#90C137] mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                Stream data from MotherDuck
              </li>
              <li class="flex items-start">
                <svg class="w-6 h-6 text-[#90C137] mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                MotherDuck AI natural language queries
              </li>
              <li class="flex items-start">
                <svg class="w-6 h-6 text-[#90C137] mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                Interactive visualizations
              </li>
            </ul>
            <a 
              href="/app/dashboard"
              class="block w-full text-center py-3 bg-[#172217] text-[#F8F6F0] font-semibold rounded-md hover:bg-[#2a3a2a] transition-colors"
            >
              Launch Dashboard
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
