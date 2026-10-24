/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @next/next/no-img-element */
"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Send,
  Zap,
  Plus,
  MessageSquare,
  Trash2,
  RotateCcw,
  History,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Brain,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Profile } from "@/types/profile";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface FloatingAIAgentProps {
  profile?: any;
  token?: string | null;
  mode?: "candidate" | "recruiter";
}

interface Message {
  id?: string;
  sender: "user" | "agent";
  text: string;
  timestamp: Date;
  analysis?: AnalysisSnapshot;
}

interface Chat {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  deleted?: boolean;
  messages?: Message[];
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

type AgentStatus =
  | "ok"
  | "partial"
  | "pending"
  | "error"
  | "unknown";

interface AgentResult {
  agent_name?: string;
  status?: AgentStatus | string;
  confidence?: string | number;
  result?: unknown;
  evidence?: unknown[];
  missing_data?: unknown[];
  recommendations?: unknown[];
  error?: unknown;
  metadata?: Record<string, unknown>;
}

interface RoutingSnapshot {
  primaryCapability?: string;
  capabilities?: string[];
  confidence?: number | string;
  intent?: string;
  targetRoleForGaps?: string;
}

interface AnalysisSnapshot {
  routing?: RoutingSnapshot | null;
  agents?: AgentResult[];
  confidence?: string | number;
  evidence?: unknown[];
  missingData?: unknown[];
  recommendations?: unknown[];
  status?: AgentStatus | string;
}

interface ApiResponse {
  reply?: string;
  response?: string;
  answer?: string;
  result?: string | Record<string, unknown>;
  message?: string;

  chatId?: string | number;
  conversationId?: string | number;

  chat?: {
    id?: string | number;
  };

  routing?: RoutingSnapshot;
  agentRouted?: string;
  primaryCapability?: string;
  agents?: unknown;
  agentResults?: unknown;
  confidence?: string | number;
  evidence?: unknown[];
  missing_data?: unknown[];
  missingData?: unknown[];
  recommendations?: unknown[];
  status?: AgentStatus | string;
  metadata?: Record<string, unknown>;
}

const DEFAULT_WIDTH = 420;
const MIN_WIDTH = 320;
const MAX_WIDTH = 800;

import { normalizeApiUrl } from "@/lib/api";

const API_BASE = normalizeApiUrl();

const INITIAL_AGENT_MESSAGE =
  "Hello! I am your HireVision AI Agent. You can ask me about your resume, career, skills, projects, GitHub, LinkedIn, jobs, ATS, learning plans, or any other question. I will understand your request and use the appropriate specialist intelligence when needed.";

const INITIAL_RECRUITER_MESSAGE =
  "Hello! I am your HireVision AI Recruitment Copilot. You can ask me to evaluate candidate matches, analyze job requirements, rank applicants by evidence, identify hiring bottlenecks, and explore talent pools.";

const QUICK_PROMPTS = [
  "Analyze my live resume",
  "Analyze my live resume and improve my bio",
  "Improve my bio",
  "Analyze my GitHub",
  "Analyze my LinkedIn",
  "Analyze my profile",
  "What skills should I learn next?",
];

const RECRUITER_QUICK_PROMPTS = [
  "Show top candidates for my active jobs",
  "Which candidates need verification?",
  "Analyze my hiring pipeline and identify bottlenecks",
  "Find candidates with React and TypeScript",
  "Give me hiring insights for my recent postings",
];

const AGENT_LABELS: Record<string, string> = {
  profile_analysis_agent: "Profile Analysis",
  skill_analysis_agent: "Skill Analysis",
  project_analysis_agent: "Project Analysis",
  career_agent: "Career Intelligence",
  skill_gap_agent: "Skill Gap Analysis",
  career_readiness_agent: "Career Readiness",
  resume_intelligence_agent: "Resume Intelligence",
  github_agent: "GitHub Intelligence",
  linkedin_agent: "LinkedIn Intelligence",
  evidence_analysis_agent: "Evidence Analysis",
  live_resume_agent: "Live Resume",
  coding_agent: "Coding Intelligence",
  teaching_agent: "Teaching Intelligence",
  job_requirement_agent: "Job Requirement Intelligence",
  candidate_discovery_agent: "Candidate Discovery",
  live_resume_intelligence_agent: "Live Resume Intelligence",
  candidate_job_matching_agent: "Job Matching Intelligence",
  candidate_ranking_agent: "Candidate Ranking Intelligence",
  candidate_comparison_agent: "Candidate Comparison Intelligence",
  profile_evidence_agent: "Profile Evidence Verification",
  candidate_shortlisting_agent: "Candidate Shortlisting Intelligence",
  talent_pool_agent: "Talent Pool Intelligence",
  hiring_pipeline_agent: "Hiring Pipeline Intelligence",
  recruiter_analytics_agent: "Recruiter Analytics Intelligence",
  candidate_reengagement_agent: "Candidate Re-engagement",
};

function normalizeMessage(message: any): Message {
  const sender =
    message?.sender === "user" ||
    message?.role === "user"
      ? "user"
      : "agent";

  return {
    id: message?.id ? String(message.id) : undefined,
    sender,
    text:
      typeof message?.text === "string"
        ? message.text
        : typeof message?.content === "string"
          ? message.content
          : "",
    timestamp: new Date(
      message?.created_at ||
        message?.createdAt ||
        message?.timestamp ||
        Date.now()
    ),
    analysis:
      message?.analysis &&
      typeof message.analysis === "object"
        ? message.analysis
        : undefined,
  };
}

function normalizeConversation(
  messages: Message[]
): ConversationMessage[] {
  return messages
    .filter((message) => Boolean(message.text?.trim()))
    .map((message) => ({
      role:
        message.sender === "user"
          ? "user"
          : "assistant",
      content: message.text,
    }));
}

function normalizeAgentName(agentName: string) {
  if (AGENT_LABELS[agentName]) {
    return AGENT_LABELS[agentName];
  }

  return String(agentName || "AI Agent")
    .replace(/_agent$/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeAgentResults(
  value: unknown
): AgentResult[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .filter(
        (item) =>
          item &&
          typeof item === "object"
      )
      .map((item) => item as AgentResult);
  }

  if (typeof value === "object") {
    return Object.entries(
      value as Record<string, unknown>
    )
      .filter(
        ([, item]) =>
          item &&
          typeof item === "object"
      )
      .map(([name, item]) => ({
        ...(item as AgentResult),
        agent_name:
          (item as AgentResult).agent_name || name,
      }));
  }

  return [];
}

function normalizeConfidence(confidence: unknown) {
  if (
    typeof confidence === "number" &&
    Number.isFinite(confidence)
  ) {
    const normalized =
      confidence > 1
        ? confidence / 100
        : confidence;

    return Math.max(
      0,
      Math.min(1, normalized)
    );
  }

  if (typeof confidence === "string") {
    const numeric = Number(confidence);

    if (Number.isFinite(numeric)) {
      const normalized =
        numeric > 1
          ? numeric / 100
          : numeric;

      return Math.max(
        0,
        Math.min(1, normalized)
      );
    }

    const upper = confidence
      .trim()
      .toUpperCase();

    if (upper === "HIGH") {
      return 0.85;
    }

    if (upper === "MEDIUM") {
      return 0.6;
    }

    if (upper === "LOW") {
      return 0.3;
    }
  }

  return null;
}

function confidenceLabel(confidence: unknown) {
  const normalized =
    normalizeConfidence(confidence);

  if (normalized === null) {
    return "Unknown";
  }

  if (normalized >= 0.8) {
    return "High";
  }

  if (normalized >= 0.55) {
    return "Medium";
  }

  return "Low";
}

function getAgentStatusClass(status?: string) {
  switch (
    String(status || "").toLowerCase()
  ) {
    case "ok":
      return "text-emerald-600 bg-emerald-50 border-emerald-100";

    case "partial":
      return "text-amber-600 bg-amber-50 border-amber-100";

    case "pending":
      return "text-blue-600 bg-blue-50 border-blue-100";

    case "error":
      return "text-red-600 bg-red-50 border-red-100";

    default:
      return "text-slate-500 bg-slate-50 border-slate-200";
  }
}

function getAgentStatusLabel(status?: string) {
  switch (
    String(status || "").toLowerCase()
  ) {
    case "ok":
      return "Completed";

    case "partial":
      return "Partial";

    case "pending":
      return "Pending";

    case "error":
      return "Unavailable";

    default:
      return "Processed";
  }
}

function getEvidenceSummary(
  agents: AgentResult[]
) {
  const values: string[] = [];

  for (const agent of agents) {
    if (!Array.isArray(agent.evidence)) {
      continue;
    }

    for (const item of agent.evidence) {
      if (
        typeof item === "string" &&
        item.trim()
      ) {
        values.push(item.trim());
      }

      if (
        item &&
        typeof item === "object"
      ) {
        const evidence =
          item as Record<string, unknown>;

        const classification =
          evidence.classification ||
          evidence.status ||
          evidence.type;

        if (
          typeof classification === "string" &&
          classification.trim()
        ) {
          values.push(
            classification
              .trim()
              .toUpperCase()
          );
        }
      }
    }
  }

  return [...new Set(values)].slice(0, 6);
}

export default function FloatingAIAgent({
  profile,
  token: propToken,
  mode = "candidate",
}: FloatingAIAgentProps) {
  const isRecruiter = mode === "recruiter";
  const initialGreeting = isRecruiter ? INITIAL_RECRUITER_MESSAGE : INITIAL_AGENT_MESSAGE;
  const activePrompts = isRecruiter ? RECRUITER_QUICK_PROMPTS : QUICK_PROMPTS;

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);

  const [
    processingStage,
    setProcessingStage,
  ] = useState(
    "Understanding your request..."
  );

  const [
    lastAnalysis,
    setLastAnalysis,
  ] = useState<AnalysisSnapshot | null>(
    null
  );

  const [
    showAnalysis,
    setShowAnalysis,
  ] = useState(false);

  const [
    sidebarWidth,
    setSidebarWidth,
  ] = useState(DEFAULT_WIDTH);

  const [
    isResizing,
    setIsResizing,
  ] = useState(false);

  const [
    showHistory,
    setShowHistory,
  ] = useState(false);

  const [
    loadingHistory,
    setLoadingHistory,
  ] = useState(false);

  const [
    loadingChat,
    setLoadingChat,
  ] = useState(false);

  const [chats, setChats] = useState<Chat[]>([]);
  const [
    currentChatId,
    setCurrentChatId,
  ] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "agent",
      text: isRecruiter ? INITIAL_RECRUITER_MESSAGE : INITIAL_AGENT_MESSAGE,
      timestamp: new Date(),
    },
  ]);

  const scrollRef =
    useRef<HTMLDivElement>(null);

  const inputRef =
    useRef<HTMLTextAreaElement>(null);

  const resizeStartX =
    useRef<number | null>(null);

  const resizeStartWidth =
    useRef<number>(DEFAULT_WIDTH);

  const isMountedRef =
    useRef(true);

  const getSupportedLanguage =
    useCallback(() => {
      if (typeof navigator === "undefined") {
        return "en";
      }

      const languages = [
        navigator.language,
        ...(navigator.languages || []),
      ].filter(Boolean);

      for (const language of languages) {
        const lower =
          language.toLowerCase();

        if (lower.startsWith("hi")) {
          return "hi";
        }

        if (lower.startsWith("gu")) {
          return "gu";
        }

        if (lower.startsWith("en")) {
          return "en";
        }
      }

      return "en";
    }, []);

  const getToken = useCallback((): string => {
    if (propToken && typeof propToken === "string") {
      let t = propToken.trim();
      if (
        (t.startsWith('"') && t.endsWith('"')) ||
        (t.startsWith("'") && t.endsWith("'"))
      ) {
        t = t.slice(1, -1).trim();
      }
      if (t.toLowerCase().startsWith("bearer ")) {
        t = t.slice(7).trim();
      }
      if (t && t !== "undefined" && t !== "null" && t !== "[object Object]") {
        return t;
      }
    }

    if (typeof window === "undefined") {
      return "";
    }

    const candidateSources = [
      localStorage.getItem("token"),
      localStorage.getItem("hirevision_token"),
      sessionStorage.getItem("token"),
      sessionStorage.getItem("hirevision_token"),
    ];

    for (const item of candidateSources) {
      if (typeof item === "string" && item.trim()) {
        let token = item.trim();
        // Strip quotes if saved with JSON.stringify
        if (
          (token.startsWith('"') && token.endsWith('"')) ||
          (token.startsWith("'") && token.endsWith("'"))
        ) {
          token = token.slice(1, -1).trim();
        }
        if (token.startsWith("{") && token.endsWith("}")) {
          try {
            const parsed = JSON.parse(token);
            if (parsed && typeof parsed === "object") {
              const inner =
                parsed.token ||
                parsed.accessToken ||
                parsed.access_token ||
                parsed.hirevision_token;
              if (typeof inner === "string") {
                token = inner.trim();
              }
            }
          } catch {
            // keep as is
          }
        }
        if (token.toLowerCase().startsWith("bearer ")) {
          token = token.slice(7).trim();
        }
        if (
          token &&
          token !== "undefined" &&
          token !== "null" &&
          token !== "[object Object]"
        ) {
          return token;
        }
      }
    }

    return "";
  }, [propToken]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop =
        scrollRef.current.scrollHeight;
    }
  }, [messages, thinking]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!open || showHistory) {
      return;
    }

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 350);

    return () => window.clearTimeout(timer);
  }, [open, showHistory]);

  const handleResizeStart = (
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    if (!open) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    resizeStartX.current = e.clientX;
    resizeStartWidth.current = sidebarWidth;

    setIsResizing(true);

    try {
      e.currentTarget.setPointerCapture?.(
        e.pointerId
      );
    } catch {
      return;
    }
  };

  useEffect(() => {
    if (!isResizing) {
      return;
    }

    const handlePointerMove = (
      e: PointerEvent
    ) => {
      if (resizeStartX.current === null) {
        return;
      }

      const delta =
        resizeStartX.current - e.clientX;

      const newWidth =
        resizeStartWidth.current + delta;

      const viewportWidth =
        typeof window !== "undefined"
          ? window.innerWidth
          : MAX_WIDTH;

      const dynamicMaxWidth = Math.min(
        MAX_WIDTH,
        Math.max(
          MIN_WIDTH,
          Math.floor(viewportWidth * 0.9)
        )
      );

      const clampedWidth = Math.min(
        Math.max(newWidth, MIN_WIDTH),
        dynamicMaxWidth
      );

      setSidebarWidth(clampedWidth);
    };

    const handlePointerUp = () => {
      resizeStartX.current = null;
      setIsResizing(false);
    };

    window.addEventListener(
      "pointermove",
      handlePointerMove
    );

    window.addEventListener(
      "pointerup",
      handlePointerUp
    );

    return () => {
      window.removeEventListener(
        "pointermove",
        handlePointerMove
      );

      window.removeEventListener(
        "pointerup",
        handlePointerUp
      );
    };
  }, [isResizing]);

  useEffect(() => {
    if (!isResizing) {
      return;
    }

    const previousUserSelect =
      document.body.style.userSelect;

    const previousCursor =
      document.body.style.cursor;

    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    return () => {
      document.body.style.userSelect =
        previousUserSelect;

      document.body.style.cursor =
        previousCursor;
    };
  }, [isResizing]);

  const loadChats = useCallback(
    async () => {
      try {
        setLoadingHistory(true);

        const token = getToken();
        if (!token) {
          setLoadingHistory(false);
          return;
        }

        const response = await fetch(
          `${API_BASE}/api/ai/chats`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(
            "Unable to load chat history."
          );
        }

        const data = await response.json();

        const serverChats =
          Array.isArray(data?.chats)
            ? data.chats
            : Array.isArray(data)
              ? data
              : [];

        const normalizedChats: Chat[] =
          serverChats.map((chat: any) => ({
            id: String(chat.id),

            title:
              chat.title ||
              "New conversation",

            createdAt: new Date(
              chat.created_at ||
                chat.createdAt ||
                Date.now()
            ),

            updatedAt: new Date(
              chat.updated_at ||
                chat.updatedAt ||
                Date.now()
            ),

            deleted:
              Boolean(chat.deleted) ||
              Boolean(chat.is_deleted),
          }));

        if (isMountedRef.current) {
          setChats(normalizedChats);
        }
      } catch (error) {
        console.error(
          "[FloatingAIAgent] Chat history error:",
          error
        );
      } finally {
        if (isMountedRef.current) {
          setLoadingHistory(false);
        }
      }
    },
    [getToken]
  );

  useEffect(() => {
    if (open) {
      void loadChats();
    }
  }, [open, loadChats]);

  const loadChat = async (chatId: string) => {
    if (thinking) {
      return;
    }

    try {
      setLoadingChat(true);

      const token = getToken();
      if (!token) {
        setLoadingChat(false);
        return;
      }

      const response = await fetch(
        `${API_BASE}/api/ai/chats/${chatId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          "Unable to load conversation."
        );
      }

      const data = await response.json();

      const serverMessages =
        Array.isArray(data?.messages)
          ? data.messages
          : Array.isArray(
                data?.chat?.messages
              )
            ? data.chat.messages
            : [];

      const normalizedMessages =
        serverMessages
          .map(normalizeMessage)
          .filter(
            (message: Message) =>
              Boolean(message.text.trim())
          );

      setCurrentChatId(String(chatId));

      setMessages(
        normalizedMessages.length
          ? normalizedMessages
          : [
              {
                sender: "agent",
                text: INITIAL_AGENT_MESSAGE,
                timestamp: new Date(),
              },
            ]
      );

      setLastAnalysis(null);
      setShowAnalysis(false);
      setShowHistory(false);

      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } catch (error) {
      console.error(
        "[FloatingAIAgent] Load chat error:",
        error
      );
    } finally {
      setLoadingChat(false);
    }
  };

  const createNewChat = async () => {
    if (thinking) {
      return;
    }

    try {
      const token = getToken();
      if (!token) {
        return;
      }

      const response = await fetch(
        `${API_BASE}/api/ai/chats`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: "New conversation",
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          "Unable to create new chat."
        );
      }

      const data = await response.json();

      const chatId =
        data?.chat?.id || data?.id;

      setCurrentChatId(
        chatId ? String(chatId) : null
      );

      setMessages([
        {
          sender: "agent",
          text: INITIAL_AGENT_MESSAGE,
          timestamp: new Date(),
        },
      ]);

      setInput("");
      setLastAnalysis(null);
      setShowAnalysis(false);
      setShowHistory(false);

      await loadChats();

      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } catch (error) {
      console.error(
        "[FloatingAIAgent] Create chat error:",
        error
      );

      setCurrentChatId(null);

      setMessages([
        {
          sender: "agent",
          text: INITIAL_AGENT_MESSAGE,
          timestamp: new Date(),
        },
      ]);

      setInput("");
      setLastAnalysis(null);
      setShowAnalysis(false);
      setShowHistory(false);
    }
  };

  const deleteChat = async (
    chatId: string,
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation();

    try {
      const token = getToken();
      if (!token) {
        return;
      }

      const response = await fetch(
        `${API_BASE}/api/ai/chats/${chatId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          "Unable to delete chat."
        );
      }

      setChats((prev) =>
        prev.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                deleted: true,
              }
            : chat
        )
      );

      if (currentChatId === chatId) {
        setCurrentChatId(null);

        setMessages([
          {
            sender: "agent",
            text:
              "Chat deleted. Start a new conversation whenever you are ready.",
            timestamp: new Date(),
          },
        ]);

        setLastAnalysis(null);
        setShowAnalysis(false);
      }
    } catch (error) {
      console.error(
        "[FloatingAIAgent] Delete chat error:",
        error
      );
    }
  };

  const restoreChat = async (
    chatId: string,
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation();

    try {
      const token = getToken();
      if (!token) {
        return;
      }

      const response = await fetch(
        `${API_BASE}/api/ai/chats/${chatId}/restore`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          "Unable to restore chat."
        );
      }

      setChats((prev) =>
        prev.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                deleted: false,
              }
            : chat
        )
      );
    } catch (error) {
      console.error(
        "[FloatingAIAgent] Restore chat error:",
        error
      );
    }
  };

  const extractReply = (data: ApiResponse) => {
    if (
      typeof data?.reply === "string" &&
      data.reply.trim()
    ) {
      return data.reply.trim();
    }

    if (
      typeof data?.response === "string" &&
      data.response.trim()
    ) {
      return data.response.trim();
    }

    if (
      typeof data?.answer === "string" &&
      data.answer.trim()
    ) {
      return data.answer.trim();
    }

    if (
      typeof data?.result === "string" &&
      data.result.trim()
    ) {
      return data.result.trim();
    }

    if (
      data?.result &&
      typeof data.result === "object"
    ) {
      const result =
        data.result as Record<string, unknown>;

      const candidates = [
        result.summary,
        result.answer,
        result.response,
        result.message,
        result.text,
      ];

      for (const candidate of candidates) {
        if (
          typeof candidate === "string" &&
          candidate.trim()
        ) {
          return candidate.trim();
        }
      }
    }

    return "I was unable to generate a response.";
  };

  const buildAnalysisSnapshot = (
    data: ApiResponse
  ): AnalysisSnapshot | null => {
    const agents =
      normalizeAgentResults(
        data?.agentResults ||
          data?.agents
      );

    const routing =
      data?.routing ||
      (data?.primaryCapability ||
      data?.agentRouted
        ? {
            primaryCapability:
              data.primaryCapability ||
              data.agentRouted ||
              "",
            capabilities: [],
            confidence: data.confidence,
          }
        : null);

    const hasAnalysis = Boolean(
      routing ||
        agents.length ||
        data?.confidence ||
        data?.evidence?.length ||
        data?.missing_data?.length ||
        data?.missingData?.length ||
        data?.recommendations?.length ||
        data?.status
    );

    if (!hasAnalysis) {
      return null;
    }

    return {
      routing,
      agents,
      confidence: data?.confidence,

      evidence:
        Array.isArray(data?.evidence)
          ? data.evidence
          : [],

      missingData:
        Array.isArray(data?.missing_data)
          ? data.missing_data
          : Array.isArray(data?.missingData)
            ? data.missingData
            : [],

      recommendations:
        Array.isArray(data?.recommendations)
          ? data.recommendations
          : [],

      status: data?.status || "ok",
    };
  };

  const handleSend = async (
    e?: React.FormEvent<HTMLFormElement>
  ) => {
    e?.preventDefault();

    if (!input.trim() || thinking) {
      return;
    }

    const userText = input.trim();

    const conversation =
      normalizeConversation(messages);

    const userMessage: Message = {
      sender: "user",
      text: userText,
      timestamp: new Date(),
    };

    setMessages((prev) => [
      ...prev,
      userMessage,
    ]);

    setInput("");
    setThinking(true);
    setLastAnalysis(null);
    setShowAnalysis(false);
    setProcessingStage(
      "Understanding your request..."
    );

    try {
      const token = getToken();
      if (!token) {
        setThinking(false);
        setProcessingStage("");
        setMessages((prev) => [
          ...prev,
          {
            sender: "agent",
            text: "You are not logged in or your session has expired. Please log in to your account to chat with the AI Agent.",
            timestamp: new Date(),
          },
        ]);
        return;
      }

      const language =
        getSupportedLanguage();

      setProcessingStage(
        "Selecting the right intelligence..."
      );

      const response = await fetch(
        `${API_BASE}/api/ai/chat`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: userText,
            history: conversation,
            conversation,
            chatId: currentChatId,
            profile,
            language,
            responseLanguage: language,
            mode: isRecruiter ? "recruiter" : "candidate",
            source: isRecruiter
              ? "hirevision-recruiter-orchestrator"
              : "hirevision-ai-orchestrator",
            client: isRecruiter
              ? "floating-recruiter-agent"
              : "floating-ai-agent",
          }),
        }
      );

      setProcessingStage(
        "Analyzing your information..."
      );

      let data: ApiResponse | null = null;

      try {
        data =
          (await response.json()) as ApiResponse;
      } catch {
        data = null;
      }

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(
            "Your session has expired or authentication is missing. Please log in again."
          );
        }

        throw new Error(
          data?.message ||
            "Failed to contact AI Agent."
        );
      }

      if (!data) {
        throw new Error(
          "The AI service returned an invalid response."
        );
      }

      const reply = extractReply(data);
      const analysis =
        buildAnalysisSnapshot(data);

      const returnedChatId =
        data?.chatId ||
        data?.chat?.id ||
        data?.conversationId;

      if (returnedChatId) {
        setCurrentChatId(
          String(returnedChatId)
        );
      }

      setProcessingStage(
        "Preparing your answer..."
      );

      setMessages((prev) => [
        ...prev,
        {
          sender: "agent",
          text: reply,
          timestamp: new Date(),
          analysis: analysis || undefined,
        },
      ]);

      if (analysis) {
        setLastAnalysis(analysis);
      }

      await loadChats();
    } catch (error: any) {
      const isSessionError =
        error?.message &&
        (error.message.includes("session has expired") ||
          error.message.includes("log in") ||
          error.message.includes("Token format is invalid") ||
          error.message.includes("authorization token") ||
          error.message.includes("401") ||
          error.message.includes("403"));

      if (isSessionError) {
        console.warn(
          "[FloatingAIAgent] Auth session notice:",
          error?.message || error
        );
      } else {
        console.error(
          "[FloatingAIAgent] Send message error:",
          error
        );
      }

      setMessages((prev) => [
        ...prev,
        {
          sender: "agent",
          text: isSessionError
            ? "Your session has expired or authentication is missing. Please log in again to chat with the AI Agent."
            : "I’m sorry, I couldn't process that request right now. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      if (isMountedRef.current) {
        setThinking(false);
        setProcessingStage(
          "Understanding your request..."
        );
      }

      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (
      e.key === "Enter" &&
      !e.shiftKey
    ) {
      e.preventDefault();

      if (
        input.trim() &&
        !thinking
      ) {
        void handleSend();
      }
    }
  };

  const handleClose = () => {
    if (isResizing) {
      return;
    }

    setOpen(false);
  };

  const getChatTitle = (chat: Chat) => {
    if (chat.title?.trim()) {
      return chat.title;
    }

    return "New conversation";
  };

  const formatChatDate = (date: Date) => {
    try {
      return date.toLocaleDateString(
        undefined,
        {
          month: "short",
          day: "numeric",
        }
      );
    } catch {
      return "";
    }
  };

  const analysisAgents = useMemo(
    () => lastAnalysis?.agents || [],
    [lastAnalysis]
  );

  const evidenceSummary = useMemo(
    () =>
      getEvidenceSummary(
        analysisAgents
      ),
    [analysisAgents]
  );

  const confidenceText =
    confidenceLabel(
      lastAnalysis?.confidence
    );

  return (
    <>
      <div className="fixed bottom-6 right-6 z-[9999] print:hidden">
        <motion.button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open HireVision AI Agent"
          className="relative w-16 h-16 rounded-full overflow-visible flex items-center justify-center cursor-pointer group"
          animate={{
            boxShadow: [
              "0px 8px 25px rgba(79, 70, 229, 0.20)",
              "0px 8px 35px rgba(124, 58, 237, 0.42)",
              "0px 8px 25px rgba(79, 70, 229, 0.20)",
            ],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          whileHover={{
            scale: 1.06,
            y: -2,
          }}
          whileTap={{
            scale: 0.96,
          }}
        >
          <img
            src="/agent_icon.png"
            alt="HireVision AI Agent"
            className="w-16 h-16 rounded-full object-cover border border-white/30 shadow-xl"
          />

          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full border-[2px] border-white shadow-md animate-pulse" />

          <div className="absolute right-[76px] top-1/2 -translate-y-1/2 bg-slate-900 text-white text-[10px] font-bold py-2 px-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg pointer-events-none">
            {isRecruiter ? "Ask Recruitment AI" : "Ask HireVision AI"}
          </div>
        </motion.button>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 bg-slate-900/30 z-[10000] backdrop-blur-sm print:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
            />

            <motion.div
              className="fixed top-0 bottom-0 right-0 max-w-[90vw] bg-white/95 backdrop-blur-md shadow-2xl z-[10001] flex flex-col border-l border-slate-200/80 print:hidden font-inter overflow-hidden"
              style={{
                width: `${sidebarWidth}px`,
                willChange: isResizing
                  ? "width"
                  : "transform",
              }}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{
                type: "spring",
                bounce: 0.1,
                duration: 0.4,
              }}
            >
              <div
                role="separator"
                aria-label="Resize chat sidebar"
                aria-orientation="vertical"
                onPointerDown={
                  handleResizeStart
                }
                className="absolute left-0 top-0 bottom-0 w-2 z-[70] cursor-col-resize group touch-none"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-indigo-300/60 transition-colors" />

                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-16 rounded-full bg-slate-300/0 group-hover:bg-indigo-400/70 transition-colors" />
              </div>

              <div className="px-[18px] py-[16px] bg-slate-50 border-b border-slate-200/60 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl overflow-hidden shadow-md border border-slate-200 bg-slate-950 shrink-0">
                    <img
                      src="/agent_icon.png"
                      alt="HireVision AI Agent"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div>
                    <h3 className="font-poppins font-extrabold text-xs text-slate-800 tracking-wider uppercase">
                      {isRecruiter ? "Recruitment Copilot" : "HireVision AI"}
                    </h3>

                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />

                      <span className="text-[10px] text-slate-500 font-bold">
                        {isRecruiter ? "Recruiter Multi-Agent Active" : "AI Intelligence Active"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setShowHistory(
                        (value) => !value
                      )
                    }
                    aria-label="Chat history"
                    title="Chat history"
                    className="p-2 hover:bg-slate-200/60 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    <History className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleClose}
                    aria-label="Close HireVision AI"
                    className="p-1.5 hover:bg-slate-200/60 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {showHistory && (
                  <motion.div
                    initial={{ x: "100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "100%" }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0 top-[75px] z-[65] bg-white flex flex-col"
                  >
                    <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setShowHistory(false)
                          }
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>

                        <div>
                          <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                            Chat History
                          </h4>

                          <p className="text-[9px] text-slate-400 mt-0.5">
                            Your conversations
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={createNewChat}
                        disabled={thinking}
                        className="p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        title="New chat"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3">
                      {loadingHistory ? (
                        <div className="flex items-center justify-center py-10 text-slate-400">
                          <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                      ) : chats.length === 0 ? (
                        <div className="py-12 text-center px-6">
                          <MessageSquare className="h-8 w-8 mx-auto text-slate-300 mb-3" />

                          <p className="text-xs font-bold text-slate-500">
                            No conversations yet
                          </p>

                          <p className="text-[10px] text-slate-400 mt-1">
                            Start a new chat to begin.
                          </p>

                          <button
                            type="button"
                            onClick={createNewChat}
                            disabled={thinking}
                            className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold disabled:opacity-50"
                          >
                            New Chat
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {chats
                            .filter(
                              (chat) =>
                                !chat.deleted
                            )
                            .map((chat) => (
                              <div
                                key={chat.id}
                                role="button"
                                tabIndex={0}
                                onClick={() =>
                                  void loadChat(
                                    chat.id
                                  )
                                }
                                onKeyDown={(e) => {
                                  if (
                                    e.key ===
                                    "Enter"
                                  ) {
                                    void loadChat(
                                      chat.id
                                    );
                                  }
                                }}
                                className={`group p-3 rounded-xl border cursor-pointer transition-colors ${
                                  currentChatId ===
                                  chat.id
                                    ? "bg-indigo-50 border-indigo-200"
                                    : "bg-white border-slate-200 hover:bg-slate-50"
                                }`}
                              >
                                <div className="flex items-start gap-2">
                                  <MessageSquare className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />

                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-bold text-slate-700 truncate">
                                      {getChatTitle(
                                        chat
                                      )}
                                    </p>

                                    <p className="text-[9px] text-slate-400 mt-1">
                                      {formatChatDate(
                                        chat.updatedAt
                                      )}
                                    </p>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={(e) =>
                                      void deleteChat(
                                        chat.id,
                                        e
                                      )
                                    }
                                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"
                                    title="Delete chat"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}

                          {chats.some(
                            (chat) =>
                              chat.deleted
                          ) && (
                            <div className="pt-4">
                              <div className="px-1 mb-2">
                                <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
                                  Recently Deleted
                                </p>
                              </div>

                              {chats
                                .filter(
                                  (chat) =>
                                    chat.deleted
                                )
                                .map((chat) => (
                                  <div
                                    key={chat.id}
                                    className="p-3 rounded-xl border border-slate-200 bg-slate-50 mb-2"
                                  >
                                    <div className="flex items-center gap-2">
                                      <MessageSquare className="h-4 w-4 text-slate-400 shrink-0" />

                                      <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-bold text-slate-500 truncate">
                                          {getChatTitle(
                                            chat
                                          )}
                                        </p>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={(e) =>
                                          void restoreChat(
                                            chat.id,
                                            e
                                          )
                                        }
                                        className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600"
                                        title="Restore chat"
                                      >
                                        <RotateCcw className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="px-4 py-2 border-b border-slate-200/60 bg-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <MessageSquare className="h-3.5 w-3.5 text-indigo-500 shrink-0" />

                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 truncate">
                    {currentChatId
                      ? "Conversation"
                      : "New Conversation"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={createNewChat}
                  disabled={thinking}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 text-[9px] font-bold transition-colors disabled:opacity-50"
                >
                  <Plus className="h-3 w-3" />
                  New Chat
                </button>
              </div>

              {lastAnalysis && (
                <div className="border-b border-slate-200 bg-slate-50/80 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setShowAnalysis(
                        (value) => !value
                      )
                    }
                    className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-slate-100/80 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Brain className="h-3.5 w-3.5 text-indigo-600" />

                      <div>
                        <p className="text-[9px] font-extrabold text-slate-700 uppercase tracking-wider">
                          AI Analysis
                        </p>

                        <p className="text-[8px] text-slate-400">
                          {analysisAgents.length
                            ? `${analysisAgents.length} specialist${
                                analysisAgents.length ===
                                1
                                  ? ""
                                  : "s"
                              } processed`
                            : "Response intelligence"}
                        </p>
                      </div>
                    </div>

                    {showAnalysis ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                  </button>

                  <AnimatePresence>
                    {showAnalysis && (
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
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-3 space-y-2.5">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                              <p className="text-[8px] text-slate-400 uppercase font-bold">
                                Confidence
                              </p>

                              <p className="text-[10px] font-extrabold text-slate-700 mt-0.5">
                                {confidenceText}
                              </p>
                            </div>

                            <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                              <p className="text-[8px] text-slate-400 uppercase font-bold">
                                Intent
                              </p>

                              <p className="text-[10px] font-extrabold text-slate-700 mt-0.5 truncate">
                                {lastAnalysis
                                  .routing
                                  ?.intent ||
                                  lastAnalysis
                                    .routing
                                    ?.primaryCapability ||
                                  "General"}
                              </p>
                            </div>
                          </div>

                          {lastAnalysis.routing
                            ?.targetRoleForGaps && (
                            <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 px-2.5 py-2">
                              <p className="text-[8px] text-indigo-500 uppercase font-bold">
                                Target Role
                              </p>

                              <p className="text-[10px] font-bold text-indigo-700 mt-0.5">
                                {
                                  lastAnalysis
                                    .routing
                                    .targetRoleForGaps
                                }
                              </p>
                            </div>
                          )}

                          {analysisAgents.length >
                            0 && (
                            <div className="space-y-1.5">
                              <p className="text-[8px] text-slate-400 uppercase font-bold">
                                Specialist Processing
                              </p>

                              {analysisAgents
                                .slice(0, 8)
                                .map(
                                  (
                                    agent,
                                    index
                                  ) => (
                                    <div
                                      key={`${agent.agent_name || "agent"}-${index}`}
                                      className="flex items-center gap-2"
                                    >
                                      <div
                                        className={`w-5 h-5 rounded-md border flex items-center justify-center ${getAgentStatusClass(
                                          agent.status
                                        )}`}
                                      >
                                        {String(
                                          agent.status ||
                                            ""
                                        ).toLowerCase() ===
                                        "error" ? (
                                          <AlertCircle className="h-3 w-3" />
                                        ) : (
                                          <CheckCircle2 className="h-3 w-3" />
                                        )}
                                      </div>

                                      <div className="flex-1 min-w-0">
                                        <p className="text-[9px] font-bold text-slate-600 truncate">
                                          {normalizeAgentName(
                                            agent.agent_name ||
                                              "AI Agent"
                                          )}
                                        </p>
                                      </div>

                                      <span className="text-[8px] font-bold text-slate-400">
                                        {getAgentStatusLabel(
                                          agent.status
                                        )}
                                      </span>
                                    </div>
                                  )
                                )}
                            </div>
                          )}

                          {evidenceSummary.length >
                            0 && (
                            <div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <ShieldCheck className="h-3 w-3 text-emerald-600" />

                                <p className="text-[8px] text-slate-400 uppercase font-bold">
                                  Evidence Signals
                                </p>
                              </div>

                              <div className="flex flex-wrap gap-1">
                                {evidenceSummary.map(
                                  (item) => (
                                    <span
                                      key={item}
                                      className="px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-100 text-[8px] font-bold text-emerald-700"
                                    >
                                      {item}
                                    </span>
                                  )
                                )}
                              </div>
                            </div>
                          )}

                          {Array.isArray(
                            lastAnalysis.missingData
                          ) &&
                            lastAnalysis.missingData
                              .length > 0 && (
                              <div className="rounded-lg border border-amber-100 bg-amber-50/60 px-2.5 py-2">
                                <p className="text-[8px] text-amber-600 uppercase font-bold">
                                  Information Needed
                                </p>

                                <p className="text-[9px] text-amber-700 mt-1 leading-relaxed">
                                  Some information was unavailable, so the AI did not assume or invent it.
                                </p>
                              </div>
                            )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 font-semibold text-xs leading-relaxed text-slate-600"
              >
                <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-start gap-2.5">
                  <Zap className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />

                  <div>
                    <span className="font-bold text-slate-800">
                      Intelligent AI Active
                    </span>

                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                      I understand your request, select relevant specialist intelligence, use available evidence, and return one clear answer.
                    </p>
                  </div>
                </div>

                {loadingChat && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />
                  </div>
                )}

                {messages.map(
                  (message, index) => (
                    <div
                      key={
                        message.id ||
                        `${message.timestamp.getTime()}-${index}`
                      }
                      className={`flex ${
                        message.sender ===
                        "user"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[90%] ${
                          message.sender ===
                          "user"
                            ? "bg-indigo-600 text-white rounded-2xl rounded-tr-none"
                            : "bg-slate-100 text-slate-700 rounded-2xl rounded-tl-none border border-slate-200/50"
                        } p-3.5`}
                      >
                        <div
                          className={`text-[9px] uppercase tracking-wider font-extrabold mb-1.5 ${
                            message.sender ===
                            "user"
                              ? "text-indigo-100"
                              : "text-slate-400"
                          }`}
                        >
                          {message.sender ===
                          "user"
                            ? "You"
                            : "HireVision AI"}
                        </div>

                        <div
                          className={`break-words font-medium text-xs leading-relaxed max-w-none ${
                            message.sender ===
                            "user"
                              ? "text-white whitespace-pre-wrap"
                              : "text-slate-700"
                          }`}
                        >
                          {message.sender ===
                          "agent" ? (
                            <ReactMarkdown
                              remarkPlugins={[
                                remarkGfm,
                              ]}
                              components={{
                                p: ({
                                  children,
                                }) => (
                                  <p className="mb-2 last:mb-0 leading-relaxed font-semibold text-slate-600">
                                    {children}
                                  </p>
                                ),

                                ul: ({
                                  children,
                                }) => (
                                  <ul className="list-disc pl-4 mb-2 space-y-1 font-semibold text-slate-650">
                                    {children}
                                  </ul>
                                ),

                                ol: ({
                                  children,
                                }) => (
                                  <ol className="list-decimal pl-4 mb-2 space-y-1 font-semibold text-slate-650">
                                    {children}
                                  </ol>
                                ),

                                li: ({
                                  children,
                                }) => (
                                  <li className="leading-relaxed">
                                    {children}
                                  </li>
                                ),

                                h1: ({
                                  children,
                                }) => (
                                  <h1 className="text-xs font-extrabold text-slate-800 tracking-wide mt-3 mb-1 uppercase">
                                    {children}
                                  </h1>
                                ),

                                h2: ({
                                  children,
                                }) => (
                                  <h2 className="text-[11px] font-extrabold text-slate-850 mt-3 mb-1 uppercase tracking-wide">
                                    {children}
                                  </h2>
                                ),

                                h3: ({
                                  children,
                                }) => (
                                  <h3 className="text-[10px] font-bold text-slate-750 mt-2 mb-1 uppercase">
                                    {children}
                                  </h3>
                                ),

                                strong: ({
                                  children,
                                }) => (
                                  <strong className="font-extrabold text-slate-900">
                                    {children}
                                  </strong>
                                ),

                                code: ({
                                  className,
                                  children,
                                  ...props
                                }: any) => {
                                  const content =
                                    String(
                                      children
                                    ).replace(
                                      /\n$/,
                                      ""
                                    );

                                  const match =
                                    /language-(\w+)/.exec(
                                      className ||
                                        ""
                                    );

                                  const isInline =
                                    !className;

                                  return isInline ? (
                                    <code
                                      className="px-1.5 py-0.5 rounded bg-slate-200 font-mono text-slate-800"
                                      {...props}
                                    >
                                      {content}
                                    </code>
                                  ) : (
                                    <div className="relative my-2.5 rounded-lg overflow-hidden border border-slate-200 shadow-sm bg-slate-950 font-mono text-[10px] text-slate-200 leading-normal">
                                      <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex justify-between items-center text-[9px] font-bold tracking-wider text-slate-400 select-none">
                                        <span>
                                          {match
                                            ? match[1].toUpperCase()
                                            : "CODE"}
                                        </span>
                                      </div>

                                      <pre className="p-3 overflow-x-auto whitespace-pre select-text">
                                        <code>
                                          {content}
                                        </code>
                                      </pre>
                                    </div>
                                  );
                                },
                              }}
                            >
                              {message.text}
                            </ReactMarkdown>
                          ) : (
                            message.text
                          )}
                        </div>

                        {message.sender ===
                          "agent" &&
                          message.analysis && (
                            <button
                              type="button"
                              onClick={() => {
                                setLastAnalysis(
                                  message.analysis ||
                                    null
                                );

                                setShowAnalysis(
                                  true
                                );
                              }}
                              className="mt-3 pt-2 border-t border-slate-200/70 w-full flex items-center gap-1.5 text-[8px] font-extrabold uppercase tracking-wider text-indigo-500 hover:text-indigo-700 transition-colors"
                            >
                              <Brain className="h-3 w-3" />
                              View AI analysis
                            </button>
                          )}
                      </div>
                    </div>
                  )
                )}

                {thinking && (
                  <div className="flex justify-start">
                    <div className="bg-slate-100 text-slate-500 rounded-2xl rounded-tl-none border border-slate-200/50 p-3.5 min-w-[230px]">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />

                          <span
                            className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"
                            style={{
                              animationDelay:
                                "0.2s",
                            }}
                          />

                          <span
                            className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"
                            style={{
                              animationDelay:
                                "0.4s",
                            }}
                          />
                        </div>

                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          AI is working
                        </span>
                      </div>

                      <div className="mt-2 flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin text-indigo-500" />

                        <span className="text-[9px] font-semibold text-slate-400">
                          {processingStage}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-3 pt-2 pb-1 bg-slate-50/80 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                {activePrompts.map(
                  (promptText) => (
                    <button
                      key={promptText}
                      type="button"
                      onClick={() => {
                        setInput(promptText);

                        if (inputRef.current) {
                          inputRef.current.focus();
                        }
                      }}
                      disabled={thinking}
                      className="shrink-0 px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-600 hover:text-indigo-600 text-[10px] font-semibold transition-all shadow-2xs cursor-pointer whitespace-nowrap disabled:opacity-50"
                    >
                      {promptText}
                    </button>
                  )
                )}
              </div>

              <form
                onSubmit={handleSend}
                className="p-[14px] bg-white flex gap-2 shrink-0 border-t border-slate-200/60"
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) =>
                    setInput(e.target.value)
                  }
                  onKeyDown={
                    handleInputKeyDown
                  }
                  placeholder={
                    isRecruiter
                      ? "Ask about candidates, jobs, screening, pipeline..."
                      : "Ask HireVision AI anything..."
                  }
                  disabled={thinking}
                  autoComplete="off"
                  rows={1}
                  className="flex-grow min-w-0 resize-none max-h-28 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 leading-relaxed"
                />

                <button
                  type="submit"
                  disabled={
                    thinking ||
                    !input.trim()
                  }
                  aria-label="Send message"
                  className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center cursor-pointer transition-colors shadow-sm shrink-0 self-end"
                >
                  {thinking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}