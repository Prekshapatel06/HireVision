"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  User,
  FileSpreadsheet,
  BookOpen,
  Code,
  FolderGit2,
  Briefcase,
  Award,
  Trophy,
  Globe,
  Network,
  Sparkles,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  Loader2,
  Bell,
  Cpu,
} from "lucide-react";

import FloatingAIAgent from "../../components/dashboard/FloatingAIAgent";
import { HireVisionLogo } from "../../components/HireVisionLogo";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

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

function clearAuthSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("hirevision_token");
  localStorage.removeItem("user");
  localStorage.removeItem("hirevision_user");
  localStorage.removeItem("role");
  localStorage.removeItem("hirevision_role");
  localStorage.removeItem("hirevision_remember");

  sessionStorage.removeItem("token");
  sessionStorage.removeItem("hirevision_token");
  sessionStorage.removeItem("user");
  sessionStorage.removeItem("hirevision_user");
  sessionStorage.removeItem("role");
  sessionStorage.removeItem("hirevision_role");
  sessionStorage.removeItem("hirevision_remember");
}

function DashboardLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeTab = searchParams.get("tab") || "overview";

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [authToken, setAuthToken] = useState<string | null>(() => getStoredToken());
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const token = getStoredToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    const fetchProfile = async () => {
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
            clearAuthSession();

            if (isMounted) {
              router.replace("/login");
            }

            return;
          }

          throw new Error("Failed to authenticate session.");
        }

        const data = await response.json();

        if (!data?.user) {
          throw new Error("Invalid authentication response.");
        }

        if (data.user.role !== "candidate") {
          if (data.user.role === "recruiter") {
            if (isMounted) {
              router.replace("/recruiter-dashboard");
            }

            return;
          }

          throw new Error("Invalid user role.");
        }

        if (isMounted) {
          setProfile(data.user);

          localStorage.setItem(
            "user",
            JSON.stringify(data.user)
          );

          localStorage.setItem(
            "hirevision_user",
            JSON.stringify(data.user)
          );

          localStorage.setItem(
            "role",
            data.user.role
          );

          localStorage.setItem(
            "hirevision_role",
            data.user.role
          );
        }
      } catch (error) {
        console.error(
          "Error loading authenticated user:",
          error
        );

        if (isMounted) {
          clearAuthSession();
          router.replace("/login");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleLogout = () => {
    clearAuthSession();
    router.replace("/");
  };

  const navItems = [
    {
      name: "Dashboard",
      tab: "overview",
      icon: LayoutDashboard,
    },
    {
      name: "Personal Information",
      tab: "personal",
      icon: User,
    },
    {
      name: "About Me",
      tab: "about",
      icon: FileSpreadsheet,
    },
    {
      name: "Education",
      tab: "education",
      icon: BookOpen,
    },
    {
      name: "Skills",
      tab: "skills",
      icon: Code,
    },
    {
      name: "Projects",
      tab: "projects",
      icon: FolderGit2,
    },
    {
      name: "Internships",
      tab: "internships",
      icon: Briefcase,
    },
    {
      name: "Experience",
      tab: "experience",
      icon: Briefcase,
    },
    {
      name: "Certifications",
      tab: "certifications",
      icon: Award,
    },
    {
      name: "Achievements",
      tab: "achievements",
      icon: Trophy,
    },
    {
      name: "Languages",
      tab: "languages",
      icon: Globe,
    },
    {
      name: "Social Profiles",
      tab: "socials",
      icon: Network,
    },
    {
      name: "Live Resume",
      tab: "live",
      icon: Sparkles,
    },
    {
      name: "AI Career Insights",
      tab: "ai-insights",
      icon: Cpu,
    },
    {
      name: "Settings",
      tab: "settings",
      icon: SettingsIcon,
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-600 gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />

        <span className="font-poppins font-semibold text-sm">
          Authenticating session...
        </span>
      </div>
    );
  }

  const activeItem =
    navItems.find((item) => item.tab === activeTab) ||
    navItems[0];

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-800 font-inter">
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex flex-col w-80 fixed top-0 bottom-0 left-0 z-40 bg-white border-r border-slate-200/80 px-6 py-7 overflow-y-auto">
        {/* LOGO */}
        <Link
          href="/dashboard"
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

        {/* NAVIGATION */}
        <nav className="flex-1 space-y-2 mb-7">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.tab;

            return (
              <Link
                key={item.tab}
                href={`/dashboard?tab=${item.tab}`}
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

                <span className="truncate leading-none">
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* USER SECTION */}
        <div className="border-t border-slate-200/80 pt-6 flex flex-col gap-4 shrink-0">
          <div className="flex items-center gap-3 px-2">
            {profile?.profile_photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.profile_photo}
                alt="Avatar"
                className="w-11 h-11 rounded-full object-cover border border-slate-200 shadow-sm shrink-0"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-white flex items-center justify-center font-bold font-poppins text-sm shadow-sm shrink-0">
                {profile?.username?.substring(0, 2).toUpperCase() ||
                  "HV"}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate">
                {profile?.full_name ||
                  profile?.username ||
                  "Candidate"}
              </p>

              <p className="text-xs text-slate-400 truncate mt-0.5">
                {profile?.email || "No Email"}
              </p>
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

      {/* MAIN CONTENT */}
      <div className="flex-1 md:pl-80 flex flex-col min-h-screen">
        {/* TOP HEADER */}
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
            <button className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
              <Bell className="h-5 w-5" />
            </button>

            <div className="h-8 w-px bg-slate-200" />

            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-500 hidden sm:inline-block">
                Status: Live
              </span>

              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="flex-1 p-6 md:p-8">
          {children}
        </main>
      </div>

      {/* MOBILE SIDEBAR */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-slate-900/40 z-50 md:hidden backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />

            <motion.aside
              className="fixed top-0 bottom-0 left-0 w-80 bg-white z-50 px-6 py-7 flex flex-col shadow-2xl md:hidden overflow-y-auto"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{
                type: "spring",
                bounce: 0.1,
                duration: 0.4,
              }}
            >
              {/* MOBILE LOGO */}
              <div className="flex items-center justify-between mb-9 shrink-0">
                <Link
                  href="/dashboard"
                  className="flex items-center gap-3"
                  onClick={() => setMobileOpen(false)}
                >
                  <div className="shrink-0">
                    <HireVisionLogo className="h-12 w-12" />
                  </div>

                  <div className="flex flex-col">
                    <span className="font-poppins font-extrabold text-[18px] leading-none tracking-[0.07em] bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                      HIREVISION
                    </span>

                    <span className="mt-1.5 text-[8px] leading-none font-bold tracking-[0.12em] text-slate-400 whitespace-nowrap">
                      AI POWERED RECRUITMENT
                    </span>
                  </div>
                </Link>

                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-[10px] cursor-pointer"
                >
                  <X className="h-5 w-5 text-slate-600" />
                </button>
              </div>

              {/* MOBILE NAV */}
              <nav className="flex-1 space-y-2 mb-7">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    activeTab === item.tab;

                  return (
                    <Link
                      key={item.tab}
                      href={`/dashboard?tab=${item.tab}`}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-4 w-full min-h-[46px] px-4 py-2.5 rounded-[13px] font-semibold text-[15px] transition-all ${
                        isActive
                          ? "bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-md"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      <Icon
                        className="h-[22px] w-[22px] shrink-0"
                        strokeWidth={1.8}
                      />

                      <span className="truncate leading-none">
                        {item.name}
                      </span>
                    </Link>
                  );
                })}
              </nav>

              {/* MOBILE USER */}
              <div className="border-t border-slate-200 pt-6 flex flex-col gap-4 shrink-0">
                <div className="flex items-center gap-3 px-2">
                  {profile?.profile_photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.profile_photo}
                      alt="Avatar"
                      className="w-11 h-11 rounded-full object-cover border border-slate-200 shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
                      {profile?.username?.substring(0, 2).toUpperCase() ||
                        "HV"}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">
                      {profile?.full_name ||
                        profile?.username ||
                        "Candidate"}
                    </p>

                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {profile?.email || "No Email"}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-[12px] font-semibold text-sm text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                >
                  <LogOut className="h-[21px] w-[21px] shrink-0" />

                  <span>Logout</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* AI AGENT */}
      <FloatingAIAgent
        profile={profile}
        token={authToken || getStoredToken()}
      />
    </div>
  );
}

export default function DashboardLayout({
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
            Loading Workspace...
          </span>
        </div>
      }
    >
      <DashboardLayoutContent>
        {children}
      </DashboardLayoutContent>
    </Suspense>
  );
}