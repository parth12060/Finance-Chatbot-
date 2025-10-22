'use client';

import React, { useEffect, useState } from "react";
import { Sun, Moon, Menu, X, MessageSquare, Plus, Search, Trash2 } from "lucide-react";
import { SessionProvider, useSession, signIn, signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import "./globals.css";

type ChatHistory = {
  id: string;
  title: string;
  preview: string;
  timestamp: number;
};

function Navbar() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isDark, setIsDark] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatHistories, setChatHistories] = useState<ChatHistory[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Initialize theme after component mounts (client-side only)
  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("prefers-dark");
    if (savedTheme === "true") {
      setIsDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  // Handle theme toggling
  useEffect(() => {
    if (!mounted) return;
    
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    try {
      localStorage.setItem("prefers-dark", String(isDark));
    } catch {}
  }, [isDark, mounted]);

  // Load chat histories
  useEffect(() => {
    if (!session?.user?.email) {
      setChatHistories([]);
      return;
    }
    
    const loadHistories = () => {
      try {
        const email = session?.user?.email;
        if (!email) return;
        
        const userHistoryKey = `chatHistories-${email}`;
        const saved = localStorage.getItem(userHistoryKey);
        if (saved) {
          setChatHistories(JSON.parse(saved));
        }
      } catch (e) {
        console.error("Failed to load chat histories", e);
      }
    };

    loadHistories();
    
    // Reload histories when returning to the page
    const interval = setInterval(loadHistories, 1000);
    return () => clearInterval(interval);
  }, [session?.user?.email]);

  const handleNewChat = () => {
    // Force reload to home without any chat ID
    window.location.href = "/";
  };

  const handleChatSelect = (chatId: string) => {
    router.push(`/?chatId=${chatId}`);
    setSidebarOpen(false);
  };

  const handleDeleteChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const email = session?.user?.email;
    if (!email) return;
    
    try {
      const userHistoryKey = `chatHistories-${email}`;
      const updated = chatHistories.filter(chat => chat.id !== chatId);
      setChatHistories(updated);
      localStorage.setItem(userHistoryKey, JSON.stringify(updated));
      
      const userChatKey = `financeChat-${email}-${chatId}`;
      localStorage.removeItem(userChatKey);
      
      // If currently viewing this chat, redirect to home
      if (searchParams.get('chatId') === chatId) {
        window.location.href = "/";
      }
    } catch (e) {
      console.error("Failed to delete chat", e);
    }
  };

  const filteredChats = chatHistories.filter(chat =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.preview.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* Top Navbar */}
      <nav className="fixed top-0 left-0 right-0 h-16 z-50 flex items-center justify-between px-4 bg-background border-b border-border">
        {/* Left side - Menu button (only show when signed in) */}
        {session ? (
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors duration-200"
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? (
              <X className="w-6 h-6 text-foreground" />
            ) : (
              <Menu className="w-6 h-6 text-foreground" />
            )}
          </button>
        ) : (
          <div className="w-10" />
        )}

        {/* Center - Title */}
        <h1 className="text-lg font-semibold text-foreground">Finance Chat</h1>

        {/* Right side - Theme toggle and Auth */}
        <div className="flex items-center gap-3">
          {/* Theme Toggle */}
          <button
            onClick={() => setIsDark((v) => !v)}
            aria-label="Toggle theme"
            className="w-10 h-10 rounded-full bg-background hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors duration-200"
            title="Toggle theme"
          >
            {!mounted ? (
              <div className="w-5 h-5" />
            ) : isDark ? (
              <Sun className="w-5 h-5 text-yellow-400" />
            ) : (
              <Moon className="w-5 h-5 text-slate-700" />
            )}
          </button>

          {/* Auth Controls */}
          {!session ? (
            <button
              onClick={() => signIn("google")}
              className="px-4 py-2 rounded-full bg-background hover:bg-slate-200 dark:hover:bg-slate-700 text-sm text-foreground transition-colors duration-200 border border-border"
            >
              Sign in
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-background px-3 py-2 rounded-full border border-border">
              {session.user?.image && (
                <img
                  src={session.user.image}
                  alt="Profile"
                  className="w-8 h-8 rounded-full border border-border"
                />
              )}
              <span className="text-sm text-foreground hidden sm:inline">{session.user?.name?.split(' ')[0]}</span>
              <button
                onClick={() => signOut()}
                className="px-3 py-1 rounded-md bg-background hover:bg-slate-200 dark:hover:bg-slate-700 text-foreground text-xs transition-colors duration-200 border border-border"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Sidebar - Only show when signed in */}
      {session && (
        <>
          <aside
            className={`fixed top-16 left-0 bottom-0 w-64 bg-background border-r border-border z-40 transform transition-transform duration-300 ease-in-out ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="flex flex-col h-full p-3">
              {/* New Chat Button */}
              <button 
                onClick={handleNewChat}
                className="flex items-center gap-3 px-3 py-3 mb-4 rounded-lg bg-background hover:bg-slate-200 dark:hover:bg-slate-700 text-foreground transition-colors duration-200 border border-border"
              >
                <Plus className="w-5 h-5" />
                <span className="font-medium text-sm">New Chat</span>
              </button>

              {/* Search Bar */}
              <div className="relative mb-4">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search chats"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-foreground placeholder-muted-foreground"
                />
              </div>

              {/* Chat History */}
              <div className="flex-1 overflow-y-auto">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3 px-2">Chats</h3>
                <div className="space-y-1">
                  {filteredChats.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">
                      No chats yet
                    </p>
                  ) : (
                    filteredChats.map((chat) => (
                      <div
                        key={chat.id}
                        onClick={() => handleChatSelect(chat.id)}
                        className={`group w-full flex items-start justify-between px-3 py-2.5 rounded-lg text-left transition-colors duration-200 cursor-pointer ${
                          searchParams.get('chatId') === chat.id
                            ? 'bg-slate-200 dark:bg-slate-700'
                            : 'hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground truncate">{chat.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(chat.timestamp).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDeleteChat(chat.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-opacity flex-shrink-0"
                          aria-label="Delete chat"
                        >
                          <Trash2 size={14} className="text-red-600 dark:text-red-400" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </aside>

          {/* Overlay for mobile */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-30"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </>
      )}
    </>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased min-h-screen">
        <SessionProvider>
          <Navbar />
          <div className="pt-16">
            {children}
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}