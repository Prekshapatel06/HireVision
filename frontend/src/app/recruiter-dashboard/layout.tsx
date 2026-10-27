"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  SearchCode,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  Loader2,
  Bell,
  UserCheck,
  Workflow,
  Sparkles,
  GitCompare,
} from "lucide-react";

import RecruiterAIChatbot from "../../components/dashboard/RecruiterAIChatbot";
import { HireVisionLogo } from "../../components/HireVisionLogo";

import { normalizeApiUrl } from "@/lib/api";

const API_URL = normalizeApiUrl();

function getStoredToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    localStorage.getItem("token") ||
    localStorage.getItem("hirevision_token") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("hirevision_token")
  );
}

function RecruiterLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeTab = searchParams.get("tab") || "overview";

  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("Recruiter");
  const [authToken, setAuthToken] = useState<string | null>(() => getStoredToken());
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const token = getStoredToken();

    if (!token) {
      router.replace("/login?role=recruiter");
      return;
    }

    const verifySession = async () => {
      try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          cache: "no-store",
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            localStorage.removeItem("role");

            if (isMounted) {
              router.replace("/login?role=recruiter");
            }

            return;
          }

          throw new Error("Session verification failed.");
        }

        const data = await response.json();

        if (!data?.user) {
          throw new Error("Invalid authentication response.");
        }

        if (data.user.role !== "recruiter") {
          localStorage.removeItem("role");

          if (isMounted) {
            router.replace("/dashboard");
          }

          return;
        }

        if (isMounted) {
          const verifiedUser = data.user;

          setUsername(verifiedUser.username || "Recruiter");

          localStorage.setItem("user", JSON.stringify(verifiedUser));
          localStorage.setItem("role", verifiedUser.role);
        }
      } catch (error) {
        console.error("Session verification failed:", error);

        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("role");

        if (isMounted) {
          router.replace("/login?role=recruiter");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    verifySession();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("role");

    router.replace("/");
  };

  const navItems = [
    {
      name: "Overview",
      tab: "overview",
      icon: LayoutDashboard,
    },
    {
      name: "Job Postings",
      tab: "jobs",
      icon: Briefcase,
    },
    {
      name: "Candidates",
      tab: "candidates",
      icon: Users,
    },
    {
      name: "Candidate Comparison",
      tab: "comparison",
      icon: GitCompare,
    },
    {
      name: "AI Screenings",
      tab: "screenings",
      icon: SearchCode,
    },
    {
      name: "Hiring Pipeline",
      tab: "pipeline",
      icon: Workflow,
    },
    {
      name: "Settings",
      tab: "settings",
      icon: SettingsIcon,
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] text-slate-600 gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-violet-600" />

        <span className="font-poppins font-semibold text-sm">
          Authenticating recruiter session...
        </span>
      </div>
    );
  }

  const activeItem =
    navItems.find((item) => item.tab === activeTab) || navItems[0];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex text-slate-800 font-inter antialiased selection:bg-indigo-500 selection:text-white">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-80 bg-white border-r border-slate-200/80 fixed top-0 bottom-0 left-0 z-40 p-6 overflow-y-auto">
        {/* LOGO */}
        <Link
          href="/recruiter-dashboard"
          className="flex items-center justify-center w-full mb-5 shrink-0"
        >
          <div className="flex items-center gap-3.5 w-full">
            <div className="shrink-0 flex items-center justify-center">
              <HireVisionLogo className="h-[88px] w-[84px]" />
            </div>

            <div className="flex flex-col min-w-0">
              <span className="font-poppins font-extrabold text-[23px] leading-none tracking-[0.08em] bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                HIREVISION
              </span>

              <span className="mt-2 text-[10px] leading-none font-bold tracking-[0.16em] text-slate-400 whitespace-nowrap">
                AI POWERED RECRUITMENT
              </span>
            </div>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="flex-1 space-y-2 mb-7">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.tab;

            return (
              <Link
                key={item.tab}
                href={`/recruiter-dashboard?tab=${item.tab}`}
                className={`group flex items-center gap-4 w-full min-h-[46px] px-4 py-2.5 rounded-[13px] font-semibold text-[15px] transition-all duration-200 ${
                  isActive
                    ? "bg-gradient-to-r from-violet-600 via-violet-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon
                  className={`h-[22px] w-[22px] shrink-0 transition-colors ${
                    isActive
                      ? "text-white"
                      : "text-slate-500 group-hover:text-slate-700"
                  }`}
                  strokeWidth={1.8}
                />

                <span className="truncate leading-none">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer info & Logout */}
        <div className="border-t border-slate-200/80 pt-6 flex flex-col gap-4 shrink-0">
          <div className="flex items-center gap-3 px-2">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-600 to-purple-600 text-white flex items-center justify-center font-bold font-poppins text-sm shadow-sm shrink-0">
              {username.substring(0, 2).toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate">
                {username}
              </p>

              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-violet-600 uppercase tracking-wider">
                  Verified Recruiter
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-[12px] font-semibold text-sm text-red-600 hover:bg-red-50 hover:text-red-700 transition-all cursor-pointer"
          >
            <LogOut className="h-[21px] w-[21px] shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Body container */}
      <div className="flex-1 md:pl-80 flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-35 bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-6 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-[10px] cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>

            <h1 className="font-poppins font-bold text-lg md:text-xl text-slate-800">
              {activeItem.name}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors cursor-pointer relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-violet-600 rounded-full border-2 border-white animate-pulse" />
            </button>

            <div className="h-5 w-px bg-slate-200" />

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-violet-700 bg-violet-50 border border-violet-100 px-3 py-1 rounded-full uppercase tracking-wider">
                Recruiter Workspace
              </span>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-6 md:p-8 relative">
          {children}

          <RecruiterAIChatbot
            token={authToken || getStoredToken()}
          />
        </main>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-slate-900/40 z-50 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />

            <motion.aside
              className="fixed top-0 bottom-0 left-0 w-80 bg-white z-50 p-6 flex flex-col shadow-2xl md:hidden overflow-y-auto"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{
                type: "spring",
                bounce: 0.1,
                duration: 0.4,
              }}
            >
              <div className="flex items-center justify-between mb-8 shrink-0">
                <Link
                  href="/recruiter-dashboard"
                  className="flex items-center gap-3"
                  onClick={() => setMobileOpen(false)}
                >
                  <HireVisionLogo className="h-10 w-10" />

                  <span className="font-poppins font-extrabold text-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    HireVision
                  </span>
                </Link>

                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="flex-1 space-y-2 mb-6">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.tab;

                  return (
                    <Link
                      key={item.tab}
                      href={`/recruiter-dashboard?tab=${item.tab}`}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-4 px-4 py-2.5 rounded-[13px] font-semibold text-sm transition-all ${
                        isActive
                          ? "bg-gradient-to-r from-violet-600 via-violet-600 to-purple-600 text-white"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="border-t border-slate-200 pt-5 flex flex-col gap-3 shrink-0">
                <div className="flex items-center gap-3 px-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                    {username.substring(0, 2).toUpperCase()}
                  </div>

                  <div className="flex-grow min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">
                      {username}
                    </p>

                    <span className="text-[10px] font-bold text-violet-600 uppercase tracking-wider block mt-0.5">
                      Recruiter
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl font-bold text-xs text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                >
                  <LogOut className="h-[18px] w-[18px] shrink-0" />
                  Logout
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* RECRUITER AI CHATBOT (Matches Candidate Floating AI Agent layout & design) */}
      <div className="print:hidden">
        <RecruiterAIChatbot token={authToken || getStoredToken()} />
      </div>
    </div>
  );
}

export default function RecruiterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-600 gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />

          <span className="font-poppins font-semibold text-sm">
            Loading Recruiter Workspace...
          </span>
        </div>
      }
    >
      <RecruiterLayoutContent>{children}</RecruiterLayoutContent>
    </Suspense>
  );
}