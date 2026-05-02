// app/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import FinanceChat from "@/components/finance-chat/FinanceChat";

type ChatHistory = {
  id: string;
  title: string;
  preview: string;
  timestamp: number;
};

export default function AssistantPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [triggerQuestion, setTriggerQuestion] = useState<string>("");
  const [currentChatId, setCurrentChatId] = useState<string>("default");
  const [chatHistories, setChatHistories] = useState<ChatHistory[]>([]);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [hasStartedChat, setHasStartedChat] = useState<boolean>(false);

  // Handle chat ID from URL
  useEffect(() => {
    const chatIdFromUrl = searchParams.get('chatId');
    if (chatIdFromUrl) {
      setCurrentChatId(chatIdFromUrl);
      setHasStartedChat(true);
    } else {
      setCurrentChatId(`chat-${Date.now()}`);
      setHasStartedChat(false);
    }
  }, [searchParams]);

  // Detect user change and clear chat histories
  useEffect(() => {
    const newEmail = session?.user?.email || null;
    
    if (currentUserEmail !== newEmail) {
      setChatHistories([]);
      const freshChatId = `chat-${Date.now()}`;
      setCurrentChatId(freshChatId);
      setCurrentUserEmail(newEmail);
      setHasStartedChat(false);
    }
  }, [session?.user?.email, currentUserEmail]);

  // Load chat histories from localStorage (only when signed in)
  useEffect(() => {
    if (!session?.user?.email) {
      setChatHistories([]);
      return;
    }
    
    try {
      const userHistoryKey = `chatHistories-${session.user.email}`;
      const saved = localStorage.getItem(userHistoryKey);
      if (saved) {
        const histories = JSON.parse(saved);
        setChatHistories(histories);
      } else {
        setChatHistories([]);
      }
    } catch (e) {
      console.error("Failed to load chat histories", e);
    }
  }, [session?.user?.email]);

  // Save chat histories to localStorage
  useEffect(() => {
    if (!session?.user?.email) return;
    
    try {
      const userHistoryKey = `chatHistories-${session.user.email}`;
      if (chatHistories.length > 0) {
        localStorage.setItem(userHistoryKey, JSON.stringify(chatHistories));
      }
    } catch (e) {
      console.error("Failed to save chat histories", e);
    }
  }, [chatHistories, session?.user?.email]);

  const handleCardClick = (question: string) => {
    const newChatId = `chat-${Date.now()}`;
    setCurrentChatId(newChatId);
    setTriggerQuestion(question);
    setHasStartedChat(true);
    setTimeout(() => setTriggerQuestion(""), 100);
  };

  const updateChatHistory = (chatId: string, firstMessage: string) => {
    setHasStartedChat(true);
    
    if (!session?.user?.email) return;
    
    setChatHistories(prev => {
      const existing = prev.find(c => c.id === chatId);
      if (existing) {
        return prev.map(c => 
          c.id === chatId 
            ? { ...c, timestamp: Date.now() }
            : c
        );
      } else {
        const newChat: ChatHistory = {
          id: chatId,
          title: firstMessage.slice(0, 30) + (firstMessage.length > 30 ? "..." : ""),
          preview: firstMessage.slice(0, 50) + (firstMessage.length > 50 ? "..." : ""),
          timestamp: Date.now(),
        };
        return [newChat, ...prev];
      }
    });
  };

  return (
    <div className="pt-16 flex flex-col" style={{ minHeight: hasStartedChat ? 'auto' : '100vh' }}>
      {/* Main Content */}
      <main className={`${!hasStartedChat ? 'flex-1 flex flex-col' : ''} transition-all duration-300 ${session ? 'lg:ml-0' : ''}`}>

        {/* Welcome screen — vertically centered between navbar and input bar */}
        {!hasStartedChat && (
          <div className="flex-1 flex items-start justify-center px-8 pt-12 pb-40">
            <div className="w-full max-w-4xl">
              <header className="text-left mb-8">
                <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-3">
                  Hello — how may I assist you in your financial journey?
                </h1>
                <p className="text-slate-600 dark:text-slate-300 max-w-2xl">
                  I can help you with tax calculations, regime comparison, SIP/EMI/PPF planning, stock &amp; mutual fund data, home purchase planning, audit guidance, and CA-level Form 16 analysis.
                </p>
                {!session && (
                  <p className="mt-3 text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                    <span>💡</span>
                    <span>You can chat now! <button onClick={() => signIn("google")} className="underline hover:text-yellow-700 dark:hover:text-yellow-300">Sign in</button> to save your chat history.</span>
                  </p>
                )}
              </header>

              <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[
                  { title: "Calculate my tax", q: "My salary is 15 LPA, how much tax do I pay?", desc: "Old vs New regime comparison with exact breakdowns" },
                  { title: "Plan a home purchase", q: "I want to buy a house worth 50 lakh, income 12 LPA", desc: "EMI, affordability & tax benefits under §24(b) & §80C" },
                  { title: "Find tax-saving options", q: "How to save tax? I earn 20 lakh", desc: "Missed deductions across 80C, 80D, 80CCD(1B) & more" },
                  { title: "Project my SIP returns", q: "SIP of 10000 monthly for 15 years at 12%", desc: "Mutual fund return projections with SIP calculator" },
                ].map((c) => (
                  <div
                    key={c.q}
                    onClick={() => handleCardClick(c.q)}
                    className="rounded-xl border border-slate-300 dark:border-slate-700 p-6 bg-white dark:bg-transparent hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors cursor-pointer"
                  >
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                      {c.title}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm">
                      {c.desc}
                    </p>
                  </div>
                ))}
              </section>
            </div>
          </div>
        )}

        {/* Chat area */}
        <div className="w-full max-w-5xl mx-auto px-8">
          <FinanceChat
            triggerQuestion={triggerQuestion}
            chatId={currentChatId}
            onMessageSent={updateChatHistory}
            onSignInRequired={() => signIn("google")}
          />
        </div>
      </main>
    </div>
  );
}