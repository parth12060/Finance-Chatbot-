// my-app/components/assistant-ui/welcome-finance.tsx
"use client";

import React from "react";

type Props = { onSelectAction?: (prompt: string) => void };

export default function WelcomeFinance({ onSelectAction }: Props) {
  const cards = [
    { title: "Calculate my tax", subtitle: "Old vs New regime comparison with exact breakdowns", action: "My salary is 15 LPA, how much tax do I pay?" },
    { title: "Plan a home purchase", subtitle: "EMI, affordability & tax benefits under §24(b) & §80C", action: "I want to buy a house worth 50 lakh, income 12 LPA" },
    { title: "Find tax-saving options", subtitle: "Missed deductions across 80C, 80D, 80CCD(1B) & more", action: "How to save tax? I earn 20 lakh" },
    { title: "Project my SIP returns", subtitle: "Mutual fund return projections with SIP calculator", action: "SIP of 10000 monthly for 15 years at 12%" },
  ];

  return (
    <div className="max-w-4xl">
      <h1 className="text-4xl font-bold mb-4">Hello — how may I assist you in your financial journey?</h1>
      <p className="text-slate-400 mb-8">I can help you with tax calculations, regime comparison, SIP/EMI/PPF planning, stock &amp; mutual fund data, home purchase planning, audit guidance, and CA-level Form 16 analysis.</p>

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


