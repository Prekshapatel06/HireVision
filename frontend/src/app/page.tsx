"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  FileText,
  Search,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { FaLink } from "react-icons/fa";
import { HireVisionLogo } from "../components/HireVisionLogo";

/* =========================================================
   DATA
========================================================= */

const features = [
  {
    icon: FileText,
    title: "AI Resume Builder",
    text: "Generate ATS-friendly resumes with intelligent AI suggestions.",
  },
  {
    icon: FileText,
    title: "Live Resume Preview",
    text: "Preview your resume instantly while keeping everything updated.",
  },
  {
    icon: Search,
    title: "ATS Score Checker",
    text: "Analyze your resume and improve keyword compatibility.",
  },
  {
    icon: FaLink,
    title: "LinkedIn & GitHub Analyzer",
    text: "Evaluate your professional profiles and repositories.",
  },
  {
    icon: BriefcaseBusiness,
    title: "AI Job Match",
    text: "Discover relevant roles using intelligent recommendations.",
  },
  {
    icon: BarChart3,
    title: "Skill Gap Analysis",
    text: "Find missing skills and improve your career profile.",
  },
  {
    icon: Users,
    title: "Recruiter Hiring Agent",
    text: "AI-powered candidate discovery and screening.",
  },
  {
    icon: BarChart3,
    title: "Bulk Resume Analysis",
    text: "Analyze hundreds of resumes with smart ranking.",
  },
];

const steps = [
  [
    "01",
    "Build Your Profile",
    "Create your professional profile with education, experience, skills, projects and career goals.",
  ],
  [
    "02",
    "Let AI Analyze",
    "HireVision analyzes your profile and recommends relevant skills and career opportunities.",
  ],
  [
    "03",
    "Discover Opportunities",
    "Find relevant jobs and receive intelligent recommendations based on your profile.",
  ],
  [
    "04",
    "Get Hired Faster",
    "Apply with confidence or let recruiters discover your verified candidate profile.",
  ],
];

const stepIcons = [Target, Sparkles, Search, Users];

const testimonials = [
  [
    "AS",
    "Aarav Sharma",
    "Software Engineer",
    "HireVision completely changed the way I prepared my resume. The AI suggestions helped me highlight the right skills and projects.",
  ],
  [
    "RM",
    "Riya Mehta",
    "Product Designer",
    "The live resume preview makes ATS analysis much easier. I could instantly improve my profile before applying.",
  ],
  [
    "DW",
    "Daniel Wilson",
    "Full Stack Developer",
    "Finding relevant candidates is significantly faster with HireVision. The AI matching gives our team a much better starting point.",
  ],
];

const faqs = [
  {
    question: "What is HireVision?",
    answer:
      "HireVision is an AI-powered career and recruitment platform that helps candidates build stronger professional profiles and helps recruiters discover relevant talent faster.",
  },
  {
    question: "Can HireVision create my resume?",
    answer:
      "Yes. HireVision helps you create a professional, ATS-friendly resume using your profile information, experience, education, skills and projects.",
  },
  {
    question: "What is the AI Resume Score?",
    answer:
      "The AI Resume Score evaluates your resume across areas such as ATS compatibility, content quality, keyword relevance and readability, then provides suggestions for improvement.",
  },
  {
    question: "How does smart job matching work?",
    answer:
      "HireVision compares your skills, experience and career profile with job requirements to identify opportunities that are most relevant to your background.",
  },
  {
    question: "Can recruiters use HireVision?",
    answer:
      "Yes. Recruiters can use the AI Hiring Agent to discover candidates, compare profiles and identify people whose skills and experience best match their requirements.",
  },
  {
    question: "Is HireVision free to use?",
    answer:
      "HireVision can provide free access to essential career tools, while advanced features and recruiter functionality may be available through additional plans.",
  },
];

/* =========================================================
   DASHBOARD MOCKUP
========================================================= */

function DashboardMockup() {
  return (
    <div className="w-full overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-[0_25px_70px_rgba(37,99,235,0.10)]">
      {/* Top */}
      <div className="flex h-12 items-center justify-between border-b border-slate-100 px-5">
        <div className="flex items-center gap-2.5">
          <HireVisionLogo className="h-6 w-6" />

          <span className="text-xs font-extrabold text-slate-800">
            HireVision
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-50 text-xs font-bold text-violet-600">
            +
          </span>
        </div>
      </div>

      <div className="grid min-h-[460px] grid-cols-[145px_1fr]">
        {/* Sidebar */}
        <div className="border-r border-slate-100 bg-slate-50 p-4">
          <p className="mb-3 text-[10px] font-bold tracking-[0.15em] text-slate-400">
            MAIN MENU
          </p>

          {[
            "Dashboard",
            "My Profile",
            "AI Resume",
            "Skills",
            "Projects",
          ].map((item, index) => (
            <div
              key={item}
              className={`mb-1.5 rounded-md px-3 py-2 text-xs font-semibold ${
                index === 0
                  ? "bg-violet-50 text-violet-600"
                  : "text-slate-400"
              }`}
            >
              {item}
            </div>
          ))}

          <p className="mb-3 mt-7 text-[10px] font-bold tracking-[0.15em] text-slate-400">
            AI TOOLS
          </p>

          <div className="rounded-md bg-white px-3 py-2 text-xs font-semibold text-slate-400">
            Career Agent
          </div>
        </div>

        {/* Main */}
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-[0.15em] text-slate-400">
                WELCOME BACK
              </p>

              <h3 className="mt-1.5 text-lg font-extrabold text-slate-900">
                Your AI Career Dashboard
              </h3>
            </div>

            <span className="rounded-md border border-violet-100 px-3 py-1.5 text-xs font-bold text-violet-600">
              View Profile
            </span>
          </div>

          {/* Stats */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              ["98%", "Profile Score"],
              ["96%", "ATS Score"],
              ["92%", "Readiness"],
            ].map(([value, label]) => (
              <div
                key={label}
                className="rounded-lg border border-slate-100 p-3.5"
              >
                <p className="text-lg font-extrabold text-slate-900">
                  {value}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  {label}
                </p>

                <div className="mt-2.5 h-1.5 rounded-full bg-violet-100">
                  <div className="h-1.5 w-4/5 rounded-full bg-violet-500" />
                </div>
              </div>
            ))}
          </div>

          {/* Activity */}
          <div className="mt-4 grid grid-cols-[1.4fr_1fr] gap-3">
            <div className="rounded-lg border border-slate-100 p-3.5">
              <p className="text-xs font-bold text-slate-600">
                Recent Activities
              </p>

              {[
                "ATS Optimization",
                "Skills Match",
                "Profile Updated",
              ].map((item) => (
                <div
                  key={item}
                  className="mt-2.5 flex items-center justify-between rounded-md bg-slate-50 px-3 py-2"
                >
                  <span className="text-xs font-medium text-slate-700">
                    {item}
                  </span>

                  <span className="h-2 w-2 rounded-full bg-violet-400" />
                </div>
              ))}
            </div>

            <div className="rounded-lg bg-violet-50 p-3.5">
              <p className="text-xs font-bold text-violet-700">
                AI Hiring Agent
              </p>

              <p className="mt-2 text-xs leading-relaxed text-violet-600">
                Your profile is ready for new opportunities.
              </p>

              <div className="mt-4 rounded-md bg-white px-2.5 py-1.5 text-center text-xs font-bold text-violet-600 shadow-sm">
                View Insights
              </div>
            </div>
          </div>

          {/* Bottom */}
          <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-100 p-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-50 text-xs font-bold text-violet-600">
                PP
              </div>

              <div>
                <p className="text-xs font-bold text-slate-800">
                  Preksha Patel
                </p>

                <p className="text-[10px] text-slate-400">
                  Profile completeness: 98%
                </p>
              </div>
            </div>

            <span className="text-[10px] text-slate-400">
              Last updated today
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   RESUME MOCKUP
========================================================= */

function ResumeMockup() {
  return (
    <div className="w-full overflow-hidden rounded-[18px] border border-slate-200 bg-white p-5 shadow-[0_25px_70px_rgba(37,99,235,0.08)]">
      <div className="grid grid-cols-2 gap-5">
        {/* Builder */}
        <div className="rounded-xl bg-slate-50 p-4">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">
              Resume Builder
            </span>

            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-bold text-violet-600">
              AI
            </span>
          </div>

          {[
            "Personal Details",
            "Education",
            "Experience",
            "Projects",
            "Skills",
          ].map((item) => (
            <div
              key={item}
              className="mb-2 rounded-md border border-slate-200 bg-white px-3 py-2.5"
            >
              <div className="h-2 w-24 rounded bg-slate-200" />
              <div className="mt-2 h-1.5 w-32 rounded bg-slate-100" />
            </div>
          ))}
        </div>

        {/* Resume */}
        <div className="rounded-xl border border-slate-100 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-800">
              PREKSHA PATEL
            </span>

            <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-bold text-violet-600">
              98
            </span>
          </div>

          <div className="mt-3 h-1.5 w-28 rounded bg-violet-200" />
          <div className="mt-2 h-1.5 w-full rounded bg-slate-100" />
          <div className="mt-1.5 h-1.5 w-5/6 rounded bg-slate-100" />

          {[
            "PROFESSIONAL SUMMARY",
            "EDUCATION",
            "EXPERIENCE",
            "PROJECTS",
            "SKILLS",
          ].map((item) => (
            <div key={item} className="mt-3.5">
              <p className="text-[10px] font-extrabold text-slate-700">
                {item}
              </p>

              <div className="mt-1.5 h-1.5 w-full rounded bg-slate-100" />
              <div className="mt-1 h-1.5 w-4/5 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   FAQ
========================================================= */

function FAQ() {
  return (
    <section id="faq" className="w-full bg-[#faf9fd]">
      <div className="mx-auto w-full max-w-[1460px] px-8 py-24 lg:px-12 xl:px-16">
        <div className="mx-auto max-w-[850px] text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#e8ddf7] bg-white px-4 py-2">
            <span className="h-2 w-2 rounded-full bg-[#7632dd]" />

            <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#6d31d6]">
              Frequently Asked Questions
            </span>
          </div>

          <h2 className="text-3xl font-extrabold leading-[1.1] tracking-[-0.04em] text-[#172036] sm:text-4xl lg:text-5xl">
            Everything You{" "}
            <span className="bg-gradient-to-r from-[#6029d9] to-[#963be8] bg-clip-text text-transparent">
              Need to Know
            </span>
          </h2>

          <p className="mx-auto mt-4 max-w-[650px] text-base leading-relaxed text-[#737b8d] sm:text-lg">
            Have questions about HireVision? Here are answers to some of the
            most common questions.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-[900px] space-y-3.5">
          {faqs.map((faq, index) => (
            <details
              key={faq.question}
              className="group overflow-hidden rounded-xl border border-[#ebe7f1] bg-white open:border-[#ddd1ef] transition shadow-sm"
              open={index === 0}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 px-6 py-5 text-left">
                <span className="text-base font-bold text-[#30384a] sm:text-lg">
                  {faq.question}
                </span>

                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f7f5fa] text-[#858c9b] group-open:bg-[#f0e7ff] group-open:text-[#7131dc]">
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                </span>
              </summary>

              <div className="border-t border-[#f0edf4] px-6 pb-5 pt-4">
                <p className="max-w-[850px] text-sm leading-relaxed text-[#777f90] sm:text-base">
                  {faq.answer}
                </p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   LANDING PAGE
========================================================= */

export default function LandingPage() {
  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-white font-inter text-slate-900">

      {/* =====================================================
          NAVBAR
      ===================================================== */}

      <header className="sticky top-0 z-50 border-b border-slate-100/80 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[78px] w-full max-w-[1460px] items-center justify-between px-8 lg:px-12 xl:px-16">

          {/* EXISTING LOGO — NO NEW H LOGO */}
          <Link href="/" className="flex items-center gap-3">
            <HireVisionLogo className="h-10 w-10" />

            <div>
              <div className="text-lg font-extrabold tracking-tight">
                HireVision
              </div>

              <div className="text-[10px] font-semibold tracking-[0.18em] text-slate-400">
                AI CAREER INTELLIGENCE
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-600 lg:flex">
            <a href="#hero" className="transition hover:text-violet-600">
              Home
            </a>
            <a href="#features" className="transition hover:text-violet-600">
              Features
            </a>
            <a href="#how-it-works" className="transition hover:text-violet-600">
              How It Works
            </a>
            <a href="#recruiters" className="transition hover:text-violet-600">
              Recruiters
            </a>
            <a href="#testimonials" className="transition hover:text-violet-600">
              Testimonials
            </a>
            <a href="#faq" className="transition hover:text-violet-600">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-3.5">
            <Link
              href="/login"
              className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Log in
            </Link>

            <Link
              href="/signup"
              className="rounded-full bg-violet-600 px-6 py-2 text-sm font-bold text-white shadow-lg shadow-violet-200 transition hover:bg-violet-700"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* =====================================================
          HERO
      ===================================================== */}

      <section id="hero" className="relative overflow-hidden bg-white">
        <div className="mx-auto grid w-full max-w-[1460px] items-center gap-14 px-8 pb-20 pt-20 lg:grid-cols-[0.95fr_1.05fr] lg:px-12 xl:px-16">

          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-4 py-2 text-xs font-bold text-violet-600">
              <Sparkles className="h-3.5 w-3.5" />
              Trusted by 10,000+ Recruiters Worldwide
            </span>

            <h1 className="mt-6 text-4xl font-black leading-[1.08] tracking-[-0.04em] text-slate-900 sm:text-5xl lg:text-6xl xl:text-[66px]">
              Smarter Hiring
              <br />
              <span className="text-violet-600">
                Better Outcomes.
              </span>
            </h1>

            <p className="mt-5 max-w-[600px] text-base leading-relaxed text-slate-500 sm:text-lg">
              HireVision uses AI to build better professional profiles,
              analyze skills, match jobs and help recruiters find the right
              talent faster.
            </p>

            <div className="mt-7 grid max-w-[600px] grid-cols-2 gap-x-8 gap-y-3.5 text-sm font-semibold text-slate-700 sm:text-base">
              {[
                "AI Resume Builder",
                "Live Resume Preview",
                "ATS Score Checker",
                "AI Hiring Agent",
                "LinkedIn & GitHub Analyzer",
                "Skill Gap Analysis",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-violet-600 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-200 transition hover:bg-violet-700 sm:text-base"
              >
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Link>

              <a
                href="#how-it-works"
                className="rounded-xl border border-slate-200 px-7 py-3.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 sm:text-base"
              >
                Watch Demo
              </a>
            </div>

            <div className="mt-7 flex items-center gap-3 text-xs sm:text-sm text-slate-500">
              <div className="flex -space-x-2">
                {["A", "R", "M", "S"].map((item) => (
                  <span
                    key={item}
                    className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-violet-100 text-xs font-bold text-violet-600"
                  >
                    {item}
                  </span>
                ))}
              </div>

              <span>
                <strong className="text-slate-700">30k+</strong> people use
                HireVision every day
              </span>
            </div>
          </div>

          <DashboardMockup />
        </div>
      </section>

      {/* =====================================================
          FEATURES
      ===================================================== */}

      <section id="features" className="bg-white py-24">
        <div className="mx-auto w-full max-w-[1460px] px-8 lg:px-12 xl:px-16">

          <div className="mx-auto max-w-[850px] text-center">
            <span className="rounded-full bg-violet-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-violet-600">
              Powerful Features
            </span>

            <h2 className="mt-5 text-3xl font-black leading-[1.1] tracking-[-0.04em] sm:text-4xl lg:text-5xl">
              Everything You Need
            </h2>

            <h3 className="mt-1.5 text-2xl font-black text-violet-600 sm:text-3xl lg:text-4xl">
              For Smarter Hiring
            </h3>

            <p className="mx-auto mt-4 max-w-[700px] text-base leading-relaxed text-slate-500 sm:text-lg">
              HireVision combines AI resume creation, ATS analysis, candidate
              scoring and smart matching into one modern recruitment platform.
            </p>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-2xl border border-slate-100 bg-white p-7 shadow-[0_6px_25px_rgba(15,23,42,0.035)] transition hover:-translate-y-1 hover:shadow-[0_12px_35px_rgba(15,23,42,0.08)]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <Icon className="h-6 w-6" />
                </div>

                <h3 className="mt-5 text-base font-extrabold text-slate-800 sm:text-lg">
                  {title}
                </h3>

                <p className="mt-2.5 text-sm leading-relaxed text-slate-500">
                  {text}
                </p>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-12 flex w-fit items-center gap-2.5 rounded-full border border-violet-100 bg-white px-6 py-3 text-xs sm:text-sm font-bold text-slate-600 shadow-sm">
            <Bot className="h-4 w-4 text-violet-600" />
            One Intelligent Platform
          </div>
        </div>
      </section>

      {/* =====================================================
          RESUME BUILDER
      ===================================================== */}

      <section className="bg-[#faf9fd] py-24">
        <div className="mx-auto grid w-full max-w-[1460px] items-center gap-16 px-8 lg:grid-cols-2 lg:px-12 xl:px-16">

          <div>
            <span className="rounded-full bg-violet-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-violet-600">
              Live Resume Builder
            </span>

            <h2 className="mt-6 text-3xl font-black leading-[1.1] tracking-[-0.04em] sm:text-4xl lg:text-5xl">
              Build. Preview.
              <br />
              <span className="text-violet-600">
                Perfect. All in real time.
              </span>
            </h2>

            <p className="mt-5 max-w-[580px] text-base leading-relaxed text-slate-600 sm:text-lg">
              Create a professional, ATS-friendly resume with AI assistance.
              Edit your content and instantly see how your final resume will
              look.
            </p>

            <div className="mt-8 space-y-4">
              {[
                [
                  "AI-powered content suggestions",
                  "Get intelligent suggestions for your resume content.",
                ],
                [
                  "Real-time ATS optimization",
                  "Improve your resume while you edit.",
                ],
                [
                  "Professional templates",
                  "Choose modern layouts designed for recruiters.",
                ],
              ].map(([title, text]) => (
                <div key={title} className="flex gap-3.5">
                  <Check className="mt-1 h-5 w-5 shrink-0 text-violet-600" />

                  <div>
                    <p className="text-base font-extrabold text-slate-800">
                      {title}
                    </p>

                    <p className="mt-1 text-sm leading-relaxed text-slate-500">
                      {text}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <Link
              href="/signup"
              className="mt-8 inline-flex rounded-xl bg-violet-600 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-200 transition hover:bg-violet-700 sm:text-base"
            >
              Create Your Resume
            </Link>
          </div>

          <ResumeMockup />
        </div>
      </section>

      {/* =====================================================
          HOW IT WORKS
      ===================================================== */}

      <section id="how-it-works" className="bg-white py-24">
        <div className="mx-auto w-full max-w-[1460px] px-8 lg:px-12 xl:px-16">

          <div className="text-center">
            <span className="rounded-full bg-violet-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-violet-600">
              Simple & Intelligent
            </span>

            <h2 className="mt-5 text-3xl font-black sm:text-4xl lg:text-5xl">
              How <span className="text-violet-600">HireVision</span> Works
            </h2>

            <p className="mx-auto mt-4 max-w-[650px] text-base leading-relaxed text-slate-500 sm:text-lg">
              A simple AI-powered process that helps candidates build stronger
              profiles and helps recruiters find better talent.
            </p>
          </div>

          <div className="relative mt-16 grid gap-10 md:grid-cols-4">
            <div className="absolute left-[12%] right-[12%] top-8 hidden h-px bg-violet-100 md:block" />

            {steps.map(([number, title, text], index) => {
              const StepIcon = stepIcons[index];

              return (
                <div key={number} className="relative text-center">
                  <div className="relative z-10 mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-violet-100 bg-white text-violet-600 shadow-sm">
                    <StepIcon className="h-6 w-6" />
                  </div>

                  <p className="mt-5 text-xs font-bold uppercase tracking-[0.15em] text-violet-600">
                    Step {number}
                  </p>

                  <h3 className="mt-2 text-base font-extrabold sm:text-lg">
                    {title}
                  </h3>

                  <p className="mx-auto mt-2 max-w-[260px] text-sm leading-relaxed text-slate-500">
                    {text}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-6 py-3 text-xs sm:text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Explore All Features
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* =====================================================
          RECRUITER
      ===================================================== */}

      <section id="recruiters" className="bg-[#faf9fd] py-24">
        <div className="mx-auto grid w-full max-w-[1460px] items-center gap-16 px-8 lg:grid-cols-2 lg:px-12 xl:px-16">

          {/* Dashboard */}
          <div className="order-2 rounded-[20px] border border-slate-200 bg-white p-6 shadow-[0_25px_60px_rgba(15,23,42,0.06)] lg:order-1">
            <div className="mb-6 flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-slate-700">
                Recruiter Talent Pipeline
              </span>

              <span className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-500">
                Search candidates
              </span>
            </div>

            {[
              "Aarav Kumar",
              "Priya Shah",
              "Rahul Mehta",
            ].map((name, index) => (
              <div
                key={name}
                className="mb-3 flex items-center justify-between rounded-xl border border-slate-100 p-4"
              >
                <div className="flex items-center gap-3.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-50 text-xs font-bold text-violet-600">
                    {name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </span>

                  <div>
                    <p className="text-sm font-bold text-slate-800">{name}</p>

                    <p className="text-xs text-slate-500">
                      {
                        [
                          "Frontend Developer",
                          "Product Designer",
                          "Backend Engineer",
                        ][index]
                      }
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-base font-black text-violet-600">
                    {94 - index * 4}%
                  </p>

                  <p className="text-[10px] text-slate-400">
                    Match
                  </p>
                </div>
              </div>
            ))}

            <div className="mt-5 rounded-xl bg-violet-50 p-4 text-xs font-semibold text-violet-600">
              AI Hiring Agent • Candidate ranking completed
            </div>
          </div>

          {/* Text */}
          <div className="order-1 lg:order-2">
            <span className="rounded-full bg-violet-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-violet-600">
              For Recruiters
            </span>

            <h2 className="mt-6 text-3xl font-black leading-[1.1] tracking-[-0.04em] sm:text-4xl lg:text-5xl">
              Hire Smarter.
              <br />
              <span className="text-violet-600">
                Find Better Talent.
              </span>
            </h2>

            <p className="mt-5 max-w-[580px] text-base leading-relaxed text-slate-600 sm:text-lg">
              Stop spending hours searching through resumes. HireVision gives
              recruiters AI-powered candidate discovery, smart matching and
              actionable insights.
            </p>

            <div className="mt-7 space-y-3 text-sm font-semibold text-slate-700 sm:text-base">
              {[
                "AI-powered candidate discovery",
                "Smart skill and profile matching",
                "Faster candidate screening",
                "Data-driven hiring insights",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-violet-600 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 grid max-w-[540px] grid-cols-3 gap-3">
              {[
                ["70%", "Less screening time"],
                ["3x", "Faster discovery"],
                ["96%", "Matching accuracy"],
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <p className="text-2xl font-black text-slate-900 sm:text-3xl">
                    {value}
                  </p>

                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            <Link
              href="/signup?role=recruiter"
              className="mt-8 inline-flex items-center rounded-xl bg-violet-600 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-200 transition hover:bg-violet-700 sm:text-base"
            >
              Start Hiring Smarter
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* =====================================================
          TESTIMONIALS
      ===================================================== */}

      <section id="testimonials" className="bg-white py-24">
        <div className="mx-auto w-full max-w-[1460px] px-8 text-center lg:px-12 xl:px-16">

          <span className="rounded-full bg-violet-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-violet-600">
            Why People Say
          </span>

          <h2 className="mt-5 text-3xl font-black sm:text-4xl lg:text-5xl">
            Loved by{" "}
            <span className="text-violet-600">
              Candidates & Recruiters
            </span>
          </h2>

          <p className="mx-auto mt-4 max-w-[650px] text-base leading-relaxed text-slate-500 sm:text-lg">
            Professionals use HireVision to build stronger careers, discover
            better opportunities and make smarter hiring decisions.
          </p>

          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {testimonials.map(([initials, name, role, quote]) => (
              <div
                key={name}
                className="rounded-2xl border border-slate-100 bg-white p-7 text-left shadow-[0_6px_25px_rgba(15,23,42,0.035)]"
              >
                <div className="text-sm tracking-widest text-violet-600">
                  ★★★★★
                </div>

                <p className="mt-5 text-sm leading-relaxed text-slate-600 sm:text-base">
                  “{quote}”
                </p>

                <div className="mt-7 flex items-center gap-3.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-50 text-xs font-bold text-violet-600">
                    {initials}
                  </span>

                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      {name}
                    </p>

                    <p className="text-xs text-slate-500">
                      {role}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================
          FAQ
      ===================================================== */}

      <FAQ />

      {/* =====================================================
          FOOTER
      ===================================================== */}

      <footer className="bg-white py-16">
        <div className="mx-auto w-full max-w-[1460px] px-8 lg:px-12 xl:px-16">

          <div className="grid gap-10 border-b border-slate-100 pb-12 md:grid-cols-4">

            {/* Brand */}
            <div>
              <div className="flex items-center gap-3">
                {/* EXISTING LOGO */}
                <HireVisionLogo className="h-10 w-10" />

                <div>
                  <p className="text-base font-extrabold text-slate-900">
                    HireVision
                  </p>

                  <p className="text-[10px] font-semibold tracking-[0.2em] text-slate-400">
                    AI CAREER INTELLIGENCE
                  </p>
                </div>
              </div>

              <p className="mt-4 max-w-[280px] text-sm leading-relaxed text-slate-500">
                Build better careers. Discover better opportunities. Hire
                better with intelligent AI-powered recruitment.
              </p>
            </div>

            {/* Product */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-900">
                PRODUCT
              </p>

              <div className="mt-4 space-y-3 text-sm text-slate-500">
                <a href="#features" className="block transition hover:text-violet-600">
                  Features
                </a>
                <a href="#how-it-works" className="block transition hover:text-violet-600">
                  How It Works
                </a>
                <a href="#faq" className="block transition hover:text-violet-600">
                  FAQ
                </a>
                <a href="/signup" className="block transition hover:text-violet-600">
                  Pricing
                </a>
              </div>
            </div>

            {/* Candidates */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-900">
                CANDIDATES
              </p>

              <div className="mt-4 space-y-3 text-sm text-slate-500">
                <a
                  href="/signup?role=candidate"
                  className="block transition hover:text-violet-600"
                >
                  Build Profile
                </a>
                <a href="#features" className="block transition hover:text-violet-600">
                  AI Resume
                </a>
                <a href="#features" className="block transition hover:text-violet-600">
                  Skill Gap
                </a>
                <a href="#features" className="block transition hover:text-violet-600">
                  Job Match
                </a>
              </div>
            </div>

            {/* Recruiters */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-900">
                RECRUITERS
              </p>

              <div className="mt-4 space-y-3 text-sm text-slate-500">
                <a
                  href="/signup?role=recruiter"
                  className="block transition hover:text-violet-600"
                >
                  AI Hiring Agent
                </a>
                <a href="#recruiters" className="block transition hover:text-violet-600">
                  Candidate Discovery
                </a>
                <a href="#recruiters" className="block transition hover:text-violet-600">
                  Smart Matching
                </a>
                <a href="#recruiters" className="block transition hover:text-violet-600">
                  Get Started
                </a>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-4 pt-8 text-xs text-slate-500 sm:flex-row">
            <p>
              © {new Date().getFullYear()} HireVision AI. All rights reserved.
            </p>

            <div className="flex gap-6">
              <span className="cursor-pointer hover:text-violet-600">Privacy Policy</span>
              <span className="cursor-pointer hover:text-violet-600">Terms of Service</span>
              <span className="cursor-pointer hover:text-violet-600">Contact</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}