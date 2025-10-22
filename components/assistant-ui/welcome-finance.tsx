// my-app/components/assistant-ui/welcome-finance.tsx
"use client";

import React from "react";

type Props = { onSelectAction?: (prompt: string) => void };

export default function WelcomeFinance({ onSelectAction }: Props) {
  const cards = [
    { title: "What's my monthly budget?", subtitle: "Generate a personalized budget plan", action: "What's my monthly budget?" },
    { title: "How can I save more this month?", subtitle: "Practical saving tips based on your spending", action: "How can I save more this month?" },
    { title: "Create a 3-month financial plan", subtitle: "Budget, savings, and basic investment goals", action: "Create a 3-month financial plan" },
    { title: "Track my expenses", subtitle: "Categorize and monitor your daily spending", action: "Track my expenses" },
  ];

  return (
    <div className="max-w-4xl">
      <h1 className="text-4xl font-bold mb-4">Hello — who may assist you in your financial journey?</h1>
      <p className="text-slate-400 mb-8">I could help you with budgeting, saving, tracking expenses, and building a simple financial plan.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cards.map((c, idx) => (
          <button
            key={idx}
            onClick={() => onSelectAction?.(c.action)}
            className="text-left rounded-2xl border border-slate-700 px-6 py-6 hover:bg-slate-900 transition"
          >
            <div className="font-medium text-white">{c.title}</div>
            <div className="text-slate-400 mt-2">{c.subtitle}</div>
          </button>
        ))}
      </div>
    </div>
  );
}


