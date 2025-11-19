// islands/PlanSelection.tsx
import { useState } from "preact/hooks";

interface PlanSelectionProps {
  onSelectPlan: (plan: 'starter' | 'smarter') => void;
}

export default function PlanSelection({ onSelectPlan }: PlanSelectionProps) {
  return (
    <div class="min-h-screen bg-gradient-to-br from-[#172217] to-[#186018] flex items-center justify-center p-4">
      <div class="max-w-6xl w-full">
        {/* Header */}
        <div class="text-center mb-12">
          <h1 class="text-4xl font-bold text-[#F8F6F0] mb-3">Choose Your Analytics Experience</h1>
          <p class="text-lg text-[#F8F6F0]/80">Select the dashboard that fits your needs</p>
        </div>

        {/* Plans Grid */}
        <div class="grid md:grid-cols-2 gap-8">
          {/* Starter Plan */}
          <div class="bg-[#172217]/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border-2 border-[#90C137]/30 hover:border-[#90C137] transition-all">
            <div class="text-center mb-6">
              <div class="inline-block p-3 bg-[#90C137]/20 rounded-full mb-4">
                <span class="text-4xl">📊</span>
              </div>
              <h2 class="text-2xl font-bold text-[#F8F6F0] mb-2">Starter Dashboard</h2>
              <p class="text-[#F8F6F0]/70">Traditional analytics workflow</p>
            </div>

            <ul class="space-y-3 mb-8">
              <li class="flex items-start">
                <span class="text-[#90C137] mr-2">✓</span>
                <span class="text-[#F8F6F0]/80">Manual table selection</span>
              </li>
              <li class="flex items-start">
                <span class="text-[#90C137] mr-2">✓</span>
                <span class="text-[#F8F6F0]/80">SQL query generation with MotherDuck AI</span>
              </li>
              <li class="flex items-start">
                <span class="text-[#90C137] mr-2">✓</span>
                <span class="text-[#F8F6F0]/80">Observable Plot visualizations</span>
              </li>
              <li class="flex items-start">
                <span class="text-[#90C137] mr-2">✓</span>
                <span class="text-[#F8F6F0]/80">Step-by-step workflow</span>
              </li>
            </ul>

            <button
              onClick={() => onSelectPlan('starter')}
              class="w-full py-3 px-6 bg-[#90C137] text-[#172217] rounded-lg font-semibold hover:bg-[#a0d147] transition-colors shadow-lg"
            >
              Start with Starter
            </button>
          </div>

          {/* Smarter Plan */}
          <div class="bg-[#172217]/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border-2 border-[#90C137] hover:border-[#a0d147] transition-all relative">
            <div class="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <span class="bg-gradient-to-r from-[#90C137] to-[#a0d147] text-[#172217] px-4 py-1 rounded-full text-sm font-semibold">
                ✨ AI-Powered
              </span>
            </div>

            <div class="text-center mb-6">
              <div class="inline-block p-3 bg-gradient-to-br from-[#90C137]/30 to-[#90C137]/20 rounded-full mb-4">
                <span class="text-4xl">🤖</span>
              </div>
              <h2 class="text-2xl font-bold text-[#F8F6F0] mb-2">Smarter Dashboard</h2>
              <p class="text-[#F8F6F0]/70">AI-powered semantic analytics</p>
            </div>

            <ul class="space-y-3 mb-8">
              <li class="flex items-start">
                <span class="text-[#90C137] mr-2">✓</span>
                <span class="text-[#F8F6F0]/80">Pre-built sessions & user dashboards</span>
              </li>
              <li class="flex items-start">
                <span class="text-[#90C137] mr-2">✓</span>
                <span class="text-[#F8F6F0]/80">Natural language queries with WebLLM</span>
              </li>
              <li class="flex items-start">
                <span class="text-[#90C137] mr-2">✓</span>
                <span class="text-[#F8F6F0]/80">Automatic chart generation (BSL-style)</span>
              </li>
              <li class="flex items-start">
                <span class="text-[#90C137] mr-2">✓</span>
                <span class="text-[#F8F6F0]/80">Interactive Plotly visualizations</span>
              </li>
              <li class="flex items-start">
                <span class="text-[#90C137] mr-2">✓</span>
                <span class="text-[#F8F6F0]/80">Churn detection & RFM analysis</span>
              </li>
            </ul>

            <button
              onClick={() => onSelectPlan('smarter')}
              class="w-full py-3 px-6 bg-[#90C137] text-[#172217] rounded-lg font-semibold hover:bg-[#a0d147] transition-all shadow-lg"
            >
              Go Smarter with AI
            </button>

            <div class="mt-4 text-center">
              <p class="text-xs text-[#F8F6F0]/50">⏱️ Initial setup takes 10-15 seconds</p>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div class="text-center mt-8 text-sm text-[#F8F6F0]/70">
          💡 Both options connect to your MotherDuck database • All processing happens locally
        </div>
      </div>
    </div>
  );
}
