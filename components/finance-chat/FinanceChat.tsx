// components/finance-chat/FinanceChat.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { Mic, Plus } from "lucide-react";
import { useSession } from "next-auth/react";

type Message = { sender: "user" | "bot"; text: string; time?: number };

interface FinanceChatProps {
  triggerQuestion?: string;
  chatId: string;
  onMessageSent?: (chatId: string, firstMessage: string) => void;
  onSignInRequired?: () => void;
}

// ============================================
// FINANCIAL KNOWLEDGE BASE
// ============================================
interface KnowledgeItem {
  keywords: string[];
  response: string;
  difficulty: "easy" | "medium" | "advanced";
  category: string;
}

const FINANCIAL_KNOWLEDGE_BASE: KnowledgeItem[] = [
  // ========== EASY LEVEL ==========
  {
    keywords: ["what is budget", "budgeting", "create budget", "monthly budget", "what's my monthly budget", "how much should i budget"],
    response: "A budget is a plan for how you'll spend your money each month. Try the 50/30/20 rule: 50% for needs (rent, food, bills), 30% for wants (entertainment, dining out), and 20% for savings and debt repayment. Start by tracking your income and expenses for one month to see where your money goes. Calculate: Income - Fixed expenses = Discretionary money for wants and savings.",
    difficulty: "easy",
    category: "budgeting"
  },
  {
    keywords: ["save money", "saving tips", "how to save", "start saving", "save more", "save more this month", "how can i save more"],
    response: "Start saving by: 1) Pay yourself first - automate transfers to savings right after payday, 2) Cut unused subscriptions, 3) Use the 24-hour rule before non-essential purchases, 4) Cook at home more often, 5) Use cashback and reward programs, 6) Challenge yourself with no-spend days, 7) Round up purchases and save the difference. Even saving ₹100/day adds up to ₹36,500/year!",
    difficulty: "easy",
    category: "savings"
  },
  {
    keywords: ["emergency fund", "emergency savings", "rainy day fund"],
    response: "An emergency fund is money set aside for unexpected expenses (medical bills, job loss, car repairs). Aim for 3-6 months of essential expenses in an easily accessible savings account. Start small with ₹1,000 and build gradually. Keep it in a separate account to avoid temptation.",
    difficulty: "easy",
    category: "savings"
  },
  {
    keywords: ["track expenses", "expense tracking", "where does money go", "track my expenses", "monitor spending", "expense tracker"],
    response: "Track expenses using: 1) Banking apps with built-in categorization (most banks offer this free), 2) Simple spreadsheet with categories (food, transport, entertainment, bills, subscriptions), 3) Apps like Money Manager, Walnut, or ET Money. Review weekly to spot patterns. Pro tip: Take 5 minutes every evening to log expenses - it becomes a habit. Categories help identify where you can cut back. Aim to track for at least 30 days to see full picture.",
    difficulty: "easy",
    category: "budgeting"
  },
  {
    keywords: ["what is interest", "simple interest", "compound interest"],
    response: "Interest is money earned on savings or paid on loans. Simple interest is calculated only on the principal amount. Compound interest is calculated on principal + accumulated interest, leading to exponential growth. Einstein called compound interest the '8th wonder of the world' - it makes your money grow faster over time!",
    difficulty: "easy",
    category: "basics"
  },
  {
    keywords: ["credit score", "cibil score", "improve credit score"],
    response: "Credit score (CIBIL in India) ranges from 300-900. Above 750 is considered good. Improve it by: 1) Pay bills on time, 2) Keep credit utilization below 30%, 3) Don't apply for multiple loans/cards quickly, 4) Maintain old credit accounts, 5) Check report annually for errors.",
    difficulty: "easy",
    category: "credit"
  },
  {
    keywords: ["what is inflation", "inflation meaning", "rising prices"],
    response: "Inflation is the rate at which prices of goods and services increase over time, reducing your purchasing power. For example, if inflation is 6%, something that costs ₹100 today will cost ₹106 next year. This is why investing is important - to beat inflation and grow your wealth.",
    difficulty: "easy",
    category: "basics"
  },
  {
    keywords: ["insurance need", "why insurance", "types of insurance"],
    response: "Insurance protects against financial loss from unexpected events. Essential types: 1) Health insurance (medical expenses), 2) Term life insurance (family protection), 3) Vehicle insurance (mandatory by law). Get health insurance first, then adequate term life insurance (10-15x annual income).",
    difficulty: "easy",
    category: "insurance"
  },

  // ========== MEDIUM LEVEL ==========
  {
    keywords: ["invest", "investment", "start investing", "where to invest"],
    response: "Start investing with these steps: 1) Build emergency fund first (3-6 months expenses), 2) Clear high-interest debt (credit cards), 3) Start with low-cost index funds/ETFs, 4) Consider your risk tolerance and time horizon. Common rule: equity allocation = 100 minus your age. Use SIP (Systematic Investment Plan) to invest regularly and benefit from rupee cost averaging.",
    difficulty: "medium",
    category: "investment"
  },
  {
    keywords: ["mutual fund", "mutual funds", "equity mutual fund", "debt mutual fund"],
    response: "Mutual funds pool money from investors to invest in stocks, bonds, or other assets. Types: 1) Equity funds (invest in stocks, higher risk/return), 2) Debt funds (invest in bonds, lower risk), 3) Hybrid funds (mix of both). Choose based on goals and risk appetite. Start with diversified equity funds or index funds for long-term wealth creation.",
    difficulty: "medium",
    category: "investment"
  },
  {
    keywords: ["sip", "systematic investment", "sip benefits"],
    response: "SIP (Systematic Investment Plan) lets you invest a fixed amount regularly in mutual funds. Benefits: 1) Rupee cost averaging - buy more units when prices are low, fewer when high, 2) Disciplined investing, 3) Power of compounding, 4) No need to time the market, 5) Start with as little as ₹500/month. Ideal for long-term goals (5+ years).",
    difficulty: "medium",
    category: "investment"
  },
  {
    keywords: ["tax saving", "section 80c", "save tax", "tax deduction"],
    response: "Save tax using these deductions: 1) Section 80C (₹1.5L limit): EPF, PPF, ELSS, life insurance, home loan principal, 2) Section 80D (₹25K-₹50K): Health insurance premiums, 3) Section 80CCD(1B) (₹50K): Additional NPS contribution, 4) HRA exemption for rent paid, 5) Home loan interest under Section 24(b) (₹2L limit).",
    difficulty: "medium",
    category: "tax"
  },
  {
    keywords: ["retirement planning", "retirement fund", "pension", "retire early"],
    response: "Retirement planning essentials: 1) Start early to leverage compound interest, 2) Aim to save 15-20% of income, 3) Use EPF (mandatory for salaried), PPF (15-year lock-in, 7-8% returns), NPS (equity exposure + tax benefits), 4) Equity mutual funds for growth, 5) Calculate required corpus = (annual expenses ÷ expected return %) × 25. Review and increase contributions annually.",
    difficulty: "medium",
    category: "retirement"
  },
  {
    keywords: ["debt management", "pay off debt", "debt repayment", "loan strategy"],
    response: "Two proven strategies: 1) Snowball method - pay smallest debts first for psychological wins, builds momentum, 2) Avalanche method - pay highest interest rate first, saves more money mathematically. Always pay minimum on all debts. Prioritize credit cards (15-36% interest) over education/home loans (7-12%). Consider debt consolidation if you have multiple high-interest loans.",
    difficulty: "medium",
    category: "debt"
  },
  {
    keywords: ["stocks", "stock market", "equity investment", "share market"],
    response: "Stock market allows buying company ownership shares. Before investing: 1) Learn fundamentals (P/E ratio, P/B ratio, ROE), 2) Diversify across sectors, 3) Start with blue-chip stocks or index funds, 4) Invest for long-term (5+ years), 5) Only invest money you can afford to lose. Don't try to time the market. For beginners, index funds are safer than individual stocks.",
    difficulty: "medium",
    category: "investment"
  },
  {
    keywords: ["fixed deposit", "fd rates", "fd vs mutual fund", "fixed income"],
    response: "Fixed Deposits offer guaranteed returns (6-7% currently) with capital protection. Pros: No market risk, predictable income. Cons: Returns barely beat inflation, taxed as per income slab, premature withdrawal penalty. Better for short-term goals (1-3 years) or risk-averse investors. For long-term wealth creation, equity mutual funds historically outperform FDs significantly.",
    difficulty: "medium",
    category: "investment"
  },
  {
    keywords: ["gold investment", "invest in gold", "gold etf", "sovereign gold bond"],
    response: "Ways to invest in gold: 1) Sovereign Gold Bonds (SGB) - best option, 2.5% annual interest + price appreciation, 8-year maturity, 2) Gold ETFs - track gold prices, traded on stock exchange, 3) Digital gold - fractional ownership, 4) Physical gold - has making charges and storage issues. Limit gold to 5-10% of portfolio as it doesn't generate income, only price appreciation.",
    difficulty: "medium",
    category: "investment"
  },

  // ========== ADVANCED LEVEL ==========
  {
    keywords: ["asset allocation", "portfolio allocation", "diversification strategy"],
    response: "Asset allocation is spreading investments across asset classes to balance risk and return. Strategic approach: 1) Equity (stocks/equity funds): 100 minus age (%), 2) Debt (bonds/debt funds): Age (%), 3) Gold: 5-10%, 4) International exposure: 10-20%. Rebalance annually. During accumulation phase (age 25-40), higher equity (70-80%). Near retirement, increase debt (50-60%). Use core-satellite strategy: 70% in passive index funds (core), 30% in active funds (satellite).",
    difficulty: "advanced",
    category: "portfolio"
  },
  {
    keywords: ["derivatives", "options", "futures", "hedging"],
    response: "Derivatives derive value from underlying assets. Types: 1) Futures - agreement to buy/sell at predetermined price/date, 2) Options - right (not obligation) to buy (call) or sell (put) at strike price. Used for: speculation (high risk/reward), hedging (protect portfolio from downside). Requires deep knowledge of Greeks (delta, gamma, theta, vega). Not recommended for beginners due to leverage and time decay. Can lose 100% of premium in options.",
    difficulty: "advanced",
    category: "advanced_investment"
  },
  {
    keywords: ["financial independence", "fire movement", "early retirement"],
    response: "FIRE (Financial Independence, Retire Early) calculation: 1) Annual expenses × 25 = required corpus (4% safe withdrawal rule), 2) Save 50-70% of income, 3) Invest aggressively in equity (70-90%), 4) Reduce lifestyle inflation. Example: ₹50L annual expense needs ₹12.5Cr corpus. Strategies: Coast FIRE (save early, let compound), Lean FIRE (minimize expenses), Fat FIRE (high corpus). Consider healthcare costs and inflation in planning.",
    difficulty: "advanced",
    category: "retirement"
  },
  {
    keywords: ["tax harvesting", "tax loss harvesting", "tax optimization"],
    response: "Tax-loss harvesting: Sell losing investments to offset capital gains, reducing tax liability. Strategy: 1) Long-term capital gains (LTCG) on equity >₹1.25L taxed at 12.5%, 2) Sell losers before year-end to book losses, 3) Buy similar (not identical) securities after 30 days to avoid wash sale, 4) Carry forward losses for 8 years. Also consider: 1) Stagger gains across years to stay below ₹1.25L threshold, 2) Gift assets to spouse in lower tax bracket (clubbing provisions apply).",
    difficulty: "advanced",
    category: "tax"
  },
  {
    keywords: ["portfolio rebalancing", "rebalancing strategy", "tactical allocation"],
    response: "Rebalancing maintains target asset allocation. Methods: 1) Calendar (annually/semi-annually), 2) Threshold (when allocation drifts 5-10%), 3) Hybrid (time + threshold). Process: Sell overweight assets, buy underweight. Example: Target 70-30 equity-debt becomes 80-20 after rally → sell 10% equity, buy debt. Tax considerations: Use debt funds' indexation benefit, harvest equity losses. In bull markets, rebalancing forces profit booking; in bear markets, forces buying low.",
    difficulty: "advanced",
    category: "portfolio"
  },
  {
    keywords: ["factor investing", "smart beta", "momentum investing", "value investing"],
    response: "Factor investing targets specific characteristics that drive returns: 1) Value - undervalued stocks (low P/E, P/B), 2) Momentum - stocks with upward price trends, 3) Quality - strong fundamentals (high ROE, low debt), 4) Low volatility - defensive stocks, 5) Size - small/mid cap premium. Smart beta funds combine factors systematically. Historically, value + momentum combination outperforms. Requires patience as factors underperform in cycles. Suitable for sophisticated investors with 10+ year horizon.",
    difficulty: "advanced",
    category: "advanced_investment"
  },
  {
    keywords: ["estate planning", "will", "inheritance", "succession planning"],
    response: "Estate planning ensures smooth wealth transfer: 1) Create valid will - clearly state beneficiaries, executor, asset distribution, 2) Nominee vs Legal heir - nominee is custodian, legal heirs inherit as per law/will, 3) Trust structures - for minors or conditional transfers, 4) Joint ownership - with survivorship clause, 5) Insurance - adequate term cover for family. Update will after major life events. Store safely, inform family about location. Consider: succession tax implications (none currently in India), generation-skipping strategies, charitable trusts for tax benefits.",
    difficulty: "advanced",
    category: "planning"
  },
  {
    keywords: ["international investment", "us stocks", "global diversification"],
    response: "International investing reduces home country bias and provides global opportunities. Options: 1) Direct foreign stocks - Liberalized Remittance Scheme (LRS) allows $250K/year, 2) International mutual funds/ETFs - easier, managed, 3) Indian funds with global exposure. Benefits: Currency diversification (rupee depreciation gains), access to global giants (Apple, Tesla). Considerations: TCS (Tax Collection at Source) 20% on remittances >₹7L, DTAA (avoid double taxation), FATCA/CRS compliance. Ideal allocation: 10-20% of equity portfolio.",
    difficulty: "advanced",
    category: "advanced_investment"
  },
  {
    keywords: ["margin trading", "leverage", "short selling"],
    response: "Margin trading borrows funds to amplify returns (and losses). Margin Trading Facility (MTF) allows buying stocks with 20-25% upfront, broker lends rest at 13-18% interest. Short selling bets on stock price decline - borrow shares, sell high, buy back low. High risk strategies: 1) Losses can exceed capital, 2) Margin calls force selling at loss, 3) Interest costs erode gains. Only for experienced traders with strict risk management (stop losses, position sizing). Not recommended for long-term investors. Regulatory risks and broker terms vary.",
    difficulty: "advanced",
    category: "advanced_investment"
  },
  {
    keywords: ["alternate investment", "aif", "pms", "structured products"],
    response: "Alternative investments beyond traditional stocks/bonds: 1) AIF (Alternative Investment Fund) - Category I (startups, social ventures), Category II (PE/VC, debt funds), Category III (hedge funds). Min investment ₹1Cr, 2) PMS (Portfolio Management Services) - customized portfolio, min ₹50L, 3) REITs - real estate exposure, 4) InvITs - infrastructure projects, 5) Structured products - capital protection with equity upside. High fee structures (2-20%). Suitable for HNIs with ₹1Cr+ investable surplus. Higher risk, illiquidity, requires due diligence.",
    difficulty: "advanced",
    category: "advanced_investment"
  }
];

// ============================================
// STORAGE FUNCTIONS
// ============================================
const initializeKnowledgeBase = () => {
  try {
    const existingKB = localStorage.getItem('financeKnowledgeBase');
    if (!existingKB) {
      localStorage.setItem('financeKnowledgeBase', JSON.stringify(FINANCIAL_KNOWLEDGE_BASE));
      console.log('✅ Financial knowledge base initialized with', FINANCIAL_KNOWLEDGE_BASE.length, 'items');
    } else {
      // Optional: Update if your knowledge base has changed
      const existing = JSON.parse(existingKB);
      if (existing.length !== FINANCIAL_KNOWLEDGE_BASE.length) {
        localStorage.setItem('financeKnowledgeBase', JSON.stringify(FINANCIAL_KNOWLEDGE_BASE));
        console.log('🔄 Financial knowledge base updated');
      }
    }
  } catch (e) {
    console.error('Failed to initialize knowledge base', e);
  }
};

const getKnowledgeBase = (): KnowledgeItem[] => {
  try {
    const kb = localStorage.getItem('financeKnowledgeBase');
    return kb ? JSON.parse(kb) : FINANCIAL_KNOWLEDGE_BASE;
  } catch (e) {
    console.error('Failed to load knowledge base', e);
    return FINANCIAL_KNOWLEDGE_BASE;
  }
};

// ============================================
// SMART RESPONSE GENERATOR
// ============================================
const generateResponse = (text: string): string => {
  const knowledgeBase = getKnowledgeBase();
  const lowerText = text.toLowerCase();
  
  // Find matching knowledge items
  const matches = knowledgeBase.filter(item => 
    item.keywords.some(keyword => lowerText.includes(keyword))
  );
  
  if (matches.length > 0) {
    // Prioritize by difficulty level if multiple matches
    const sortedMatches = matches.sort((a, b) => {
      const difficultyOrder = { easy: 0, medium: 1, advanced: 2 };
      return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
    });
    
    // Return the most relevant match
    return sortedMatches[0].response;
  }
  
  // Fallback response
  return "I can help with budgeting, saving, investments, taxes, insurance, retirement planning, and advanced topics like derivatives, portfolio management, and estate planning. Try asking: 'How do I start investing?' or 'What is tax harvesting?' or 'Explain asset allocation'";
};

// ============================================
// MAIN COMPONENT
// ============================================
export default function FinanceChat({ triggerQuestion, chatId, onMessageSent }: FinanceChatProps) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Initialize knowledge base on mount
  useEffect(() => {
    initializeKnowledgeBase();
  }, []);

  // Auto-scroll to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Detect user change and clear messages
  useEffect(() => {
    const newEmail = session?.user?.email || null;
    
    if (currentUserEmail !== newEmail) {
      setMessages([]);
      setCurrentUserEmail(newEmail);
    }
  }, [session?.user?.email, currentUserEmail]);

  // Load chat messages for current chatId (only when signed in)
  useEffect(() => {
    if (!session?.user?.email) {
      setMessages([]);
      return;
    }

    try {
      const userChatKey = `financeChat-${session.user.email}-${chatId}`;
      const raw = localStorage.getItem(userChatKey);
      if (raw) {
        setMessages(JSON.parse(raw));
      } else {
        setMessages([]);
      }
    } catch (e) {
      console.error("failed load", e);
      setMessages([]);
    }
  }, [chatId, session?.user?.email]);

  // Save chat messages (only when signed in)
  useEffect(() => {
    if (!session?.user?.email || messages.length === 0) return;

    try {
      const userChatKey = `financeChat-${session.user.email}-${chatId}`;
      localStorage.setItem(userChatKey, JSON.stringify(messages));
    } catch (e) {
      console.error("failed save", e);
    }
  }, [messages, chatId, session?.user?.email]);

  // Handle triggered questions from cards
  useEffect(() => {
    if (triggerQuestion && triggerQuestion.trim()) {
      const userMsg: Message = { sender: "user", text: triggerQuestion, time: Date.now() };
      const botMsg: Message = { sender: "bot", text: generateResponse(triggerQuestion), time: Date.now() + 200 };
      setMessages([userMsg, botMsg]);
      
      if (onMessageSent) {
        onMessageSent(chatId, triggerQuestion);
      }
    }
  }, [triggerQuestion, chatId]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    
    const userMsg: Message = { sender: "user", text: trimmed, time: Date.now() };
    const botMsg: Message = { sender: "bot", text: generateResponse(trimmed), time: Date.now() + 200 };
    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInput("");
    inputRef.current?.focus();
    
    if (session?.user?.email && onMessageSent && messages.length === 0) {
      onMessageSent(chatId, trimmed);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Messages Display */}
      {messages.length > 0 && (
        <div className="max-w-4xl mx-auto mb-32 space-y-4 px-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`px-4 py-3 rounded-lg max-w-xl text-sm break-words ${
                  m.sender === "user" 
                    ? "bg-blue-600 text-white" 
                    : "bg-slate-200 dark:bg-gray-800 text-slate-900 dark:text-gray-100"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input Box - Fixed at Bottom */}
      <div className="fixed bottom-0 left-0 right-0 p-6 border-t border-slate-200 dark:border-gray-800 bg-background z-10">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            <div className="flex items-center gap-3 bg-slate-100 dark:bg-gray-800 rounded-full px-4 py-3 shadow-lg">
              <button
                type="button"
                onClick={() => console.log('Add attachment')}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                aria-label="Add attachment"
              >
                <Plus size={20} />
              </button>

              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask anything about finance..."
                className="flex-1 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 outline-none text-base"
              />

              <button
                type="button"
                onClick={() => console.log('Voice input')}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                aria-label="Voice input"
              >
                <Mic size={20} />
              </button>

              <button
                type="button"
                onClick={() => console.log('Audio options')}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                aria-label="Audio options"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="12" x2="3" y2="12" />
                  <line x1="7" y1="8" x2="7" y2="16" />
                  <line x1="11" y1="6" x2="11" y2="18" />
                  <line x1="15" y1="10" x2="15" y2="14" />
                  <line x1="19" y1="8" x2="19" y2="16" />
                  <line x1="23" y1="12" x2="23" y2="12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}