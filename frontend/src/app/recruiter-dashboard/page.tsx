"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  Suspense,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Users,
  Briefcase,
  Zap,
  Filter,
  Search,
  ExternalLink,
  TrendingUp,
  Clock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Calendar,
  Workflow,
  Building2,
  Play,
  Check,
  X,
  FileText,
  BarChart3,
  RefreshCw,
  SlidersHorizontal,
  Mail,
  Phone,
  MapPin,
  GraduationCap,
  Award,
  FolderGit2,
  GitCompare,
  Scale,
  Pencil,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface RecruiterJob {
  id: number | string;
  title?: string;
  description?: string;
  status?: string;
  requirements?: {
    must_have?: string[];
    preferred?: string[];
    optional?: string[];
  };
  created_at?: string;
}

interface RecruiterCandidate {
  id?: number | string;
  user_id?: number | string;
  full_name?: string;
  username?: string;
  email?: string;
  phone?: string;
  city?: string;
  country?: string;
  career_objective?: string;
  skills?: any[] | Record<string, any>;
  projects?: any[];
  experience?: any[];
  internships?: any[];
  education?: any[];
  certifications?: any[];
  social_profiles?: {
    github?: string;
    linkedin?: string;
    portfolio?: string;
  };
  resume_url?: string;
  has_live_resume?: boolean;
  profile_photo?: string;
  updated_at?: string;
  created_at?: string;
}

interface RecruiterMatch {
  id: number;
  user_id?: number | string;
  job_id?: number | string;
  candidate_id?: number | string;
  full_name?: string;
  username?: string;
  job_title?: string;
  match_score?: number | null;
  status?: string;
  explanation?: string;
  created_at?: string;
  updated_at?: string;
}

interface RecruiterSettings {
  company_name: string;
  industry: string;
}

interface RecruiterAnalytics {
  totalJobs: number;
  activeJobs: number;
  totalApplications: number;
  evaluatedCount: number;
  averageMatchScore: number | null;
  pipelineStages: Record<string, number>;
  topSkills: { name: string; count: number }[];
  bottlenecks: {
    type: string;
    severity: "low" | "medium" | "high";
    message: string;
  }[];
  recentMatches: {
    id: number;
    candidateName: string;
    jobTitle: string;
    status: string;
    score: number | null;
  }[];
}

interface AIAnalysisBreakdown {
  score: number | null;
  level: string;
  strongMatches: string[];
  partialMatches: string[];
  missing: string[];
  unavailable: string[];
  recommendations: string[];
  confidence: number;
}

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

const DEFAULT_SETTINGS: RecruiterSettings = {
  company_name: "",
  industry: "",
};

const normalizeNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(100, Math.round(parsed)));
};

const normalizeStatus = (value: unknown): string => {
  if (typeof value !== "string" || !value.trim()) return "Awaiting Review";
  return value.trim();
};

const getSkillNames = (skills: RecruiterCandidate["skills"]): string[] => {
  if (Array.isArray(skills)) {
    return skills
      .map((skill) => {
        if (typeof skill === "string") return skill.trim();
        if (skill && typeof skill === "object") {
          return String(skill.name || skill.skill || skill.title || "").trim();
        }
        return "";
      })
      .filter(Boolean);
  }
  if (skills && typeof skills === "object") {
    return Object.keys(skills).filter(Boolean);
  }
  return [];
};

function RecruiterDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";

  // Data states
  const [dbJobs, setDbJobs] = useState<RecruiterJob[]>([]);
  const [dbMatches, setDbMatches] = useState<RecruiterMatch[]>([]);
  const [dbCandidates, setDbCandidates] = useState<RecruiterCandidate[]>([]);
  const [recruiterSettings, setRecruiterSettings] =
    useState<RecruiterSettings>(DEFAULT_SETTINGS);
  const [analytics, setAnalytics] = useState<RecruiterAnalytics | null>(null);

  // UI & filter states
  const [loadingDb, setLoadingDb] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterJobId, setFilterJobId] = useState<string>("All");

  // Candidates Intelligence Tab states
  const [candidateSearchQuery, setCandidateSearchQuery] = useState("");
  const [candidateJobFilter, setCandidateJobFilter] = useState<string>("All");
  const [candidateEvidenceFilter, setCandidateEvidenceFilter] = useState<
    "all" | "live_resume" | "github" | "experience" | "high_completeness"
  >("all");

  // Candidate Comparison Tab states
  const [selectedCandidateIdsForComparison, setSelectedCandidateIdsForComparison] =
    useState<(number | string)[]>([]);
  const [comparisonJobId, setComparisonJobId] = useState<string>("All");
  const [comparisonResult, setComparisonResult] = useState<any | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);

  // Job creation form states
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newJobDesc, setNewJobDesc] = useState("");
  const [newJobMustHave, setNewJobMustHave] = useState("");
  const [newJobPreferred, setNewJobPreferred] = useState("");

  // Job edit modal states
  const [editingJob, setEditingJob] = useState<RecruiterJob | null>(null);
  const [editJobTitle, setEditJobTitle] = useState("");
  const [editJobDesc, setEditJobDesc] = useState("");
  const [editJobMustHave, setEditJobMustHave] = useState("");
  const [editJobPreferred, setEditJobPreferred] = useState("");
  const [editJobStatus, setEditJobStatus] = useState("Active");
  const [isEditJobModalOpen, setIsEditJobModalOpen] = useState(false);

  // AI Breakdown Modal
  const [modalMatch, setModalMatch] = useState<RecruiterMatch | null>(null);
  const [modalAnalysis, setModalAnalysis] =
    useState<AIAnalysisBreakdown | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Candidate Profile Detail Modal
  const [profileModalCandidate, setProfileModalCandidate] =
    useState<RecruiterCandidate | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Candidate Real Live Resume Modal (Single Source of Truth)
  const [liveResumeModalCandidate, setLiveResumeModalCandidate] =
    useState<RecruiterCandidate | null>(null);
  const [liveResumeData, setLiveResumeData] = useState<any | null>(null);
  const [liveResumeLoading, setLiveResumeLoading] = useState(false);
  const [liveResumeError, setLiveResumeError] = useState<string | null>(null);
  const [isLiveResumeModalOpen, setIsLiveResumeModalOpen] = useState(false);

  const getToken = useCallback(() => {
    if (typeof window === "undefined") return null;
    return (
      sessionStorage.getItem("token") ||
      sessionStorage.getItem("hirevision_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("hirevision_token")
    );
  }, []);

  const clearAuthStorage = useCallback(() => {
    if (typeof window === "undefined") return;
    const keys = [
      "token",
      "hirevision_token",
      "user",
      "hirevision_user",
      "role",
      "hirevision_role",
    ];
    keys.forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
  }, []);

  const redirectToLogin = useCallback(() => {
    clearAuthStorage();
    router.replace("/login?role=recruiter");
  }, [clearAuthStorage, router]);

  const authorizedFetch = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const token = getToken();
      if (!token) {
        redirectToLogin();
        throw new Error("Authentication required.");
      }

      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${token}`);
      if (init.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }

      const response = await fetch(`${API_URL}${path}`, {
        ...init,
        headers,
        cache: "no-store",
      });

      if (response.status === 401 || response.status === 403) {
        redirectToLogin();
        throw new Error("Your recruiter session has expired.");
      }

      return response;
    },
    [getToken, redirectToLogin]
  );

  const loadDashboardData = useCallback(async () => {
    const token = getToken();
    if (!token) {
      redirectToLogin();
      return;
    }

    setLoadingDb(true);
    try {
      const [settingsRes, jobsRes, candidatesRes, matchesRes, analyticsRes] =
        await Promise.all([
          authorizedFetch("/api/recruiter/settings"),
          authorizedFetch("/api/recruiter/jobs"),
          authorizedFetch("/api/recruiter/candidates"),
          authorizedFetch("/api/recruiter/matches"),
          authorizedFetch("/api/recruiter/analytics"),
        ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setRecruiterSettings({
          company_name: data?.company_name || "",
          industry: data?.industry || "",
        });
      }

      if (jobsRes.ok) {
        const data = await jobsRes.json();
        setDbJobs(Array.isArray(data?.jobs) ? data.jobs : []);
      }

      if (candidatesRes.ok) {
        const data = await candidatesRes.json();
        setDbCandidates(
          Array.isArray(data?.candidates) ? data.candidates : []
        );
      }

      if (matchesRes.ok) {
        const data = await matchesRes.json();
        setDbMatches(Array.isArray(data?.matches) ? data.matches : []);
      }

      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error("Recruiter dashboard data loading failed:", error);
    } finally {
      setLoadingDb(false);
    }
  }, [authorizedFetch, getToken, redirectToLogin]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData, activeTab]);

  // Derived metrics
  const activeJobsCount = useMemo(() => {
    return dbJobs.filter((job) => {
      const status = String(job.status || "active").toLowerCase();
      return (
        status !== "closed" && status !== "archived" && status !== "inactive"
      );
    }).length;
  }, [dbJobs]);

  const totalApplications = dbMatches.length;

  const evaluatedMatches = useMemo(() => {
    return dbMatches.filter((m) => normalizeNumber(m.match_score) !== null);
  }, [dbMatches]);

  const averageFitScore = useMemo(() => {
    if (evaluatedMatches.length === 0) return null;
    const total = evaluatedMatches.reduce(
      (sum, m) => sum + (normalizeNumber(m.match_score) || 0),
      0
    );
    return Math.round(total / evaluatedMatches.length);
  }, [evaluatedMatches]);

  // Unique candidate deduplication strictly by unique database ID
  const uniqueCandidates = useMemo(() => {
    const seen = new Set();
    const list: RecruiterCandidate[] = [];
    for (const c of dbCandidates) {
      const id = c.user_id ?? c.id;
      if (id && !seen.has(id)) {
        seen.add(id);
        list.push(c);
      }
    }
    return list;
  }, [dbCandidates]);

  // Unique match deduplication strictly by candidate_id and job_id
  const uniqueMatches = useMemo(() => {
    const seen = new Set();
    const list: RecruiterMatch[] = [];
    for (const m of dbMatches) {
      const key = `${m.candidate_id ?? m.user_id}_${m.job_id}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push(m);
      }
    }
    return list;
  }, [dbMatches]);

  const handleOpenLiveResume = async (candidate: RecruiterCandidate) => {
    const candidateId = candidate.user_id ?? candidate.id;
    if (!candidateId) return;
    setLiveResumeModalCandidate(candidate);
    setIsLiveResumeModalOpen(true);
    setLiveResumeLoading(true);
    setLiveResumeError(null);
    setLiveResumeData(null);

    try {
      const res = await authorizedFetch(
        `/api/recruiter/candidates/${candidateId}/live-resume`
      );
      if (res.status === 404) {
        const err = await res.json().catch(() => null);
        setLiveResumeError(
          err?.message || "This candidate has not generated a Live Resume yet."
        );
      } else if (!res.ok) {
        throw new Error("Unable to retrieve candidate Live Resume.");
      } else {
        const data = await res.json();
        setLiveResumeData(data);
      }
    } catch (err: any) {
      setLiveResumeError(
        err.message || "Live Resume is not available."
      );
    } finally {
      setLiveResumeLoading(false);
    }
  };

  // Handlers
  const handleShortlistCandidate = async (candidateId: string | number) => {
    const match =
      dbMatches.find(
        (m) =>
          String(m.candidate_id || m.user_id) === String(candidateId) &&
          (filterJobId !== "All" ? String(m.job_id) === String(filterJobId) : true)
      ) ||
      dbMatches.find(
        (m) => String(m.candidate_id || m.user_id) === String(candidateId)
      );

    if (match) {
      await handleUpdateMatchStatus(match.id, "Shortlisted");
    } else {
      setMessage({
        type: "error",
        text: "No active job application found for this candidate to shortlist.",
      });
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJobTitle.trim()) {
      setMessage({ type: "error", text: "Please provide a job title." });
      return;
    }

    setActionLoading("create-job");
    setMessage(null);

    try {
      const res = await authorizedFetch("/api/recruiter/jobs", {
        method: "POST",
        body: JSON.stringify({
          title: newJobTitle.trim(),
          description: newJobDesc.trim(),
          requirements: {
            must_have: newJobMustHave
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            preferred: newJobPreferred
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            optional: [],
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || "Failed to create job posting.");
      }

      setNewJobTitle("");
      setNewJobDesc("");
      setNewJobMustHave("");
      setNewJobPreferred("");
      await loadDashboardData();
      setMessage({
        type: "success",
        text: "Job posting published successfully.",
      });
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.message || "Failed to create job.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartEditJob = (job: RecruiterJob) => {
    setEditingJob(job);
    setEditJobTitle(job.title || "");
    setEditJobDesc(job.description || "");
    setEditJobMustHave(job.requirements?.must_have?.join(", ") || "");
    setEditJobPreferred(job.requirements?.preferred?.join(", ") || "");
    setEditJobStatus(job.status || "Active");
    setIsEditJobModalOpen(true);
  };

  const handleSaveEditJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJob) return;
    if (!editJobTitle.trim()) {
      setMessage({ type: "error", text: "Job title is required." });
      return;
    }

    setActionLoading(`edit-job-${editingJob.id}`);
    try {
      const res = await authorizedFetch(`/api/recruiter/jobs/${editingJob.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: editJobTitle.trim(),
          description: editJobDesc.trim(),
          status: editJobStatus,
          requirements: {
            must_have: editJobMustHave
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            preferred: editJobPreferred
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            optional: [],
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || "Failed to update job posting.");
      }

      const data = await res.json();
      setDbJobs((prev) =>
        prev.map((j) => (j.id === editingJob.id ? data.job : j))
      );
      setMessage({
        type: "success",
        text: "Job posting updated successfully.",
      });
      setIsEditJobModalOpen(false);
      setEditingJob(null);
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.message || "Failed to update job.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteJob = async (jobId: string | number) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this job posting? All related candidate matches will also be removed."
      )
    ) {
      return;
    }

    setActionLoading(`delete-job-${jobId}`);
    try {
      const res = await authorizedFetch(`/api/recruiter/jobs/${jobId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || "Failed to delete job.");
      }

      setDbJobs((prev) => prev.filter((j) => String(j.id) !== String(jobId)));
      setDbMatches((prev) =>
        prev.filter((m) => String(m.job_id) !== String(jobId))
      );
      setMessage({
        type: "success",
        text: "Job posting deleted successfully.",
      });
      authorizedFetch("/api/recruiter/analytics")
        .then((r) => r.json())
        .then((data) => setAnalytics(data))
        .catch(() => {});
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.message || "Failed to delete job.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateMatchStatus = async (
    matchId: number,
    newStatus: string
  ) => {
    setActionLoading(`status-${matchId}`);
    try {
      const res = await authorizedFetch(
        `/api/recruiter/matches/${matchId}/status`,
        {
          method: "POST",
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!res.ok) throw new Error("Failed to update candidate status.");

      setDbMatches((prev) =>
        prev.map((m) => (m.id === matchId ? { ...m, status: newStatus } : m))
      );
      setMessage({
        type: "success",
        text: `Candidate status transitioned to "${newStatus}".`,
      });
      // Silent refresh analytics
      authorizedFetch("/api/recruiter/analytics")
        .then((r) => r.json())
        .then((data) => setAnalytics(data))
        .catch(() => {});
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.message || "Could not update status.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleEvaluateSingleMatch = async (match: RecruiterMatch) => {
    setActionLoading(`eval-${match.id}`);
    try {
      const res = await authorizedFetch(
        `/api/recruiter/matches/${match.id}/evaluate`,
        {
          method: "POST",
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || "Failed to run AI evaluation.");
      }

      const data = await res.json();
      const updatedMatch = {
        ...match,
        match_score: data.analysis?.score ?? data.match?.match_score,
        explanation: data.match?.explanation || data.analysis?.level,
      };

      setDbMatches((prev) =>
        prev.map((m) => (m.id === match.id ? updatedMatch : m))
      );

      setModalMatch(updatedMatch);
      setModalAnalysis(data.analysis);
      setIsModalOpen(true);

      setMessage({
        type: "success",
        text: `AI evaluated ${match.full_name || "candidate"}: ${data.analysis?.score ?? 0}% Match Score.`,
      });

      authorizedFetch("/api/recruiter/analytics")
        .then((r) => r.json())
        .then((d) => setAnalytics(d))
        .catch(() => {});
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.message || "AI match evaluation failed.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleBatchEvaluateJob = async (jobId: string | number) => {
    if (uniqueCandidates.length === 0) {
      setMessage({
        type: "error",
        text: "No candidates available for screening.",
      });
      return;
    }

    setActionLoading(`batch-eval-${jobId}`);
    try {
      const res = await authorizedFetch(
        `/api/recruiter/jobs/${jobId}/evaluate-matches`,
        {
          method: "POST",
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || "Failed to batch evaluate matches.");
      }

      const data = await res.json();
      if ((data.evaluatedCount || 0) === 0) {
        setMessage({
          type: "error",
          text: data.message || "No candidates available for screening.",
        });
      } else {
        setMessage({
          type: "success",
          text: `Evaluated ${data.evaluatedCount} candidate(s) for this position.`,
        });
      }
      await loadDashboardData();
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.message || "Batch evaluation failed.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRunComparison = async (overrideIds?: (number | string)[]) => {
    const ids = overrideIds || selectedCandidateIdsForComparison;
    if (ids.length < 2) {
      setMessage({
        type: "error",
        text: "Please select at least two candidates to compare.",
      });
      return;
    }

    setComparisonLoading(true);
    setComparisonError(null);
    try {
      const res = await authorizedFetch("/api/recruiter/candidates/compare", {
        method: "POST",
        body: JSON.stringify({
          candidateIds: ids,
          jobId: comparisonJobId !== "All" ? comparisonJobId : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(
          err?.message || "Failed to run Candidate Comparison Agent."
        );
      }

      const data = await res.json();
      setComparisonResult(data);
      setMessage({
        type: "success",
        text: `Compared ${ids.length} candidates using HireVision Candidate Comparison Agent.`,
      });
    } catch (err: any) {
      setComparisonError(err.message || "Comparison failed.");
      setMessage({
        type: "error",
        text: err.message || "Candidate comparison failed.",
      });
    } finally {
      setComparisonLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading("settings");
    try {
      const res = await authorizedFetch("/api/recruiter/settings", {
        method: "PUT",
        body: JSON.stringify({
          company_name: recruiterSettings.company_name.trim(),
          industry: recruiterSettings.industry.trim(),
        }),
      });

      if (!res.ok) throw new Error("Failed to update profile settings.");

      setMessage({
        type: "success",
        text: "Recruiter profile settings saved.",
      });
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.message || "Unable to save settings.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = normalizeStatus(status);
    switch (s) {
      case "Shortlisted":
        return (
          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 text-[11px] font-bold rounded-full border border-emerald-200/60 uppercase tracking-wider flex items-center gap-1">
            <Check className="h-3 w-3" /> Shortlisted
          </span>
        );
      case "Scheduled":
      case "Interview":
        return (
          <span className="px-2.5 py-1 bg-purple-50 text-purple-600 text-[11px] font-bold rounded-full border border-purple-200/60 uppercase tracking-wider flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Interview
          </span>
        );
      case "Rejected":
        return (
          <span className="px-2.5 py-1 bg-rose-50 text-rose-600 text-[11px] font-bold rounded-full border border-rose-200/60 uppercase tracking-wider flex items-center gap-1">
            <X className="h-3 w-3" /> Rejected
          </span>
        );
      case "Hired":
        return (
          <span className="px-2.5 py-1 bg-blue-50 text-blue-600 text-[11px] font-bold rounded-full border border-blue-200/60 uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Hired
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 bg-amber-50 text-amber-600 text-[11px] font-bold rounded-full border border-amber-200/60 uppercase tracking-wider flex items-center gap-1">
            <Clock className="h-3 w-3" /> Awaiting Review
          </span>
        );
    }
  };

  const renderToastMessage = () => {
    if (!message) return null;
    return (
      <div
        className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border text-xs font-semibold shadow-sm transition-all ${
          message.type === "success"
            ? "bg-emerald-50/80 text-emerald-800 border-emerald-200"
            : "bg-rose-50/80 text-rose-800 border-rose-200"
        }`}
      >
        <div className="flex items-center gap-2">
          {message.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
        <button
          onClick={() => setMessage(null)}
          className="text-slate-400 hover:text-slate-600 p-1"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  // -------------------------------------------------------------
  // TAB 1: OVERVIEW
  // -------------------------------------------------------------
  const renderOverviewTab = () => {
    const stageCounts = analytics?.pipelineStages || {
      "Awaiting Review": dbMatches.filter(
        (m) => normalizeStatus(m.status) === "Awaiting Review"
      ).length,
      Shortlisted: dbMatches.filter(
        (m) => normalizeStatus(m.status) === "Shortlisted"
      ).length,
      Scheduled: dbMatches.filter((m) =>
        ["Scheduled", "Interview"].includes(normalizeStatus(m.status))
      ).length,
      Hired: dbMatches.filter((m) => normalizeStatus(m.status) === "Hired")
        .length,
      Rejected: dbMatches.filter((m) => normalizeStatus(m.status) === "Rejected")
        .length,
    };

    return (
      <div className="space-y-8">
        {/* Welcome Command Banner matching Candidate Side */}
        <div className="premium-card p-6 md:p-8 bg-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm border border-purple-100 rounded-2xl">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center font-poppins font-black text-2xl shadow-md shadow-indigo-500/20">
              {recruiterSettings.company_name
                ? recruiterSettings.company_name.substring(0, 2).toUpperCase()
                : "HV"}
            </div>
            <div>
              <h2 className="font-poppins font-extrabold text-xl md:text-2xl text-slate-800">
                Recruiter Command Center
              </h2>
              <p className="text-xs text-slate-500 font-semibold mt-0.5 flex items-center gap-2">
                <span>
                  {recruiterSettings.company_name || "HireVision Enterprise"}
                </span>
                {recruiterSettings.industry && (
                  <>
                    <span>•</span>
                    <span className="text-indigo-600 font-bold">
                      {recruiterSettings.industry}
                    </span>
                  </>
                )}
                <span>•</span>
                <span>Data-Grounded Multi-Agent Intelligence</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/recruiter-dashboard?tab=jobs")}
              className="px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 cursor-pointer flex items-center gap-1.5 transition-all"
            >
              <Briefcase className="h-3.5 w-3.5" />
              + Post New Job
            </button>
            <div className="px-4 py-2 bg-purple-50 text-purple-700 rounded-full text-xs font-bold flex items-center gap-1.5 border border-purple-100">
              <Zap className="h-4 w-4 fill-purple-600 text-purple-600 animate-pulse" />
              Real-Time AI Active
            </div>
          </div>
        </div>

        {/* 4 Statistics KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Active Jobs */}
          <div className="premium-card p-5 bg-white border-l-4 border-l-purple-500 rounded-2xl shadow-sm border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Active Job Postings
            </span>
            <div className="flex items-baseline justify-between">
              <h3 className="font-poppins font-black text-2xl text-slate-800">
                {loadingDb ? (
                  <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                ) : (
                  activeJobsCount
                )}
              </h3>
              <span className="text-[10px] text-slate-400 font-semibold">
                {dbJobs.length} total posted
              </span>
            </div>
          </div>

          {/* Total Applicants */}
          <div className="premium-card p-5 bg-white border-l-4 border-l-indigo-500 rounded-2xl shadow-sm border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Total Applications
            </span>
            <div className="flex items-baseline justify-between">
              <h3 className="font-poppins font-black text-2xl text-slate-800">
                {loadingDb ? (
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                ) : (
                  totalApplications
                )}
              </h3>
              <span className="text-[10px] text-slate-400 font-semibold">
                Across all positions
              </span>
            </div>
          </div>

          {/* AI Evaluated Screenings */}
          <div className="premium-card p-5 bg-white border-l-4 border-l-violet-500 rounded-2xl shadow-sm border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              AI Screened Candidates
            </span>
            <div className="flex items-baseline justify-between">
              <h3 className="font-poppins font-black text-2xl text-slate-800">
                {loadingDb ? (
                  <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
                ) : (
                  evaluatedMatches.length
                )}
              </h3>
              <span className="text-[10px] text-violet-600 font-bold">
                {totalApplications > 0
                  ? `${Math.round(
                      (evaluatedMatches.length / totalApplications) * 100
                    )}% screened`
                  : "0%"}
              </span>
            </div>
          </div>

          {/* Average Fit Score */}
          <div className="premium-card p-5 bg-white border-l-4 border-l-emerald-500 rounded-2xl shadow-sm border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Average Match Fit
            </span>
            <div className="flex items-center gap-2">
              <h3 className="font-poppins font-black text-2xl text-emerald-600">
                {averageFitScore !== null ? `${averageFitScore}%` : "—"}
              </h3>
              {averageFitScore !== null && (
                <div className="flex-1 bg-emerald-100 h-1.5 rounded-full overflow-hidden hidden sm:block">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full transition-all"
                    style={{ width: `${averageFitScore}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottleneck Alerts & AI Signals */}
        {analytics?.bottlenecks && analytics.bottlenecks.length > 0 && (
          <div className="space-y-3">
            {analytics.bottlenecks.map((b, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl border border-amber-200/80 bg-amber-50/60 flex items-start justify-between gap-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-amber-100 text-amber-700 mt-0.5">
                    <AlertCircle className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                      Pipeline Signal: {b.type.replace(/_/g, " ")}
                    </h4>
                    <p className="text-xs text-amber-800/90 font-medium mt-0.5 leading-relaxed">
                      {b.message}
                    </p>
                  </div>
                </div>
                {b.type === "SCREENING_BACKLOG" && (
                  <button
                    onClick={() =>
                      router.push("/recruiter-dashboard?tab=screenings")
                    }
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shrink-0 cursor-pointer shadow-sm"
                  >
                    Resolve Backlog
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Real-time Interactive Pipeline Funnel */}
        <div className="premium-card p-6 bg-white border border-purple-100/80 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Workflow className="h-4 w-4 text-purple-600" />
              <h3 className="font-poppins font-black text-sm text-slate-800 uppercase tracking-tight">
                Hiring Funnel Progression
              </h3>
            </div>
            <button
              onClick={() => router.push("/recruiter-dashboard?tab=pipeline")}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              Open Kanban Board <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
            {[
              {
                label: "Applied",
                count: totalApplications,
                color: "border-slate-200 bg-slate-50 text-slate-800",
              },
              {
                label: "AI Screened",
                count: evaluatedMatches.length,
                color: "border-indigo-200 bg-indigo-50/50 text-indigo-700",
              },
              {
                label: "Shortlisted",
                count: stageCounts["Shortlisted"] || 0,
                color: "border-emerald-200 bg-emerald-50/50 text-emerald-700",
              },
              {
                label: "Interview",
                count:
                  (stageCounts["Scheduled"] || 0) +
                  (stageCounts["Interview"] || 0),
                color: "border-purple-200 bg-purple-50/50 text-purple-700",
              },
              {
                label: "Hired",
                count: stageCounts["Hired"] || 0,
                color: "border-blue-200 bg-blue-50/50 text-blue-700",
              },
            ].map((step, i) => (
              <div
                key={step.label}
                className={`p-4 rounded-xl border ${step.color} flex flex-col justify-between transition-all hover:scale-[1.02]`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Step {i + 1}
                  </span>
                  <span className="text-xs font-black text-slate-400">
                    {totalApplications > 0
                      ? `${Math.round((step.count / totalApplications) * 100)}%`
                      : "0%"}
                  </span>
                </div>
                <div className="mt-3">
                  <h4 className="font-poppins font-black text-2xl text-slate-800">
                    {step.count}
                  </h4>
                  <p className="text-xs font-bold mt-0.5">{step.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2-Column Grid: Recent Screenings & Skill Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Candidate Screenings */}
          <div className="lg:col-span-2 space-y-4">
            <div className="premium-card p-6 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-indigo-600" />
                  <h3 className="font-poppins font-black text-sm text-slate-800 uppercase tracking-tight">
                    Recent Candidate Screenings
                  </h3>
                </div>
                <button
                  onClick={() =>
                    router.push("/recruiter-dashboard?tab=screenings")
                  }
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  View All Screenings <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-semibold text-slate-600">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="px-4 py-3">Candidate</th>
                      <th className="px-4 py-3">Applied Job</th>
                      <th className="px-4 py-3">AI Fit</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dbMatches.slice(0, 5).map((match) => {
                      const score = normalizeNumber(match.match_score);
                      const status = normalizeStatus(match.status);
                      return (
                        <tr
                          key={match.id}
                          className="hover:bg-slate-50/60 transition-colors"
                        >
                          <td className="px-4 py-3.5 font-bold text-slate-800">
                            {match.full_name || match.username || "Candidate"}
                          </td>
                          <td className="px-4 py-3.5 text-slate-600 font-medium">
                            {match.job_title || "General Application"}
                          </td>
                          <td className="px-4 py-3.5">
                            {score !== null ? (
                              <span
                                className={`font-poppins font-black text-xs px-2 py-0.5 rounded-md ${
                                  score >= 75
                                    ? "bg-emerald-50 text-emerald-700"
                                    : score >= 50
                                    ? "bg-indigo-50 text-indigo-700"
                                    : "bg-amber-50 text-amber-700"
                                }`}
                              >
                                {score}%
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">
                                Pending AI
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            {getStatusBadge(status)}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <button
                              onClick={() => handleEvaluateSingleMatch(match)}
                              disabled={actionLoading === `eval-${match.id}`}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-bold cursor-pointer transition-all inline-flex items-center gap-1"
                            >
                              {actionLoading === `eval-${match.id}` ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Sparkles className="h-3 w-3" />
                              )}
                              {score !== null ? "View AI Report" : "Run AI Fit"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {dbMatches.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="text-center py-8 text-slate-400 font-semibold"
                        >
                          No candidate applications recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: Skill Signals & Match Philosophy */}
          <div className="space-y-6">
            <div className="premium-card p-6 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <TrendingUp className="h-4 w-4 text-purple-600" />
                <h4 className="font-poppins font-bold text-slate-800 text-sm">
                  Talent Pool Skill Density
                </h4>
              </div>
              <div className="space-y-3">
                {(analytics?.topSkills || []).slice(0, 5).map((s, i) => {
                  const max = analytics?.topSkills[0]?.count || 1;
                  const pct = Math.round((s.count / max) * 100);
                  return (
                    <div key={s.name} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold text-slate-700">
                        <span>{s.name}</span>
                        <span className="text-purple-600">
                          {s.count} candidate{s.count === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-violet-600 to-indigo-600 h-full rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}

                {(!analytics?.topSkills ||
                  analytics.topSkills.length === 0) && (
                  <p className="text-xs text-slate-400 italic py-2">
                    Candidate skill data currently syncing...
                  </p>
                )}
              </div>
            </div>

            <div className="premium-card p-6 bg-gradient-to-br from-indigo-50/50 via-purple-50/30 to-white border border-purple-100/80 rounded-2xl shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-purple-600" />
                <h4 className="font-poppins font-bold text-slate-800 text-sm">
                  Explainable AI Screening
                </h4>
              </div>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                HireVision AI evaluates candidate evidence (verified projects,
                work history, and skills) directly against job must-have and
                preferred requirements. Scores reflect demonstrated ability, not
                synthetic metrics.
              </p>
              <div className="pt-2">
                <button
                  onClick={() =>
                    router.push("/recruiter-dashboard?tab=screenings")
                  }
                  className="w-full py-2 bg-white hover:bg-slate-50 text-indigo-600 border border-indigo-200/80 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-sm"
                >
                  Inspect Active Screenings <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // TAB 2: JOB POSTINGS
  // -------------------------------------------------------------
  const renderJobsTab = () => {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Active Job Postings Column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-poppins font-black text-lg text-slate-800">
                  Your Job Postings
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  Manage active listings and trigger batch AI candidate
                  evaluations.
                </p>
              </div>
              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full border border-indigo-200/60">
                {dbJobs.length} Job{dbJobs.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="space-y-4">
              {dbJobs.map((job) => {
                const jobMatches = dbMatches.filter(
                  (m) => String(m.job_id) === String(job.id)
                );
                const scoredCount = jobMatches.filter(
                  (m) => normalizeNumber(m.match_score) !== null
                ).length;
                const isEvaluating =
                  actionLoading === `batch-eval-${job.id}`;

                return (
                  <div
                    key={job.id}
                    className="premium-card p-6 bg-white border border-slate-200/80 rounded-2xl shadow-sm hover:border-purple-200 transition-all space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h4 className="font-poppins font-extrabold text-base text-slate-800">
                            {job.title || "Untitled Job"}
                          </h4>
                          <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-full border border-emerald-200/60 uppercase">
                            {job.status || "Active"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-1 line-clamp-2">
                          {job.description || "No description provided."}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleBatchEvaluateJob(job.id)}
                          disabled={isEvaluating}
                          className="px-3 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/10 cursor-pointer flex items-center gap-1.5 transition-all disabled:opacity-50"
                        >
                          {isEvaluating ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                          AI Batch Screen
                        </button>

                        <button
                          onClick={() => handleStartEditJob(job)}
                          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
                          title="Edit Job"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeleteJob(job.id)}
                          className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all cursor-pointer"
                          title="Delete Job"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Requirements Tags */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">
                          Must-Have:
                        </span>
                        {(job.requirements?.must_have || []).length > 0 ? (
                          job.requirements?.must_have?.map((skill) => (
                            <span
                              key={skill}
                              className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold rounded-md"
                            >
                              {skill}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">
                            None specified
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">
                          Preferred:
                        </span>
                        {(job.requirements?.preferred || []).length > 0 ? (
                          job.requirements?.preferred?.map((skill) => (
                            <span
                              key={skill}
                              className="px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-600 text-[10px] font-bold rounded-md"
                            >
                              {skill}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">
                            None specified
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Footer stats & link */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs font-semibold">
                      <div className="flex items-center gap-4 text-slate-500">
                        <span>
                          <strong className="text-slate-800">
                            {jobMatches.length}
                          </strong>{" "}
                          applicants
                        </span>
                        <span>•</span>
                        <span className="text-indigo-600">
                          <strong>{scoredCount}</strong> AI evaluated
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          setFilterJobId(String(job.id));
                          router.push(
                            `/recruiter-dashboard?tab=screenings&jobId=${job.id}`
                          );
                        }}
                        className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-bold"
                      >
                        View Applicants <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {dbJobs.length === 0 && (
                <div className="p-12 text-center bg-white border border-slate-200/80 rounded-2xl">
                  <Briefcase className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <h4 className="font-poppins font-bold text-slate-700 text-sm">
                    No jobs available.
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Create your first job listing on the right to start
                    evaluating candidate matches.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Post New Job Form Column */}
          <div className="space-y-4">
            <div className="premium-card p-6 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-4 sticky top-6">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-poppins font-extrabold text-base text-slate-800">
                  Post a New Job
                </h3>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">
                  Define technical requirements for automated AI matching.
                </p>
              </div>

              <form onSubmit={handleCreateJob} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Job Title *
                  </label>
                  <input
                    type="text"
                    value={newJobTitle}
                    onChange={(e) => setNewJobTitle(e.target.value)}
                    placeholder="e.g. Senior Frontend Engineer"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Job Description
                  </label>
                  <textarea
                    value={newJobDesc}
                    onChange={(e) => setNewJobDesc(e.target.value)}
                    placeholder="Describe role responsibilities, team structure, and scope..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 min-h-[90px] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Must-Have Skills (comma-separated) *
                  </label>
                  <input
                    type="text"
                    value={newJobMustHave}
                    onChange={(e) => setNewJobMustHave(e.target.value)}
                    placeholder="React, TypeScript, Next.js, Node.js"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Directly impacts candidate match score calculations.
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Preferred Skills (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={newJobPreferred}
                    onChange={(e) => setNewJobPreferred(e.target.value)}
                    placeholder="Docker, GraphQL, AWS, TailwindCSS"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={actionLoading === "create-job"}
                  className="w-full py-3 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {actionLoading === "create-job" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Publishing Position...
                    </>
                  ) : (
                    <>
                      <Briefcase className="h-4 w-4" />
                      Publish Job Listing
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // TAB 2.5: CANDIDATE INTELLIGENCE & DECISION SUPPORT (CANDIDATES)
  // -------------------------------------------------------------
  const calculateProfileCompleteness = (c: RecruiterCandidate): number => {
    let score = 0;
    if (c.full_name || c.username) score += 10;
    if (c.email) score += 10;
    if (c.phone) score += 10;
    if (c.city || c.country) score += 10;
    if (c.career_objective && c.career_objective.trim().length > 0) score += 10;
    const skills = getSkillNames(c.skills);
    if (skills.length > 0) score += 15;
    if (Array.isArray(c.projects) && c.projects.length > 0) score += 15;
    if (Array.isArray(c.experience) && c.experience.length > 0) score += 10;
    if (Array.isArray(c.education) && c.education.length > 0) score += 5;
    if (
      c.has_live_resume ||
      c.resume_url ||
      c.social_profiles?.github ||
      c.social_profiles?.linkedin
    ) {
      score += 5;
    }
    return Math.min(100, score);
  };

  const getCandidateStrengths = (c: RecruiterCandidate): string[] => {
    const strengths: string[] = [];
    const skills = getSkillNames(c.skills);
    if (skills.length >= 3) {
      strengths.push(
        `${skills.length} verified technical skills (${skills.slice(0, 3).join(", ")})`
      );
    } else if (skills.length > 0) {
      strengths.push(`${skills.length} verified skill(s): ${skills.join(", ")}`);
    }
    if (Array.isArray(c.projects) && c.projects.length > 0) {
      const topProj = c.projects[0];
      const title = topProj.title || topProj.name || "Verified Project";
      strengths.push(
        `Portfolio proof: "${title}" documented with technical evidence`
      );
    }
    if (Array.isArray(c.experience) && c.experience.length > 0) {
      strengths.push(
        `${c.experience.length} professional experience record(s) on file`
      );
    }
    if (c.has_live_resume) {
      strengths.push("Candidate-generated Live Resume active & verified");
    }
    if (c.social_profiles?.github) {
      strengths.push("GitHub repository & codebase connected");
    }
    if (strengths.length === 0) {
      strengths.push("Verified HireVision candidate profile");
    }
    return strengths.slice(0, 3);
  };

  const getCandidateMissingInfo = (c: RecruiterCandidate): string[] => {
    const missing: string[] = [];
    if (!c.has_live_resume) {
      missing.push("Live Resume not generated yet");
    }
    if (!c.resume_url) {
      missing.push("PDF/Doc resume not attached");
    }
    if (!c.social_profiles?.github) {
      missing.push("GitHub account not connected");
    }
    if (!c.social_profiles?.linkedin) {
      missing.push("LinkedIn profile not linked");
    }
    if (!Array.isArray(c.experience) || c.experience.length === 0) {
      missing.push("No work experience listed");
    }
    if (!Array.isArray(c.projects) || c.projects.length === 0) {
      missing.push("No projects showcased");
    }
    if (!c.career_objective || !c.career_objective.trim()) {
      missing.push("Career objective not specified");
    }
    return missing;
  };

  const renderCandidatesTab = () => {
    const filteredCandidates = uniqueCandidates.filter((candidate) => {
      const q = candidateSearchQuery.toLowerCase().trim();
      if (q) {
        const name = (
          candidate.full_name ||
          candidate.username ||
          ""
        ).toLowerCase();
        const obj = (candidate.career_objective || "").toLowerCase();
        const skills = getSkillNames(candidate.skills).join(" ").toLowerCase();
        const city = (candidate.city || "").toLowerCase();
        if (
          !name.includes(q) &&
          !obj.includes(q) &&
          !skills.includes(q) &&
          !city.includes(q)
        ) {
          return false;
        }
      }

      if (
        candidateEvidenceFilter === "live_resume" &&
        !candidate.has_live_resume
      ) {
        return false;
      }
      if (
        candidateEvidenceFilter === "github" &&
        !candidate.social_profiles?.github
      ) {
        return false;
      }
      if (
        candidateEvidenceFilter === "experience" &&
        (!Array.isArray(candidate.experience) || candidate.experience.length === 0)
      ) {
        return false;
      }
      if (
        candidateEvidenceFilter === "high_completeness" &&
        calculateProfileCompleteness(candidate) < 75
      ) {
        return false;
      }
      return true;
    });

    const selectedJob =
      candidateJobFilter !== "All"
        ? dbJobs.find((j) => String(j.id) === String(candidateJobFilter))
        : null;

    return (
      <div className="space-y-6">
        {/* Candidates Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-slate-200/80 p-6 rounded-3xl shadow-sm">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center border border-violet-100">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="font-poppins font-black text-xl text-slate-800">
                Candidate Intelligence & Decision Support
              </h3>
            </div>
            <p className="text-xs text-slate-500 font-semibold mt-1 max-w-2xl">
              Deep candidate profile intelligence, verified credentials, evidence tracking, and job match evaluations. Real candidate data only.
            </p>
          </div>

          {/* Job Context Selector */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3.5 py-2 rounded-2xl shadow-inner">
              <Briefcase className="h-4 w-4 text-slate-500 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  Evaluate Against Job:
                </span>
                <select
                  value={candidateJobFilter}
                  onChange={(e) => setCandidateJobFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer pr-2"
                >
                  <option value="All">All Candidates (General Intelligence)</option>
                  {dbJobs.map((job) => (
                    <option key={job.id} value={String(job.id)}>
                      {job.title} ({job.status || "Active"})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Candidate Search Bar */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={candidateSearchQuery}
                onChange={(e) => setCandidateSearchQuery(e.target.value)}
                placeholder="Search name, skills, role..."
                className="pl-10 pr-4 py-2.5 w-full bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Evidence & Readiness Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold">
          <button
            onClick={() => setCandidateEvidenceFilter("all")}
            className={`px-3.5 py-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
              candidateEvidenceFilter === "all"
                ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            All Candidates
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700">
              {uniqueCandidates.length}
            </span>
          </button>
          <button
            onClick={() => setCandidateEvidenceFilter("live_resume")}
            className={`px-3.5 py-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
              candidateEvidenceFilter === "live_resume"
                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Live Resume Active
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700">
              {uniqueCandidates.filter((c) => c.has_live_resume).length}
            </span>
          </button>
          <button
            onClick={() => setCandidateEvidenceFilter("github")}
            className={`px-3.5 py-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
              candidateEvidenceFilter === "github"
                ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <FolderGit2 className="h-3.5 w-3.5" />
            GitHub Connected
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700">
              {uniqueCandidates.filter((c) => c.social_profiles?.github).length}
            </span>
          </button>
          <button
            onClick={() => setCandidateEvidenceFilter("experience")}
            className={`px-3.5 py-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
              candidateEvidenceFilter === "experience"
                ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Briefcase className="h-3.5 w-3.5" />
            Documented Experience
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700">
              {
                uniqueCandidates.filter(
                  (c) => Array.isArray(c.experience) && c.experience.length > 0
                ).length
              }
            </span>
          </button>
          <button
            onClick={() => setCandidateEvidenceFilter("high_completeness")}
            className={`px-3.5 py-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
              candidateEvidenceFilter === "high_completeness"
                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Profile Completeness ≥ 75%
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700">
              {
                uniqueCandidates.filter(
                  (c) => calculateProfileCompleteness(c) >= 75
                ).length
              }
            </span>
          </button>
        </div>

        {/* Candidate Intelligence Cards List */}
        <div className="space-y-4">
          {filteredCandidates.map((candidate, index) => {
            const candidateId = candidate.user_id ?? candidate.id;
            const skills = getSkillNames(candidate.skills);
            const completeness = calculateProfileCompleteness(candidate);
            const strengths = getCandidateStrengths(candidate);
            const missingInfo = getCandidateMissingInfo(candidate);

            // Check if this candidate has a match evaluation for the selected job
            const matchedRecord = selectedJob
              ? uniqueMatches.find(
                  (m) =>
                    String(m.job_id) === String(selectedJob.id) &&
                    String(m.candidate_id ?? m.user_id) === String(candidateId)
                )
              : null;

            // Target role derivation
            const targetRole =
              candidate.experience?.[0]?.role ||
              candidate.experience?.[0]?.title ||
              candidate.career_objective ||
              "Open to Technology & Product Roles";

            // Top project
            const topProject =
              Array.isArray(candidate.projects) && candidate.projects.length > 0
                ? candidate.projects[0]
                : null;

            // Top experience
            const latestExp =
              Array.isArray(candidate.experience) && candidate.experience.length > 0
                ? candidate.experience[0]
                : null;

            return (
              <div
                key={candidateId ?? index}
                className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all space-y-5"
              >
                {/* 1. Header: Candidate Identity, Target Role, Completeness */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-start sm:items-center gap-4">
                    {candidate.profile_photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={candidate.profile_photo}
                        alt="Avatar"
                        className="w-14 h-14 rounded-2xl object-cover border-2 border-indigo-100 shadow-sm"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white font-poppins font-black text-lg flex items-center justify-center shadow-sm">
                        {(candidate.full_name || candidate.username || "HV")
                          .substring(0, 2)
                          .toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-poppins font-black text-base text-slate-900">
                          {candidate.full_name ||
                            candidate.username ||
                            "Registered Candidate"}
                        </h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          ID #{candidateId}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-indigo-600 mt-0.5 line-clamp-1">
                        {targetRole}
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 font-semibold mt-1">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-slate-400" />
                          {candidate.city
                            ? `${candidate.city}${
                                candidate.country ? `, ${candidate.country}` : ""
                              }`
                            : "Location not provided"}
                        </span>
                        {candidate.email && (
                          <span className="hidden sm:flex items-center gap-1">
                            <Mail className="h-3 w-3 text-slate-400" />
                            {candidate.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Profile Completeness Gauge */}
                  <div className="flex flex-col items-start md:items-end gap-1.5 self-start md:self-auto bg-slate-50 md:bg-transparent p-3 md:p-0 rounded-2xl w-full md:w-auto">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Profile Completeness
                      </span>
                      <span
                        className={`text-xs font-black ${
                          completeness >= 80
                            ? "text-emerald-600"
                            : completeness >= 50
                            ? "text-indigo-600"
                            : "text-amber-600"
                        }`}
                      >
                        {completeness}%
                      </span>
                    </div>
                    <div className="w-full md:w-36 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          completeness >= 80
                            ? "bg-emerald-500"
                            : completeness >= 50
                            ? "bg-indigo-500"
                            : "bg-amber-500"
                        }`}
                        style={{ width: `${completeness}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Real Channels & Evidence Badges */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {candidate.has_live_resume ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                      Live Resume Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold bg-slate-50 text-slate-400 border border-slate-200">
                      No Live Resume
                    </span>
                  )}

                  {candidate.resume_url ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      <FileText className="h-3.5 w-3.5 text-blue-600" />
                      Resume Uploaded
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold bg-slate-50 text-slate-400 border border-slate-200">
                      No Uploaded PDF
                    </span>
                  )}

                  {candidate.social_profiles?.github ? (
                    <a
                      href={
                        candidate.social_profiles.github.startsWith("http")
                          ? candidate.social_profiles.github
                          : `https://github.com/${candidate.social_profiles.github}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-sm"
                    >
                      <FolderGit2 className="h-3.5 w-3.5" />
                      GitHub Connected
                      <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold bg-slate-50 text-slate-400 border border-slate-200">
                      GitHub Not Connected
                    </span>
                  )}

                  {candidate.social_profiles?.linkedin ? (
                    <a
                      href={
                        candidate.social_profiles.linkedin.startsWith("http")
                          ? candidate.social_profiles.linkedin
                          : `https://linkedin.com/in/${candidate.social_profiles.linkedin}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold bg-sky-600 hover:bg-sky-700 text-white transition-all shadow-sm"
                    >
                      LinkedIn Connected
                      <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold bg-slate-50 text-slate-400 border border-slate-200">
                      LinkedIn Not Linked
                    </span>
                  )}
                </div>

                {/* 3. Deep Evidence Showcase: Skills, Projects, Experience */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-1">
                  {/* Verified Skills */}
                  <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Verified Technical Skills ({skills.length})
                    </span>
                    {skills.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {skills.slice(0, 6).map((sk) => (
                          <span
                            key={sk}
                            className="px-2.5 py-1 bg-white border border-slate-200 text-slate-800 text-[11px] font-bold rounded-lg shadow-2xs"
                          >
                            {sk}
                          </span>
                        ))}
                        {skills.length > 6 && (
                          <span className="text-[10px] font-bold text-indigo-600 self-center">
                            +{skills.length - 6} more
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        No technical skills verified yet.
                      </p>
                    )}
                  </div>

                  {/* Strongest Project / Portfolio Evidence */}
                  <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Strongest Project / Evidence
                    </span>
                    {topProject ? (
                      <div className="space-y-1">
                        <h5 className="font-bold text-xs text-slate-800 line-clamp-1">
                          {topProject.title || topProject.name || "Portfolio Project"}
                        </h5>
                        <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                          {topProject.description || "Project implementation verified on profile."}
                        </p>
                        {topProject.technologies && (
                          <span className="text-[10px] font-bold text-indigo-600 block">
                            Stack:{" "}
                            {Array.isArray(topProject.technologies)
                              ? topProject.technologies.join(", ")
                              : String(topProject.technologies)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        No projects recorded in profile.
                      </p>
                    )}
                  </div>

                  {/* Documented Work Experience */}
                  <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Documented Work Experience
                    </span>
                    {latestExp ? (
                      <div className="space-y-1">
                        <h5 className="font-bold text-xs text-slate-800 line-clamp-1">
                          {latestExp.role || latestExp.title || "Software Engineer"}{" "}
                          {latestExp.company ? `@ ${latestExp.company}` : ""}
                        </h5>
                        {latestExp.joining_date && (
                          <p className="text-[10px] text-slate-400 font-semibold">
                            {latestExp.joining_date} -{" "}
                            {latestExp.ending_date || "Present"}
                          </p>
                        )}
                        <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                          {latestExp.description || "Professional role documented on profile."}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        Experience information is not available.
                      </p>
                    )}
                  </div>
                </div>

                {/* 4. Candidate Strengths & Missing Information Split */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Verified Strengths */}
                  <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl space-y-2">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      Candidate Strengths (Real Evidence)
                    </span>
                    <ul className="space-y-1 text-xs text-slate-700">
                      {strengths.map((str, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-emerald-600 font-black">•</span>
                          <span>{str}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Missing Information (Never Invented) */}
                  <div className="p-4 bg-amber-50/40 border border-amber-200/60 rounded-2xl space-y-2">
                    <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                      Important Missing Information
                    </span>
                    {missingInfo.length > 0 ? (
                      <ul className="space-y-1 text-xs text-slate-600">
                        {missingInfo.slice(0, 3).map((mis, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-amber-600 font-black">•</span>
                            <span>{mis}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-emerald-700 font-semibold">
                        Comprehensive candidate record: all primary profile data fields populated.
                      </p>
                    )}
                  </div>
                </div>

                {/* 5. Job Fit Intelligence (When a Job is Selected) */}
                {selectedJob && (
                  <div className="p-4.5 bg-gradient-to-r from-violet-50/80 via-indigo-50/60 to-purple-50/60 border border-indigo-100 rounded-2xl space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-indigo-600" />
                        <h5 className="font-poppins font-extrabold text-xs text-slate-800">
                          Job Fit Intelligence: {selectedJob.title}
                        </h5>
                      </div>

                      {matchedRecord && normalizeNumber(matchedRecord.match_score) !== null ? (
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-indigo-600 text-white shadow-xs">
                            {normalizeNumber(matchedRecord.match_score)}% Match
                          </span>
                          <span className="text-xs font-bold text-slate-600">
                            {matchedRecord.status || "Evaluated"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-slate-500">
                          Not evaluated for this job yet
                        </span>
                      )}
                    </div>

                    {matchedRecord?.explanation && (
                      <p className="text-xs text-slate-600 font-medium bg-white/80 p-3 rounded-xl border border-indigo-100/60 leading-relaxed">
                        {matchedRecord.explanation}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-1 text-xs">
                      <span className="text-[11px] text-slate-500 font-medium">
                        HireVision AI Specialist Matching Agent
                      </span>
                      {matchedRecord ? (
                        <button
                          onClick={() => {
                            setModalMatch(matchedRecord);
                            setModalAnalysis({
                              score: normalizeNumber(matchedRecord.match_score),
                              level: matchedRecord.explanation || "Evaluated Candidate",
                              strongMatches: [],
                              partialMatches: [],
                              missing: [],
                              unavailable: [],
                              recommendations: [
                                "Evaluate candidate against must-have skills",
                                "Verify project technical stack",
                              ],
                              confidence: 1,
                            });
                            setIsModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
                        >
                          View Full AI Match Breakdown
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            handleBatchEvaluateJob(selectedJob.id);
                          }}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-xs flex items-center gap-1"
                        >
                          <Sparkles className="h-3 w-3" /> Run Fit Evaluation
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* 6. Footer Actions: Live Resume, View Profile */}
                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold">
                  <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                    <span>Verified Real Database Profile</span>
                    <span>•</span>
                    <span>Updated: {candidate.updated_at ? new Date(candidate.updated_at).toLocaleDateString() : "Active"}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setProfileModalCandidate(candidate);
                        setIsProfileModalOpen(true);
                      }}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      View Profile
                    </button>

                    {candidateId ? (
                      <button
                        onClick={() => handleOpenLiveResume(candidate)}
                        className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Live Resume
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    ) : (
                      <span className="text-slate-400 text-xs">ID Unavailable</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Empty State: Zero fake candidates rule */}
          {uniqueCandidates.length === 0 ? (
            <div className="p-16 text-center bg-white border border-slate-200/80 rounded-3xl space-y-3">
              <Users className="h-10 w-10 text-slate-300 mx-auto" />
              <h4 className="font-poppins font-black text-slate-800 text-base">
                No candidates available.
              </h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Only genuine registered candidate accounts are shown in HireVision. No mock, demo, or fake candidate data is generated.
              </p>
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="p-16 text-center bg-white border border-slate-200/80 rounded-3xl space-y-3">
              <Search className="h-10 w-10 text-slate-300 mx-auto" />
              <h4 className="font-poppins font-black text-slate-800 text-base">
                No candidates match your current search and filters.
              </h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Try adjusting your search terms or clearing the evidence filter pills above.
              </p>
              <button
                onClick={() => {
                  setCandidateSearchQuery("");
                  setCandidateEvidenceFilter("all");
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // TAB 3: CANDIDATE COMPARISON (REPLACES TALENT POOL)
  // -------------------------------------------------------------
  const renderComparisonTab = () => {
    const selectedCandidates = uniqueCandidates.filter((c) => {
      const id = c.user_id ?? c.id;
      return id && selectedCandidateIdsForComparison.includes(id);
    });

    const toggleCandidateSelection = (candidateId: number | string) => {
      setSelectedCandidateIdsForComparison((prev) => {
        if (prev.includes(candidateId)) {
          return prev.filter((id) => id !== candidateId);
        }
        if (prev.length >= 4) {
          setMessage({
            type: "error",
            text: "You can compare up to 4 candidates at a time.",
          });
          return prev;
        }
        return [...prev, candidateId];
      });
      // Clear previous comparison results when selection changes
      setComparisonResult(null);
    };

    return (
      <div className="space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-slate-200/80 p-6 rounded-3xl shadow-sm">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center border border-violet-100">
                <GitCompare className="h-5 w-5" />
              </div>
              <h3 className="font-poppins font-black text-xl text-slate-800">
                Candidate Comparison
              </h3>
            </div>
            <p className="text-xs text-slate-500 font-semibold mt-1 max-w-2xl">
              Objective side-by-side evidence analysis and multi-candidate comparison powered by the HireVision Candidate Comparison Agent.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Optional Job Context */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3.5 py-2 rounded-2xl shadow-inner">
              <Briefcase className="h-4 w-4 text-slate-500 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  Compare For Job:
                </span>
                <select
                  value={comparisonJobId}
                  onChange={(e) => {
                    setComparisonJobId(e.target.value);
                    setComparisonResult(null);
                  }}
                  className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer pr-2"
                >
                  <option value="All">General Comparison (All Jobs)</option>
                  {dbJobs.map((job) => (
                    <option key={job.id} value={String(job.id)}>
                      {job.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Run Comparison Action Button */}
            <button
              onClick={() => handleRunComparison()}
              disabled={selectedCandidateIdsForComparison.length < 2 || comparisonLoading}
              className="px-5 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-bold shadow-md shadow-indigo-500/20 cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {comparisonLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing Candidates...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Run AI Comparison ({selectedCandidateIdsForComparison.length})
                </>
              )}
            </button>
          </div>
        </div>

        {/* Selected Candidate Tags & Quick Selection Bar */}
        <div className="bg-slate-50 border border-slate-200/80 p-4.5 rounded-2xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Selected for Comparison:
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-indigo-100 text-indigo-700">
                {selectedCandidateIdsForComparison.length} / 4 candidates
              </span>
            </div>

            {selectedCandidateIdsForComparison.length > 0 && (
              <button
                onClick={() => {
                  setSelectedCandidateIdsForComparison([]);
                  setComparisonResult(null);
                }}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer self-start sm:self-auto"
              >
                Clear Selection
              </button>
            )}
          </div>

          {selectedCandidates.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {selectedCandidates.map((candidate) => {
                const candidateId = candidate.user_id ?? candidate.id;
                return (
                  <div
                    key={candidateId}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-slate-800 shadow-xs"
                  >
                    <div className="w-5 h-5 rounded-md bg-indigo-50 text-indigo-600 text-[10px] font-black flex items-center justify-center">
                      {(candidate.full_name || candidate.username || "HV").substring(0, 2).toUpperCase()}
                    </div>
                    <span>{candidate.full_name || candidate.username}</span>
                    <button
                      onClick={() => toggleCandidateSelection(candidateId!)}
                      className="p-0.5 text-slate-400 hover:text-slate-700 rounded-full cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500 font-medium">
              Select at least 2 candidates below to perform a side-by-side evidence comparison.
            </p>
          )}
        </div>

        {/* State 1: Zero Candidates Available */}
        {uniqueCandidates.length === 0 ? (
          <div className="p-16 text-center bg-white border border-slate-200/80 rounded-3xl space-y-3">
            <Users className="h-10 w-10 text-slate-300 mx-auto" />
            <h4 className="font-poppins font-black text-slate-800 text-base">
              No candidates available.
            </h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              When candidates register on HireVision, their verified profiles will appear here for comparison.
            </p>
          </div>
        ) : selectedCandidateIdsForComparison.length < 2 ? (
          /* State 2: Prompt to Select Candidates */
          <div className="space-y-4">
            <div className="p-6 bg-white border border-slate-200/80 rounded-3xl space-y-4">
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-indigo-600" />
                <h4 className="font-poppins font-bold text-sm text-slate-800">
                  Select candidates to compare.
                </h4>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Choose 2 to 4 candidates from your verified talent database to generate objective, evidence-based AI comparisons.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                {uniqueCandidates.map((candidate) => {
                  const candidateId = candidate.user_id ?? candidate.id;
                  const isSelected = selectedCandidateIdsForComparison.includes(candidateId!);
                  const skills = getSkillNames(candidate.skills);
                  const completeness = calculateProfileCompleteness(candidate);

                  return (
                    <div
                      key={candidateId}
                      onClick={() => toggleCandidateSelection(candidateId!)}
                      className={`p-4.5 rounded-2xl border transition-all cursor-pointer space-y-3 ${
                        isSelected
                          ? "bg-indigo-50/50 border-indigo-400 shadow-sm"
                          : "bg-white border-slate-200 hover:border-indigo-200 hover:shadow-xs"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-600 font-poppins font-black text-sm flex items-center justify-center border border-indigo-100 shadow-xs">
                            {(candidate.full_name || candidate.username || "HV")
                              .substring(0, 2)
                              .toUpperCase()}
                          </div>
                          <div>
                            <h5 className="font-poppins font-extrabold text-xs text-slate-800">
                              {candidate.full_name || candidate.username}
                            </h5>
                            <p className="text-[11px] text-slate-400 font-medium">
                              ID #{candidateId} • {completeness}% Complete
                            </p>
                          </div>
                        </div>

                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
                            isSelected
                              ? "bg-indigo-600 border-indigo-600 text-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {isSelected && <Check className="h-3.5 w-3.5" />}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1 text-[10px]">
                        {skills.slice(0, 4).map((sk) => (
                          <span
                            key={sk}
                            className="px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-md"
                          >
                            {sk}
                          </span>
                        ))}
                        {skills.length > 4 && (
                          <span className="text-slate-400 font-bold self-center">
                            +{skills.length - 4}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 pt-1 border-t border-slate-100">
                        <span>
                          {candidate.has_live_resume ? "Live Resume Active" : "No Live Resume"}
                        </span>
                        <span className={isSelected ? "text-indigo-600" : "text-slate-400"}>
                          {isSelected ? "Selected" : "Click to select"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* State 3: Candidates Selected -> Comparison Output & Matrix */
          <div className="space-y-6">
            {/* If comparison not yet executed, show prompt banner */}
            {!comparisonResult && !comparisonLoading && (
              <div className="p-6 bg-indigo-50/70 border border-indigo-200 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-poppins font-black text-sm text-slate-800">
                      {selectedCandidates.length} Candidates Ready for Comparison
                    </h4>
                    <p className="text-xs text-slate-600 font-medium mt-0.5">
                      Click below to analyze verified skills, project evidence, and qualifications.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleRunComparison()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all shrink-0"
                >
                  Run Comparison
                </button>
              </div>
            )}

            {/* AI Agent Executive Summary & Recommendation */}
            {comparisonResult && (
              <div className="p-6 bg-white border border-slate-200/90 rounded-3xl shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                  <Sparkles className="h-5 w-5 text-indigo-600" />
                  <h4 className="font-poppins font-black text-base text-slate-800">
                    Candidate Comparison Agent Analysis
                  </h4>
                </div>

                {comparisonResult.comparison?.summary && (
                  <p className="text-xs text-slate-700 font-medium leading-relaxed bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80">
                    {comparisonResult.comparison.summary}
                  </p>
                )}

                {comparisonResult.comparison?.recommendation?.reason && (
                  <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl space-y-1">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                      Agent Recommendation & Guidance
                    </span>
                    <p className="text-xs text-emerald-950 font-medium leading-relaxed">
                      {comparisonResult.comparison.recommendation.reason}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 font-semibold pt-1">
                  <span>Grounding: 100% Real PostgreSQL Evidence</span>
                  <span>•</span>
                  <span>Missing data is not invented</span>
                  <span>•</span>
                  <span>Protected sensitive attributes excluded</span>
                </div>
              </div>
            )}

            {/* Multi-Column Side-by-Side Comparison Matrix */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm space-y-4 overflow-x-auto">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="font-poppins font-black text-sm text-slate-800">
                  Side-by-Side Candidate Evidence Matrix
                </h4>
                <span className="text-xs text-slate-400 font-semibold">
                  Comparing {selectedCandidates.length} candidate(s)
                </span>
              </div>

              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns: `repeat(${selectedCandidates.length}, minmax(280px, 1fr))`,
                }}
              >
                {selectedCandidates.map((candidate) => {
                  const candidateId = candidate.user_id ?? candidate.id;
                  const skills = getSkillNames(candidate.skills);
                  const completeness = calculateProfileCompleteness(candidate);
                  const strengths = getCandidateStrengths(candidate);
                  const missingInfo = getCandidateMissingInfo(candidate);

                  const topProject =
                    Array.isArray(candidate.projects) && candidate.projects.length > 0
                      ? candidate.projects[0]
                      : null;

                  const latestExp =
                    Array.isArray(candidate.experience) && candidate.experience.length > 0
                      ? candidate.experience[0]
                      : null;

                  const primaryEdu =
                    Array.isArray(candidate.education) && candidate.education.length > 0
                      ? candidate.education[0]
                      : null;

                  return (
                    <div
                      key={candidateId}
                      className="border border-slate-200/90 rounded-2xl p-5 bg-slate-50/40 space-y-5 flex flex-col justify-between"
                    >
                      <div className="space-y-4">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            {candidate.profile_photo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={candidate.profile_photo}
                                alt="Avatar"
                                className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-xs"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-poppins font-black text-sm flex items-center justify-center shadow-xs">
                                {(candidate.full_name || candidate.username || "HV")
                                  .substring(0, 2)
                                  .toUpperCase()}
                              </div>
                            )}
                            <div>
                              <h5 className="font-poppins font-extrabold text-sm text-slate-900">
                                {candidate.full_name || candidate.username}
                              </h5>
                              <p className="text-[11px] text-slate-500 font-medium">
                                ID #{candidateId}
                              </p>
                              <p className="text-[11px] text-slate-400 font-medium">
                                {candidate.city
                                  ? `${candidate.city}${candidate.country ? `, ${candidate.country}` : ""}`
                                  : "Location not provided"}
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={() => toggleCandidateSelection(candidateId!)}
                            className="p-1 rounded-full text-slate-400 hover:text-red-500 cursor-pointer"
                            title="Remove from comparison"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Profile Completeness Gauge */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                            <span>Completeness</span>
                            <span className="text-indigo-600 font-black">
                              {completeness}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-600 rounded-full"
                              style={{ width: `${completeness}%` }}
                            />
                          </div>
                        </div>

                        {/* Channels & Verification Status */}
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Channels & Verification:
                          </span>
                          <div className="flex flex-col gap-1.5 text-xs">
                            {candidate.has_live_resume ? (
                              <button
                                onClick={() => handleOpenLiveResume(candidate)}
                                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-[11px] font-bold flex items-center justify-between cursor-pointer transition-all"
                              >
                                <span className="flex items-center gap-1.5">
                                  <Sparkles className="h-3 w-3 text-emerald-600" />
                                  Live Resume Active
                                </span>
                                <ExternalLink className="h-3 w-3" />
                              </button>
                            ) : (
                              <span className="px-2.5 py-1 text-[11px] font-bold text-slate-400 bg-white border border-slate-200 rounded-xl">
                                Live Resume Not Generated
                              </span>
                            )}

                            {candidate.resume_url ? (
                              <span className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-1.5">
                                <FileText className="h-3 w-3 text-blue-600" />
                                Resume Uploaded
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 text-[11px] font-bold text-slate-400 bg-white border border-slate-200 rounded-xl">
                                No PDF Uploaded
                              </span>
                            )}

                            {candidate.social_profiles?.github ? (
                              <span className="px-2.5 py-1 text-[11px] font-bold text-white bg-slate-900 rounded-xl flex items-center gap-1.5">
                                <FolderGit2 className="h-3 w-3" />
                                GitHub Connected
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 text-[11px] font-bold text-slate-400 bg-white border border-slate-200 rounded-xl">
                                GitHub Not Connected
                              </span>
                            )}

                            {candidate.social_profiles?.linkedin ? (
                              <span className="px-2.5 py-1 text-[11px] font-bold text-white bg-sky-600 rounded-xl flex items-center gap-1.5">
                                LinkedIn Linked
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 text-[11px] font-bold text-slate-400 bg-white border border-slate-200 rounded-xl">
                                LinkedIn Not Linked
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Technical Skills */}
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Verified Skills ({skills.length}):
                          </span>
                          {skills.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {skills.slice(0, 6).map((sk) => (
                                <span
                                  key={sk}
                                  className="px-2 py-0.5 bg-white border border-slate-200 text-slate-800 text-[10px] font-bold rounded-md"
                                >
                                  {sk}
                                </span>
                              ))}
                              {skills.length > 6 && (
                                <span className="text-[10px] font-bold text-indigo-600 self-center">
                                  +{skills.length - 6}
                                </span>
                              )}
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-400 italic">
                              No technical skills verified.
                            </p>
                          )}
                        </div>

                        {/* Strongest Project Evidence */}
                        <div className="space-y-1 pt-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Top Project Proof:
                          </span>
                          {topProject ? (
                            <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-1">
                              <h6 className="font-bold text-xs text-slate-800 line-clamp-1">
                                {topProject.title || topProject.name || "Portfolio Project"}
                              </h6>
                              <p className="text-[10px] text-slate-500 line-clamp-2">
                                {topProject.description || "Project implementation verified on profile."}
                              </p>
                              {topProject.technologies && (
                                <span className="text-[10px] font-bold text-indigo-600 block">
                                  Stack: {Array.isArray(topProject.technologies) ? topProject.technologies.join(", ") : String(topProject.technologies)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-400 italic">
                              No projects documented.
                            </p>
                          )}
                        </div>

                        {/* Work Experience */}
                        <div className="space-y-1 pt-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Work Experience:
                          </span>
                          {latestExp ? (
                            <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-0.5">
                              <h6 className="font-bold text-xs text-slate-800 line-clamp-1">
                                {latestExp.role || latestExp.title || "Role"}{" "}
                                {latestExp.company ? `@ ${latestExp.company}` : ""}
                              </h6>
                              {latestExp.joining_date && (
                                <p className="text-[10px] text-slate-400 font-semibold">
                                  {latestExp.joining_date} - {latestExp.ending_date || "Present"}
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-400 italic">
                              Experience information is not available.
                            </p>
                          )}
                        </div>

                        {/* Education */}
                        <div className="space-y-1 pt-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Education:
                          </span>
                          {primaryEdu ? (
                            <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-[11px]">
                              <span className="font-bold text-slate-800 block">
                                {primaryEdu.degree}
                              </span>
                              {primaryEdu.college_name && (
                                <span className="text-slate-500 text-[10px] block">
                                  {primaryEdu.college_name}
                                </span>
                              )}
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-400 italic">
                              No formal education listed.
                            </p>
                          )}
                        </div>

                        {/* Strengths */}
                        <div className="space-y-1 pt-1">
                          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                            Key Strengths:
                          </span>
                          <ul className="space-y-1 text-[11px] text-slate-700">
                            {strengths.map((str, idx) => (
                              <li key={idx} className="flex items-start gap-1">
                                <span className="text-emerald-600 font-black">•</span>
                                <span>{str}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Important Missing Data */}
                        <div className="space-y-1 pt-1">
                          <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                            Missing Information:
                          </span>
                          {missingInfo.length > 0 ? (
                            <ul className="space-y-0.5 text-[10px] text-slate-600">
                              {missingInfo.slice(0, 3).map((mis, idx) => (
                                <li key={idx} className="flex items-start gap-1">
                                  <span className="text-amber-600 font-black">•</span>
                                  <span>{mis}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-[10px] text-emerald-700 font-semibold">
                              All primary fields populated.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="pt-3 border-t border-slate-200 flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            onClick={() => {
                              setProfileModalCandidate(candidate);
                              setIsProfileModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex-1"
                          >
                            View Profile
                          </button>

                          {candidateId && (
                            <button
                              onClick={() => handleOpenLiveResume(candidate)}
                              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 flex-1"
                            >
                              <Sparkles className="h-3 w-3" /> Live Resume
                            </button>
                          )}
                        </div>

                        {candidateId && (
                          <button
                            onClick={() => handleShortlistCandidate(candidateId)}
                            className="w-full px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                          >
                            <Check className="h-3.5 w-3.5" /> Shortlist Candidate
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pairwise Comparison Insights */}
            {comparisonResult?.analysis?.pairwiseComparisons &&
              comparisonResult.analysis.pairwiseComparisons.length > 0 && (
                <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <Scale className="h-4 w-4 text-indigo-600" />
                    <h4 className="font-poppins font-black text-sm text-slate-800">
                      Pairwise Overlap & Differentiators
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {comparisonResult.analysis.pairwiseComparisons.map(
                      (pair: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between font-bold text-slate-800 pb-1 border-b border-slate-200/60">
                            <span>
                              {pair.candidateA?.name || "Candidate A"} vs{" "}
                              {pair.candidateB?.name || "Candidate B"}
                            </span>
                            <span className="text-indigo-600 font-black">
                              {pair.skillOverlap?.shared?.length || 0} Shared Skills
                            </span>
                          </div>

                          {pair.skillOverlap?.shared?.length > 0 && (
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase">
                                Shared Skills:
                              </span>
                              <p className="text-[11px] text-slate-700 font-semibold mt-0.5">
                                {pair.skillOverlap.shared.join(", ")}
                              </p>
                            </div>
                          )}

                          {pair.skillOverlap?.uniqueToA?.length > 0 && (
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase">
                                Unique to {pair.candidateA?.name || "Candidate A"}:
                              </span>
                              <p className="text-[11px] text-slate-700 font-semibold mt-0.5">
                                {pair.skillOverlap.uniqueToA.join(", ")}
                              </p>
                            </div>
                          )}

                          {pair.skillOverlap?.uniqueToB?.length > 0 && (
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase">
                                Unique to {pair.candidateB?.name || "Candidate B"}:
                              </span>
                              <p className="text-[11px] text-slate-700 font-semibold mt-0.5">
                                {pair.skillOverlap.uniqueToB.join(", ")}
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
          </div>
        )}
      </div>
    );
  };

  // -------------------------------------------------------------
  // TAB 4: AI SCREENINGS
  // -------------------------------------------------------------
  const renderScreeningsTab = () => {
    const filteredMatches = uniqueMatches.filter((match) => {
      const matchStatus = normalizeStatus(match.status);
      const matchesStatus =
        filterStatus === "All" || matchStatus === filterStatus;
      const matchesJob =
        filterJobId === "All" || String(match.job_id) === filterJobId;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (match.full_name || match.username || "")
          .toLowerCase()
          .includes(q) ||
        (match.job_title || "").toLowerCase().includes(q);

      return matchesStatus && matchesJob && matchesSearch;
    });

    return (
      <div className="space-y-6">
        {/* Screening Filter Controls */}
        <div className="premium-card p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search candidate name or job..."
                className="pl-9 pr-3 py-2 w-full bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <select
              value={filterJobId}
              onChange={(e) => setFilterJobId(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="All">All Jobs ({dbJobs.length})</option>
              {dbJobs.map((j) => (
                <option key={j.id} value={String(j.id)}>
                  {j.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
            {[
              "All",
              "Awaiting Review",
              "Shortlisted",
              "Scheduled",
              "Rejected",
            ].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                  filterStatus === st
                    ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/80"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Screening Table */}
        <div className="premium-card bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-semibold text-slate-600">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-5 py-4">Candidate</th>
                  <th className="px-5 py-4">Applied Job</th>
                  <th className="px-5 py-4">Match Score</th>
                  <th className="px-5 py-4">Evidence Level</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMatches.map((match) => {
                  const score = normalizeNumber(match.match_score);
                  const status = normalizeStatus(match.status);
                  const isEvaluating = actionLoading === `eval-${match.id}`;
                  const isUpdating = actionLoading === `status-${match.id}`;

                  return (
                    <tr
                      key={match.id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-5 py-4 font-bold text-slate-800">
                        {match.full_name || match.username || "Candidate"}
                      </td>
                      <td className="px-5 py-4 text-slate-700 font-medium">
                        {match.job_title || "General Application"}
                      </td>
                      <td className="px-5 py-4">
                        {score !== null ? (
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-poppins font-black text-sm px-2.5 py-0.5 rounded-lg ${
                                score >= 80
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                  : score >= 60
                                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200/60"
                                  : "bg-amber-50 text-amber-700 border border-amber-200/60"
                              }`}
                            >
                              {score}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium italic">
                            Not analyzed yet
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {score !== null ? (
                          <span className="px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200/60 text-[10px] font-bold rounded-full uppercase tracking-wider">
                            AI Verified
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-slate-50 text-slate-500 border border-slate-200/60 text-[10px] font-bold rounded-full uppercase tracking-wider">
                            Pending Screening
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">{getStatusBadge(status)}</td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleEvaluateSingleMatch(match)}
                            disabled={isEvaluating}
                            className="px-2.5 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-[10px] font-bold shadow-sm cursor-pointer transition-all flex items-center gap-1 disabled:opacity-50"
                          >
                            {isEvaluating ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Sparkles className="h-3 w-3" />
                            )}
                            {score !== null ? "Inspect AI" : "Run AI"}
                          </button>

                          {status === "Awaiting Review" && (
                            <>
                              <button
                                onClick={() =>
                                  handleUpdateMatchStatus(
                                    match.id,
                                    "Shortlisted"
                                  )
                                }
                                disabled={isUpdating}
                                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60 rounded-xl text-[10px] font-bold cursor-pointer"
                              >
                                Shortlist
                              </button>
                              <button
                                onClick={() =>
                                  handleUpdateMatchStatus(match.id, "Rejected")
                                }
                                disabled={isUpdating}
                                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/60 rounded-xl text-[10px] font-bold cursor-pointer"
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {status === "Shortlisted" && (
                            <button
                              onClick={() =>
                                handleUpdateMatchStatus(match.id, "Scheduled")
                              }
                              disabled={isUpdating}
                              className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/60 rounded-xl text-[10px] font-bold cursor-pointer flex items-center gap-1"
                            >
                              <Calendar className="h-3 w-3" /> Schedule
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {dbMatches.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-center py-12 text-slate-400 font-semibold"
                    >
                      No screening results available.
                    </td>
                  </tr>
                ) : filteredMatches.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-center py-12 text-slate-400 font-semibold"
                    >
                      No screening results available.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // TAB 5: HIRING PIPELINE (KANBAN)
  // -------------------------------------------------------------
  const renderPipelineTab = () => {
    const columns = [
      {
        id: "Awaiting Review",
        title: "Applied / Review",
        matches: uniqueMatches.filter(
          (m) => normalizeStatus(m.status) === "Awaiting Review"
        ),
        color: "border-slate-300 bg-slate-50/50",
      },
      {
        id: "Shortlisted",
        title: "Shortlisted",
        matches: uniqueMatches.filter(
          (m) => normalizeStatus(m.status) === "Shortlisted"
        ),
        color: "border-emerald-300 bg-emerald-50/30",
      },
      {
        id: "Scheduled",
        title: "Interview Scheduled",
        matches: uniqueMatches.filter((m) =>
          ["Scheduled", "Interview"].includes(normalizeStatus(m.status))
        ),
        color: "border-purple-300 bg-purple-50/30",
      },
      {
        id: "Hired",
        title: "Hired",
        matches: uniqueMatches.filter(
          (m) => normalizeStatus(m.status) === "Hired"
        ),
        color: "border-blue-300 bg-blue-50/30",
      },
      {
        id: "Rejected",
        title: "Rejected",
        matches: uniqueMatches.filter(
          (m) => normalizeStatus(m.status) === "Rejected"
        ),
        color: "border-rose-300 bg-rose-50/30",
      },
    ];

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-poppins font-black text-lg text-slate-800">
              Interactive Hiring Pipeline
            </h3>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Live progression of candidate matches across pipeline stages.
            </p>
          </div>
          <button
            onClick={() => loadDashboardData()}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh Board
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-5 items-start">
          {columns.map((col) => (
            <div
              key={col.id}
              className={`rounded-2xl border ${col.color} p-4 space-y-3 bg-white/70 min-h-[400px] shadow-sm`}
            >
              <div className="flex items-center justify-between border-b border-slate-150 pb-2.5">
                <h4 className="font-poppins font-bold text-xs text-slate-800 uppercase tracking-tight">
                  {col.title}
                </h4>
                <span className="px-2 py-0.5 bg-white border border-slate-200 text-slate-700 text-[10px] font-black rounded-full">
                  {col.matches.length}
                </span>
              </div>

              <div className="space-y-3">
                {col.matches.map((match) => {
                  const score = normalizeNumber(match.match_score);
                  return (
                    <div
                      key={match.id}
                      className="p-3.5 bg-white border border-slate-200/80 rounded-xl shadow-xs hover:border-purple-200 transition-all space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h5 className="font-poppins font-extrabold text-xs text-slate-800">
                          {match.full_name || match.username || "Candidate"}
                        </h5>
                        {score !== null ? (
                          <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                            {score}%
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-400 font-bold">
                            Unscored
                          </span>
                        )}
                      </div>

                      <p className="text-[10px] text-slate-500 font-semibold truncate">
                        {match.job_title || "Application"}
                      </p>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                        <button
                          onClick={() => handleEvaluateSingleMatch(match)}
                          className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-0.5"
                        >
                          <Sparkles className="h-3 w-3" /> Report
                        </button>

                        {col.id === "Awaiting Review" && (
                          <button
                            onClick={() =>
                              handleUpdateMatchStatus(match.id, "Shortlisted")
                            }
                            className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-bold rounded border border-emerald-200/60"
                          >
                            Advance →
                          </button>
                        )}

                        {col.id === "Shortlisted" && (
                          <button
                            onClick={() =>
                              handleUpdateMatchStatus(match.id, "Scheduled")
                            }
                            className="px-2 py-0.5 bg-purple-50 text-purple-700 text-[9px] font-bold rounded border border-purple-200/60"
                          >
                            Schedule →
                          </button>
                        )}

                        {col.id === "Scheduled" && (
                          <button
                            onClick={() =>
                              handleUpdateMatchStatus(match.id, "Hired")
                            }
                            className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[9px] font-bold rounded border border-blue-200/60"
                          >
                            Hire →
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {col.matches.length === 0 && (
                  <p className="text-center py-8 text-[11px] text-slate-400 font-medium italic">
                    No candidates
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // TAB 6: SETTINGS
  // -------------------------------------------------------------
  const renderSettingsTab = () => {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h3 className="font-poppins font-black text-lg text-slate-800">
            Recruiter Profile & Company Settings
          </h3>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">
            Update your organization branding and recruitment parameters.
          </p>
        </div>

        <div className="premium-card p-6 md:p-8 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-6">
          <form onSubmit={handleSaveSettings} className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Company / Organization Name *
              </label>
              <input
                type="text"
                value={recruiterSettings.company_name}
                onChange={(e) =>
                  setRecruiterSettings((prev) => ({
                    ...prev,
                    company_name: e.target.value,
                  }))
                }
                placeholder="e.g. Acme Technologies Inc."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Industry Sector
              </label>
              <input
                type="text"
                value={recruiterSettings.industry}
                onChange={(e) =>
                  setRecruiterSettings((prev) => ({
                    ...prev,
                    industry: e.target.value,
                  }))
                }
                placeholder="e.g. Artificial Intelligence, FinTech, SaaS"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={actionLoading === "settings"}
              className="px-6 py-3 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 cursor-pointer transition-all flex items-center gap-2 disabled:opacity-60"
            >
              {actionLoading === "settings" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving Changes...
                </>
              ) : (
                <>
                  <Building2 className="h-4 w-4" /> Save Profile Settings
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {renderToastMessage()}

      {activeTab === "overview" && renderOverviewTab()}
      {activeTab === "jobs" && renderJobsTab()}
      {activeTab === "candidates" && renderCandidatesTab()}
      {(activeTab === "comparison" || activeTab === "pool") && renderComparisonTab()}
      {activeTab === "screenings" && renderScreeningsTab()}
      {activeTab === "pipeline" && renderPipelineTab()}
      {activeTab === "settings" && renderSettingsTab()}

      {/* Edit Job Modal */}
      <AnimatePresence>
        {isEditJobModalOpen && editingJob && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-6 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white font-poppins font-black text-sm border border-white/20">
                    <Pencil className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-poppins font-extrabold text-base">
                      Edit Job Posting
                    </h3>
                    <p className="text-xs text-white/80 font-medium mt-0.5">
                      Modify job details, must-have criteria, and posting status.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsEditJobModalOpen(false);
                    setEditingJob(null);
                  }}
                  className="p-1.5 rounded-full hover:bg-white/20 text-white transition-all cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSaveEditJob} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700 flex-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Job Title *
                    </label>
                    <input
                      type="text"
                      value={editJobTitle}
                      onChange={(e) => setEditJobTitle(e.target.value)}
                      placeholder="e.g. Senior Full Stack Engineer"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Posting Status
                      </label>
                      <select
                        value={editJobStatus}
                        onChange={(e) => setEditJobStatus(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      >
                        <option value="Active">Active</option>
                        <option value="Closed">Closed</option>
                        <option value="Draft">Draft</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Job Description
                    </label>
                    <textarea
                      rows={4}
                      value={editJobDesc}
                      onChange={(e) => setEditJobDesc(e.target.value)}
                      placeholder="Detailed overview of job responsibilities and goals..."
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Must-Have Skills (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={editJobMustHave}
                      onChange={(e) => setEditJobMustHave(e.target.value)}
                      placeholder="e.g. Node.js, React, PostgreSQL, System Design"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      AI agent uses these strictly to evaluate required technical competencies.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Preferred Skills (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={editJobPreferred}
                      onChange={(e) => setEditJobPreferred(e.target.value)}
                      placeholder="e.g. Docker, AWS, Redis, GraphQL"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditJobModalOpen(false);
                      setEditingJob(null);
                    }}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading === `edit-job-${editingJob.id}`}
                    className="px-5 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 hover:from-violet-700 hover:to-indigo-700 cursor-pointer flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    {actionLoading === `edit-job-${editingJob.id}` ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Detailed Breakdown Modal */}
      <AnimatePresence>
        {isModalOpen && modalMatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 text-white flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    <h3 className="font-poppins font-extrabold text-base">
                      Candidate AI Match Intelligence
                    </h3>
                  </div>
                  <p className="text-xs text-white/80 font-medium mt-0.5">
                    {modalMatch.full_name || modalMatch.username} •{" "}
                    {modalMatch.job_title}
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-full hover:bg-white/20 text-white transition-all cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6">
                {/* Score & Level Display */}
                <div className="p-5 bg-gradient-to-br from-indigo-50/60 to-purple-50/40 rounded-2xl border border-indigo-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
                      Overall Match Score
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <h4 className="font-poppins font-black text-3xl text-indigo-700">
                        {modalAnalysis?.score ??
                          normalizeNumber(modalMatch.match_score) ??
                          0}
                        %
                      </h4>
                      <span className="text-xs font-bold text-slate-600">
                        {modalAnalysis?.level || "Evaluated Candidate"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      AI Confidence
                    </span>
                    <span className="text-sm font-black text-slate-700">
                      {modalAnalysis?.confidence !== null && modalAnalysis?.confidence !== undefined
                        ? `${Math.round(Number(modalAnalysis.confidence) * 100)}%`
                        : "Unavailable"}
                    </span>
                  </div>
                </div>

                {/* Strong Matches */}
                {modalAnalysis?.strongMatches &&
                  modalAnalysis.strongMatches.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        Strong Verified Matches
                      </h5>
                      <div className="flex flex-wrap gap-1.5">
                        {modalAnalysis.strongMatches.map((m) => (
                          <span
                            key={m}
                            className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-xs font-bold rounded-lg"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Partial Matches */}
                {modalAnalysis?.partialMatches &&
                  modalAnalysis.partialMatches.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                        Partial Competencies
                      </h5>
                      <div className="flex flex-wrap gap-1.5">
                        {modalAnalysis.partialMatches.map((m) => (
                          <span
                            key={m}
                            className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200/60 text-xs font-bold rounded-lg"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Missing Skills */}
                {modalAnalysis?.missing &&
                  modalAnalysis.missing.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                        <X className="h-3.5 w-3.5 text-rose-600" />
                        Gaps / Missing Requirements
                      </h5>
                      <div className="flex flex-wrap gap-1.5">
                        {modalAnalysis.missing.map((m) => (
                          <span
                            key={m}
                            className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200/60 text-xs font-bold rounded-lg"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Recommendations */}
                {modalAnalysis?.recommendations &&
                  modalAnalysis.recommendations.length > 0 && (
                    <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
                      <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Recruiter Interview Focus Points
                      </h5>
                      <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4 font-medium">
                        {modalAnalysis.recommendations.map((rec, i) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Close
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      handleUpdateMatchStatus(modalMatch.id, "Shortlisted");
                      setIsModalOpen(false);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Shortlist Candidate
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Candidate Verified Profile Modal */}
      <AnimatePresence>
        {isProfileModalOpen && profileModalCandidate && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col"
            >
              {/* Header */}
              <div className="p-6 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {profileModalCandidate.profile_photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profileModalCandidate.profile_photo}
                      alt="Avatar"
                      className="w-14 h-14 rounded-2xl object-cover border-2 border-white/20 shadow"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md text-white font-poppins font-black text-xl flex items-center justify-center border border-white/20">
                      {(profileModalCandidate.full_name || profileModalCandidate.username || "HV")
                        .substring(0, 2)
                        .toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="font-poppins font-extrabold text-lg">
                      {profileModalCandidate.full_name || profileModalCandidate.username || "Candidate Profile"}
                    </h3>
                    <p className="text-xs text-white/80 font-medium">
                      Registered HireVision Candidate • {profileModalCandidate.city || "Location not provided"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsProfileModalOpen(false)}
                  className="p-1.5 rounded-full hover:bg-white/20 text-white transition-all cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
                {/* Contact Information */}
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <span>{profileModalCandidate.email || "Email unavailable"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-slate-400" />
                    <span>{profileModalCandidate.phone || "Phone not provided"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    <span>
                      {profileModalCandidate.city
                        ? `${profileModalCandidate.city}${profileModalCandidate.country ? `, ${profileModalCandidate.country}` : ""}`
                        : "Location not provided"}
                    </span>
                  </div>
                </div>

                {/* Professional Objective */}
                <div className="space-y-1.5">
                  <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Professional Summary
                  </h5>
                  <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl leading-relaxed italic">
                    {profileModalCandidate.career_objective || "No summary provided by candidate yet."}
                  </p>
                </div>

                {/* Skills */}
                <div className="space-y-2">
                  <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Verified Technical Skills
                  </h5>
                  <div className="flex flex-wrap gap-1.5">
                    {getSkillNames(profileModalCandidate.skills).length > 0 ? (
                      getSkillNames(profileModalCandidate.skills).map((sk) => (
                        <span
                          key={sk}
                          className="px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-100 font-bold rounded-lg"
                        >
                          {sk}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 italic">No skills documented yet</span>
                    )}
                  </div>
                </div>

                {/* Projects */}
                <div className="space-y-2">
                  <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FolderGit2 className="h-3.5 w-3.5 text-indigo-600" />
                    Key Projects ({profileModalCandidate.projects?.length || 0})
                  </h5>
                  {Array.isArray(profileModalCandidate.projects) && profileModalCandidate.projects.length > 0 ? (
                    <div className="space-y-2">
                      {profileModalCandidate.projects.map((p: any, idx: number) => (
                        <div key={idx} className="p-3 border border-slate-200 rounded-xl bg-slate-50/50 space-y-1">
                          <div className="flex items-center justify-between font-bold text-slate-800">
                            <span>{p.title || p.name || `Project #${idx + 1}`}</span>
                            <div className="flex items-center gap-2">
                              {p.github_link && (
                                <a
                                  href={p.github_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-indigo-600 hover:underline flex items-center gap-0.5 text-[10px]"
                                >
                                  GitHub <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              )}
                              {p.live_link && (
                                <a
                                  href={p.live_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-600 hover:underline flex items-center gap-0.5 text-[10px]"
                                >
                                  Demo <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              )}
                            </div>
                          </div>
                          {p.description && <p className="text-slate-600 text-[11px]">{p.description}</p>}
                          {p.technologies && (
                            <p className="text-[10px] text-slate-400 font-semibold">
                              Stack: {Array.isArray(p.technologies) ? p.technologies.join(", ") : p.technologies}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 italic">No projects added yet.</p>
                  )}
                </div>

                {/* Experience */}
                <div className="space-y-2">
                  <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5 text-violet-600" />
                    Work Experience & Internships
                  </h5>
                  {Array.isArray(profileModalCandidate.experience) && profileModalCandidate.experience.length > 0 ? (
                    <div className="space-y-2">
                      {profileModalCandidate.experience.map((exp: any, idx: number) => (
                        <div key={idx} className="p-3 border border-slate-200 rounded-xl bg-slate-50/50 space-y-0.5">
                          <h6 className="font-bold text-slate-800">
                            {exp.role || exp.title} {exp.company ? `@ ${exp.company}` : ""}
                          </h6>
                          {exp.joining_date && (
                            <p className="text-[10px] text-slate-400">
                              {exp.joining_date} - {exp.ending_date || "Present"}
                            </p>
                          )}
                          {exp.description && <p className="text-slate-600 text-[11px] mt-1">{exp.description}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 italic">No professional experience listed.</p>
                  )}
                </div>

                {/* Education */}
                <div className="space-y-2">
                  <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <GraduationCap className="h-3.5 w-3.5 text-blue-600" />
                    Education
                  </h5>
                  {Array.isArray(profileModalCandidate.education) && profileModalCandidate.education.length > 0 ? (
                    <div className="space-y-2">
                      {profileModalCandidate.education.map((edu: any, idx: number) => (
                        <div key={idx} className="p-3 border border-slate-200 rounded-xl bg-slate-50/50">
                          <span className="font-bold text-slate-800">{edu.degree}</span>
                          {edu.college_name && (
                            <span className="text-slate-500"> • {edu.college_name}</span>
                          )}
                          {edu.college_passing_year && (
                            <span className="text-slate-400 text-[10px] block mt-0.5">
                              Class of {edu.college_passing_year}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 italic">No formal education listed.</p>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => setIsProfileModalOpen(false)}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Close
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const cid = profileModalCandidate.user_id || profileModalCandidate.id;
                      if (cid) handleShortlistCandidate(cid);
                    }}
                    className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Shortlist Candidate
                  </button>
                  {profileModalCandidate.user_id || profileModalCandidate.id ? (
                    <button
                      onClick={() => {
                        setIsProfileModalOpen(false);
                        handleOpenLiveResume(profileModalCandidate);
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm hover:from-violet-700 hover:to-indigo-700 cursor-pointer"
                    >
                      Open Live Resume
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. Candidate Real Live Resume Modal (Single Source of Truth) */}
      <AnimatePresence>
        {isLiveResumeModalOpen && liveResumeModalCandidate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
            >
              {/* Header */}
              <div className="p-6 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white font-poppins font-black text-sm border border-white/20">
                    {(liveResumeModalCandidate.full_name || liveResumeModalCandidate.username || "HV")
                      .substring(0, 2)
                      .toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <h3 className="font-poppins font-extrabold text-base">
                        Candidate Live Resume
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white uppercase tracking-wider">
                        Read-Only Recruiter View
                      </span>
                    </div>
                    <p className="text-xs text-white/80 font-medium mt-0.5">
                      {liveResumeModalCandidate.full_name || liveResumeModalCandidate.username} • User ID #{liveResumeModalCandidate.user_id || liveResumeModalCandidate.id}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsLiveResumeModalOpen(false)}
                  className="p-1.5 rounded-full hover:bg-white/20 text-white transition-all cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-4 flex-1 text-slate-700 text-xs">
                {liveResumeLoading ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                    <span className="font-poppins font-bold text-xs">
                      Fetching candidate's verified Live Resume from database...
                    </span>
                  </div>
                ) : liveResumeError || !liveResumeData?.hasLiveResume ? (
                  <div className="py-16 px-6 text-center space-y-3 bg-amber-50/50 rounded-2xl border border-amber-200/70">
                    <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
                      <AlertCircle className="h-6 w-6" />
                    </div>
                    <h4 className="font-poppins font-black text-base text-slate-800">
                      Live Resume is not available.
                    </h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed font-medium">
                      This candidate has not created or published a Live Resume on their candidate dashboard. In accordance with real-data integrity rules, no placeholder or artificial resume is generated.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Exact Candidate Live Resume Renderer (Candidate-Side Component View) */}
                    <div className="w-full rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-inner">
                      <iframe
                        src={`/resume/share/${liveResumeModalCandidate.user_id || liveResumeModalCandidate.id}`}
                        className="w-full h-[650px] border-0"
                        title={`${liveResumeModalCandidate.full_name || liveResumeModalCandidate.username || "Candidate"} Live Resume`}
                      />
                    </div>

                    {/* Stored Markdown Preview (Collapsible) */}
                    <details className="group border border-slate-200 rounded-2xl p-4 bg-slate-50/50 text-xs">
                      <summary className="font-bold text-slate-700 cursor-pointer flex items-center justify-between select-none">
                        <span>View Raw Stored Resume Markdown (Database Single Source of Truth)</span>
                        <ChevronRight className="h-4 w-4 text-slate-400 group-open:rotate-90 transition-transform" />
                      </summary>
                      <div className="mt-3 p-4 bg-white border border-slate-200 rounded-xl font-mono text-xs text-slate-800 leading-relaxed whitespace-pre-wrap select-text max-h-60 overflow-y-auto">
                        {liveResumeData.liveResume?.content || "No resume markdown stored."}
                      </div>
                    </details>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => setIsLiveResumeModalOpen(false)}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Close
                </button>
                {liveResumeData?.hasLiveResume && (
                  <a
                    href={`/resume/share/${liveResumeModalCandidate.user_id || liveResumeModalCandidate.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm hover:from-violet-700 hover:to-indigo-700 cursor-pointer"
                  >
                    Open Public Share View
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function RecruiterDashboard() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      }
    >
      <RecruiterDashboardContent />
    </Suspense>
  );
}