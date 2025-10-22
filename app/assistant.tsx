// my-app/app/assistant.tsx
"use client";

import React from "react";
import FinanceChat from "@/components/finance-chat/FinanceChat";
import WelcomeFinance from "@/components/assistant-ui/welcome-finance";

export default function AssistantPage() {
  return (
    <main className="min-h-screen bg-black/90 text-white">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <WelcomeFinance />
        {/* FinanceChat embedded below the hero */}
        <div className="mt-12">
          <FinanceChat />
        </div>
      </div>
    </main>
  );
}

