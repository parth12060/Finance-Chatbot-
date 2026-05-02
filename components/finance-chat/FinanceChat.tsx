// components/finance-chat/FinanceChat.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Mic, Plus, Loader2, TrendingUp, TrendingDown, BarChart2,
  ArrowUpRight, ArrowDownRight, FileText, CheckCircle, AlertCircle, AlertTriangle,
  Calculator, X, Lock, Sparkles,
} from "lucide-react";
import { useSession, signIn } from "next-auth/react";

// ────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────
type Message = {
  sender: "user" | "bot";
  text: string;
  time?: number;
  response_type?: string;
  sources?: string[];
  confidence?: number;
  calculator_result?: Record<string, unknown>;
  realtime_data?: Record<string, unknown>;
  form16_result?: Record<string, unknown>;
  suggest_planner?: boolean;
  planner_prefill?: Record<string, string>;
};

interface FinanceChatProps {
  triggerQuestion?: string;
  chatId: string;
  onMessageSent?: (chatId: string, firstMessage: string) => void;
  onSignInRequired?: () => void;
}

// ────────────────────────────────────────────────
// CONSTANTS
// ────────────────────────────────────────────────
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

// ────────────────────────────────────────────────
// API HELPERS
// ────────────────────────────────────────────────
// Module-level session id — persists for the browser session
let _sessionId: string | null = null;

type BackendResult = {
  answer: string;
  sources: string[];
  confidence: number;
  response_type?: string;
  calculator_result?: Record<string, unknown>;
  realtime_data?: Record<string, unknown>;
  regime_advisory?: string;
  session_id?: string;
  suggest_planner?: boolean;
  planner_prefill?: Record<string, string>;
};

type StreamEvent = {
  type?: "status" | "token" | "replace" | "done";
  token?: string;
  answer?: string;
  message?: string;
  payload?: Partial<BackendResult>;
};

type StreamHandlers = {
  onToken: (token: string) => void;
  onReplace: (answer: string) => void;
  onStatus?: (message: string) => void;
};

function normalizeBackendResult(data: Partial<BackendResult> | undefined): BackendResult {
  const answer = data?.regime_advisory
    ? `${data.regime_advisory}\n\n${data.answer || ""}`
    : data?.answer || "Sorry, I couldn't get a response.";

  if (data?.session_id) _sessionId = data.session_id;

  return {
    answer,
    sources: data?.sources || [],
    confidence: data?.confidence || 0,
    response_type: data?.response_type,
    calculator_result: data?.calculator_result,
    realtime_data: data?.realtime_data,
    regime_advisory: data?.regime_advisory,
    session_id: data?.session_id,
    suggest_planner: data?.suggest_planner,
    planner_prefill: data?.planner_prefill,
  };
}

async function askBackendJson(question: string): Promise<BackendResult> {
  const res = await fetch(`${API_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, session_id: _sessionId }),
  });
  if (!res.ok) throw new Error(`Backend error: ${res.status}`);
  const data = await res.json();
  return normalizeBackendResult(data);
}

async function askBackendStream(question: string, handlers: StreamHandlers): Promise<BackendResult> {
  const res = await fetch(`${API_URL}/ask/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, session_id: _sessionId }),
  });

  if (!res.ok) throw new Error(`Backend error: ${res.status}`);
  if (!res.body) return askBackendJson(question);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalPayload: Partial<BackendResult> | undefined;

  const handleEvent = (raw: string) => {
    const dataLine = raw
      .split("\n")
      .find(line => line.startsWith("data:"));
    if (!dataLine) return;

    const jsonText = dataLine.slice(5).trim();
    if (!jsonText) return;

    const event = JSON.parse(jsonText) as StreamEvent;
    if (event.type === "status" && event.message) handlers.onStatus?.(event.message);
    if (event.type === "token" && event.token) handlers.onToken(event.token);
    if (event.type === "replace") handlers.onReplace(event.answer || "");
    if (event.type === "done") finalPayload = event.payload;
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop() || "";
    events.forEach(handleEvent);
  }

  if (buffer.trim()) handleEvent(buffer);
  return normalizeBackendResult(finalPayload);
}

async function uploadForm16(file: File): Promise<Record<string, unknown>> {
  const formData = new FormData();
  formData.append("form16", file);
  const res = await fetch(`${API_URL}/upload-form16`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}

// ────────────────────────────────────────────────
// FORMAT HELPERS
// ────────────────────────────────────────────────
function formatAnswer(text: string): string {
  return text
    .split("\n")
    .map(line => line.includes("|")
      ? line.replace(/<br\s*\/?>/gi, "; ")
      : line.replace(/<br\s*\/?>/gi, "\n"))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const markdownComponents: Components = {
  h1: ({ ...props }) => <h1 className="mb-3 text-xl font-semibold leading-tight" {...props} />,
  h2: ({ ...props }) => <h2 className="mt-4 mb-2 text-lg font-semibold leading-tight first:mt-0" {...props} />,
  h3: ({ ...props }) => <h3 className="mt-4 mb-2 text-base font-semibold leading-tight first:mt-0" {...props} />,
  p: ({ ...props }) => <p className="my-2 leading-6 first:mt-0 last:mb-0" {...props} />,
  ul: ({ ...props }) => <ul className="my-2 ml-5 list-disc space-y-1" {...props} />,
  ol: ({ ...props }) => <ol className="my-2 ml-5 list-decimal space-y-1" {...props} />,
  li: ({ ...props }) => <li className="leading-6" {...props} />,
  strong: ({ ...props }) => <strong className="font-semibold" {...props} />,
  a: ({ ...props }) => (
    <a className="font-medium text-blue-600 underline underline-offset-2 dark:text-blue-300" target="_blank" rel="noreferrer" {...props} />
  ),
  table: ({ ...props }) => (
    <div className="my-3 max-w-full overflow-x-auto rounded-lg border border-slate-300 dark:border-slate-700">
      <table className="min-w-full border-collapse text-left text-xs" {...props} />
    </div>
  ),
  thead: ({ ...props }) => <thead className="bg-slate-100 dark:bg-slate-900" {...props} />,
  th: ({ ...props }) => <th className="border-b border-slate-300 px-3 py-2 font-semibold dark:border-slate-700" {...props} />,
  td: ({ ...props }) => <td className="border-t border-slate-200 px-3 py-2 align-top dark:border-slate-800" {...props} />,
  code: ({ ...props }) => <code className="rounded bg-slate-100 px-1 py-0.5 text-[0.85em] dark:bg-slate-900" {...props} />,
};

function MarkdownMessage({ text }: { text: string }) {
  return (
    <div className="max-w-none text-sm leading-6 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

function fmt(n: unknown): string {
  if (n === null || n === undefined) return "—";
  const num = typeof n === "number" ? n : parseFloat(String(n));
  if (isNaN(num)) return String(n);
  return num.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function fmtPct(n: unknown): string {
  const num = typeof n === "number" ? n : parseFloat(String(n));
  if (isNaN(num)) return "—";
  return `${num > 0 ? "+" : ""}${num.toFixed(2)}%`;
}

function fmtINR(n: unknown): string {
  if (n === null || n === undefined) return "—";
  const num = typeof n === "number" ? n : parseFloat(String(n));
  if (isNaN(num)) return String(n);
  return `₹${num.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function safeStr(v: unknown): string {
  return v != null ? String(v) : "";
}

// ════════════════════════════════════════════════
// FORM 16 ANALYSIS CARD
// ════════════════════════════════════════════════
function Form16Card({ data }: { data: Record<string, unknown> }) {
  const [activeTab, setActiveTab] = useState<"summary" | "deductions" | "verdict">("summary");

  if (data.error != null) {
    return (
      <div className="mt-3 rounded-xl overflow-hidden border border-red-200 dark:border-red-800">
        <div className="bg-red-500 px-4 py-2 flex items-center gap-2">
          <AlertCircle size={16} className="text-white" />
          <span className="text-white font-semibold text-sm">Form 16 Parse Error</span>
        </div>
        <div className="bg-white dark:bg-gray-900 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {safeStr(data.error) || "Could not parse your Form 16. Please ensure it's a valid PDF."}
        </div>
      </div>
    );
  }

  const employee   = (data.employee   as Record<string, unknown>) ?? {};
  const employer   = (data.employer   as Record<string, unknown>) ?? {};
  const salary     = (data.salary_summary       as Record<string, unknown>) ?? {};
  const deductions = (data.deductions_declared  as Record<string, unknown>) ?? {};
  const taxComp    = (data.tax_computation      as Record<string, unknown>) ?? {};
  const regimeComp = (data.regime_comparison    as Record<string, unknown>) ?? {};
  const missed     = (data.missed_deductions    as Array<Record<string, unknown>>) ?? [];
  const advTax     = (data.advance_tax          as Record<string, unknown>) ?? {};
  const verdict    = (data.verdict              as Record<string, unknown>) ?? {};

  const newRegime  = (regimeComp.new_regime as Record<string, unknown>) ?? {};
  const oldRegime  = (regimeComp.old_regime as Record<string, unknown>) ?? {};

  const verdictAction = safeStr(verdict.action);
  const totalSaving   = missed.reduce(
    (s, d) => s + (typeof d.tax_saving === "number" ? d.tax_saving : 0), 0
  );

  const incomeRows: [string, unknown][] = [
    ["Gross Salary",                 salary.gross_salary],
    ["HRA Exempt [10(13A)]",         salary.hra_exempt],
    ["Standard Deduction [16(ia)]",  salary.standard_deduction],
    ["Professional Tax [16(iii)]",   salary.professional_tax],
    ["Net Taxable Income",           taxComp.total_taxable_income],
  ];

  const verdictBg =
    verdictAction === "CLAIM_REFUND" ? "bg-green-50 dark:bg-green-900/20 border-green-400" :
    verdictAction === "PAY_BALANCE"  ? "bg-red-50 dark:bg-red-900/20 border-red-400"       :
                                       "bg-blue-50 dark:bg-blue-900/20 border-blue-400";

  const verdictText =
    verdictAction === "CLAIM_REFUND" ? "text-green-700 dark:text-green-400" :
    verdictAction === "PAY_BALANCE"  ? "text-red-700 dark:text-red-400"     :
                                       "text-blue-700 dark:text-blue-400";

  const verdictHeading =
    verdictAction === "CLAIM_REFUND" ? "✅ You are eligible for a Refund"     :
    verdictAction === "PAY_BALANCE"  ? "⚠️ Balance Tax Payable"              :
                                       "✅ Tax Fully Settled — No Action Needed";

  const differenceLabel =
    verdictAction === "CLAIM_REFUND" ? "Refund" : "Balance";

  return (
    <div className="mt-3 rounded-xl overflow-hidden border border-orange-200 dark:border-orange-800 w-full">

      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-amber-500 px-4 py-3 flex items-center gap-2">
        <FileText size={18} className="text-white" />
        <div>
          <p className="text-white font-semibold text-sm">
            Form 16 Analysis — AY {safeStr(data.assessment_year) || "2026-27"}
          </p>
          <p className="text-orange-100 text-xs">
            {safeStr(employer.pan)} → Employee PAN: {safeStr(employee.pan)}
          </p>
        </div>
        {missed.length > 0 && (
          <div className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">
            {missed.length} missed deduction{missed.length > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-orange-50 dark:bg-orange-900/20 border-b border-orange-100 dark:border-orange-900">
        {(["summary", "deductions", "verdict"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-orange-600 text-white"
                : "text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/40"
            }`}
          >
            {tab === "summary"    && "📋 Summary"}
            {tab === "deductions" && `💡 Save Tax${totalSaving > 0 ? ` (${fmtINR(totalSaving)})` : ""}`}
            {tab === "verdict"    && "⚖️ Verdict"}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-900">

        {/* ── SUMMARY TAB ── */}
        {activeTab === "summary" && (
          <div className="divide-y divide-slate-100 dark:divide-gray-800">

            {/* Income breakdown */}
            <div className="px-5 py-4">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                Income Breakdown
              </p>
              <div className="space-y-2">
                {incomeRows.map(([label, val]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">{label}</span>
                    <span className={`font-semibold ${
                      label === "Net Taxable Income"
                        ? "text-orange-600 dark:text-orange-400"
                        : "text-slate-800 dark:text-slate-200"
                    }`}>
                      {fmtINR(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Regime comparison */}
            <div className="px-5 py-4">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                Regime Comparison
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "New Regime", regime: newRegime, better: regimeComp.better_regime === "New Regime" },
                  { label: "Old Regime", regime: oldRegime, better: regimeComp.better_regime === "Old Regime" },
                ].map(({ label, regime, better }) => (
                  <div
                    key={label}
                    className={`rounded-lg p-2.5 border-2 ${
                      better
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                        : "border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800"
                    }`}
                  >
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1">
                      {better && <CheckCircle size={14} className="text-green-600" />}
                      {label}
                    </p>
                    <p className={`text-base font-bold mt-0.5 ${
                      better ? "text-green-600 dark:text-green-400" : "text-slate-700 dark:text-slate-300"
                    }`}>
                      {fmtINR(regime.total_tax)}
                    </p>
                    <p className="text-xs text-slate-400">{fmt(regime.effective_rate)}% effective</p>
                  </div>
                ))}
              </div>
              {Number(regimeComp.annual_saving) > 0 && (
                <div className="mt-2 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2 text-xs text-green-700 dark:text-green-300">
                  💰 Switch to {safeStr(regimeComp.better_regime)} → Save {fmtINR(regimeComp.annual_saving)} per year
                </div>
              )}
            </div>

            {/* TDS status */}
            <div className="px-5 py-4">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                TDS Status
              </p>
              <div className="space-y-2">
                {([
                  ["Net Tax Payable", taxComp.net_tax_payable],
                  ["TDS Deducted",    taxComp.tds_deducted],
                ] as [string, unknown][]).map(([label, val]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">{label}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{fmtINR(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── SAVE TAX TAB ── */}
        {activeTab === "deductions" && (
          <div className="divide-y divide-slate-100 dark:divide-gray-800">

            {/* Declared */}
            <div className="px-5 py-4">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                Declared in Form 16
              </p>
              <div className="space-y-2">
                {Object.entries(deductions).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">{k.replace(/_/g, " ")}</span>
                    <span className={`font-semibold ${
                      Number(v) > 0 ? "text-slate-800 dark:text-slate-200" : "text-slate-400"
                    }`}>
                      {Number(v) > 0 ? fmtINR(v) : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Missed */}
            {missed.length > 0 ? (
              <div className="px-5 py-4">
                <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <AlertTriangle size={14} /> Missed Deductions — Act Now!
                </p>
                <div className="space-y-2">
                  {missed.map((d, i) => (
                    <div
                      key={i}
                      className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2.5 border border-red-100 dark:border-red-900"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-bold text-red-700 dark:text-red-400">{safeStr(d.section)}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Can invest {fmtINR(d.gap)} more
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500 dark:text-slate-400">Tax saving</p>
                          <p className="text-sm font-bold text-green-600 dark:text-green-400">{fmtINR(d.tax_saving)}</p>
                        </div>
                      </div>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1.5">
                        💡 {safeStr(d.action)}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-2 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2 text-xs text-green-700 dark:text-green-300 font-semibold">
                  Total potential tax savings: {fmtINR(totalSaving)}
                </div>
              </div>
            ) : (
              <div className="px-4 py-3 text-xs text-green-600 dark:text-green-400 flex items-center gap-2">
                <CheckCircle size={14} /> All major deductions are fully utilised. Great tax planning!
              </div>
            )}
          </div>
        )}

        {/* ── VERDICT TAB ── */}
        {activeTab === "verdict" && (
          <div className="divide-y divide-slate-100 dark:divide-gray-800">

            {/* Main verdict box */}
            <div className="px-5 py-4">
              <div className={`rounded-xl p-3 border-2 ${verdictBg}`}>
                <p className={`font-bold text-sm mb-1 ${verdictText}`}>
                  {verdictHeading}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {safeStr(verdict.message)}
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                  {([
                    ["TDS Paid",        verdict.tds_paid],
                    ["Liability",       verdict.actual_liability],
                    [differenceLabel,   verdict.difference],
                  ] as [string, unknown][]).map(([label, val]) => (
                    <div key={label} className="text-center">
                      <p className="text-slate-400">{label}</p>
                      <p className="font-bold text-slate-800 dark:text-slate-200">{fmtINR(val)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Advance Tax */}
            <div className="px-5 py-4">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                Advance Tax (Sec 208/209)
              </p>
              {advTax.advance_tax_required === true ? (
                <div className="space-y-2">
                  {((advTax.installments as Array<Record<string, unknown>>) ?? []).map((inst, i) => (
                    <div
                      key={i}
                      className="flex justify-between items-center text-sm bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2.5"
                    >
                      <div>
                        <p className="font-medium text-slate-700 dark:text-slate-300">
                          {safeStr(inst.installment)} — Due {safeStr(inst.due_date)}
                        </p>
                        <p className="text-slate-400">{safeStr(inst.cumulative_pct)}% cumulative</p>
                      </div>
                      <p className="font-bold text-amber-700 dark:text-amber-400">{fmtINR(inst.amount)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <CheckCircle size={14} />
                  {safeStr(advTax.reason) || "Advance tax not required."}
                </p>
              )}
            </div>

            {/* Form 26AS reminder */}
            {data.form26as_reminder != null && (
              <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 text-xs text-blue-700 dark:text-blue-300">
                {safeStr(data.form26as_reminder)}
              </div>
            )}

            {/* Legal source */}
            {data.source != null && (
              <div className="px-4 py-2 text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-gray-800">
                📜 {safeStr(data.source)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// MARKET OVERVIEW CARD
// ════════════════════════════════════════════════
function MarketOverview({ data }: { data: Record<string, unknown> }) {
  const skip = new Set(["type", "source", "note", "error", "resources"]);
  const indices = Object.entries(data).filter(([k]) => !skip.has(k));

  return (
    <div className="mt-4 rounded-xl overflow-hidden border border-green-200 dark:border-green-800">
      <div className="bg-green-600 dark:bg-green-800 px-4 py-2 flex items-center gap-2">
        <BarChart2 size={18} className="text-white" />
        <span className="text-white font-semibold text-sm">📈 Live Market Overview</span>
        <span className="ml-auto text-green-200 text-xs">Angel One • Real-time</span>
      </div>
      {data.note != null && (
        <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs border-b border-amber-200 dark:border-amber-800">
          ⚠️ {safeStr(data.note)}
        </div>
      )}
      <div className="bg-white dark:bg-gray-900 divide-y divide-slate-100 dark:divide-gray-800">
        {indices.map(([name, val]) => {
          const v = (val as Record<string, unknown>) ?? {};
          const chg = typeof v.change === "number" ? v.change : 0;
          const pct = typeof v.change_pct === "number" ? v.change_pct : 0;
          const isUp = chg >= 0;
          return (
            <div key={name} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-slate-700 dark:text-slate-300 font-medium text-sm">{name}</span>
              <div className="flex flex-col items-end">
                <span className="font-bold text-slate-900 dark:text-white text-sm">{fmt(v.value)}</span>
                <span className={`text-xs flex items-center gap-0.5 ${isUp ? "text-green-600" : "text-red-500"}`}>
                  {isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {fmt(Math.abs(chg))} ({fmtPct(pct)})
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {data.resources != null && (
        <div className="px-4 py-2 bg-slate-50 dark:bg-gray-800 text-xs text-slate-500 dark:text-slate-400">
          📌 {(data.resources as string[]).join("  •  ")}
        </div>
      )}
      <div className="px-4 py-2 bg-slate-50 dark:bg-gray-800 text-xs text-slate-400">
        Source: {safeStr(data.source) || "Angel One SmartAPI"}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// INDIVIDUAL STOCK CARD
// ════════════════════════════════════════════════
function StockCard({ data }: { data: Record<string, unknown> }) {
  const chg  = typeof data.change === "number" ? data.change : 0;
  const pct  = typeof data.change_pct === "number" ? data.change_pct : 0;
  const isUp = chg >= 0;

  return (
    <div className="mt-4 rounded-xl overflow-hidden border border-blue-200 dark:border-blue-800">
      <div className={`px-4 py-2 flex items-center gap-2 ${isUp ? "bg-green-600" : "bg-red-500"}`}>
        {isUp ? <TrendingUp size={18} className="text-white" /> : <TrendingDown size={18} className="text-white" />}
        <span className="text-white font-semibold text-sm">
          {safeStr(data.symbol || data.name) || "Stock"} · {safeStr(data.exchange) || "NSE"}
        </span>
        <span className="ml-auto text-white/80 text-xs">Real-time</span>
      </div>
      <div className="bg-white dark:bg-gray-900 px-4 py-3">
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">₹{fmt(data.price)}</p>
            <p className={`text-sm flex items-center gap-1 mt-0.5 ${isUp ? "text-green-600" : "text-red-500"}`}>
              {isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {isUp ? "+" : ""}{fmt(chg)} ({fmtPct(pct)}) today
            </p>
          </div>
          <div className="text-right text-xs text-slate-500 dark:text-slate-400">
            <p>Prev Close</p>
            <p className="font-medium text-slate-700 dark:text-slate-300">₹{fmt(data.prev_close)}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {([
            ["Open",     data.open],
            ["Day High", data.day_high],
            ["Day Low",  data.day_low],
            ["52W High", data.week_52_high],
            ["52W Low",  data.week_52_low],
            ["Volume",   data.volume],
          ] as [string, unknown][]).map(([label, val]) => (
            <div key={label} className="bg-slate-50 dark:bg-gray-800 rounded-lg p-3">
              <p className="text-xs text-slate-400 dark:text-slate-500">{label}</p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {label === "Volume" ? fmt(val) : `₹${fmt(val)}`}
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="px-4 py-2 bg-slate-50 dark:bg-gray-800 text-xs text-slate-400">
        Source: {safeStr(data.source) || "Angel One SmartAPI"}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// TOP GAINERS & LOSERS
// ════════════════════════════════════════════════
function GainersLosers({ data }: { data: Record<string, unknown> }) {
  const gainers = (data.gainers as Array<Record<string, unknown>>) ?? [];
  const losers  = (data.losers  as Array<Record<string, unknown>>) ?? [];

  return (
    <div className="mt-4 rounded-xl overflow-hidden border border-slate-200 dark:border-gray-700">
      <div className="bg-slate-800 dark:bg-gray-900 px-4 py-2 flex items-center gap-2">
        <BarChart2 size={18} className="text-white" />
        <span className="text-white font-semibold text-sm">
          🏆 Top Gainers & Losers — {safeStr(data.index) || "Nifty 100"}
        </span>
        <span className="ml-auto text-slate-400 text-xs">{safeStr(data.time)}</span>
      </div>
      <div className="bg-white dark:bg-gray-900 grid grid-cols-2 divide-x divide-slate-100 dark:divide-gray-800">
        <div>
          <div className="px-3 py-1.5 bg-green-50 dark:bg-green-900/20 border-b border-green-100 dark:border-green-900">
            <span className="text-green-700 dark:text-green-400 text-xs font-semibold flex items-center gap-1">
              <TrendingUp size={14} /> Top Gainers
            </span>
          </div>
          {gainers.map((s, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 border-b border-slate-50 dark:border-gray-800 last:border-0">
              <div>
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{safeStr(s.symbol)}</span>
                <p className="text-xs text-slate-400">₹{fmt(s.price)}</p>
              </div>
              <span className="text-xs font-bold text-green-600 flex items-center gap-0.5">
                <ArrowUpRight size={14} />{fmtPct(s.change_pct)}
              </span>
            </div>
          ))}
        </div>
        <div>
          <div className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900">
            <span className="text-red-700 dark:text-red-400 text-xs font-semibold flex items-center gap-1">
              <TrendingDown size={14} /> Top Losers
            </span>
          </div>
          {losers.map((s, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 border-b border-slate-50 dark:border-gray-800 last:border-0">
              <div>
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{safeStr(s.symbol)}</span>
                <p className="text-xs text-slate-400">₹{fmt(s.price)}</p>
              </div>
              <span className="text-xs font-bold text-red-500 flex items-center gap-0.5">
                <ArrowDownRight size={14} />{fmtPct(s.change_pct)}
              </span>
            </div>
          ))}
        </div>
      </div>
      {data.note != null && (
        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-xs text-blue-600 dark:text-blue-400 border-t border-blue-100 dark:border-blue-800">
          🕐 {safeStr(data.note)}
        </div>
      )}
      <div className="px-4 py-2 bg-slate-50 dark:bg-gray-800 text-xs text-slate-400">
        Source: {safeStr(data.source) || "NSE India"}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// BEST MUTUAL FUNDS BY RETURNS
// ════════════════════════════════════════════════
function MFReturns({ data }: { data: Record<string, unknown> }) {
  const categories = (data.data as Record<string, Array<Record<string, unknown>>>) ?? {};
  const defaultTab = (data.active_category as string) || Object.keys(categories)[0] || "";
  const [activeTab, setActiveTab] = useState(defaultTab);
  useEffect(() => { if (defaultTab) setActiveTab(defaultTab); }, [defaultTab]);

  const tabs  = Object.keys(categories);
  const funds = categories[activeTab] ?? [];

  const ICONS: Record<string, string> = {
    "Large Cap": "🏛️", "Mid Cap": "🏢", "Small Cap": "🏠",
    "Flexi Cap": "🔄", "Gold Fund": "🥇", "Silver Fund": "🥈",
  };

  return (
    <div className="mt-4 rounded-xl overflow-hidden border border-purple-200 dark:border-purple-800">
      <div className="bg-purple-700 dark:bg-purple-900 px-4 py-2 flex items-center gap-2">
        <TrendingUp size={18} className="text-white" />
        <span className="text-white font-semibold text-sm">📊 Best Mutual Funds by Returns</span>
      </div>
      <div className="flex overflow-x-auto bg-purple-50 dark:bg-purple-900/20 border-b border-purple-100 dark:border-purple-900">
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-shrink-0 px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-purple-700 text-white"
                : "text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40"
            }`}>
            {ICONS[tab] || "📈"} {tab}
          </button>
        ))}
      </div>
      <div className="bg-white dark:bg-gray-900">
        <div className="grid grid-cols-4 px-3 py-1.5 bg-slate-50 dark:bg-gray-800 text-xs text-slate-500 dark:text-slate-400 font-medium">
          <span className="col-span-2">Fund</span>
          <span className="text-center">1Y</span>
          <span className="text-center">3Y / 5Y</span>
        </div>
        {funds.length > 0 ? funds.map((f, i) => (
          <div key={i} className="grid grid-cols-4 px-3 py-2.5 border-b border-slate-50 dark:border-gray-800 last:border-0 items-center">
            <div className="col-span-2 pr-2">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-tight line-clamp-2">
                {safeStr(f.name).replace(/Direct.*Growth/i, "").trim()}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">NAV ₹{fmt(f.nav)}</p>
            </div>
            <div className="text-center">
              <span className={`text-sm font-bold ${
                typeof f.return_1y === "number" && f.return_1y > 0 ? "text-green-600" : "text-red-500"
              }`}>
                {f.return_1y != null ? fmtPct(f.return_1y) : "—"}
              </span>
            </div>
            <div className="text-center text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
              <p>{f.return_3y != null ? fmtPct(f.return_3y) : "—"}</p>
              <p className="text-slate-300 dark:text-slate-600">{f.return_5y != null ? fmtPct(f.return_5y) : "—"}</p>
            </div>
          </div>
        )) : (
          <div className="px-4 py-3 text-xs text-slate-400">No data for {activeTab}</div>
        )}
      </div>
      <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-xs">
        ⚠️ {safeStr(data.note) || "Past returns don't guarantee future performance."}
      </div>
      <div className="px-4 py-2 bg-slate-50 dark:bg-gray-800 text-xs text-slate-400">
        Source: {safeStr(data.source) || "AMFI India"}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// MF NAV CARD
// ════════════════════════════════════════════════
function MFNavCard({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="mt-4 rounded-xl overflow-hidden border border-indigo-200 dark:border-indigo-800">
      <div className="bg-indigo-600 dark:bg-indigo-800 px-4 py-2 flex items-center gap-2">
        <BarChart2 size={18} className="text-white" />
        <span className="text-white font-semibold text-sm">📊 Mutual Fund NAV</span>
      </div>
      <div className="bg-white dark:bg-gray-900 px-4 py-3 space-y-2">
        <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{safeStr(data.fund_name)}</p>
        <p className="text-slate-500 text-xs">{safeStr(data.fund_house)} · {safeStr(data.scheme_type)}</p>
        <div className="flex items-center gap-4 mt-2">
          <div>
            <p className="text-xs text-slate-400">NAV</p>
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">₹{safeStr(data.nav)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">As of</p>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{safeStr(data.nav_date)}</p>
          </div>
        </div>
      </div>
      <div className="px-4 py-2 bg-slate-50 dark:bg-gray-800 text-xs text-slate-400">
        Source: {safeStr(data.source) || "AMFI India"}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// GOLD CARD
// ════════════════════════════════════════════════
function GoldCard({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="mt-4 rounded-xl overflow-hidden border border-yellow-200 dark:border-yellow-800">
      <div className="bg-yellow-500 dark:bg-yellow-700 px-4 py-2">
        <span className="text-white font-semibold text-sm">🥇 Gold Price (MCX / COMEX)</span>
      </div>
      <div className="bg-white dark:bg-gray-900 px-4 py-3 grid grid-cols-2 gap-3">
        {([
          ["10g (INR)",    `₹${fmt(data.gold_inr_per_10g)}`],
          ["Per gram",     `₹${fmt(data.gold_inr_per_gram)}`],
          ["USD/troy oz",  `$${fmt(data.gold_usd_per_troy_oz)}`],
          ["USD/INR",      fmt(data.usd_inr_rate)],
        ] as [string, string][]).map(([label, value]) => (
          <div key={label} className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
            <p className="text-xs text-slate-400">{label}</p>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{value}</p>
          </div>
        ))}
      </div>
      <div className="px-4 py-2 bg-slate-50 dark:bg-gray-800 text-xs text-slate-400">
        Source: {safeStr(data.source)}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// FOREX CARD
// ════════════════════════════════════════════════
function ForexCard({ data }: { data: Record<string, unknown> }) {
  const pct  = typeof data.change_pct === "number" ? data.change_pct : 0;
  const isUp = pct >= 0;
  return (
    <div className="mt-4 rounded-xl overflow-hidden border border-cyan-200 dark:border-cyan-800">
      <div className="bg-cyan-600 dark:bg-cyan-800 px-4 py-2">
        <span className="text-white font-semibold text-sm">
          💱 {safeStr(data.from)}/{safeStr(data.to)} Exchange Rate
        </span>
      </div>
      <div className="bg-white dark:bg-gray-900 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">₹{fmt(data.rate)}</p>
          <p className="text-xs text-slate-500">per 1 {safeStr(data.from)}</p>
        </div>
        <span className={`text-sm font-bold flex items-center gap-1 ${isUp ? "text-green-600" : "text-red-500"}`}>
          {isUp ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
          {fmtPct(pct)}
        </span>
      </div>
      <div className="px-4 py-2 bg-slate-50 dark:bg-gray-800 text-xs text-slate-400">
        Source: {safeStr(data.source)}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// MARKET CLOSED / ERROR CARD
// ════════════════════════════════════════════════
function ErrorCard({ message }: { message: string }) {
  const isClosed = message.toLowerCase().includes("closed") || message.toLowerCase().includes("no data");
  return (
    <div className="mt-4 rounded-xl overflow-hidden border border-amber-200 dark:border-amber-800">
      <div className="bg-amber-500 dark:bg-amber-700 px-4 py-2">
        <span className="text-white font-semibold text-sm">
          {isClosed ? "🕐 Market Closed" : "⚠️ Data Unavailable"}
        </span>
      </div>
      <div className="bg-white dark:bg-gray-900 px-4 py-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">{message}</p>
        {isClosed && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            NSE trading hours: Mon–Fri, 9:15 AM – 3:30 PM IST
          </p>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// GENERIC FALLBACK
// ════════════════════════════════════════════════
function GenericResult({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/30 rounded-lg text-sm space-y-2 border border-green-200 dark:border-green-800">
      <p className="font-semibold text-green-700 dark:text-green-300 text-sm">📈 Live Data</p>
      {Object.entries(data).filter(([k]) => k !== "type").map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4">
          <span className="text-slate-500 dark:text-slate-400 capitalize">{k.replace(/_/g, " ")}</span>
          <span className="font-medium text-slate-800 dark:text-slate-200 text-right">
            {typeof v === "object" && v !== null ? JSON.stringify(v) : safeStr(v)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════
// SMART REALTIME ROUTER
// ════════════════════════════════════════════════
function RealtimeResult({ data }: { data: Record<string, unknown> }) {
  if (!data || Object.keys(data).length === 0) return null;
  if (data.error != null) return <ErrorCard message={safeStr(data.error)} />;
  const type = safeStr(data.type);
  if (type === "gainers_losers")  return <GainersLosers data={data} />;
  if (type === "mf_returns")      return <MFReturns     data={data} />;
  if (type === "market_overview") return <MarketOverview data={data} />;
  if (type === "stock")           return <StockCard      data={data} />;
  if (type === "mf_nav")          return <MFNavCard      data={data} />;
  if (type === "gold")            return <GoldCard       data={data} />;
  if (type === "forex")           return <ForexCard      data={data} />;
  if (data.gainers != null && data.losers != null) return <GainersLosers data={data} />;
  if (data.data != null && typeof data.data === "object") return <MFReturns data={data} />;
  if (data.price != null && data.change !== undefined)    return <StockCard  data={data} />;
  if (data["Nifty 50"] != null || data["SENSEX"] != null) return <MarketOverview data={data} />;
  if (data.nav != null && data.fund_name != null)         return <MFNavCard  data={data} />;
  if (data.gold_inr_per_10g != null)                      return <GoldCard   data={data} />;
  if (data.rate != null && data.from != null)             return <ForexCard  data={data} />;
  return <GenericResult data={data} />;
}

// ════════════════════════════════════════════════
// MISSED DEDUCTIONS CARD
// ════════════════════════════════════════════════
function MissedDeductionsCard({ data }: { data: Record<string, unknown> }) {
  const opps = (data.opportunities ?? []) as Array<Record<string, unknown>>;
  const total = data.total_potential_saving as number ?? 0;
  const slab = String(data.marginal_slab_rate ?? "—");
  return (
    <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg text-sm border border-emerald-200 dark:border-emerald-800">
      <p className="font-semibold text-emerald-700 dark:text-emerald-300 text-sm mb-2">
        💰 Tax Saving Opportunities (Your Slab: {slab})
      </p>
      <div className="space-y-2">
        {opps.map((o, i) => {
          const gap = o.gap as number ?? 0;
          const saving = o.tax_saving as number ?? 0;
          const instruments = (o.instruments ?? []) as string[];
          return (
            <div key={i} className="p-3 bg-white dark:bg-gray-800 rounded border border-emerald-100 dark:border-emerald-700">
              <div className="flex justify-between font-medium text-slate-800 dark:text-slate-200">
                <span>§{String(o.section)}</span>
                <span className="text-emerald-600 dark:text-emerald-400">Save {fmtINR(saving)}</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                {fmtINR(gap)} unused headroom
              </p>
              <p className="text-slate-600 dark:text-slate-300 mt-0.5">{String(o.action)}</p>
              {instruments.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {instruments.map((inst, j) => (
                    <span key={j} className="bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded text-xs">
                      {inst}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-700 flex justify-between font-semibold text-sm">
        <span className="text-slate-600 dark:text-slate-300">Total Potential Saving</span>
        <span className="text-emerald-600 dark:text-emerald-400">{fmtINR(total)}/year</span>
      </div>
      {data.regime_note ? (
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{String(data.regime_note)}</p>
      ) : null}
    </div>
  );
}

// ════════════════════════════════════════════════
// ADVANCE TAX PLANNER CARD
// ════════════════════════════════════════════════
function AdvanceTaxCard({ data }: { data: Record<string, unknown> }) {
  const required = data.advance_tax_required as boolean;
  const installments = (data.installments ?? []) as Array<Record<string, unknown>>;
  const i234b = (data.interest_234b ?? {}) as Record<string, unknown>;

  if (!required) {
    return (
      <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/30 rounded-lg text-sm border border-green-200 dark:border-green-800">
        <p className="font-semibold text-green-700 dark:text-green-300 text-sm">
          <CheckCircle className="inline w-4 h-4 mr-1" />
          Advance Tax Not Required
        </p>
        <p className="text-slate-600 dark:text-slate-300 mt-1">{String(data.reason ?? "")}</p>
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/30 rounded-lg text-sm border border-amber-200 dark:border-amber-800">
      <p className="font-semibold text-amber-700 dark:text-amber-300 text-sm mb-2">
        📅 Advance Tax Installment Plan
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3">
        <span className="text-slate-500 dark:text-slate-400">Expected Income</span>
        <span className="text-right font-medium text-slate-800 dark:text-slate-200">{fmtINR(data.expected_income)}</span>
        <span className="text-slate-500 dark:text-slate-400">Total Tax</span>
        <span className="text-right font-medium text-slate-800 dark:text-slate-200">{fmtINR(data.total_tax)}</span>
        <span className="text-slate-500 dark:text-slate-400">TDS Deducted</span>
        <span className="text-right font-medium text-slate-800 dark:text-slate-200">{fmtINR(data.tds_deducted)}</span>
        <span className="text-slate-500 dark:text-slate-400">Net Liability</span>
        <span className="text-right font-semibold text-amber-700 dark:text-amber-300">{fmtINR(data.net_liability)}</span>
      </div>
      <table className="w-full text-sm mt-1">
        <thead>
          <tr className="border-b border-amber-200 dark:border-amber-700 text-slate-500 dark:text-slate-400">
            <th className="text-left py-2">Installment</th>
            <th className="text-left py-2">Due Date</th>
            <th className="text-right py-2">Amount</th>
            <th className="text-right py-2">Cumul.</th>
          </tr>
        </thead>
        <tbody>
          {installments.map((row, i) => (
            <tr key={i} className="border-b border-amber-100 dark:border-amber-800">
              <td className="py-2 text-slate-700 dark:text-slate-300">{String(row.installment)}</td>
              <td className="py-2 text-slate-700 dark:text-slate-300">{String(row.due_date)}</td>
              <td className="py-2 text-right font-medium text-slate-800 dark:text-slate-200">{fmtINR(row.amount)}</td>
              <td className="py-2 text-right text-slate-500 dark:text-slate-400">{String(row.pct)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      {i234b.applies ? (
        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/30 rounded border border-red-200 dark:border-red-800">
          <p className="text-red-700 dark:text-red-300 font-medium">
            <AlertTriangle className="inline w-3 h-3 mr-1" />
            §234B Interest Risk
          </p>
          <p className="text-red-600 dark:text-red-400">
            Shortfall: {fmtINR(i234b.shortfall)} → {fmtINR(i234b.monthly_interest)}/month interest
          </p>
        </div>
      ) : null}
      {data.payment_method ? (
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">{String(data.payment_method)}</p>
      ) : null}
    </div>
  );
}

// ════════════════════════════════════════════════
// AUDIT REQUIREMENT CARD
// ════════════════════════════════════════════════
function AuditCard({ data }: { data: Record<string, unknown> }) {
  const required = data.audit_required as boolean;
  const reqs = (data.requirements ?? []) as string[];
  return (
    <div className={`mt-4 p-4 rounded-lg text-sm border ${
      required
        ? "bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800"
        : "bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800"
    }`}>
      <p className={`font-semibold text-sm ${
        required ? "text-red-700 dark:text-red-300" : "text-green-700 dark:text-green-300"
      }`}>
        {required ? (
          <><AlertCircle className="inline w-4 h-4 mr-1" />Tax Audit MANDATORY</>
        ) : (
          <><CheckCircle className="inline w-4 h-4 mr-1" />Audit Not Required</>
        )}
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3">
        <span className="text-slate-500 dark:text-slate-400">Turnover</span>
        <span className="text-right font-medium text-slate-800 dark:text-slate-200">{fmtINR(data.turnover)}</span>
        <span className="text-slate-500 dark:text-slate-400">Threshold</span>
        <span className="text-right font-medium text-slate-800 dark:text-slate-200">{String(data.threshold_label)}</span>
        <span className="text-slate-500 dark:text-slate-400">Section</span>
        <span className="text-right font-medium text-slate-800 dark:text-slate-200">{String(data.section)}</span>
      </div>
      {required && reqs.length > 0 && (
        <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-700">
          <p className="font-medium text-red-700 dark:text-red-300 mb-1">Requirements:</p>
          <ul className="list-disc list-inside space-y-1.5 text-slate-600 dark:text-slate-300">
            {reqs.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
          {data.penalty ? (
            <p className="mt-1 text-red-600 dark:text-red-400 font-medium">
              Penalty: {String(data.penalty)}
            </p>
          ) : null}
        </div>
      )}
      {!required && data.presumptive_note ? (
        <p className="mt-2 text-slate-500 dark:text-slate-400">{String(data.presumptive_note)}</p>
      ) : null}
    </div>
  );
}

// ════════════════════════════════════════════════
// HOME PURCHASE CARD
// ════════════════════════════════════════════════
function HomePurchaseCard({ data }: { data: Record<string, unknown> }) {
  const aff = (data.affordability ?? {}) as Record<string, unknown>;
  const tb = (data.tax_benefits ?? {}) as Record<string, unknown>;
  const s24b = (tb.section_24b ?? {}) as Record<string, unknown>;
  const s80c = (tb.section_80c_principal ?? {}) as Record<string, unknown>;
  const s80eea = (tb.section_80eea ?? {}) as Record<string, unknown>;
  const regime = (data.regime_comparison ?? {}) as Record<string, unknown>;
  const prepay = (data.prepayment_scenario ?? {}) as Record<string, unknown>;
  const affordable = aff.affordable as boolean;

  return (
    <div className="mt-4 p-4 bg-violet-50 dark:bg-violet-900/30 rounded-lg text-sm border border-violet-200 dark:border-violet-800">
      <p className="font-semibold text-violet-700 dark:text-violet-300 text-sm mb-2">
        🏠 Home Purchase Analysis
      </p>

      {/* Loan & EMI */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <span className="text-slate-500 dark:text-slate-400">Property Value</span>
        <span className="text-right font-medium text-slate-800 dark:text-slate-200">{fmtINR(data.property_value)}</span>
        <span className="text-slate-500 dark:text-slate-400">Loan Amount</span>
        <span className="text-right font-medium text-slate-800 dark:text-slate-200">{fmtINR(data.loan_amount)}</span>
        <span className="text-slate-500 dark:text-slate-400">Down Payment</span>
        <span className="text-right font-medium text-slate-800 dark:text-slate-200">{fmtINR(data.down_payment)}</span>
        <span className="text-slate-500 dark:text-slate-400">Monthly EMI</span>
        <span className="text-right font-semibold text-violet-700 dark:text-violet-300">{fmtINR(data.monthly_emi)}</span>
        <span className="text-slate-500 dark:text-slate-400">Interest Rate</span>
        <span className="text-right font-medium text-slate-800 dark:text-slate-200">{String(data.interest_rate)}%</span>
        <span className="text-slate-500 dark:text-slate-400">Tenure</span>
        <span className="text-right font-medium text-slate-800 dark:text-slate-200">{String(data.tenure_years)} years</span>
        <span className="text-slate-500 dark:text-slate-400">Total Interest</span>
        <span className="text-right font-medium text-slate-800 dark:text-slate-200">{fmtINR(data.total_interest)}</span>
      </div>

      {/* Affordability */}
      <div className={`mt-3 p-3 rounded border ${
        affordable
          ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
          : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
      }`}>
        <p className={`font-medium ${affordable ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>
          {affordable ? <CheckCircle className="inline w-4 h-4 mr-1" /> : <AlertTriangle className="inline w-4 h-4 mr-1" />}
          EMI is {String(aff.emi_to_income_pct)}% of take-home ({fmtINR(aff.monthly_takehome)})
        </p>
        <p className="text-slate-500 dark:text-slate-400 mt-0.5">{String(aff.recommendation)}</p>
      </div>

      {/* Tax Benefits */}
      <div className="mt-3 pt-3 border-t border-violet-200 dark:border-violet-700">
        <p className="font-medium text-violet-700 dark:text-violet-300 mb-1">Annual Tax Benefits (Old Regime)</p>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">§24(b) Interest</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Save {fmtINR(s24b.tax_saving)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">§80C Principal</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Save {fmtINR(s80c.tax_saving)}</span>
          </div>
          <div className="flex justify-between font-semibold border-t border-violet-200 dark:border-violet-700 pt-1">
            <span className="text-slate-600 dark:text-slate-300">Total Annual Saving</span>
            <span className="text-emerald-600 dark:text-emerald-400">{fmtINR(tb.total_annual_tax_saving)}/yr</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Effective EMI after tax</span>
            <span className="text-violet-700 dark:text-violet-300 font-medium">{fmtINR(tb.effective_emi_after_tax)}</span>
          </div>
        </div>
      </div>

      {/* 80EEA Warning */}
      {s80eea.warning ? (
        <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
          <p className="text-amber-700 dark:text-amber-300 font-medium">
            <AlertTriangle className="inline w-4 h-4 mr-1" />§80EEA Status
          </p>
          <p className="text-amber-600 dark:text-amber-400">{String(s80eea.warning)}</p>
        </div>
      ) : null}

      {/* Regime Comparison */}
      {regime.recommendation ? (
        <div className="mt-3 pt-3 border-t border-violet-200 dark:border-violet-700">
          <p className="font-medium text-violet-700 dark:text-violet-300 mb-1">New vs Old Regime Comparison</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <span className="text-slate-500 dark:text-slate-400">Old Regime Tax</span>
            <span className="text-right font-medium text-slate-800 dark:text-slate-200">{fmtINR(regime.old_regime_tax)}</span>
            <span className="text-slate-500 dark:text-slate-400">New Regime Tax</span>
            <span className="text-right font-medium text-slate-800 dark:text-slate-200">{fmtINR(regime.new_regime_tax)}</span>
            <span className="text-slate-500 dark:text-slate-400">Old Regime Annual Cost</span>
            <span className="text-right font-medium text-slate-800 dark:text-slate-200">{fmtINR(regime.old_annual_cost)}</span>
            <span className="text-slate-500 dark:text-slate-400">New Regime Annual Cost</span>
            <span className="text-right font-medium text-slate-800 dark:text-slate-200">{fmtINR(regime.new_annual_cost)}</span>
          </div>
          <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
            <p className="text-blue-700 dark:text-blue-300 font-medium">
              Recommended: {String(regime.recommendation)}
            </p>
            <p className="text-blue-600 dark:text-blue-400 mt-0.5">{String(regime.note)}</p>
          </div>
        </div>
      ) : null}

      {/* Hidden Costs Warning */}
      {data.hidden_costs_warning ? (
        <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded border border-orange-200 dark:border-orange-800">
          <p className="text-orange-700 dark:text-orange-300 font-medium">
            <AlertTriangle className="inline w-4 h-4 mr-1" />Hidden Costs
          </p>
          <p className="text-orange-600 dark:text-orange-400">{String(data.hidden_costs_warning)}</p>
        </div>
      ) : null}

      {/* Prepayment Scenario */}
      {prepay.interest_saved ? (
        <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded border border-emerald-200 dark:border-emerald-800">
          <p className="text-emerald-700 dark:text-emerald-300 font-medium">
            💡 Pro Tip: Prepayment Scenario
          </p>
          <p className="text-emerald-600 dark:text-emerald-400 mt-0.5">
            Increasing your EMI by just {fmtINR(prepay.extra_monthly)}/month will reduce your loan tenure by ~{String(prepay.years_saved)} years and save you roughly {fmtINR(prepay.interest_saved)} in total interest.
          </p>
        </div>
      ) : null}
    </div>
  );
}

// ════════════════════════════════════════════════
// TAX CALENDAR CARD
// ════════════════════════════════════════════════
const URGENCY_STYLES: Record<string, { pill: string; icon: string }> = {
  overdue:  { pill: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700", icon: "🚨" },
  critical: { pill: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-700", icon: "⚠️" },
  soon:     { pill: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700", icon: "🔔" },
  upcoming: { pill: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700", icon: "📌" },
  future:   { pill: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700", icon: "📅" },
};
const CAT_LABELS: Record<string, string> = {
  advance_tax: "Advance Tax", itr: "ITR Filing", itr_audit: "ITR (Audit)",
  itr_revised: "Revised ITR", tds: "TDS Return", audit: "Tax Audit",
  tax_saving: "Tax Saving", transfer_pricing: "Transfer Pricing",
};

function TaxCalendarCard({ data }: { data: Record<string, unknown> }) {
  const deadlines = (data.deadlines ?? []) as Record<string, unknown>[];
  const summary   = String(data.summary ?? "");
  const refDate   = String(data.reference_date ?? "");

  return (
    <div className="mt-2 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
      {/* Header */}
      <div className="bg-indigo-600 dark:bg-indigo-800 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-white font-semibold text-sm">📅 Tax Planning Calendar</p>
          <p className="text-indigo-200 text-xs mt-0.5">As of {refDate}</p>
        </div>
        <span className="bg-indigo-500 dark:bg-indigo-700 text-white text-xs px-2 py-1 rounded-full">
          {deadlines.length} deadlines
        </span>
      </div>

      {/* Summary banner */}
      <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800">
        <p className="text-indigo-700 dark:text-indigo-300 text-xs">{summary}</p>
      </div>

      {/* Deadline list */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-gray-900">
        {deadlines.map((d, i) => {
          const urgency = String(d.urgency ?? "future");
          const style   = URGENCY_STYLES[urgency] ?? URGENCY_STYLES.future;
          const catLabel = CAT_LABELS[String(d.category ?? "")] ?? String(d.category ?? "");
          return (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-lg w-6 text-center flex-shrink-0">{style.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug truncate">
                  {String(d.label ?? "")}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {String(d.date ?? "")} &nbsp;·&nbsp; {Number(d.days_away)} days away
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${style.pill}`}>
                  {urgency}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">{catLabel}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-slate-50 dark:bg-gray-800 border-t border-slate-100 dark:border-slate-700">
        <p className="text-xs text-slate-400 dark:text-slate-500">{String(data.source ?? "")}</p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// INSURANCE ADEQUACY CARD
// ════════════════════════════════════════════════
function InsuranceCard({ data }: { data: Record<string, unknown> }) {
  const isAdequate = data.status === "ADEQUATE";
  const gap        = Number(data.cover_gap ?? 0);
  const recs       = (data.recommendations ?? []) as string[];

  return (
    <div className="mt-2 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
      {/* Header */}
      <div className={`px-4 py-3 ${isAdequate ? "bg-green-600 dark:bg-green-800" : "bg-red-600 dark:bg-red-800"}`}>
        <p className="text-white font-semibold text-sm">
          {isAdequate ? "✅" : "⚠️"} Life Insurance Adequacy Check
        </p>
        <p className={`text-xs mt-0.5 ${isAdequate ? "text-green-200" : "text-red-200"}`}>
          {isAdequate ? "Your cover is adequate" : `Cover gap: ${fmtINR(gap)}`}
        </p>
      </div>

      {/* Key figures grid */}
      <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-gray-900">
        {[
          ["Annual Income",         fmtINR(data.annual_income)],
          ["Current Cover",         fmtINR(data.current_cover)],
          ["Recommended Min (10x)", fmtINR(data.recommended_cover_min)],
          ["Recommended Max",       fmtINR(data.recommended_cover_max)],
          ["HLV Cross-check",       fmtINR(data.hlv_estimate)],
          ["Est. Premium to Close Gap", `₹${fmt(data.annual_premium_estimate)}/yr`],
        ].map(([label, value]) => (
          <div key={label} className="px-4 py-2.5">
            <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Gap bar */}
      {!isAdequate && gap > 0 && (() => {
        const current = Number(data.current_cover ?? 0);
        const min     = Number(data.recommended_cover_min ?? 1);
        const pct     = Math.min(100, Math.round(current / min * 100));
        return (
          <div className="px-4 py-3 bg-slate-50 dark:bg-gray-800 border-t border-slate-100 dark:border-slate-700">
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>Coverage: {pct}% of minimum required</span>
              <span>{fmtINR(current)} / {fmtINR(min)}</span>
            </div>
            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 rounded-full" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })()}

      {/* Recommendations */}
      <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-gray-900">
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Recommendations</p>
        <ul className="space-y-1.5">
          {recs.map((r, i) => (
            <li key={i} className="flex gap-2 text-xs text-slate-600 dark:text-slate-300">
              <span className="text-slate-400 flex-shrink-0">•</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Premium note + source */}
      <div className="px-4 py-2 bg-slate-50 dark:bg-gray-800 border-t border-slate-100 dark:border-slate-700">
        <p className="text-xs text-slate-400 dark:text-slate-500">{String(data.premium_note ?? "")}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{String(data.source ?? "")}</p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// GOAL INVESTMENT PLAN CARD
// ════════════════════════════════════════════════
const FEASIBILITY_STYLE: Record<string, string> = {
  FEASIBLE:    "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700",
  MODERATE:    "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700",
  HIGH_STRAIN: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700",
  UNKNOWN:     "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700",
};

function GoalPlanCard({ data }: { data: Record<string, unknown> }) {
  const mix  = (data.instrument_mix      ?? []) as Record<string, unknown>[];
  const sips = (data.sip_per_instrument  ?? []) as Record<string, unknown>[];
  const feasibility     = String(data.feasibility ?? "UNKNOWN");
  const feasibilityNote = String(data.feasibility_note ?? "");
  const fStyle          = FEASIBILITY_STYLE[feasibility] ?? FEASIBILITY_STYLE.UNKNOWN;

  // Allocation bar colors
  const BAR_COLORS = ["bg-violet-500","bg-blue-500","bg-emerald-500","bg-amber-500","bg-rose-500"];

  return (
    <div className="mt-2 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
      {/* Header */}
      <div className="bg-violet-600 dark:bg-violet-800 px-4 py-3">
        <p className="text-white font-semibold text-sm">🎯 Goal Investment Plan</p>
        <p className="text-violet-200 text-xs mt-0.5">
          Target {fmtINR(data.target_amount)} in {String(data.timeline_years)} years
        </p>
      </div>

      {/* Hero SIP */}
      <div className="bg-violet-50 dark:bg-violet-900/20 px-4 py-3 border-b border-violet-100 dark:border-violet-800 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Required Monthly SIP</p>
          <p className="text-2xl font-bold text-violet-700 dark:text-violet-300">
            {fmtINR(data.required_monthly_sip)}
          </p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${fStyle}`}>
          {feasibility}
        </span>
      </div>

      {/* Feasibility note */}
      {feasibilityNote ? (
        <div className="px-4 py-2 bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-slate-700">
          <p className="text-xs text-slate-500 dark:text-slate-400">{feasibilityNote}</p>
        </div>
      ) : null}

      {/* Summary grid */}
      <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-gray-900">
        {[
          ["Target Amount",           fmtINR(data.target_amount)],
          ["Timeline",                `${String(data.timeline_years)} years`],
          ["Current Savings",         fmtINR(data.current_savings)],
          ["Future Value of Savings", fmtINR(data.fv_current_savings)],
          ["Gap to Fill",             fmtINR(data.gap_to_fill)],
          ["Assumed CAGR",            "12% (equity)"],
        ].map(([label, value]) => (
          <div key={label} className="px-4 py-2.5">
            <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Allocation bar */}
      <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-gray-900">
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Recommended Allocation</p>
        <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
          {mix.map((m, i) => (
            <div
              key={i}
              className={`${BAR_COLORS[i % BAR_COLORS.length]} flex-shrink-0`}
              style={{ width: `${Number(m.allocation_pct ?? 0)}%` }}
              title={`${String(m.instrument)}: ${Number(m.allocation_pct)}%`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
          {mix.map((m, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className={`inline-block w-2.5 h-2.5 rounded-sm ${BAR_COLORS[i % BAR_COLORS.length]}`} />
              {String(m.instrument)} {Number(m.allocation_pct)}%
            </div>
          ))}
        </div>
      </div>

      {/* Per-instrument SIP table */}
      <div className="border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-gray-900">
        <div className="grid grid-cols-3 px-4 py-1.5 bg-slate-50 dark:bg-gray-800 text-xs font-medium text-slate-500 dark:text-slate-400">
          <span>Instrument</span><span className="text-right">Monthly SIP</span><span className="text-right">Why</span>
        </div>
        {mix.map((m, i) => {
          const sipEntry = sips[i] ?? {};
          return (
            <div key={i} className="grid grid-cols-3 px-4 py-2.5 border-t border-slate-50 dark:border-slate-800 items-start">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 pr-2">{String(m.instrument)}</span>
              <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 text-right">{fmtINR(sipEntry.monthly_sip)}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 text-right pl-2 leading-snug">{String(m.rationale)}</span>
            </div>
          );
        })}
      </div>

      {/* Note + source */}
      <div className="px-4 py-2.5 bg-slate-50 dark:bg-gray-800 border-t border-slate-100 dark:border-slate-700">
        <p className="text-xs text-slate-400 dark:text-slate-500">{String(data.note ?? "")}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{String(data.source ?? "")}</p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// TAX PLANNER CARD
// ════════════════════════════════════════════════
const SECTION_COLORS: Record<string, string> = {
  "Section 10(13A)": "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  "Section 80C":     "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300",
  "Section 80CCD(1B)":"bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300",
  "Section 80D":     "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
  "Section 24(b)":   "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  "Section 80E":     "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300",
};

function TaxPlannerCard({ data, onForceOldRegime }: {
  data: Record<string, unknown>;
  onForceOldRegime?: () => void;
}) {
  const inc                = (data.income_details ?? {}) as Record<string, unknown>;
  const steps              = (data.steps ?? []) as Record<string, unknown>[];
  const recommendOld       = data.recommend_old as boolean;
  const forceOldRegime     = data.force_old_regime as boolean;
  const currentTax         = Number(data.current_tax     ?? 0);
  const optimisedTax       = Number(data.optimised_tax   ?? 0);
  const totalSaving        = Number(data.total_saving    ?? 0);
  const newTax             = Number(data.current_tax_new ?? 0);
  const oldEffRate         = Number(data.old_eff_rate    ?? 0);
  const newEffRate         = Number(data.new_eff_rate    ?? 0);
  const newRegimeSaving    = Number(data.new_regime_tax_saving  ?? 0);
  const disposableGain     = Number(data.disposable_income_gain ?? 0);
  const showOldSteps       = recommendOld || forceOldRegime;

  return (
    <div className="mt-2 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 text-xs">

      {/* ── Header ── */}
      <div className="bg-slate-900 dark:bg-slate-950 px-4 py-3">
        <p className="text-white font-semibold text-sm">📊 Tax Planning Report</p>
        <p className="text-slate-400 text-xs mt-0.5">AY 2026-27 · Finance Act 2025</p>
      </div>

      {/* ── PRIMARY CTA BANNER — most important info first ── */}
      {!recommendOld && !forceOldRegime ? (
        <div className="bg-emerald-600 dark:bg-emerald-700 px-4 py-3 border-b border-emerald-700 dark:border-emerald-800">
          <p className="text-white font-bold text-sm">
            ✅ Best Move: Switch to New Regime — Save {fmtINR(newRegimeSaving)} instantly
          </p>
          <p className="text-emerald-100 mt-1 leading-relaxed">
            No investments required. Just declare New Regime in your Form 12BB.
            {disposableGain > newRegimeSaving
              ? ` You also free up ${fmtINR(disposableGain - newRegimeSaving)} currently locked in 80C/NPS — total financial gain: ${fmtINR(disposableGain)}.`
              : ""}
          </p>
        </div>
      ) : (
        <div className="bg-amber-50 dark:bg-amber-950/40 px-4 py-3 border-b border-amber-200 dark:border-amber-800">
          <p className="text-amber-800 dark:text-amber-300 font-bold text-sm">
            📋 Old Regime is better for you — follow the checklist below to save {fmtINR(totalSaving)}
          </p>
          <p className="text-amber-700 dark:text-amber-400 mt-1">
            Maximising all deductions in the Old Regime saves more than the New Regime for your income profile.
          </p>
        </div>
      )}

      {/* ── Regime Comparison — promoted above the numbers ── */}
      <div className="bg-white dark:bg-gray-900 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
          Regime Comparison
        </p>
        <div className="grid grid-cols-2 gap-2">
          {/* Old Regime */}
          <div className={`rounded-lg p-3 border-2 ${recommendOld
            ? "border-emerald-500 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20"
            : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-gray-800"}`}>
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${recommendOld ? "bg-emerald-500" : "bg-slate-400"}`} />
              <span className="font-medium text-slate-700 dark:text-slate-300">Old Regime</span>
              {recommendOld ? (
                <span className="text-xs bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">Recommended</span>
              ) : null}
            </div>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{fmtINR(optimisedTax)}</p>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5">{oldEffRate}% effective rate</p>
            <p className="text-slate-400 dark:text-slate-500 mt-0.5">With all deductions</p>
          </div>
          {/* New Regime */}
          <div className={`rounded-lg p-3 border-2 ${!recommendOld
            ? "border-emerald-500 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20"
            : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-gray-800"}`}>
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${!recommendOld ? "bg-emerald-500" : "bg-slate-400"}`} />
              <span className="font-medium text-slate-700 dark:text-slate-300">New Regime</span>
              {!recommendOld ? (
                <span className="text-xs bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">Recommended</span>
              ) : null}
            </div>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{fmtINR(newTax)}</p>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5">{newEffRate}% effective rate</p>
            <p className="text-slate-400 dark:text-slate-500 mt-0.5">No deductions needed</p>
          </div>
        </div>
      </div>

      {/* ── Tax numbers (secondary, below regime comparison) ── */}
      <div className="bg-slate-50 dark:bg-gray-800 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
          Your Tax Numbers
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[
            ["Current Tax",             fmtINR(currentTax),    "text-orange-500 dark:text-orange-400",  "Old regime, no new investments"],
            [showOldSteps ? "After Optimisation" : "New Regime Tax", fmtINR(showOldSteps ? optimisedTax : newTax), "text-emerald-600 dark:text-emerald-400", showOldSteps ? "Old regime, fully optimised" : "Zero investments needed"],
            [showOldSteps ? "Tax Saving" : "You Save",         fmtINR(showOldSteps ? totalSaving : newRegimeSaving), "text-emerald-600 dark:text-emerald-400", showOldSteps ? "By using all deductions" : "By switching regime"],
          ].map(([label, value, color, sub]) => (
            <div key={label} className="bg-white dark:bg-gray-900 rounded-lg p-2.5 border border-slate-100 dark:border-slate-700">
              <p className="text-slate-500 dark:text-slate-400 leading-tight">{label}</p>
              <p className={`text-base font-bold mt-1 ${color}`}>{value}</p>
              <p className="text-slate-400 dark:text-slate-500 mt-0.5 leading-tight">{sub}</p>
            </div>
          ))}
        </div>
        {/* Disposable income gain — only when New Regime recommended */}
        {!recommendOld && !forceOldRegime && disposableGain > 0 && (
          <div className="mt-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-blue-700 dark:text-blue-300">
              💡 Total financial gain: <strong>{fmtINR(disposableGain)}</strong>
              {" "}(tax saved + capital freed from lock-in)
            </p>
          </div>
        )}
      </div>

      {/* ── Income Details ── */}
      <div className="bg-white dark:bg-gray-900 px-4 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
          Income Details
        </p>
        <div className="space-y-1">
          {[
            ["Gross Salary",             fmtINR(inc.gross_salary)],
            inc.hra_received             ? ["HRA Received",        fmtINR(inc.hra_received)]        : null,
            inc.rent_paid                ? ["Rent Paid (Annual)",   fmtINR(inc.rent_paid)]           : null,
            inc.rent_paid                ? ["City",                 String(inc.city ?? "")]          : null,
            inc.home_loan_interest       ? ["Home Loan Interest",   fmtINR(inc.home_loan_interest)]  : null,
            inc.edu_loan_interest        ? ["Education Loan Int.",  fmtINR(inc.edu_loan_interest)]   : null,
          ].filter(Boolean).map(row => {
            const [label, value] = row as [string, string];
            return (
              <div key={label} className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">{label}</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{value}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Action Steps — conditional on regime ── */}
      <div className="bg-white dark:bg-gray-900 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
          {showOldSteps ? "Old Regime Optimisation Checklist" : "Action Plan"}
        </p>
        {showOldSteps && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
            ⚠️ These steps apply only if you choose the Old Regime
          </p>
        )}
        <div className="space-y-3">
          {steps.map((s) => {
            const section = String(s.section ?? "");
            const sectionColor = SECTION_COLORS[section] ?? "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300";
            const hasTaxSaving = Number(s.tax_saving ?? 0) > 0;
            const warning = s.warning ? String(s.warning) : null;
            return (
              <div key={Number(s.step)} className="flex gap-3">
                <div className={`w-6 h-6 rounded-full text-white flex items-center justify-center font-bold flex-shrink-0 mt-0.5 ${showOldSteps ? "bg-amber-600 dark:bg-amber-700" : "bg-emerald-600 dark:bg-emerald-700"}`}>
                  {Number(s.step)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{String(s.title ?? "")}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${sectionColor}`}>
                      {section}
                    </span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{String(s.detail ?? "")}</p>
                  {warning ? (
                    <p className="text-red-600 dark:text-red-400 font-medium mt-1 flex items-start gap-1">
                      <span>⚠️</span><span>{warning}</span>
                    </p>
                  ) : null}
                  {hasTaxSaving ? (
                    <p className="text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                      Tax saving: {fmtINR(s.tax_saving)}
                    </p>
                  ) : null}
                  <p className="text-slate-400 dark:text-slate-500 italic mt-0.5">Source: {String(s.source ?? "")}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* "Show Old Regime checklist anyway" toggle — only when New Regime recommended */}
        {!recommendOld && !forceOldRegime && onForceOldRegime ? (
          <button
            onClick={onForceOldRegime}
            className="mt-4 text-xs text-slate-400 dark:text-slate-500 underline hover:text-slate-600 dark:hover:text-slate-300"
          >
            I want to use Old Regime — show me the full deduction checklist
          </button>
        ) : null}
      </div>

      {/* ── Footer ── */}
      <div className="bg-slate-50 dark:bg-gray-800 px-4 py-3">
        <p className="text-slate-400 dark:text-slate-500">{String(data.source ?? "")}</p>
        <p className="text-slate-400 dark:text-slate-500 mt-1">
          Verify all figures with a Chartered Accountant before filing.
        </p>
      </div>
    </div>
  );
}

function TaxPlannerCardWrapper({ data }: { data: Record<string, unknown> }) {
  const [planData, setPlanData] = useState<Record<string, unknown>>(data);
  const [loading, setLoading]   = useState(false);

  const handleForceOldRegime = async () => {
    setLoading(true);
    try {
      const inc = (data.income_details ?? {}) as Record<string, unknown>;
      const res = await fetch(`${API_URL}/tax-planner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gross_salary:       inc.gross_salary,
          basic_salary:       inc.basic_salary,
          hra_received:       inc.hra_received,
          rent_paid:          inc.rent_paid,
          city:               inc.city,
          home_loan_interest: inc.home_loan_interest,
          edu_loan_interest:  inc.edu_loan_interest,
          force_old_regime:   true,
        }),
      });
      const json = await res.json();
      if (json.calculator_result) setPlanData(json.calculator_result);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mt-2 flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs py-3">
        <Loader2 size={14} className="animate-spin" /> Loading Old Regime checklist…
      </div>
    );
  }
  return <TaxPlannerCard data={planData} onForceOldRegime={handleForceOldRegime} />;
}

// ════════════════════════════════════════════════
// CALCULATOR RESULT
// ════════════════════════════════════════════════
function renderValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number")  return v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) {
    if (v.length > 0 && typeof v[0] === "object") {
      return v.map((item: unknown) => {
        const obj = item as Record<string, unknown>;
        if (obj.slab && obj.rate && obj.tax !== undefined)
          return `${obj.slab} @ ${obj.rate}: ₹${Number(obj.tax).toLocaleString("en-IN")}`;
        return Object.values(obj).join(" ");
      }).join(" | ");
    }
    return v.map(String).join(", ");
  }
  if (typeof v === "object") {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => `${k.replace(/_/g, " ")}: ${
        typeof val === "number" ? val.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : String(val)
      }`).join(" · ");
  }
  return String(v);
}

function CalcResult({ data }: { data: Record<string, unknown> }) {
  if (!data || Object.keys(data).length === 0) return null;

  // Route to specialised cards for new feature types
  const calcType = data.type as string | undefined;
  if (calcType === "missed_deductions") return <MissedDeductionsCard data={data} />;
  if (calcType === "advance_tax")       return <AdvanceTaxCard data={data} />;
  if (calcType === "audit")             return <AuditCard data={data} />;
  if (calcType === "home_purchase")     return <HomePurchaseCard data={data} />;
  if (calcType === "tax_calendar")      return <TaxCalendarCard data={data} />;
  if (calcType === "insurance")         return <InsuranceCard data={data} />;
  if (calcType === "goal_plan")         return <GoalPlanCard data={data} />;
  if (calcType === "tax_planner") {
    return <TaxPlannerCardWrapper data={data} />;
  }

  const SKIP = new Set(["slab_breakdown","year_wise","recommended_instruments","new_details","old_details","recommendation","type"]);
  const newDetails = data["new_details"] as Record<string, unknown> | undefined;
  const oldDetails = data["old_details"] as Record<string, unknown> | undefined;
  return (
    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-sm space-y-2 border border-blue-200 dark:border-blue-800">
      <p className="font-semibold text-blue-700 dark:text-blue-300 text-sm">📊 Calculator Result</p>
      {Object.entries(data).filter(([k]) => !SKIP.has(k)).map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4">
          <span className="text-slate-500 dark:text-slate-400 capitalize">{k.replace(/_/g, " ")}</span>
          <span className="font-medium text-slate-800 dark:text-slate-200 text-right max-w-[60%]">{renderValue(v)}</span>
        </div>
      ))}
      {newDetails != null && Object.keys(newDetails).length > 0 && (
        <>
          <p className="text-blue-600 dark:text-blue-400 font-semibold pt-1 border-t border-blue-200 dark:border-blue-700 mt-1">New Regime</p>
          {Object.entries(newDetails).filter(([k]) => !SKIP.has(k)).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 pl-2">
              <span className="text-slate-500 dark:text-slate-400 capitalize">{k.replace(/_/g, " ")}</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{renderValue(v)}</span>
            </div>
          ))}
        </>
      )}
      {oldDetails != null && Object.keys(oldDetails).length > 0 && (
        <>
          <p className="text-blue-600 dark:text-blue-400 font-semibold pt-1 border-t border-blue-200 dark:border-blue-700 mt-1">Old Regime</p>
          {Object.entries(oldDetails).filter(([k]) => !SKIP.has(k)).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 pl-2">
              <span className="text-slate-500 dark:text-slate-400 capitalize">{k.replace(/_/g, " ")}</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{renderValue(v)}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════
// SOURCES
// ════════════════════════════════════════════════
function Sources({ sources, confidence }: { sources: string[]; confidence: number }) {
  if (!sources || sources.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1 items-center">
      <span className="text-xs text-slate-400 dark:text-slate-500 mr-1">Sources:</span>
      {sources.slice(0, 3).map((s, i) => (
        <span key={i} className="text-xs bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
          {String(s).replace(/.*\//, "").replace(".pdf", "")}
        </span>
      ))}
      {confidence > 0 && (
        <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">
          · {Math.round(confidence * 100)}% confidence
        </span>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════
export default function FinanceChat({ triggerQuestion, chatId, onMessageSent }: FinanceChatProps) {
  const { data: session } = useSession();
  const [messages, setMessages]               = useState<Message[]>([]);
  const [input, setInput]                     = useState("");
  const [loading, setLoading]                 = useState(false);
  const [uploadingForm16, setUploadingForm16]  = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [taxPlannerMode, setTaxPlannerMode]    = useState(false);
  const [showSignInWall, setShowSignInWall]    = useState(false);
  const [guestCount, setGuestCount]            = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return parseInt(localStorage.getItem("fa_guest_count") || "0", 10);
  });
  const [taxForm, setTaxForm] = useState({
    gross_salary: "", basic_salary: "", hra_received: "", rent_paid: "",
    city: "metro", d80c_used: "", d80d_used: "", nps_used: "",
    home_loan_interest: "", edu_loan_interest: "",
  });

  const inputRef       = useRef<HTMLTextAreaElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => { scrollToBottom(); }, [messages]);

  // When user signs IN — load their saved chat (guest messages stay as-is until replaced)
  useEffect(() => {
    const newEmail = session?.user?.email ?? null;
    if (newEmail && newEmail !== currentUserEmail) {
      // User just signed in — load their saved history
      setCurrentUserEmail(newEmail);
      try {
        const raw = localStorage.getItem(`financeChat-${newEmail}-${chatId}`);
        if (raw) setMessages(JSON.parse(raw));
        // clear guest counter on sign-in
        localStorage.removeItem("fa_guest_count");
        setGuestCount(0);
        setShowSignInWall(false);
      } catch { /* keep current messages */ }
    } else if (!newEmail && currentUserEmail) {
      // User just signed OUT — keep messages visible, just update email state
      setCurrentUserEmail(null);
    }
  }, [session?.user?.email, currentUserEmail, chatId]);

  // Save to localStorage (only for signed-in users)
  useEffect(() => {
    if (!session?.user?.email || messages.length === 0) return;
    try {
      localStorage.setItem(`financeChat-${session.user.email}-${chatId}`, JSON.stringify(messages));
    } catch { console.error("Failed to save chat"); }
  }, [messages, chatId, session?.user?.email]);

  // Auto-send trigger question
  useEffect(() => {
    if (triggerQuestion?.trim()) sendMessage(triggerQuestion.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerQuestion]);

  // ── Send chat message ────────────────────────
  const GUEST_LIMIT = 2;

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    // Guest wall — block after GUEST_LIMIT questions if not signed in
    if (!session?.user) {
      const next = guestCount + 1;
      setGuestCount(next);
      localStorage.setItem("fa_guest_count", String(next));
      if (next > GUEST_LIMIT) {
        setShowSignInWall(true);
        return;
      }
    }
    setMessages(prev => [
      ...prev,
      { sender: "user", text, time: Date.now() },
      { sender: "bot", text: "", time: Date.now() },
    ]);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setLoading(true);
    if (onMessageSent && messages.length === 0) onMessageSent(chatId, text);

    let streamedAnswer = "";
    const updateLastBot = (patch: Partial<Message>) => {
      setMessages(prev => {
        const next = [...prev];
        for (let i = next.length - 1; i >= 0; i -= 1) {
          if (next[i].sender === "bot") {
            next[i] = { ...next[i], ...patch };
            break;
          }
        }
        return next;
      });
    };

    try {
      const result = await askBackendStream(text, {
        onStatus: message => {
          if (!streamedAnswer) updateLastBot({ text: message });
        },
        onReplace: answer => {
          streamedAnswer = answer;
          updateLastBot({ text: formatAnswer(streamedAnswer) });
        },
        onToken: token => {
          streamedAnswer += token;
          updateLastBot({ text: formatAnswer(streamedAnswer) });
        },
      });

      updateLastBot({
        text: formatAnswer(result.answer || streamedAnswer),
        response_type: result.response_type,
        sources: result.sources,
        confidence: result.confidence,
        calculator_result: result.calculator_result ?? undefined,
        realtime_data:     result.realtime_data     ?? undefined,
        suggest_planner:   result.suggest_planner   ?? undefined,
        planner_prefill:   result.planner_prefill   ?? undefined,
      });
    } catch (err) {
      updateLastBot({
        text: "⚠️ Could not reach the backend. Make sure Flask is running on port 5001.",
      });
      console.error("Backend error:", err);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  // ── Form 16 upload ───────────────────────────
  const handleForm16Upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // allow re-upload of same file

    setMessages(prev => [
      ...prev,
      { sender: "user", text: `📄 Uploaded Form 16: ${file.name}`, time: Date.now() },
    ]);
    setUploadingForm16(true);
    if (onMessageSent && messages.length === 0) onMessageSent(chatId, `Form 16 upload: ${file.name}`);

    try {
      const result = await uploadForm16(file);
      const missed = (result.missed_deductions as Array<Record<string, unknown>>) ?? [];
      const totalSaving = missed.reduce(
        (s, d) => s + (typeof d.tax_saving === "number" ? d.tax_saving : 0), 0
      );
      let summaryText = "✅ Form 16 parsed successfully. Here's your personalised CA-level tax analysis:";
      if (missed.length > 0) {
        summaryText +=
          `\n\n⚠️ Found ${missed.length} missed deduction${missed.length > 1 ? "s" : ""}! ` +
          `You could save ₹${totalSaving.toLocaleString("en-IN")} more in taxes. ` +
          `Check the "Save Tax" tab below.`;
      } else {
        summaryText += "\n\n✅ All major deductions are fully utilised — great tax planning!";
      }
      setMessages(prev => [
        ...prev,
        { sender: "bot", text: summaryText, time: Date.now(), form16_result: result },
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          sender: "bot",
          text: "⚠️ Could not parse Form 16. Please ensure:\n• The file is a valid Form 16 PDF\n• Flask backend is running on port 5001\n• The PDF is not password-protected",
          time: Date.now(),
        },
      ]);
      console.error("Form 16 upload error:", err);
    } finally {
      setUploadingForm16(false);
      inputRef.current?.focus();
    }
  };

  const handleSend = () => sendMessage(input.trim());
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleTaxPlannerSubmit = async () => {
    const lakh = (v: string) => parseFloat(v || "0") * 100000;
    const payload = {
      gross_salary:        lakh(taxForm.gross_salary),
      basic_salary:        lakh(taxForm.basic_salary),
      hra_received:        lakh(taxForm.hra_received),
      rent_paid:           lakh(taxForm.rent_paid),
      city:                taxForm.city,
      d80c_used:           lakh(taxForm.d80c_used),
      d80d_used:           lakh(taxForm.d80d_used),
      nps_used:            lakh(taxForm.nps_used),
      home_loan_interest:  lakh(taxForm.home_loan_interest),
      edu_loan_interest:   lakh(taxForm.edu_loan_interest),
    };
    if (!payload.gross_salary) return;
    setTaxPlannerMode(false);
    const summary = `Tax saving plan for gross salary ₹${taxForm.gross_salary}L${taxForm.basic_salary ? `, basic ₹${taxForm.basic_salary}L` : ""}${taxForm.rent_paid ? `, rent ₹${taxForm.rent_paid}L/yr` : ""}`;
    setMessages(prev => [...prev, { sender: "user", text: summary, time: Date.now() }]);
    if (onMessageSent && messages.length === 0) onMessageSent(chatId, summary);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/tax-planner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        sender: "bot",
        text: data.answer || "Here is your personalised tax saving plan:",
        time: Date.now(),
        calculator_result: data.calculator_result,
      }]);
    } catch {
      setMessages(prev => [...prev, { sender: "bot", text: "⚠️ Could not reach the backend.", time: Date.now() }]);
    } finally {
      setLoading(false);
    }
  };

  const isBusy = loading || uploadingForm16;

  // ── Render ───────────────────────────────────
  return (
    <>
      {/* Sign-in wall modal */}
      {showSignInWall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">
            {/* Top gradient bar */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
              <div className="flex items-center gap-3 mb-1">
                <Sparkles size={22} />
                <span className="text-lg font-bold">You&apos;re on a roll!</span>
              </div>
              <p className="text-blue-100 text-sm">
                Sign in to keep chatting — it&apos;s free and takes 10 seconds.
              </p>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Feature list */}
              <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                {[
                  "Unlimited questions — no caps",
                  "Chat history saved across sessions",
                  "Tax planner & Form 16 analysis",
                  "Live market data & portfolio tools",
                ].map(f => (
                  <li key={f} className="flex items-center gap-2">
                    <CheckCircle size={15} className="text-emerald-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {/* Sign-in button */}
              <button
                onClick={() => signIn("google")}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
              >
                <Lock size={15} />
                Sign in with Google
              </button>

              {/* Dismiss — lets them see the answer but blocks next question */}
              <button
                onClick={() => setShowSignInWall(false)}
                className="w-full text-center text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors py-1"
              >
                Maybe later — I&apos;ll lose my progress
              </button>
            </div>
          </div>
        </div>
      )}

      {messages.length > 0 && (
        <div className="max-w-4xl mx-auto pb-40 space-y-5 px-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`px-4 py-3 rounded-2xl max-w-2xl text-sm break-words ${
                m.sender === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-200 dark:bg-gray-800 text-slate-900 dark:text-gray-100"
              }`}>
                {m.sender === "bot" && m.response_type === "web_search" && (
                  <div className="mb-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                    Official web fallback
                  </div>
                )}
                {m.sender === "bot" ? (
                  <MarkdownMessage text={m.text} />
                ) : (
                  <p className="whitespace-pre-wrap">{m.text}</p>
                )}
                {m.sender === "bot" && m.form16_result    != null && <Form16Card    data={m.form16_result} />}
                {m.sender === "bot" && m.calculator_result != null && <CalcResult    data={m.calculator_result} />}
                {m.sender === "bot" && m.realtime_data    != null && <RealtimeResult data={m.realtime_data} />}
                {m.sender === "bot" && (m.sources?.length ?? 0) > 0 && (
                  <Sources sources={m.sources!} confidence={m.confidence ?? 0} />
                )}
                {m.sender === "bot" && m.suggest_planner && (
                  <button
                    onClick={() => {
                      setTaxForm(prev => ({
                        ...prev,
                        ...(m.planner_prefill ?? {}),
                      }));
                      setTaxPlannerMode(true);
                      setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }), 100);
                    }}
                    className="mt-3 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors"
                  >
                    <Calculator size={14} />
                    Get my personalised tax saving plan →
                  </button>
                )}
              </div>
            </div>
          ))}

          {isBusy && (
            <div className="flex justify-start">
              <div className="px-4 py-3 rounded-2xl bg-slate-200 dark:bg-gray-800 flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
                <Loader2 size={16} className="animate-spin" />
                {uploadingForm16 ? "Analysing Form 16…" : "Thinking…"}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Hidden PDF file picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleForm16Upload}
      />

      {/* Input bar */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pt-3 pb-3 bg-background z-10 border-t border-slate-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto">

          {/* ── Tax Planner Mode panel ── */}
          {taxPlannerMode && (
            <div className="mb-3 rounded-2xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 p-4 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calculator size={16} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Tax Planner Mode</span>
                  <span className="text-xs text-emerald-600 dark:text-emerald-500 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded-full">All amounts in ₹ Lakh</span>
                </div>
                <button onClick={() => setTaxPlannerMode(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 mb-3">
                {([
                  ["gross_salary",       "Gross Salary *",        "e.g. 15"],
                  ["basic_salary",       "Basic Salary",          "e.g. 6"],
                  ["hra_received",       "HRA Received",          "e.g. 3"],
                  ["rent_paid",          "Annual Rent Paid",      "e.g. 1.8"],
                  ["d80c_used",          "80C Investments",       "e.g. 0.5"],
                  ["d80d_used",          "80D (Health Ins.)",     "e.g. 0.25"],
                  ["nps_used",           "NPS (80CCD 1B)",        "e.g. 0.5"],
                  ["home_loan_interest", "Home Loan Interest",    "e.g. 1.5"],
                  ["edu_loan_interest",  "Edu Loan Interest",     "e.g. 0"],
                ] as [keyof typeof taxForm, string, string][]).map(([key, label, placeholder]) => (
                  <div key={key}>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder={placeholder}
                      value={taxForm[key]}
                      onChange={e => setTaxForm(prev => ({ ...prev, [key]: e.target.value }))}
                      className="w-full rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 text-slate-900 dark:text-white outline-none focus:border-emerald-400 dark:focus:border-emerald-500"
                    />
                  </div>
                ))}

                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">City Type</label>
                  <select
                    value={taxForm.city}
                    onChange={e => setTaxForm(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 text-slate-900 dark:text-white outline-none focus:border-emerald-400 dark:focus:border-emerald-500"
                  >
                    <option value="metro">Metro (Mumbai/Delhi/etc.)</option>
                    <option value="non-metro">Non-Metro</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleTaxPlannerSubmit}
                disabled={!taxForm.gross_salary || isBusy}
                className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
                Generate My Tax Saving Plan
              </button>
            </div>
          )}

          {messages.length === 0 && !taxPlannerMode && (
            <p className="text-center text-xs text-slate-400 dark:text-slate-500 mb-1.5">
              💡 Click <strong>+</strong> to upload your <strong>Form 16 PDF</strong> for personalised CA-level tax analysis
            </p>
          )}

          <div className="flex items-end gap-3 bg-slate-100 dark:bg-gray-800 rounded-2xl px-4 py-3 border border-slate-200 dark:border-gray-700 shadow-sm mb-1.5">

            {/* + → triggers Form 16 file picker */}
            <button
              type="button"
              aria-label="Upload Form 16 PDF"
              title="Upload Form 16 for CA-level tax analysis"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-slate-500 dark:text-gray-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors disabled:opacity-50"
            >
              {uploadingForm16
                ? <Loader2 size={20} className="animate-spin text-orange-500" />
                : <Plus size={20} />}
            </button>

            <textarea
              ref={inputRef}
              value={input}
              onChange={e => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
              }}
              onKeyDown={handleKeyDown}
              placeholder={taxPlannerMode ? "Tax Planner Mode active — fill the form above" : uploadingForm16 ? "Analysing your Form 16…" : "Ask anything about finance..."}
              disabled={isBusy || taxPlannerMode}
              rows={1}
              className="flex-1 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 outline-none text-base disabled:opacity-50 resize-none overflow-y-auto"
              style={{ maxHeight: 200 }}
            />

            {/* Tax Planner Mode toggle */}
            <button
              type="button"
              aria-label="Tax Planner Mode"
              title="Switch to Tax Planner Mode"
              onClick={() => setTaxPlannerMode(v => !v)}
              disabled={isBusy}
              className={`flex-shrink-0 w-8 h-8 flex items-center justify-center transition-colors disabled:opacity-50 ${
                taxPlannerMode
                  ? "text-emerald-500 dark:text-emerald-400"
                  : "text-slate-500 dark:text-gray-400 hover:text-emerald-500 dark:hover:text-emerald-400"
              }`}
            >
              <Calculator size={20} />
            </button>

            <button
              type="button"
              aria-label="Voice input"
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <Mic size={20} />
            </button>

            <button
              type="button"
              onClick={handleSend}
              disabled={isBusy || !input.trim() || taxPlannerMode}
              aria-label="Send"
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-blue-500 hover:text-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading
                ? <Loader2 size={20} className="animate-spin" />
                : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                )}
            </button>
          </div>
          <p className="text-center text-xs text-slate-400 dark:text-slate-500">
            FinAdvisor is AI-powered and can make mistakes. Please verify tax and financial information with a CA.
          </p>
        </div>
      </div>
    </>
  );
}
