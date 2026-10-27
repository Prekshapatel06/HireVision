"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Sparkles,
  Cpu,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Zap,
  ArrowRight,
  Plus,
  X,
  Upload,
  CheckSquare,
  Square,
  FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Profile } from "@/types/profile";

function Github({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

function Linkedin({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" rx="1" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function getSkillString(item: unknown): string {
  if (!item) {
    return "";
  }

  if (typeof item === "string") {
    return item.trim();
  }

  if (typeof item === "number") {
    return String(item);
  }

  if (typeof item === "object") {
    const value = item as Record<string, unknown>;

    return String(
      value.skill ??
        value.name ??
        value.title ??
        value.skill_name ??
        value.skillName ??
        value.technology ??
        ""
    ).trim();
  }

  return String(item).trim();
}

interface AICareerInsightsProps {
  profile: Profile;
  onRefreshProfile: () => void;
}

interface CareerItem {
  role_name?: string;
  roleName?: string;
  match_score?: number;
  matchScore?: number;
  explanation?: string;
}

interface SkillItem {
  skill_name?: string;
  skillName?: string;
  proficiency_score?: number;
  proficiencyScore?: number;
  level?: string;
  evidence?: string[];
}

interface ProjectItem {
  project_title?: string;
  projectTitle?: string;
  quality_score?: number;
  qualityScore?: number;
  technical_depth?: number;
  technicalDepth?: number;
  career_relevance?: number;
  careerRelevance?: number;
  description_quality?: number;
  descriptionQuality?: number;
  status?: string;
  suggestions?: string[];
}

interface GapData {
  strong_skills?: unknown[];
  strongSkills?: unknown[];
  missing_skills?: unknown[];
  missingSkills?: unknown[];
  priority_learning_order?: unknown[];
  priorityLearningOrder?: unknown[];
}

interface ResumeProjectSuggestion {
  title?: string;
  improved_description?: string;
  improvedDescription?: string;
}

interface ResumeSuggestions {
  about_me?: string;
  aboutMe?: string;
  projects?: ResumeProjectSuggestion[];
}

interface AnalysisData {
  readiness?: {
    readiness_score?: number;
    readinessScore?: number;
    profile_quality?: number;
    profileQuality?: number;
    skill_strength?: number;
    skillStrength?: number;
    project_strength?: number;
    projectStrength?: number;
    resume_quality?: number;
    resumeQuality?: number;
  };
  profile?: {
    profile_score?: number;
    profileScore?: number;
    strengths?: string[];
  };
  skills?: SkillItem[];
  projects?: ProjectItem[];
  career?: CareerItem[];
}

interface ApiEnvelope {
  result?: unknown;
  data?: unknown;
  analysis?: unknown;
  readiness?: unknown;
  profile?: unknown;
  skills?: unknown;
  projects?: unknown;
  career?: unknown;
  agentResults?: unknown;
  agent_results?: unknown;
  agents?: unknown;
  message?: string;
  error?: string;
  detail?:
    | string
    | Array<{
        msg?: string;
      }>;
  status?: string;
  code?: string;
  authorizationUrl?: string;
  pendingImports?: unknown;
  pending_items?: unknown;
  pending_imports?: unknown;
  items?: unknown;
}

interface PendingImport {
  id?: number | string;
  source?: string;
  item_type?: string;
  itemType?: string;
  title?: string;
  description?: string;
  external_id?: string;
  externalId?: string;
  metadata?: {
    technologies?: string | string[];
    issuer?: string;
    issue_date?: string;
    issueDate?: string;
    relevance_score?: number;
    relevanceScore?: number;
    company?: string;
    institution?: string;
    degree?: string;
    start_date?: string;
    end_date?: string;
    skills?: string[];
    [key: string]: unknown;
  };
}

import { normalizeApiUrl } from "@/lib/api";

const API_BASE_URL = normalizeApiUrl();

const clampScore = (value: unknown): number => {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const score = Number(value);

  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.min(100, Math.max(0, score));
};

const normalizeToken = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }

  let token = value.trim();

  if (!token) {
    return "";
  }

  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    token = token.slice(1, -1).trim();
  }

  if (token.toLowerCase().startsWith("bearer ")) {
    token = token.slice(7).trim();
  }

  return token;
};

const getToken = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const keys = ["token", "hirevision_token"];

  for (const key of keys) {
    const sessionValue = normalizeToken(
      sessionStorage.getItem(key)
    );

    if (sessionValue) {
      return sessionValue;
    }
  }

  for (const key of keys) {
    const localValue = normalizeToken(
      localStorage.getItem(key)
    );

    if (localValue) {
      return localValue;
    }
  }

  return null;
};

const waitForAuthToken = async (
  attempts = 10,
  delay = 250
): Promise<string | null> => {
  const immediateToken = getToken();

  if (immediateToken) {
    return immediateToken;
  }

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, delay);
    });

    const token = getToken();

    if (token) {
      return token;
    }
  }

  return null;
};

const buildHeaders = (token: string): HeadersInit => ({
  Accept: "application/json",
  Authorization: `Bearer ${normalizeToken(token)}`,
  "Content-Type": "application/json",
});

const parseJsonResponse = async (
  response: Response
): Promise<ApiEnvelope | null> => {
  const contentType =
    response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    return null;
  }

  try {
    return (await response.json()) as ApiEnvelope;
  } catch {
    return null;
  }
};

const isObject = (
  value: unknown
): value is Record<string, unknown> => {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
};

const hasAnalysisShape = (
  value: unknown
): value is Record<string, unknown> => {
  if (!isObject(value)) {
    return false;
  }

  return Boolean(
    "readiness" in value ||
      "profile" in value ||
      "skills" in value ||
      "projects" in value ||
      "career" in value ||
      "readinessScore" in value ||
      "profileScore" in value
  );
};

const collectAnalysisCandidates = (
  value: unknown,
  depth = 0
): unknown[] => {
  if (depth > 5 || value === null || value === undefined) {
    return [];
  }

  const candidates: unknown[] = [value];

  if (Array.isArray(value)) {
    for (const item of value) {
      candidates.push(
        ...collectAnalysisCandidates(item, depth + 1)
      );
    }

    return candidates;
  }

  if (isObject(value)) {
    const keys = [
      "result",
      "data",
      "analysis",
      "output",
      "response",
      "value",
      "agentResults",
      "agent_results",
    ];

    for (const key of keys) {
      if (key in value) {
        candidates.push(
          ...collectAnalysisCandidates(
            value[key],
            depth + 1
          )
        );
      }
    }

    for (const key of [
      "readiness",
      "profile",
      "skills",
      "projects",
      "career",
    ]) {
      if (key in value) {
        candidates.push(value);
        break;
      }
    }
  }

  return candidates;
};

const extractPendingImportsFromPayload = (
  payload: unknown
): PendingImport[] => {
  const candidates = collectAnalysisCandidates(payload);

  const normalizeList = (value: unknown): PendingImport[] => {
    if (Array.isArray(value)) {
      return value.filter(isObject) as PendingImport[];
    }

    if (isObject(value)) {
      const grouped = [
        value.projects,
        value.skills,
        value.bio,
        value.experience,
        value.education,
        value.certifications,
      ];

      return grouped
        .filter(Array.isArray)
        .flat()
        .filter(isObject) as PendingImport[];
    }

    return [];
  };

  for (const candidate of candidates) {
    if (!isObject(candidate)) {
      continue;
    }

    for (const key of [
      "items",
      "pendingImports",
      "pending_items",
      "pending_imports",
    ]) {
      if (key in candidate) {
        const items = normalizeList(candidate[key]);

        if (items.length > 0) {
          return items.filter(
            (item) =>
              !item ||
              !("status" in item) ||
              String((item as Record<string, unknown>).status || "PENDING")
                .toUpperCase() === "PENDING"
          );
        }
      }
    }
  }

  if (Array.isArray(payload)) {
    return normalizeList(payload);
  }

  return [];
};

const extractAuthorizationUrl = (payload: unknown): string => {
  if (!isObject(payload)) {
    return "";
  }

  const direct = payload.authorizationUrl;

  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }

  for (const key of ["result", "data"]) {
    const nested = payload[key];
    if (isObject(nested)) {
      const url = nested.authorizationUrl;
      if (typeof url === "string" && url.trim()) {
        return url.trim();
      }
    }
  }

  return "";
};

const extractAnalysisData = (
  payload: ApiEnvelope | null
): AnalysisData | null => {
  if (!payload) {
    return null;
  }

  const candidates = collectAnalysisCandidates(payload);

  for (const candidate of candidates) {
    if (hasAnalysisShape(candidate)) {
      return candidate as AnalysisData;
    }
  }

  return null;
};

const getBackendError = (
  payload: ApiEnvelope | null,
  fallback: string
): string => {
  if (
    typeof payload?.message === "string" &&
    payload.message.trim()
  ) {
    return payload.message.trim();
  }

  if (
    typeof payload?.error === "string" &&
    payload.error.trim()
  ) {
    return payload.error.trim();
  }

  if (
    typeof payload?.detail === "string" &&
    payload.detail.trim()
  ) {
    return payload.detail.trim();
  }

  if (Array.isArray(payload?.detail)) {
    const messages = payload.detail
      .map((item) => item?.msg?.trim())
      .filter(Boolean);

    if (messages.length > 0) {
      return messages.join(", ");
    }
  }

  return fallback;
};

const getProfileTargetRole = (
  profile: Profile
): string => {
  if (!profile || typeof profile !== "object") {
    return "";
  }

  const value =
    profile as unknown as Record<string, unknown>;

  return String(
    value.target_role ??
      value.targetRole ??
      ""
  ).trim();
};

const getCareerRoleName = (
  item: CareerItem
): string => {
  return String(
    item.role_name ??
      item.roleName ??
      ""
  ).trim();
};

const getCareerMatchScore = (
  item: CareerItem
): number | undefined => {
  const value =
    item.match_score ??
    item.matchScore;

  if (
    value === undefined ||
    value === null ||
    (value as unknown) === ""
  ) {
    return undefined;
  }

  const score = Number(value);

  return Number.isFinite(score)
    ? clampScore(score)
    : undefined;
};

const getSkillName = (
  item: SkillItem
): string => {
  return String(
    item.skill_name ??
      item.skillName ??
      ""
  ).trim();
};

const getSkillScore = (
  item: SkillItem
): number | undefined => {
  const value =
    item.proficiency_score ??
    item.proficiencyScore;

  if (
    value === undefined ||
    value === null ||
    (value as unknown) === ""
  ) {
    return undefined;
  }

  const score = Number(value);

  return Number.isFinite(score)
    ? clampScore(score)
    : undefined;
};

const getProjectTitle = (
  item: ProjectItem
): string => {
  return String(
    item.project_title ??
      item.projectTitle ??
      ""
  ).trim();
};

const getProjectMetric = (
  item: ProjectItem,
  snakeKey: keyof ProjectItem,
  camelKey: keyof ProjectItem
): number | undefined => {
  const value =
    item[snakeKey] ??
    item[camelKey];

  if (
    value === undefined ||
    value === null ||
    (value as unknown) === ""
  ) {
    return undefined;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue)
    ? clampScore(numberValue)
    : undefined;
};

const normalizeAnalysisData = (
  data: AnalysisData | null
): AnalysisData | null => {
  if (!data) {
    return null;
  }

  const readinessSource =
    data.readiness || {};

  const profileSource =
    data.profile || {};

  return {
    readiness: {
      readiness_score:
        readinessSource.readiness_score ??
        readinessSource.readinessScore,
      profile_quality:
        readinessSource.profile_quality ??
        readinessSource.profileQuality,
      skill_strength:
        readinessSource.skill_strength ??
        readinessSource.skillStrength,
      project_strength:
        readinessSource.project_strength ??
        readinessSource.projectStrength,
      resume_quality:
        readinessSource.resume_quality ??
        readinessSource.resumeQuality,
    },
    profile: {
      profile_score:
        profileSource.profile_score ??
        profileSource.profileScore,
      strengths: Array.isArray(
        profileSource.strengths
      )
        ? profileSource.strengths.filter(
            (item): item is string =>
              typeof item === "string"
          )
        : [],
    },
    skills: Array.isArray(data.skills)
      ? data.skills.map((item) => ({
          ...item,
          skill_name:
            item.skill_name ??
            item.skillName,
          proficiency_score:
            item.proficiency_score ??
            item.proficiencyScore,
        }))
      : [],
    projects: Array.isArray(data.projects)
      ? data.projects.map((item) => ({
          ...item,
          project_title:
            item.project_title ??
            item.projectTitle,
          quality_score:
            item.quality_score ??
            item.qualityScore,
          technical_depth:
            item.technical_depth ??
            item.technicalDepth,
          career_relevance:
            item.career_relevance ??
            item.careerRelevance,
          description_quality:
            item.description_quality ??
            item.descriptionQuality,
          status:
            (item as any).status,
        }))
      : [],
    career: Array.isArray(data.career)
      ? data.career.map((item) => ({
          ...item,
          role_name:
            item.role_name ??
            item.roleName,
          match_score:
            item.match_score ??
            item.matchScore,
        }))
      : [],
  };
};
export default function AICareerInsights({
  profile,
  onRefreshProfile,
}: AICareerInsightsProps) {
  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [githubUrl, setGithubUrl] =
    useState(
      profile?.social_profiles?.github || ""
    );

  const [linkedinUrl, setLinkedinUrl] =
    useState(
      profile?.social_profiles?.linkedin || ""
    );

  const [scanningGithub, setScanningGithub] =
    useState(false);

  const [scanningLinkedin, setScanningLinkedin] =
    useState(false);

  const [pendingImports, setPendingImports] =
    useState<PendingImport[]>([]);

  const [selectedImportIds, setSelectedImportIds] =
    useState<Set<number | string>>(new Set());

  const [modalViewMode, setModalViewMode] =
    useState<"batch" | "single">("batch");

  const [uploadingArchive, setUploadingArchive] =
    useState(false);

  const [linkedinMessage, setLinkedinMessage] =
    useState<{
      type: "success" | "error" | "info" | "warning";
      text: string;
    } | null>(null);

  const archiveFileInputRef =
    React.useRef<HTMLInputElement | null>(null);

  const [showImportDialog, setShowImportDialog] =
    useState(false);

  const [selectedImportItem, setSelectedImportItem] =
    useState<PendingImport | null>(null);

  const [importing, setImporting] =
    useState(false);

  const [analysisData, setAnalysisData] =
    useState<AnalysisData | null>(null);

  const [targetRole, setTargetRole] =
    useState(
      getProfileTargetRole(profile)
    );

  const [loadingGaps, setLoadingGaps] =
    useState(false);

  const [gapData, setGapData] =
    useState<GapData | null>(null);

  const [resumeSuggestions, setResumeSuggestions] =
    useState<ResumeSuggestions | null>(null);

  const [loadingSuggestions, setLoadingSuggestions] =
    useState(false);

  const [applyingSuggestion, setApplyingSuggestion] =
    useState<string | null>(null);

  const [expandedSection, setExpandedSection] =
    useState("scores");

  const [expandedSkill, setExpandedSkill] =
    useState<number | null>(null);

  const fetchSkillGaps = useCallback(
    async (role: string) => {
      const normalizedRole =
        role.trim();

      if (!normalizedRole) {
        setGapData(null);
        return;
      }

      setLoadingGaps(true);

      const token =
        await waitForAuthToken();

      if (!token) {
        setLoadingGaps(false);
        return;
      }

      try {
        const res = await fetch(
          `${API_BASE_URL}/api/ai/gaps?targetRole=${encodeURIComponent(
            normalizedRole
          )}`,
          {
            method: "GET",
            headers: buildHeaders(token),
            cache: "no-store",
          }
        );

        const data =
          await parseJsonResponse(res);

        if (
          res.status === 401 ||
          res.status === 403
        ) {
          throw new Error(
            "Your authentication session has expired. Please log in again."
          );
        }

        if (!res.ok) {
          throw new Error(
            getBackendError(
              data,
              "Failed to analyze skill gaps."
            )
          );
        }

        const source =
          data?.result ??
          data?.data ??
          data;

        const candidates =
          collectAnalysisCandidates(source);

        let normalizedSource:
          | Record<string, unknown>
          | null = null;

        for (const candidate of candidates) {
          if (isObject(candidate)) {
            if (
              "strong_skills" in candidate ||
              "strongSkills" in candidate ||
              "missing_skills" in candidate ||
              "missingSkills" in candidate ||
              "priority_learning_order" in candidate ||
              "priorityLearningOrder" in candidate
            ) {
              normalizedSource =
                candidate;
              break;
            }
          }
        }

        if (!normalizedSource) {
          setGapData(null);
          return;
        }

        setGapData({
          strong_skills:
            Array.isArray(
              normalizedSource.strong_skills
            )
              ? normalizedSource.strong_skills
              : Array.isArray(
                    normalizedSource.strongSkills
                  )
                ? normalizedSource.strongSkills
                : [],
          missing_skills:
            Array.isArray(
              normalizedSource.missing_skills
            )
              ? normalizedSource.missing_skills
              : Array.isArray(
                    normalizedSource.missingSkills
                  )
                ? normalizedSource.missingSkills
                : [],
          priority_learning_order:
            Array.isArray(
              normalizedSource.priority_learning_order
            )
              ? normalizedSource.priority_learning_order
              : Array.isArray(
                    normalizedSource.priorityLearningOrder
                  )
                ? normalizedSource.priorityLearningOrder
                : [],
        });
      } catch (err) {
        console.error(
          "Skill gap error:",
          err
        );

        if (
          err instanceof Error &&
          err.message.includes(
            "authentication session"
          )
        ) {
          setError(err.message);
        }
      } finally {
        setLoadingGaps(false);
      }
    },
    []
  );

  const fetchResumeSuggestions =
    useCallback(async () => {
      setLoadingSuggestions(true);

      const token =
        await waitForAuthToken();

      if (!token) {
        setLoadingSuggestions(false);
        return;
      }

      try {
        const res = await fetch(
          `${API_BASE_URL}/api/ai/resume/suggestions`,
          {
            method: "GET",
            headers: buildHeaders(token),
            cache: "no-store",
          }
        );

        const data =
          await parseJsonResponse(res);

        if (
          res.status === 401 ||
          res.status === 403
        ) {
          throw new Error(
            "Your authentication session has expired. Please log in again."
          );
        }

        if (!res.ok) {
          throw new Error(
            getBackendError(
              data,
              "Failed to load resume suggestions."
            )
          );
        }

        const candidates =
          collectAnalysisCandidates(
            data?.result ??
              data?.data ??
              data
          );

        let source:
          | Record<string, unknown>
          | null = null;

        for (const candidate of candidates) {
          if (
            isObject(candidate) &&
            ("about_me" in candidate ||
              "aboutMe" in candidate ||
              "projects" in candidate)
          ) {
            source = candidate;
            break;
          }
        }

        if (!source) {
          setResumeSuggestions(null);
          return;
        }

        const projects =
          Array.isArray(source.projects)
            ? source.projects
            : [];

        setResumeSuggestions({
          about_me:
            typeof source.about_me ===
              "string"
              ? source.about_me
              : typeof source.aboutMe ===
                  "string"
                ? source.aboutMe
                : undefined,
          projects:
            projects as ResumeProjectSuggestion[],
        });
      } catch (err) {
        console.error(
          "Resume suggestions error:",
          err
        );

        if (
          err instanceof Error &&
          err.message.includes(
            "authentication session"
          )
        ) {
          setError(err.message);
        }
      } finally {
        setLoadingSuggestions(false);
      }
    }, []);

  const fetchPendingImports =
    useCallback(async () => {
      const token =
        await waitForAuthToken();

      if (!token) {
        return;
      }

      try {
        const res = await fetch(
          `${API_BASE_URL}/api/ai/import/pending`,
          {
            method: "GET",
            headers: buildHeaders(token),
            cache: "no-store",
          }
        );

        const data =
          await parseJsonResponse(res);

        if (
          res.status === 401 ||
          res.status === 403
        ) {
          throw new Error(
            "Your authentication session has expired. Please log in again."
          );
        }

        if (!res.ok) {
          throw new Error(
            getBackendError(
              data,
              "Failed to load pending imports."
            )
          );
        }

        const items =
          extractPendingImportsFromPayload(data);

        setPendingImports(items);

        if (items.length > 0) {
          setSelectedImportItem((current) =>
            current &&
            items.some(
              (item) => String(item.id) === String(current.id)
            )
              ? current
              : items[0]
          );
          setShowImportDialog(true);
        }
      } catch (err) {
        console.error(
          "Pending imports error:",
          err
        );

        if (
          err instanceof Error &&
          err.message.includes(
            "authentication session"
          )
        ) {
          setError(err.message);
        }
      }
    }, []);

  const fetchAIData = useCallback(
    async (forceRefresh = false) => {
      setError("");

      const token =
        await waitForAuthToken();

      if (!token) {
        setLoading(false);
        setRefreshing(false);
        setError(
          "Authentication session not found. Please log in again."
        );
        return;
      }

      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        let res: Response | null = null;
        let data: ApiEnvelope | null = null;

        if (forceRefresh) {
          res = await fetch(
            `${API_BASE_URL}/api/ai/analyze`,
            {
              method: "POST",
              headers: buildHeaders(token),
              body: JSON.stringify({}),
              cache: "no-store",
            }
          );

          data =
            await parseJsonResponse(res);
        } else {
          res = await fetch(
            `${API_BASE_URL}/api/ai/analysis`,
            {
              method: "GET",
              headers: buildHeaders(token),
              cache: "no-store",
            }
          );

          data =
            await parseJsonResponse(res);

          const rawResult = data?.result as Record<string, unknown> | undefined;
          const rawData = data?.data as Record<string, unknown> | undefined;
          const hasExistingAnalysis =
            res.ok &&
            data &&
            Boolean(
              data.readiness ||
                rawResult?.readiness ||
                rawData?.readiness
            );

          if (!hasExistingAnalysis) {
            res = await fetch(
              `${API_BASE_URL}/api/ai/analyze`,
              {
                method: "POST",
                headers: buildHeaders(token),
                body: JSON.stringify({}),
                cache: "no-store",
              }
            );

            data =
              await parseJsonResponse(res);
          }
        }

        if (!res) {
          throw new Error(
            "Unable to contact the AI analysis service."
          );
        }

        if (
          res.status === 401 ||
          res.status === 403
        ) {
          throw new Error(
            "Your authentication session has expired. Please log in again."
          );
        }

        if (!res.ok) {
          const backendMessage =
            getBackendError(
              data,
              ""
            );

          if (
            res.status === 404 &&
            !backendMessage
          ) {
            throw new Error(
              "AI analysis endpoint was not found. Please restart the HireVision backend server."
            );
          }

          throw new Error(
            backendMessage ||
              "Failed to load AI career insights."
          );
        }

        const normalizedAnalysis =
          normalizeAnalysisData(
            extractAnalysisData(data)
          );

        if (!normalizedAnalysis) {
          const directPayload =
            data?.result ??
            data?.data ??
            data?.analysis ??
            data;

          if (
            hasAnalysisShape(
              directPayload
            )
          ) {
            setAnalysisData(
              normalizeAnalysisData(
                directPayload as AnalysisData
              )
            );
          } else {
            setAnalysisData(null);
          }
        } else {
          setAnalysisData(
            normalizedAnalysis
          );
        }

        const resolvedAnalysis =
          normalizedAnalysis;

        const currentTargetRole =
          targetRole.trim();

        const firstCareerRole =
          resolvedAnalysis?.career?.[0]
            ? getCareerRoleName(
                resolvedAnalysis.career[0]
              )
            : "";

        const detectedRole =
          currentTargetRole ||
          firstCareerRole;

        if (
          firstCareerRole &&
          !currentTargetRole
        ) {
          setTargetRole(
            firstCareerRole
          );
        }

        await Promise.allSettled([
          detectedRole
            ? fetchSkillGaps(
                detectedRole
              )
            : Promise.resolve(),

          fetchResumeSuggestions(),

          fetchPendingImports(),
        ]);
      } catch (err: unknown) {
        console.error(
          "AI analysis error:",
          err
        );

        if (
          err instanceof DOMException &&
          err.name === "AbortError"
        ) {
          setError(
            "The AI analysis request was cancelled. Please try again."
          );
        } else if (
          err instanceof TypeError
        ) {
          setError(
            `Unable to connect to the AI server at ${API_BASE_URL}.`
          );
        } else if (
          err instanceof Error
        ) {
          setError(err.message);
        } else {
          setError(
            "Something went wrong while loading AI analysis."
          );
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      fetchPendingImports,
      fetchResumeSuggestions,
      fetchSkillGaps,
      targetRole,
    ]
  );

  useEffect(() => {
    let active = true;
    const run = async () => {
      await Promise.resolve();
      if (active) {
        fetchAIData(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [fetchAIData]);

  useEffect(() => {
    let active = true;
    const syncProfile = async () => {
      await Promise.resolve();
      if (!active) return;
      setGithubUrl(
        profile?.social_profiles?.github || ""
      );
      setLinkedinUrl(
        profile?.social_profiles?.linkedin || ""
      );
      const nextTargetRole = getProfileTargetRole(profile);
      if (nextTargetRole) {
        setTargetRole(nextTargetRole);
      }
    };
    syncProfile();
    return () => {
      active = false;
    };
  }, [profile]);

  useEffect(() => {
    const handleAuthChanged =
      () => {
        if (!getToken()) {
          return;
        }

        fetchAIData(false);
      };

    window.addEventListener(
      "hirevision-auth-changed",
      handleAuthChanged
    );

    window.addEventListener(
      "storage",
      handleAuthChanged
    );

    return () => {
      window.removeEventListener(
        "hirevision-auth-changed",
        handleAuthChanged
      );

      window.removeEventListener(
        "storage",
        handleAuthChanged
      );
    };
  }, [fetchAIData]);
    const handleScanGithub =
    async () => {
      let url =
        githubUrl.trim();

      if (!url) {
        return;
      }

      if (
        !/^https?:\/\//i.test(url)
      ) {
        url = `https://${url}`;
      }

      setScanningGithub(true);

      const token =
        await waitForAuthToken();

      if (!token) {
        alert(
          "Authentication session not found. Please log in again."
        );
        setScanningGithub(false);
        return;
      }

      try {
        const res =
          await fetch(
            `${API_BASE_URL}/api/ai/github/scan`,
            {
              method: "POST",
              headers:
                buildHeaders(token),
              body: JSON.stringify({
                githubUrl: url,
              }),
            }
          );

        const data =
          await parseJsonResponse(
            res
          );

        if (
          res.status === 401 ||
          res.status === 403
        ) {
          throw new Error(
            "Your authentication session has expired. Please log in again."
          );
        }

        if (!res.ok) {
          throw new Error(
            getBackendError(
              data,
              "GitHub scan failed."
            )
          );
        }

        const items =
          extractPendingImportsFromPayload(data);

        await fetchPendingImports();

        if (items.length > 0) {
          setSelectedImportItem(items[0]);
          setShowImportDialog(true);
        } else if (typeof data?.message === "string" && data.message.trim()) {
          alert(data.message);
        }
      } catch (err: unknown) {
        if (
          err instanceof Error
        ) {
          alert(err.message);
        } else {
          alert(
            "Error scanning GitHub."
          );
        }
      } finally {
        setScanningGithub(false);
      }
    };

  const handleScanLinkedin =
    async () => {
      let url =
        linkedinUrl.trim();

      if (!url) {
        return;
      }

      if (
        !/^https?:\/\//i.test(url)
      ) {
        url = `https://${url}`;
      }

      setScanningLinkedin(true);
      setLinkedinMessage(null);

      const token =
        await waitForAuthToken();

      if (!token) {
        alert(
          "Authentication session not found. Please log in again."
        );
        setScanningLinkedin(false);
        return;
      }

      try {
        const res =
          await fetch(
            `${API_BASE_URL}/api/ai/linkedin/scan`,
            {
              method: "POST",
              headers:
                buildHeaders(token),
              body: JSON.stringify({
                linkedinUrl: url,
              }),
            }
          );

        const data =
          await parseJsonResponse(
            res
          );

        if (
          res.status === 401 ||
          res.status === 403
        ) {
          throw new Error(
            "Your authentication session has expired. Please log in again."
          );
        }

        const authorizationUrl =
          extractAuthorizationUrl(data);

        if (
          (res.status === 409 ||
            data?.status === "authorization_required") &&
          authorizationUrl
        ) {
          window.location.assign(authorizationUrl);
          return;
        }

        if (!res.ok) {
          throw new Error(
            getBackendError(
              data,
              "LinkedIn scan failed."
            )
          );
        }

        const items =
          extractPendingImportsFromPayload(data);

        await fetchPendingImports();

        if (data?.status === "limited_access") {
          setLinkedinMessage({
            type: "info",
            text: "LinkedIn connected successfully with basic profile access. Standard LinkedIn permissions only return basic identity data. To import your complete positions, skills, and credentials, you can upload your LinkedIn export archive below.",
          });
        } else if (items.length > 0) {
          const idSet = new Set<number | string>(
            items.map((i: PendingImport) => i.id).filter(Boolean) as (number | string)[]
          );
          setSelectedImportIds(idSet);
          setSelectedImportItem(items[0]);
          setModalViewMode(items.length > 1 ? "batch" : "single");
          setShowImportDialog(true);
          setLinkedinMessage({
            type: "success",
            text: `Found ${items.length} new profile item(s) pending your approval.`,
          });
        } else {
          setLinkedinMessage({
            type: "info",
            text:
              data?.message ||
              "Your LinkedIn profile was scanned successfully. No new information was found to import.",
          });
        }
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : "Error scanning LinkedIn.";
        setLinkedinMessage({
          type: "error",
          text: msg,
        });
      } finally {
        setScanningLinkedin(false);
      }
    };

  const handleUploadArchive =
    async (
      event: React.ChangeEvent<HTMLInputElement>
    ) => {
      const files = event.target.files
        ? Array.from(event.target.files)
        : [];

      if (files.length === 0) {
        return;
      }

      event.target.value = "";
      setUploadingArchive(true);
      setLinkedinMessage(null);

      const token =
        await waitForAuthToken();

      if (!token) {
        alert(
          "Authentication session not found. Please log in again."
        );
        setUploadingArchive(false);
        return;
      }

      try {
        const formData = new FormData();
        files.forEach((file) => {
          formData.append("files", file);
        });
        formData.append("file", files[0]);
        if (linkedinUrl.trim()) {
          formData.append(
            "linkedinUrl",
            linkedinUrl.trim()
          );
        }

        const res = await fetch(
          `${API_BASE_URL}/api/ai/linkedin/import-archive`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          }
        );

        const data =
          await parseJsonResponse(res);

        if (!res.ok) {
          throw new Error(
            getBackendError(
              data,
              "Failed to import LinkedIn archive."
            )
          );
        }

        const items =
          extractPendingImportsFromPayload(data);

        await fetchPendingImports();

        if (items.length > 0) {
          const idSet = new Set<number | string>(
            items.map((it: PendingImport) => it.id).filter(Boolean) as (number | string)[]
          );
          setSelectedImportIds(idSet);
          setSelectedImportItem(items[0]);
          setModalViewMode(items.length > 1 ? "batch" : "single");
          setShowImportDialog(true);
          setLinkedinMessage({
            type: "success",
            text: `Found ${items.length} new profile item(s) from your LinkedIn archive ready for review.`,
          });
        } else {
          setLinkedinMessage({
            type: "info",
            text:
              data?.message ||
              "LinkedIn archive processed successfully. No new information was found to import.",
          });
        }
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : "Failed to import LinkedIn archive.";
        setLinkedinMessage({
          type: "error",
          text: msg,
        });
      } finally {
        setUploadingArchive(false);
      }
    };

  const handleBatchApprove =
    async (
      idsToApprove?: (number | string)[]
    ) => {
      const targetIds = (
        idsToApprove ||
        Array.from(selectedImportIds)
      )
        .map((id) => Number(id))
        .filter(
          (id) =>
            Number.isInteger(id) && id > 0
        );

      if (targetIds.length === 0) {
        alert(
          "Please select at least one item to add."
        );
        return;
      }

      setImporting(true);

      const token =
        await waitForAuthToken();

      if (!token) {
        alert(
          "Authentication session not found. Please log in again."
        );
        setImporting(false);
        return;
      }

      try {
        const res = await fetch(
          `${API_BASE_URL}/api/ai/import/batch-approve`,
          {
            method: "POST",
            headers: buildHeaders(token),
            body: JSON.stringify({
              importIds: targetIds,
            }),
          }
        );

        const data =
          await parseJsonResponse(res);

        if (!res.ok) {
          throw new Error(
            getBackendError(
              data,
              "Batch import approval failed."
            )
          );
        }

        setShowImportDialog(false);
        setSelectedImportItem(null);
        setSelectedImportIds(new Set());

        await fetchPendingImports();
        onRefreshProfile();
        await fetchAIData(true);
      } catch (err: unknown) {
        alert(
          err instanceof Error
            ? err.message
            : "Unable to approve items."
        );
      } finally {
        setImporting(false);
      }
    };

  const handleBatchReject =
    async (
      idsToReject?: (number | string)[]
    ) => {
      const targetIds = (
        idsToReject ||
        Array.from(selectedImportIds)
      )
        .map((id) => Number(id))
        .filter(
          (id) =>
            Number.isInteger(id) && id > 0
        );

      if (targetIds.length === 0) {
        alert(
          "Please select at least one item to reject."
        );
        return;
      }

      setImporting(true);

      const token =
        await waitForAuthToken();

      if (!token) {
        alert(
          "Authentication session not found. Please log in again."
        );
        setImporting(false);
        return;
      }

      try {
        const res = await fetch(
          `${API_BASE_URL}/api/ai/import/batch-reject`,
          {
            method: "POST",
            headers: buildHeaders(token),
            body: JSON.stringify({
              importIds: targetIds,
            }),
          }
        );

        const data =
          await parseJsonResponse(res);

        if (!res.ok) {
          throw new Error(
            getBackendError(
              data,
              "Batch import rejection failed."
            )
          );
        }

        setShowImportDialog(false);
        setSelectedImportItem(null);
        setSelectedImportIds(new Set());

        await fetchPendingImports();
      } catch (err: unknown) {
        alert(
          err instanceof Error
            ? err.message
            : "Unable to reject items."
        );
      } finally {
        setImporting(false);
      }
    };

  const handleApproveImport =
    async (
      importId: number
    ) => {
      setImporting(true);

      const token =
        await waitForAuthToken();

      if (!token) {
        alert(
          "Authentication session not found. Please log in again."
        );
        setImporting(false);
        return;
      }

      try {
        const res =
          await fetch(
            `${API_BASE_URL}/api/ai/import/approve`,
            {
              method: "POST",
              headers:
                buildHeaders(token),
              body: JSON.stringify({
                importId,
              }),
            }
          );

        const data =
          await parseJsonResponse(
            res
          );

        if (
          res.status === 401 ||
          res.status === 403
        ) {
          throw new Error(
            "Your authentication session has expired. Please log in again."
          );
        }

        if (!res.ok) {
          throw new Error(
            getBackendError(
              data,
              "Import approval failed."
            )
          );
        }

        setShowImportDialog(
          false
        );

        setSelectedImportItem(
          null
        );

        await fetchPendingImports();

        onRefreshProfile();

        await fetchAIData(true);
      } catch (err: unknown) {
        if (
          err instanceof Error
        ) {
          alert(err.message);
        } else {
          alert(
            "Unable to import item."
          );
        }
      } finally {
        setImporting(false);
      }
    };

  const handleRejectImport =
    async (
      importId: number
    ) => {
      setImporting(true);

      const token =
        await waitForAuthToken();

      if (!token) {
        alert(
          "Authentication session not found. Please log in again."
        );
        setImporting(false);
        return;
      }

      try {
        const res =
          await fetch(
            `${API_BASE_URL}/api/ai/import/reject`,
            {
              method: "POST",
              headers:
                buildHeaders(token),
              body: JSON.stringify({
                importId,
              }),
            }
          );

        const data =
          await parseJsonResponse(
            res
          );

        if (
          res.status === 401 ||
          res.status === 403
        ) {
          throw new Error(
            "Your authentication session has expired. Please log in again."
          );
        }

        if (!res.ok) {
          throw new Error(
            getBackendError(
              data,
              "Import rejection failed."
            )
          );
        }

        setShowImportDialog(
          false
        );

        setSelectedImportItem(
          null
        );

        await fetchPendingImports();
      } catch (err: unknown) {
        if (
          err instanceof Error
        ) {
          alert(err.message);
        } else {
          alert(
            "Unable to reject import."
          );
        }
      } finally {
        setImporting(false);
      }
    };

  const handleApplySuggestion =
    async (
      type: string,
      payload: unknown,
      idKey: string
    ) => {
      setApplyingSuggestion(
        idKey
      );

      const token =
        await waitForAuthToken();

      if (!token) {
        alert(
          "Authentication session not found. Please log in again."
        );
        setApplyingSuggestion(
          null
        );
        return;
      }

      try {
        const res =
          await fetch(
            `${API_BASE_URL}/api/ai/resume/suggestions/apply`,
            {
              method: "POST",
              headers:
                buildHeaders(token),
              body: JSON.stringify({
                type,
                payload,
              }),
            }
          );

        const data =
          await parseJsonResponse(
            res
          );

        if (
          res.status === 401 ||
          res.status === 403
        ) {
          throw new Error(
            "Your authentication session has expired. Please log in again."
          );
        }

        if (!res.ok) {
          throw new Error(
            getBackendError(
              data,
              "Unable to apply resume suggestion."
            )
          );
        }

        onRefreshProfile();

        await fetchAIData(true);

        alert(
          "Resume suggestion successfully applied to your profile!"
        );
      } catch (err: unknown) {
        if (
          err instanceof Error
        ) {
          alert(err.message);
        } else {
          alert(
            "Unable to apply suggestion."
          );
        }
      } finally {
        setApplyingSuggestion(
          null
        );
      }
    };

  const closeImportModal =
    () => {
      if (importing) {
        return;
      }

      setShowImportDialog(
        false
      );

      setSelectedImportItem(
        null
      );
    };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const linkedinState = params.get("linkedin");
    const linkedinError = params.get("linkedin_error");

    if (linkedinState === "error" && linkedinError) {
      setLinkedinMessage({
        type: "error",
        text: linkedinError,
      });
      setExpandedSection("github-linkedin");
    } else if (linkedinState === "connected") {
      setExpandedSection("github-linkedin");
      fetchPendingImports().then(() => {
        setLinkedinMessage({
          type: "success",
          text: "LinkedIn account connected and profile scanned successfully.",
        });
      });
    }

    if (linkedinState === "connected" || linkedinState === "error") {
      params.delete("linkedin");
      params.delete("linkedin_error");
      params.delete("linkedin_imports");

      const query = params.toString();
      const cleanUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", cleanUrl);
    }
  }, [fetchPendingImports]);

  if (loading) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 bg-slate-50 text-slate-600">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-purple-100 bg-white shadow-sm">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </div>

        <div className="text-center">
          <p className="text-sm font-bold text-slate-800">
            Analyzing your career profile...
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Synthesizing skills, projects and career data.
          </p>
        </div>
      </div>
    );
  }

  const {
    readiness,
    profile: profileMetrics,
    skills = [],
    projects = [],
    career = [],
  } = analysisData || {};

  const readinessScore =
    clampScore(
      readiness?.readiness_score ??
        readiness?.readinessScore
    );

  const profileScore =
    clampScore(
      profileMetrics?.profile_score ??
        profileMetrics?.profileScore
    );
      return (
    <div className="mx-auto max-w-6xl space-y-6 bg-slate-50 p-1 font-sans text-slate-800">
      <div className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-100">
              <Cpu className="h-6 w-6 text-purple-600" />
            </div>

            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-slate-900">
                AI Candidate Intelligence
              </h2>

              <p className="mt-1 text-xs font-medium text-slate-500">
                Continuous analysis of your profile, skills, projects
                & imports.
              </p>
            </div>
          </div>

          <button
            onClick={() =>
              fetchAIData(true)
            }
            disabled={refreshing}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}

            {refreshing
              ? "Analyzing..."
              : "Refresh AI Analysis"}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

          <div>
            <p className="text-xs font-bold">
              AI Analysis Error
            </p>

            <p className="mt-0.5 text-xs text-red-600">
              {error}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        <div className="space-y-6 md:col-span-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                AI Profile Score
              </span>

              <span className="rounded-full border border-purple-100 bg-purple-50 px-2.5 py-1 text-[9px] font-bold text-purple-600">
                Evidence Based
              </span>
            </div>

            <div className="relative mx-auto flex h-40 w-40 items-center justify-center">
              <svg
                className="h-full w-full -rotate-90"
                viewBox="0 0 100 100"
              >
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#F1F5F9"
                  strokeWidth="8"
                  fill="none"
                />

                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#7C3AED"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray="251.2"
                  strokeDashoffset={
                    251.2 -
                    (251.2 * profileScore) /
                      100
                  }
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
              </svg>

              <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-extrabold text-slate-900">
                  {profileScore}%
                </span>

                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  Quality
                </span>
              </div>
            </div>

            <div className="mt-5 border-t border-slate-100 pt-5">
              <span className="mb-3 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Profile Strengths
              </span>

              <div className="space-y-2">
                {(profileMetrics?.strengths ||
                  [])
                  .slice(0, 4)
                  .map(
                    (
                      strength: string,
                      index: number
                    ) => (
                      <div
                        key={`${strength}-${index}`}
                        className="flex items-start gap-2 text-[11px] font-semibold text-slate-600"
                      >
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        <span>
                          {strength}
                        </span>
                      </div>
                    )
                  )}

                {(profileMetrics?.strengths ||
                  []).length === 0 && (
                  <span className="text-[10px] italic text-slate-400">
                    Add profile information, skills and experience
                    to generate evidence-based strengths.
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Career Readiness
              </span>

              <span className="rounded-full border border-purple-100 bg-purple-50 px-2.5 py-1 text-[9px] font-bold text-purple-600">
                Aggregate
              </span>
            </div>

            <div className="relative mx-auto flex h-40 w-40 items-center justify-center">
              <svg
                className="h-full w-full -rotate-90"
                viewBox="0 0 100 100"
              >
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#F1F5F9"
                  strokeWidth="8"
                  fill="none"
                />

                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#6366F1"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray="251.2"
                  strokeDashoffset={
                    251.2 -
                    (251.2 * readinessScore) /
                      100
                  }
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
              </svg>

              <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-extrabold text-slate-900">
                  {readinessScore}%
                </span>

                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  Score
                </span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-5">
              {[
                {
                  label: "Profile",
                  val:
                    readiness?.profile_quality ??
                    readiness?.profileQuality,
                },
                {
                  label: "Skills",
                  val:
                    readiness?.skill_strength ??
                    readiness?.skillStrength,
                },
                {
                  label: "Projects",
                  val:
                    readiness?.project_strength ??
                    readiness?.projectStrength,
                },
                {
                  label: "Resume",
                  val:
                    readiness?.resume_quality ??
                    readiness?.resumeQuality,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center"
                >
                  <span className="block text-[9px] font-bold text-slate-400">
                    {item.label}
                  </span>

                  <span className="mt-1 block text-sm font-extrabold text-slate-700">
                    {clampScore(
                      item.val
                    )}
                    %
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6 md:col-span-7">
          <div className="grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-white p-1 sm:grid-cols-4">
            {[
              {
                id: "scores",
                label: "Skills & Career",
              },
              {
                id: "projects",
                label: "Projects & Gaps",
              },
              {
                id: "connectors",
                label: "GitHub / LinkedIn",
              },
              {
                id: "resume",
                label: "Resume AI",
              },
            ].map(
              (section) => (
                <button
                  key={section.id}
                  onClick={() =>
                    setExpandedSection(
                      section.id
                    )
                  }
                  className={`cursor-pointer rounded-xl px-2 py-2.5 text-[10px] font-bold transition-all ${
                    expandedSection ===
                    section.id
                      ? "border border-purple-100 bg-purple-50 text-purple-700 shadow-sm"
                      : "text-slate-500 hover:bg-slate-50 hover:text-purple-600"
                  }`}
                >
                  {section.label}
                </button>
              )
            )}
          </div>

          <AnimatePresence mode="wait">
            {expandedSection ===
              "scores" && (
              <motion.div
                key="scores-sec"
                className="space-y-6"
                initial={{
                  opacity: 0,
                  y: 10,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                }}
              >
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="mb-5 flex items-center gap-2 text-sm font-extrabold text-slate-900">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                    Suggested Career Roles
                  </h3>

                  <div className="space-y-3">
                    {(career || []).map(
                      (
                        item: CareerItem,
                        index: number
                      ) => {
                        const roleName =
                          getCareerRoleName(
                            item
                          );

                        const matchScore =
                          getCareerMatchScore(
                            item
                          );

                        return (
                          <div
                            key={`${roleName}-${index}`}
                            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs font-extrabold text-slate-800">
                                {roleName ||
                                  "Career Role"}
                              </span>

                              {matchScore !==
                                undefined && (
                                <span className="shrink-0 rounded-full border border-purple-100 bg-purple-50 px-2.5 py-1 text-[9px] font-extrabold text-purple-700">
                                  {matchScore}%
                                  {" "}
                                  Match
                                </span>
                              )}
                            </div>

                            <p className="mt-2 text-[11px] font-medium leading-relaxed text-slate-500">
                              {item.explanation ||
                                "No explanation available."}
                            </p>
                          </div>
                        );
                      }
                    )}

                    {(career || [])
                      .length === 0 && (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
                        <p className="text-xs font-medium text-slate-400">
                          Add career history, skills or a target
                          role to receive personalized recommendations.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                    <Cpu className="h-5 w-5 text-purple-600" />
                    Evidence-Based Skill Proficiency
                  </h3>

                  <p className="mt-2 text-[11px] font-medium text-slate-400">
                    Estimated proficiency based on available technical
                    projects, certificates and profile evidence.
                  </p>

                  <div className="mt-5 space-y-3">
                    {(skills || []).map(
                      (
                        skill: SkillItem,
                        index: number
                      ) => {
                        const isExpanded =
                          expandedSkill ===
                          index;

                        const score =
                          getSkillScore(
                            skill
                          );

                        const hasScore =
                          score !==
                          undefined;

                        const skillName =
                          getSkillName(
                            skill
                          );

                        return (
                          <div
                            key={`${skillName}-${index}`}
                            className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedSkill(
                                  isExpanded
                                    ? null
                                    : index
                                )
                              }
                              className="w-full cursor-pointer bg-white p-4 text-left transition hover:bg-slate-50"
                            >
                              <div className="flex items-center gap-4">
                                <div className="flex-1">
                                  <div className="mb-2 flex items-center justify-between gap-3">
                                    <span className="text-xs font-bold text-slate-700">
                                      {skillName ||
                                        "Unknown Skill"}
                                    </span>

                                    <div className="flex items-center gap-2">
                                      {skill.level && (
                                        <span
                                          className={`rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase ${
                                            skill.level ===
                                            "Strong"
                                              ? "border-indigo-100 bg-indigo-50 text-indigo-600"
                                              : skill.level ===
                                                  "Intermediate"
                                                ? "border-blue-100 bg-blue-50 text-blue-600"
                                                : "border-cyan-100 bg-cyan-50 text-cyan-600"
                                          }`}
                                        >
                                          {skill.level}
                                        </span>
                                      )}

                                      {hasScore && (
                                        <span className="text-xs font-extrabold text-purple-700">
                                          {score}%
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {hasScore && (
                                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                      <motion.div
                                        initial={{
                                          width: 0,
                                        }}
                                        animate={{
                                          width: `${score}%`,
                                        }}
                                        transition={{
                                          duration: 0.7,
                                        }}
                                        className={`h-full rounded-full ${
                                          skill.level ===
                                          "Strong"
                                            ? "bg-indigo-500"
                                            : skill.level ===
                                                "Intermediate"
                                              ? "bg-blue-500"
                                              : "bg-cyan-500"
                                        }`}
                                      />
                                    </div>
                                  )}
                                </div>

                                {isExpanded ? (
                                  <ChevronUp className="h-5 w-5 shrink-0 text-slate-400" />
                                ) : (
                                  <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" />
                                )}
                              </div>
                            </button>

                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{
                                    height: 0,
                                    opacity: 0,
                                  }}
                                  animate={{
                                    height: "auto",
                                    opacity: 1,
                                  }}
                                  exit={{
                                    height: 0,
                                    opacity: 0,
                                  }}
                                  className="border-t border-slate-200"
                                >
                                  <div className="p-4">
                                    <span className="mb-3 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                      AI Evidence
                                    </span>

                                    <ul className="space-y-2">
                                      {(
                                        skill.evidence ||
                                        []
                                      ).map(
                                        (
                                          evidence: string,
                                          evidenceIndex: number
                                        ) => (
                                          <li
                                            key={`${evidence}-${evidenceIndex}`}
                                            className="flex gap-2 text-[11px] font-medium leading-relaxed text-slate-600"
                                          >
                                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-500" />
                                            {evidence}
                                          </li>
                                        )
                                      )}

                                      {(
                                        skill.evidence ||
                                        []
                                      ).length === 0 && (
                                        <li className="text-[11px] italic text-slate-400">
                                          No supporting evidence was
                                          returned. Add projects,
                                          certificates or other
                                          verifiable profile evidence.
                                        </li>
                                      )}
                                    </ul>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      }
                    )}

                    {(skills || [])
                      .length === 0 && (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
                        <p className="text-xs font-medium text-slate-400">
                          Add technical skills to review proficiency.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {expandedSection ===
              "projects" && (
              <motion.div
                key="projects-sec"
                className="space-y-6"
                initial={{
                  opacity: 0,
                  y: 10,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                }}
              >
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                      <Zap className="h-5 w-5 text-amber-500" />
                      Target Role Skill Gap
                    </h3>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={targetRole}
                        onChange={(
                          event
                        ) =>
                          setTargetRole(
                            event.target
                              .value
                          )
                        }
                        placeholder="Target Role..."
                        className="w-44 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100"
                      />

                      <button
                        onClick={() =>
                          fetchSkillGaps(
                            targetRole
                          )
                        }
                        disabled={
                          loadingGaps ||
                          !targetRole.trim()
                        }
                        className="flex min-w-[75px] cursor-pointer items-center justify-center rounded-xl bg-purple-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loadingGaps ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Analyze"
                        )}
                      </button>
                    </div>
                  </div>

                  {gapData ? (
                    <div className="mt-5 space-y-5">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                            Strong Skills
                          </span>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {(
                              gapData.strong_skills ||
                              gapData.strongSkills ||
                              []
                            ).map(
                              (
                                skill: unknown,
                                idx: number
                              ) => {
                                const str =
                                  getSkillString(
                                    skill
                                  );

                                return str ? (
                                  <span
                                    key={`strong-${str}-${idx}`}
                                    className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-[10px] font-bold text-emerald-700"
                                  >
                                    {str}
                                  </span>
                                ) : null;
                              }
                            )}

                            {(
                              gapData.strong_skills ||
                              gapData.strongSkills ||
                              []
                            ).length ===
                              0 && (
                              <span className="text-[10px] italic text-slate-400">
                                None detected
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-red-100 bg-red-50/60 p-4">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-red-700">
                            Missing Skills
                          </span>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {(
                              gapData.missing_skills ||
                              gapData.missingSkills ||
                              []
                            ).map(
                              (
                                skill: unknown,
                                idx: number
                              ) => {
                                const str =
                                  getSkillString(
                                    skill
                                  );

                                return str ? (
                                  <span
                                    key={`missing-${str}-${idx}`}
                                    className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[10px] font-bold text-red-700"
                                  >
                                    {str}
                                  </span>
                                ) : null;
                              }
                            )}

                            {(
                              gapData.missing_skills ||
                              gapData.missingSkills ||
                              []
                            ).length ===
                              0 && (
                              <span className="text-[10px] italic text-slate-400">
                                None detected
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        <span className="mb-3 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Suggested Learning Path
                        </span>

                        <div className="space-y-2">
                          {(
                            gapData.priority_learning_order ||
                            gapData.priorityLearningOrder ||
                            []
                          ).map(
                            (
                              skill: unknown,
                              index: number
                            ) => {
                              const str =
                                getSkillString(
                                  skill
                                );

                              if (!str) {
                                return null;
                              }

                              return (
                                <div
                                  key={`path-${str}-${index}`}
                                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
                                >
                                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-100 text-[10px] font-extrabold text-purple-700">
                                    {index +
                                      1}
                                  </span>

                                  <span className="text-xs font-bold text-slate-700">
                                    {str}
                                  </span>

                                  <ArrowRight className="ml-auto h-4 w-4 text-slate-300" />
                                </div>
                              );
                            }
                          )}

                          {(
                            gapData.priority_learning_order ||
                            gapData.priorityLearningOrder ||
                            []
                          ).length ===
                            0 && (
                            <p className="text-[11px] italic text-slate-400">
                              No learning order was returned for
                              this target role.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                      <p className="text-xs font-medium text-slate-400">
                        Enter a target job role and click Analyze.
                      </p>
                    </div>
                  )}
                </div>
                                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                        <Sparkles className="h-5 w-5 text-purple-600" />
                        Project Quality Analytics
                      </h3>
                      <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                        Evaluates architecture depth, verifiable code evidence, and career impact.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-purple-700 bg-purple-50 px-3 py-1.5 rounded-full border border-purple-100 shrink-0">
                      <span>Formula: 40% Depth + 35% Relevance + 25% Description</span>
                    </div>
                  </div>

                  <div className="mt-5 space-y-4">
                    {(projects || []).map(
                      (
                        project: ProjectItem,
                        index: number
                      ) => {
                        const projectTitle =
                          getProjectTitle(
                            project
                          );

                        const qualityScore =
                          getProjectMetric(
                            project,
                            "quality_score",
                            "qualityScore"
                          );

                        const technicalDepth =
                          getProjectMetric(
                            project,
                            "technical_depth",
                            "technicalDepth"
                          );

                        const careerRelevance =
                          getProjectMetric(
                            project,
                            "career_relevance",
                            "careerRelevance"
                          );

                        const descriptionQuality =
                          getProjectMetric(
                            project,
                            "description_quality",
                            "descriptionQuality"
                          );

                        const projectStatus =
                          project.status ||
                          (qualityScore === 0 ? "Insufficient Data" : null);

                        const hasGroundedScore =
                          qualityScore !== undefined && qualityScore > 0;

                        return (
                          <div
                            key={`${projectTitle}-${index}`}
                            className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <h4 className="text-xs font-extrabold text-slate-800">
                                {projectTitle ||
                                  "Untitled Project"}
                              </h4>

                              {hasGroundedScore ? (
                                <span className="shrink-0 rounded-full border border-purple-100 bg-purple-50 px-2.5 py-1 text-[10px] font-bold text-purple-700">
                                  Quality: {qualityScore}%
                                </span>
                              ) : (
                                <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">
                                  {projectStatus || "Insufficient Data"}
                                </span>
                              )}
                            </div>

                            <div className="mt-4 grid grid-cols-3 gap-3">
                              {[
                                {
                                  label: "Tech Depth",
                                  value: technicalDepth,
                                },
                                {
                                  label: "Relevance",
                                  value: careerRelevance,
                                },
                                {
                                  label: "Description",
                                  value: descriptionQuality,
                                },
                              ].map((item) => (
                                <div
                                  key={item.label}
                                  className="rounded-xl border border-slate-200 bg-white p-3"
                                >
                                  <span className="block text-[9px] font-bold text-slate-400">
                                    {item.label}
                                  </span>

                                  <span className="mt-1 block text-sm font-extrabold text-slate-700">
                                    {item.value !== undefined && item.value > 0 ? (
                                      `${item.value}%`
                                    ) : (
                                      <span className="text-[10px] font-semibold text-amber-600">
                                        {projectStatus || "Insufficient Data"}
                                      </span>
                                    )}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {(
                              project.suggestions ||
                              []
                            ).length > 0 && (
                              <div className="mt-4 border-t border-slate-200 pt-4">
                                <span className="mb-2 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                  Optimization Suggestions
                                </span>

                                <ul className="space-y-1.5">
                                  {(
                                    project.suggestions ||
                                    []
                                  ).map(
                                    (
                                      suggestion,
                                      suggestionIndex
                                    ) => (
                                      <li
                                        key={`${suggestion}-${suggestionIndex}`}
                                        className="flex gap-2 text-[11px] font-medium leading-relaxed text-slate-600"
                                      >
                                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-500" />
                                        {suggestion}
                                      </li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}
                          </div>
                        );
                      }
                    )}

                    {(projects || [])
                      .length === 0 && (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
                        <p className="text-xs font-medium text-slate-400">
                          Add technical projects to review quality
                          indicators.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {expandedSection ===
              "connectors" && (
              <motion.div
                key="connectors-sec"
                className="space-y-6"
                initial={{
                  opacity: 0,
                  y: 10,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                }}
              >
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="space-y-3">
                    <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <Github className="h-5 w-5 text-slate-900" />
                      Connect GitHub Profile
                    </h4>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="url"
                        value={githubUrl}
                        onChange={(
                          event
                        ) =>
                          setGithubUrl(
                            event.target
                              .value
                          )
                        }
                        placeholder="https://github.com/your-username"
                        className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100"
                      />

                      <button
                        onClick={
                          handleScanGithub
                        }
                        disabled={
                          scanningGithub ||
                          !githubUrl.trim()
                        }
                        className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {scanningGithub && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}

                        {scanningGithub
                          ? "Scanning..."
                          : "Scan Profile"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 space-y-3 border-t border-slate-100 pt-6">
                    <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <Linkedin className="h-5 w-5 text-blue-700" />
                      Connect LinkedIn Profile
                    </h4>

                    {linkedinMessage && (
                      <div
                        className={`flex items-start justify-between gap-3 rounded-2xl p-4 text-xs ${
                          linkedinMessage.type === "success"
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                            : linkedinMessage.type === "error"
                            ? "border border-rose-200 bg-rose-50 text-rose-800"
                            : linkedinMessage.type === "warning"
                            ? "border border-amber-200 bg-amber-50 text-amber-800"
                            : "border border-blue-200 bg-blue-50 text-blue-800"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          {linkedinMessage.type === "success" ? (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                          ) : (
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                          )}
                          <p className="leading-relaxed">{linkedinMessage.text}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setLinkedinMessage(null)}
                          className="shrink-0 rounded p-1 text-slate-400 hover:text-slate-600"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="url"
                        value={linkedinUrl}
                        onChange={(
                          event
                        ) =>
                          setLinkedinUrl(
                            event.target
                              .value
                          )
                        }
                        placeholder="https://linkedin.com/in/your-profile"
                        className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                      />

                      <button
                        onClick={
                          handleScanLinkedin
                        }
                        disabled={
                          scanningLinkedin ||
                          !linkedinUrl.trim()
                        }
                        className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {scanningLinkedin && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}

                        {scanningLinkedin
                          ? "Scanning..."
                          : "Scan Profile"}
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5">
                      <div className="flex items-center gap-2.5 text-xs text-slate-600">
                        <Upload className="h-4 w-4 shrink-0 text-blue-600" />
                        <div>
                          <p className="font-semibold text-slate-800">
                            Have a LinkedIn data export?
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Upload your official export archive (.zip) or select multiple CSV files (Positions, Education, Certifications, Projects, Skills, etc.) to import complete profile details.
                          </p>
                        </div>
                      </div>

                      <input
                        ref={archiveFileInputRef}
                        type="file"
                        accept=".zip,.csv"
                        multiple
                        className="hidden"
                        onChange={handleUploadArchive}
                      />

                      <button
                        type="button"
                        onClick={() => archiveFileInputRef.current?.click()}
                        disabled={uploadingArchive}
                        className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {uploadingArchive ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                            <span>Processing...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="h-3.5 w-3.5 text-blue-700" />
                            <span>Upload Export Archive</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {pendingImports.length >
                  0 && (
                  <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                        <AlertCircle className="h-5 w-5 text-amber-500" />

                        Pending Imports

                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-600">
                          {
                            pendingImports.length
                          }
                        </span>
                      </h3>

                      <button
                        onClick={() => {
                          const idSet = new Set<number | string>(
                            pendingImports.map((i) => i.id).filter(Boolean) as (number | string)[]
                          );
                          setSelectedImportIds(idSet);
                          setModalViewMode("batch");
                          setShowImportDialog(true);
                        }}
                        className="cursor-pointer rounded-xl bg-purple-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-purple-700"
                      >
                        Review All ({pendingImports.length})
                      </button>
                    </div>

                    <div className="mt-5 space-y-3">
                      {pendingImports.map(
                        (
                          item: PendingImport
                        ) => (
                          <div
                            key={String(
                              item.id ??
                                `${item.source}-${item.title}`
                            )}
                            className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center"
                          >
                            <div className="min-w-0">
                              <span className="inline-block rounded-md border border-purple-100 bg-purple-50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-purple-700">
                                {item.source ||
                                  "External"}{" "}
                                •{" "}
                                {item.item_type ||
                                  item.itemType ||
                                  "Item"}
                              </span>

                              <h4 className="mt-2 text-xs font-extrabold text-slate-800">
                                {item.title ||
                                  "Untitled Item"}
                              </h4>

                              <p className="mt-1 line-clamp-2 text-[11px] font-medium text-slate-500">
                                {item.description ||
                                  "No description available."}
                              </p>
                            </div>

                            <button
                              onClick={() => {
                                setSelectedImportItem(
                                  item
                                );
                                setShowImportDialog(
                                  true
                                );
                              }}
                              className="shrink-0 cursor-pointer rounded-xl bg-purple-600 px-4 py-2 text-[10px] font-bold text-white transition hover:bg-purple-700"
                            >
                              Review
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
                        {expandedSection ===
              "resume" && (
              <motion.div
                key="resume-sec"
                className="space-y-6"
                initial={{
                  opacity: 0,
                  y: 10,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                }}
              >
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                    Live Resume Optimization Suggestions
                  </h3>

                  <p className="mt-2 text-[11px] font-medium text-slate-400">
                    Review AI-enhanced wording updates and apply them
                    directly to your live profile.
                  </p>

                  {loadingSuggestions ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-7 w-7 animate-spin text-purple-600" />
                    </div>
                  ) : resumeSuggestions ? (
                    <div className="mt-6 space-y-6">
                      {resumeSuggestions.about_me && (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              About Me Draft
                            </span>

                            <button
                              onClick={() =>
                                handleApplySuggestion(
                                  "about_me",
                                  resumeSuggestions.about_me,
                                  "about_me"
                                )
                              }
                              disabled={
                                applyingSuggestion !==
                                null
                              }
                              className="flex cursor-pointer items-center gap-1 rounded-lg bg-purple-600 px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {applyingSuggestion ===
                              "about_me" ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Plus className="h-3 w-3" />
                              )}

                              Apply
                            </button>
                          </div>

                          <p className="mt-3 rounded-xl border border-slate-200 bg-white p-4 text-xs font-medium italic leading-relaxed text-slate-600">
                            &quot;
                            {
                              resumeSuggestions.about_me
                            }
                            &quot;
                          </p>
                        </div>
                      )}

                      {(
                        resumeSuggestions.projects ||
                        []
                      ).length > 0 && (
                        <div className="space-y-3">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Project Description Optimizations
                          </span>

                          {(
                            resumeSuggestions.projects ||
                            []
                          ).map(
                            (
                              project: ResumeProjectSuggestion,
                              index: number
                            ) => {
                              const id =
                                `project-${index}`;

                              return (
                                <div
                                  key={`${project.title}-${index}`}
                                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <h4 className="text-xs font-extrabold text-slate-800">
                                      {project.title ||
                                        "Project"}
                                    </h4>

                                    <button
                                      onClick={() =>
                                        handleApplySuggestion(
                                          "project",
                                          project,
                                          id
                                        )
                                      }
                                      disabled={
                                        applyingSuggestion !==
                                        null
                                      }
                                      className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg bg-purple-600 px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {applyingSuggestion ===
                                      id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Plus className="h-3 w-3" />
                                      )}

                                      Apply
                                    </button>
                                  </div>

                                  <p className="mt-3 rounded-xl border border-slate-200 bg-white p-4 text-xs font-medium italic leading-relaxed text-slate-600">
                                    &quot;
                                    {project.improved_description ||
                                      project.improvedDescription ||
                                      "No improved description available."}
                                    &quot;
                                  </p>
                                </div>
                              );
                            }
                          )}
                        </div>
                      )}

                      {!resumeSuggestions.about_me &&
                        (
                          resumeSuggestions.projects ||
                          []
                        ).length === 0 && (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                            <p className="text-xs italic text-slate-400">
                              No optimization recommendations
                              compiled yet.
                            </p>
                          </div>
                        )}
                    </div>
                  ) : (
                    <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                      <p className="text-xs italic text-slate-400">
                        No optimization recommendations compiled yet.
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {showImportDialog &&
          (pendingImports.length > 0 || selectedImportItem) && (
            <>
              <motion.div
                className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm"
                initial={{
                  opacity: 0,
                }}
                animate={{
                  opacity: 1,
                }}
                exit={{
                  opacity: 0,
                }}
                onClick={
                  closeImportModal
                }
              />

              <motion.div
                className="fixed left-1/2 top-1/2 z-[60] flex max-h-[90vh] w-[calc(100%-2rem)] max-w-[620px] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
                initial={{
                  opacity: 0,
                  scale: 0.95,
                }}
                animate={{
                  opacity: 1,
                  scale: 1,
                }}
                exit={{
                  opacity: 0,
                  scale: 0.95,
                }}
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100">
                      <Sparkles className="h-5 w-5 text-purple-600" />
                    </div>

                    <div>
                      <h3 className="text-sm font-extrabold text-slate-800">
                        Profile Data Import
                      </h3>

                      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Source:{" "}
                        {selectedImportItem?.source ||
                          pendingImports[0]?.source ||
                          "External"}{" "}
                        • {pendingImports.length} pending item(s)
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={
                      closeImportModal
                    }
                    className="cursor-pointer rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Subheader / Tabs if multiple items */}
                {pendingImports.length > 1 && (
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 text-xs">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setModalViewMode("batch")}
                        className={`rounded-lg px-3 py-1 font-bold transition ${
                          modalViewMode === "batch"
                            ? "bg-purple-100 text-purple-700"
                            : "text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        All Items ({pendingImports.length})
                      </button>

                      {selectedImportItem && (
                        <button
                          type="button"
                          onClick={() => setModalViewMode("single")}
                          className={`rounded-lg px-3 py-1 font-bold transition ${
                            modalViewMode === "single"
                              ? "bg-purple-100 text-purple-700"
                              : "text-slate-500 hover:bg-slate-100"
                          }`}
                        >
                          Single Item Detail
                        </button>
                      )}
                    </div>

                    {modalViewMode === "batch" && (
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedImportIds.size === pendingImports.length) {
                            setSelectedImportIds(new Set());
                          } else {
                            setSelectedImportIds(
                              new Set(
                                pendingImports
                                  .map((i) => i.id)
                                  .filter(Boolean) as (number | string)[]
                              )
                            );
                          }
                        }}
                        className="text-xs font-semibold text-purple-600 hover:text-purple-800"
                      >
                        {selectedImportIds.size === pendingImports.length
                          ? "Deselect All"
                          : `Select All (${pendingImports.length})`}
                      </button>
                    )}
                  </div>
                )}

                {/* Content: Batch Mode vs Single Item Mode */}
                {modalViewMode === "batch" && pendingImports.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500">
                      Select which items to add to your HireVision profile and live resume. You can review or reject items at any time.
                    </p>

                    <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                      {pendingImports.map((item) => {
                        const isChecked = selectedImportIds.has(item.id ?? "");
                        return (
                          <div
                            key={String(item.id)}
                            onClick={() => {
                              const newSet = new Set(selectedImportIds);
                              if (isChecked) {
                                newSet.delete(item.id ?? "");
                              } else {
                                newSet.add(item.id ?? "");
                              }
                              setSelectedImportIds(newSet);
                            }}
                            className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition ${
                              isChecked
                                ? "border-purple-200 bg-purple-50/50"
                                : "border-slate-200 bg-white hover:bg-slate-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} // handled by row click
                              className="mt-1 h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                            />

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="rounded-md border border-purple-100 bg-purple-50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-purple-700">
                                  {item.item_type || item.itemType || "ITEM"}
                                </span>
                                <h4 className="text-xs font-bold text-slate-800">
                                  {item.title || "Untitled Item"}
                                </h4>
                              </div>

                              {item.description && (
                                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-600">
                                  {item.description}
                                </p>
                              )}

                              {item.metadata?.technologies && (
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  {(Array.isArray(item.metadata.technologies)
                                    ? item.metadata.technologies
                                    : [item.metadata.technologies]
                                  ).map((tech, idx) => (
                                    <span
                                      key={`${tech}-${idx}`}
                                      className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600"
                                    >
                                      {String(tech)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedImportItem(item);
                                setModalViewMode("single");
                              }}
                              className="shrink-0 text-[10px] font-bold text-purple-600 hover:text-purple-800"
                            >
                              Detail →
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Batch Actions Footer */}
                    <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                      <button
                        onClick={() => handleBatchReject()}
                        disabled={importing || selectedImportIds.size === 0}
                        className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Cancel / Reject Selected ({selectedImportIds.size})
                      </button>

                      <button
                        onClick={() => handleBatchApprove()}
                        disabled={importing || selectedImportIds.size === 0}
                        className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {importing && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        Add Selected ({selectedImportIds.size})
                      </button>
                    </div>
                  </div>
                ) : selectedImportItem ? (
                  <div className="space-y-4">
                    {pendingImports.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setModalViewMode("batch")}
                        className="text-xs font-semibold text-purple-600 hover:text-purple-800"
                      >
                        ← Back to all items ({pendingImports.length})
                      </button>
                    )}

                    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <div>
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          {selectedImportItem.item_type || selectedImportItem.itemType || "ITEM"}
                        </span>
                        <span className="mt-1 block text-sm font-extrabold text-slate-800">
                          {selectedImportItem.title || "Untitled Item"}
                        </span>
                      </div>

                      <div>
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          Details
                        </span>
                        <p className="mt-1 text-xs font-medium leading-relaxed text-slate-600">
                          {selectedImportItem.description || "No description available."}
                        </p>
                      </div>

                      {selectedImportItem.metadata?.technologies && (
                        <div>
                          <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                            Technologies Detected
                          </span>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {(Array.isArray(selectedImportItem.metadata.technologies)
                              ? selectedImportItem.metadata.technologies
                              : [selectedImportItem.metadata.technologies]
                            ).map((tech, idx) => (
                              <span
                                key={`${tech}-${idx}`}
                                className="rounded-lg border border-purple-100 bg-white px-2.5 py-1 text-[10px] font-bold text-purple-600"
                              >
                                {String(tech)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedImportItem.metadata?.issuer && (
                        <div>
                          <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                            Issuer / Organization
                          </span>
                          <span className="mt-1 block text-xs font-bold text-slate-700">
                            {String(selectedImportItem.metadata.issuer)}
                            {(selectedImportItem.metadata.issue_date ?? selectedImportItem.metadata.issueDate)
                              ? ` (${selectedImportItem.metadata.issue_date ?? selectedImportItem.metadata.issueDate})`
                              : ""}
                          </span>
                        </div>
                      )}

                      {selectedImportItem.metadata?.company && (
                        <div>
                          <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                            Company & Period
                          </span>
                          <span className="mt-1 block text-xs font-bold text-slate-700">
                            {String(selectedImportItem.metadata.company)}
                            {selectedImportItem.metadata.location ? ` • ${selectedImportItem.metadata.location}` : ""}
                            {(selectedImportItem.metadata.start_date || selectedImportItem.metadata.end_date)
                              ? ` (${selectedImportItem.metadata.start_date || ""} - ${selectedImportItem.metadata.end_date || (selectedImportItem.metadata.current ? "Present" : "")})`
                              : ""}
                          </span>
                        </div>
                      )}

                      {selectedImportItem.metadata?.institution && (
                        <div>
                          <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                            Institution & Degree
                          </span>
                          <span className="mt-1 block text-xs font-bold text-slate-700">
                            {String(selectedImportItem.metadata.institution)}
                            {selectedImportItem.metadata.degree ? ` • ${selectedImportItem.metadata.degree}` : ""}
                            {selectedImportItem.metadata.field_of_study ? ` (${selectedImportItem.metadata.field_of_study})` : ""}
                            {selectedImportItem.metadata.end_year ? ` [${selectedImportItem.metadata.end_year}]` : ""}
                          </span>
                        </div>
                      )}

                      {selectedImportItem.metadata?.proficiency && (
                        <div>
                          <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                            Proficiency
                          </span>
                          <span className="mt-1 block text-xs font-bold text-slate-700">
                            {String(selectedImportItem.metadata.proficiency)}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between gap-3 border-t border-slate-200 pt-3 text-[10px] font-semibold text-slate-400">
                        <span>
                          Source: {selectedImportItem.source || "External"}
                        </span>
                        <span className="max-w-[220px] truncate font-bold text-purple-600">
                          External ID: {selectedImportItem.external_id || selectedImportItem.externalId || "N/A"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                      <div>
                        <span className="text-xs font-bold text-slate-800">
                          Permission Required
                        </span>
                        <p className="mt-1 text-[10px] font-medium leading-relaxed text-slate-500">
                          Would you like to import this item directly to your profile and live resume? You can edit or remove it later.
                        </p>
                      </div>
                    </div>

                    {/* Single Item Action Buttons */}
                    <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                      <button
                        onClick={() =>
                          handleRejectImport(Number(selectedImportItem.id))
                        }
                        disabled={importing || !selectedImportItem.id}
                        className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        No, Keep Private
                      </button>

                      <button
                        onClick={() =>
                          handleApproveImport(Number(selectedImportItem.id))
                        }
                        disabled={importing || !selectedImportItem.id}
                        className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {importing && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        Yes, Add to Profile
                      </button>
                    </div>
                  </div>
                ) : null}
              </motion.div>
            </>
          )}
      </AnimatePresence>
    </div>
  );
}