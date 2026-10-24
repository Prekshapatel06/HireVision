const { callLLM } = require("./openaiService");
const {
  failedAgentResponse,
  normalizeAgentResponse,
} = require("./agentResponseSchema");

const {
  detectRequiredCandidateAgents,
} = require("./candidateAgentRouter");

const profileAgent = require("./profileAgent");
const skillAgent = require("./skillAgent");
const projectAgent = require("./projectAgent");
const careerAgent = require("./careerAgent");
const skillGapAgent = require("./skillGapAgent");
const readinessAgent = require("./readinessAgent");
const resumeAgent = require("./resumeAgent");
const githubAgent = require("./githubAgent");
const linkedinAgent = require("./linkedinAgent");
const evidenceAnalysisAgent = require("./evidenceAnalysisAgent");
const liveResumeAgent = require("./liveResumeAgent");
const codingAgent = require("./codingAgent");
const teachingAgent = require("./teachingAgent");

const MAX_CONVERSATION_MESSAGES = Math.max(
  1,
  Number(
    process.env.AI_ORCHESTRATOR_MAX_CONVERSATION_MESSAGES ||
      30
  )
);

const MAX_AGENT_RESULT_CHARS = Math.max(
  5000,
  Number(
    process.env.AI_ORCHESTRATOR_MAX_AGENT_RESULT_CHARS ||
      20000
  )
);

const DEFAULT_AGENT_TIMEOUT_MS = Math.max(
  5000,
  Number(
    process.env.AI_AGENT_TIMEOUT_MS || 45000
  )
);

const AGENT_NAMES = Object.freeze({
  profile: "profile_analysis_agent",
  skills: "skill_analysis_agent",
  projects: "project_analysis_agent",
  career: "career_agent",
  gaps: "skill_gap_agent",
  readiness: "career_readiness_agent",
  resume: "resume_intelligence_agent",
  github: "github_agent",
  linkedin: "linkedin_agent",
  evidence: "evidence_analysis_agent",
  liveResume: "live_resume_agent",
  coding: "coding_agent",
  teaching: "teaching_agent",
});

const AGENT_KEYS = Object.freeze(
  Object.keys(AGENT_NAMES)
);

const AGENT_HANDLERS = Object.freeze({
  profile: profileAgent?.handleQuery,
  skills: skillAgent?.handleQuery,
  projects: projectAgent?.handleQuery,
  career: careerAgent?.handleQuery,
  gaps: skillGapAgent?.handleQuery,
  readiness: readinessAgent?.handleQuery,
  resume: resumeAgent?.handleQuery,
  github: githubAgent?.handleQuery,
  linkedin: linkedinAgent?.handleQuery,
  evidence: evidenceAnalysisAgent?.handleQuery,
  liveResume: liveResumeAgent?.handleQuery,
  coding: codingAgent?.handleQuery,
  teaching: teachingAgent?.handleQuery,
});

function normalizeLanguage(language) {
  if (!language) {
    return "auto";
  }

  const value = String(language)
    .trim()
    .toLowerCase();

  if (
    value === "hi" ||
    value === "hindi" ||
    value.startsWith("hi-")
  ) {
    return "hi";
  }

  if (
    value === "gu" ||
    value === "gujarati" ||
    value.startsWith("gu-")
  ) {
    return "gu";
  }

  if (
    value === "en" ||
    value === "english" ||
    value.startsWith("en-")
  ) {
    return "en";
  }

  return "auto";
}

function detectLanguageFromQuery(query, fallbackLanguage = "auto") {
  const text = String(query || "").toLowerCase();
  if (
    /[\u0A80-\u0AFF]/.test(text) ||
    /\b(in gujarati|gujarati ma|gujarati language|explain in gujarati|gujarati)\b/i.test(text)
  ) {
    return "gu";
  }
  if (
    /[\u0900-\u097F]/.test(text) ||
    /\b(in hindi|hindi me|hindi language|explain in hindi|hinglish)\b/i.test(text)
  ) {
    return "hi";
  }
  if (/\b(in english|english)\b/i.test(text)) {
    return "en";
  }
  return normalizeLanguage(fallbackLanguage);
}

function getLanguageInstruction(language) {
  const normalized =
    normalizeLanguage(language);

  if (normalized === "hi") {
    return `
Respond in natural Hindi/Hinglish.

Keep technical terminology in English when appropriate:
React, JavaScript, TypeScript, Node.js, Next.js, Python,
API, SQL, GitHub, LinkedIn, ATS, resume, interview,
frontend, backend, Docker, AWS, PostgreSQL.

Do not translate technical names unnecessarily.
`;
  }

  if (normalized === "gu") {
    return `
Respond in natural Gujarati.

Keep technical terminology in English when appropriate:
React, JavaScript, TypeScript, Node.js, Next.js, Python,
API, SQL, GitHub, LinkedIn, ATS, resume, interview,
frontend, backend, Docker, AWS, PostgreSQL.

Do not translate technical names unnecessarily.
`;
  }

  if (normalized === "en") {
    return `
Respond in clear, natural, professional English.
`;
  }

  return `
Detect the language from the latest user message.

Supported:
English
Hindi
Gujarati
Hinglish
Gujarati mixed with English

English -> English.
Hindi -> Hindi/Hinglish.
Gujarati -> Gujarati.
Hinglish -> natural Hindi/Hinglish.
Gujarati mixed with English -> natural Gujarati with English
technical terminology.

The latest user message has priority over browser language.
`;
}

function buildProfileContext(profile) {
  const source =
    profile &&
    typeof profile === "object"
      ? profile
      : {};

  const socialProfiles =
    source.social_profiles &&
    typeof source.social_profiles === "object"
      ? source.social_profiles
      : {};

  return {
    candidateName:
      source.full_name ||
      source.name ||
      "Candidate",

    careerObjective:
      source.career_objective ||
      source.careerObjective ||
      "",

    about:
      source.about ||
      source.about_me ||
      "",

    education:
      Array.isArray(source.education)
        ? source.education
        : [],

    skills:
      Array.isArray(source.skills)
        ? source.skills
        : [],

    projects:
      Array.isArray(source.projects)
        ? source.projects
        : [],

    experience:
      Array.isArray(source.experience)
        ? source.experience
        : [],

    internships:
      Array.isArray(source.internships)
        ? source.internships
        : [],

    certifications:
      Array.isArray(source.certifications)
        ? source.certifications
        : [],

    achievements:
      Array.isArray(source.achievements)
        ? source.achievements
        : [],

    languages:
      Array.isArray(source.languages)
        ? source.languages
        : [],

    socialProfiles,

    links: {
      github:
        source.github ||
        source.github_url ||
        socialProfiles.github ||
        "",

      linkedin:
        source.linkedin ||
        source.linkedin_url ||
        socialProfiles.linkedin ||
        "",
    },
  };
}

function normalizeConversation(conversation) {
  if (!Array.isArray(conversation)) {
    return [];
  }

  return conversation
    .filter(
      (message) =>
        message &&
        (
          message.role === "user" ||
          message.role === "assistant"
        ) &&
        typeof message.content === "string" &&
        message.content.trim()
    )
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }))
    .slice(-MAX_CONVERSATION_MESSAGES);
}

function normalizeRoutingResult(result) {
  const normalized = {
    needsProfile: false,
    needsSkills: false,
    needsProjects: false,
    needsCareer: false,
    needsGaps: false,
    needsReadiness: false,
    needsResume: false,
    needsGithub: false,
    needsLinkedin: false,
    needsEvidence: false,
    needsLiveResume: false,
    needsTeaching: false,
    needsCoding: false,
    isGeneral: false,
    targetRoleForGaps: "",
    primaryCapability: "",
    capabilities: [],
    confidence: 0,
    intent: "general",
  };

  if (
    !result ||
    typeof result !== "object"
  ) {
    normalized.isGeneral = true;
    normalized.confidence = 1;
    return normalized;
  }

  for (const capability of AGENT_KEYS.map(
    (key) => `needs${key.charAt(0).toUpperCase()}${key.slice(1)}`
  )) {
    if (
      Object.prototype.hasOwnProperty.call(
        result,
        capability
      )
    ) {
      normalized[capability] =
        result[capability] === true ||
        result[capability] === "true" ||
        result[capability] === 1;
    }
  }

  normalized.targetRoleForGaps =
    typeof result.targetRoleForGaps === "string"
      ? result.targetRoleForGaps.trim()
      : "";

  const requestedCapabilities =
    Array.isArray(result.capabilities)
      ? result.capabilities
      : [];

  normalized.capabilities =
    requestedCapabilities.filter(
      (item) =>
        typeof item === "string" &&
        Object.prototype.hasOwnProperty.call(
          normalized,
          item
        ) &&
        item.startsWith("needs")
    );

  if (!normalized.capabilities.length) {
    normalized.capabilities =
      Object.keys(normalized).filter(
        (key) =>
          key.startsWith("needs") &&
          normalized[key] === true
      );
  }

  normalized.primaryCapability =
    typeof result.primaryCapability === "string" &&
    result.primaryCapability.trim()
      ? result.primaryCapability.trim()
      : normalized.capabilities[0] || "";

  const numericConfidence =
    Number(result.confidence);

  normalized.confidence =
    Number.isFinite(numericConfidence)
      ? Math.max(
          0,
          Math.min(
            1,
            numericConfidence > 1
              ? numericConfidence / 100
              : numericConfidence
          )
        )
      : 0;

  normalized.intent =
    typeof result.intent === "string" &&
    result.intent.trim()
      ? result.intent.trim()
      : "general";

  normalized.isGeneral =
    normalized.capabilities.length === 0;

  return normalized;
}

function expandRoutingForDependencies(
  routing
) {
  const expanded =
    normalizeRoutingResult(routing);

  if (expanded.needsReadiness) {
    expanded.needsProfile = true;
    expanded.needsSkills = true;
    expanded.needsProjects = true;
    expanded.needsCareer = true;
    expanded.needsGaps = true;
    expanded.needsEvidence = true;
  }

  if (expanded.needsGaps) {
    expanded.needsSkills = true;
    expanded.needsProjects = true;
    expanded.needsEvidence = true;
  }

  if (expanded.needsProfile) {
    expanded.needsEvidence = true;
  }

  if (expanded.needsGithub) {
    expanded.needsProjects = true;
    expanded.needsEvidence = true;
  }

  if (expanded.needsLinkedin) {
    expanded.needsEvidence = true;
  }

  if (expanded.needsLiveResume) {
    expanded.needsResume = true;
  }

  expanded.capabilities = [
    "needsProfile",
    "needsSkills",
    "needsProjects",
    "needsCareer",
    "needsGaps",
    "needsReadiness",
    "needsResume",
    "needsGithub",
    "needsLinkedin",
    "needsEvidence",
    "needsLiveResume",
    "needsTeaching",
    "needsCoding",
  ].filter(
    (capability) =>
      expanded[capability] === true
  );

  expanded.isGeneral =
    expanded.capabilities.length === 0;

  return expanded;
}

function getAgentFunction(agentKey) {
  return AGENT_HANDLERS[agentKey];
}

function getAgentName(agentKey) {
  return (
    AGENT_NAMES[agentKey] ||
    `${agentKey}_agent`
  );
}

function serializeForContext(
  value,
  maxChars = MAX_AGENT_RESULT_CHARS
) {
  let serialized = "";

  try {
    serialized =
      JSON.stringify(value);
  } catch {
    try {
      serialized =
        JSON.stringify({
          summary: String(
            value || ""
          ),
        });
    } catch {
      return "";
    }
  }

  if (
    typeof serialized !== "string"
  ) {
    return "";
  }

  if (
    serialized.length <= maxChars
  ) {
    return serialized;
  }

  return (
    serialized.slice(0, maxChars) +
    "\n...[truncated]"
  );
}

function normalizeAgentOutput(
  agentName,
  result,
  durationMs
) {
  if (
    result &&
    typeof result === "object" &&
    result.agent_name &&
    result.status &&
    result.result !== undefined
  ) {
    return {
      ...result,
      metadata: {
        ...(result.metadata || {}),
        durationMs,
      },
    };
  }

  if (
    result &&
    typeof result === "object"
  ) {
    return normalizeAgentResponse(
      agentName,
      result,
      {
        status: "ok",
        metadata: {
          durationMs,
        },
      }
    );
  }

  return normalizeAgentResponse(
    agentName,
    {
      summary:
        typeof result === "string"
          ? result
          : String(result || ""),
    },
    {
      status: "ok",
      metadata: {
        durationMs,
      },
    }
  );
}

async function withTimeout(
  promise,
  timeoutMs,
  agentName
) {
  let timer;

  const timeoutPromise =
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error =
          new Error(
            `${agentName} timed out after ${timeoutMs}ms.`
          );

        error.code =
          "AGENT_TIMEOUT";

        reject(error);
      }, timeoutMs);
    });

  try {
    return await Promise.race([
      promise,
      timeoutPromise,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function createAgentContext(
  context,
  agentResults = {}
) {
  return {
    ...(context || {}),
    conversation:
      normalizeConversation(
        context?.conversation ||
          context?.history ||
          []
      ),

    history:
      normalizeConversation(
        context?.history ||
          context?.conversation ||
          []
      ),

    agentResults,
  };
}

async function runAgent(
  agentKey,
  profile,
  query,
  context
) {
  const agentName =
    getAgentName(agentKey);

  const handler =
    getAgentFunction(agentKey);

  if (
    typeof handler !== "function"
  ) {
    return failedAgentResponse(
      agentName,
      new Error(
        `${agentName} handler is unavailable.`
      ),
      {
        metadata: {
          agentKey,
        },
      }
    );
  }

  const startedAt =
    Date.now();

  const timeoutMs = Math.max(
    5000,
    Number(
      context?.agentTimeoutMs ||
        DEFAULT_AGENT_TIMEOUT_MS
    )
  );

  try {
    const result =
      await withTimeout(
        Promise.resolve(
          handler(
            profile,
            query,
            createAgentContext(
              context
            )
          )
        ),
        timeoutMs,
        agentName
      );

    return normalizeAgentOutput(
      agentName,
      result,
      Date.now() - startedAt
    );
  } catch (error) {
    console.error(
      `[Orchestrator] ${agentName} failed:`,
      error?.message || error
    );

    return failedAgentResponse(
      agentName,
      error,
      {
        metadata: {
          agentKey,
          durationMs:
            Date.now() - startedAt,
        },
      }
    );
  }
}

function getIndependentAgentKeys(
  routing
) {
  const mapping = [
    ["needsProfile", "profile"],
    ["needsSkills", "skills"],
    ["needsProjects", "projects"],
    ["needsCareer", "career"],
    ["needsResume", "resume"],
    ["needsGithub", "github"],
    ["needsLinkedin", "linkedin"],
    ["needsEvidence", "evidence"],
    ["needsLiveResume", "liveResume"],
    ["needsCoding", "coding"],
    ["needsTeaching", "teaching"],
  ];

  return [
    ...new Set(
      mapping
        .filter(
          ([capability]) =>
            routing[capability] === true
        )
        .map(([, agentKey]) => agentKey)
    ),
  ];
}

async function executeIndependentAgents(
  profile,
  query,
  routing,
  context
) {
  const agentKeys =
    getIndependentAgentKeys(
      routing
    );

  if (!agentKeys.length) {
    return {};
  }

  const results =
    await Promise.all(
      agentKeys.map(
        (agentKey) =>
          runAgent(
            agentKey,
            profile,
            query,
            {
              ...context,
              agentResults: {},
            }
          )
      )
    );

  const agentResults = {};

  agentKeys.forEach(
    (agentKey, index) => {
      agentResults[
        getAgentName(agentKey)
      ] = results[index];
    }
  );

  return agentResults;
}

function buildDependencyContext(
  agentResults
) {
  const context = {};

  for (
    const [
      agentName,
      result,
    ] of Object.entries(
      agentResults || {}
    )
  ) {
    context[agentName] = {
      status:
        result?.status ||
        "unknown",

      result:
        result?.result ??
        null,

      evidence:
        Array.isArray(result?.evidence)
          ? result.evidence
          : [],

      confidence:
        result?.confidence ||
        "UNKNOWN",

      missing_data:
        Array.isArray(
          result?.missing_data
        )
          ? result.missing_data
          : [],

      recommendations:
        Array.isArray(
          result?.recommendations
        )
          ? result.recommendations
          : [],

      error:
        result?.error ||
        null,
    };
  }

  return context;
}

async function executeDependentAgents(
  profile,
  query,
  routing,
  context,
  agentResults
) {
  const dependentKeys = [];

  if (routing.needsGaps) {
    dependentKeys.push("gaps");
  }

  if (routing.needsReadiness) {
    dependentKeys.push("readiness");
  }

  if (!dependentKeys.length) {
    return agentResults;
  }

  const dependencyContext =
    buildDependencyContext(
      agentResults
    );

  const results =
    await Promise.all(
      dependentKeys.map(
        (agentKey) =>
          runAgent(
            agentKey,
            profile,
            query,
            {
              ...context,

              targetRole:
                routing.targetRoleForGaps ||
                context?.targetRole ||
                "",

              agentResults:
                dependencyContext,
            }
          )
      )
    );

  dependentKeys.forEach(
    (agentKey, index) => {
      agentResults[
        getAgentName(agentKey)
      ] = results[index];
    }
  );

  return agentResults;
}

function getSuccessfulResults(
  agentResults
) {
  return Object.entries(
    agentResults || {}
  ).filter(
    ([, result]) =>
      result &&
      result.status !== "error"
  );
}

function getFailedResults(
  agentResults
) {
  return Object.entries(
    agentResults || {}
  ).filter(
    ([, result]) =>
      !result ||
      result.status === "error"
  );
}

function buildSynthesisResults(
  agentResults
) {
  const output = {};

  for (
    const [
      agentName,
      item,
    ] of Object.entries(
      agentResults || {}
    )
  ) {
    output[agentName] = {
      status:
        item?.status ||
        "unknown",

      result:
        item?.result ??
        null,

      evidence:
        Array.isArray(item?.evidence)
          ? item.evidence
          : [],

      confidence:
        item?.confidence ||
        "UNKNOWN",

      missing_data:
        Array.isArray(
          item?.missing_data
        )
          ? item.missing_data
          : [],

      recommendations:
        Array.isArray(
          item?.recommendations
        )
          ? item.recommendations
          : [],

      error:
        item?.error ||
        null,
    };
  }

  return output;
}

function extractTextResponse(
  response
) {
  if (
    typeof response === "string" &&
    response.trim()
  ) {
    return response.trim();
  }

  if (
    response &&
    typeof response === "object"
  ) {
    const candidates = [
      response.reply,
      response.response,
      response.answer,
      response.output_text,
      response.text,
    ];

    for (
      const candidate
      of candidates
    ) {
      if (
        typeof candidate === "string" &&
        candidate.trim()
      ) {
        return candidate.trim();
      }
    }
  }

  return "";
}

function formatStructuredAgentResult(result) {
  if (!result || typeof result !== "object") return "";

  // 1. Coding Agent result
  if (result.diagnosis || result.solution) {
    const parts = [];
    if (result.diagnosis) parts.push(`### Diagnosis\n${result.diagnosis}`);
    if (result.solution?.explanation) parts.push(`### Solution\n${result.solution.explanation}`);
    if (result.solution?.correctedCode) {
      parts.push(`\`\`\`${result.solution.language || "javascript"}\n${result.solution.correctedCode}\n\`\`\``);
    }
    if (Array.isArray(result.verificationSteps) && result.verificationSteps.length) {
      parts.push(`### Verification Steps\n` + result.verificationSteps.map(s => `- ${s}`).join("\n"));
    }
    if (parts.length) return parts.join("\n\n");
  }

  // 2. Teaching Agent result
  if (result.topic || result.lesson) {
    const parts = [];
    const topicName = result.topic || "Core Concepts";
    parts.push(`### Technical Guide: ${topicName}`);
    if (result.lesson?.explanation) parts.push(result.lesson.explanation);
    if (Array.isArray(result.lesson?.keyConcepts) && result.lesson.keyConcepts.length) {
      parts.push(`**Key Concepts:**\n` + result.lesson.keyConcepts.map(c => `- **${c.name || c.title || c}**: ${c.description || ""}`).join("\n"));
    }
    if (Array.isArray(result.nextSteps) && result.nextSteps.length) {
      parts.push(`**Next Steps:**\n` + result.nextSteps.map(s => `- ${s}`).join("\n"));
    }
    if (parts.length > 1) return parts.join("\n\n");
  }

  // 3. Readiness Agent result
  if (result.score !== undefined && (result.breakdown || result.level)) {
    const b = result.breakdown || {};
    const strengths = Array.isArray(result.strengths) && result.strengths.length
      ? `\n\n**Strengths:**\n` + result.strengths.map(s => `- ${s}`).join("\n")
      : "";
    const improvements = Array.isArray(result.improvements) && result.improvements.length
      ? `\n\n**Key Areas for Improvement:**\n` + result.improvements.map(i => `- ${i}`).join("\n")
      : "";
    return `### Job Readiness: ${result.score}% (${result.level || "Evaluated"})\n\n**Component Breakdown:**\n- Profile Completeness: ${b.profile ?? "N/A"}%\n- Technical Skills: ${b.skills ?? "N/A"}%\n- Project Portfolio: ${b.projects ?? "N/A"}%\n- Certifications & Credentials: ${b.certifications ?? "N/A"}%${strengths}${improvements}`;
  }

  // 4. Profile Agent result
  if (result.completeness !== undefined && (result.breakdown || result.strengths)) {
    const b = result.breakdown || {};
    const strengths = Array.isArray(result.strengths) && result.strengths.length
      ? `\n\n**Profile Strengths:**\n` + result.strengths.map(s => `- ${s}`).join("\n")
      : "";
    const recommendations = Array.isArray(result.recommendations) && result.recommendations.length
      ? `\n\n**Actionable Recommendations:**\n` + result.recommendations.map(r => `- ${r}`).join("\n")
      : "";
    return `### Profile Completeness: ${result.completeness}%\n\n**Section Status:**\n- Bio / Summary: ${b.bio ?? "N/A"}%\n- Technical Skills: ${b.skills ?? "N/A"}%\n- Projects: ${b.projects ?? "N/A"}%\n- Work Experience: ${b.experience ?? "N/A"}%\n- Education: ${b.education ?? "N/A"}%${strengths}${recommendations}`;
  }

  // 5. Skill Gap Agent result
  if (result.missingSkills || result.targetRole || result.learningPaths) {
    const role = result.targetRole || "Target Role";
    const matched = Array.isArray(result.matchedSkills) && result.matchedSkills.length
      ? `**Matched Skills:**\n` + result.matchedSkills.map(s => `- ✅ ${typeof s === "object" ? s.name || s.skill : s}`).join("\n") + "\n\n"
      : "";
    const missing = Array.isArray(result.missingSkills) && result.missingSkills.length
      ? `**Missing / Target Skills to Learn:**\n` + result.missingSkills.map(s => `- ⚠️ **${typeof s === "object" ? s.name || s.skill : s}**`).join("\n") + "\n\n"
      : "**Missing Skills:** None! You possess all primary benchmark skills for this path.\n\n";
    const learning = Array.isArray(result.learningPaths) && result.learningPaths.length
      ? `**Recommended Learning Path:**\n` + result.learningPaths.map(p => `- **${p.skill}**: ${p.recommendation || p.resource || p.description || "Practice with hands-on projects"}`).join("\n")
      : "";
    return `### Skill Gap Analysis: ${role}\n\n${matched}${missing}${learning}`.trim();
  }

  // 6. Project Agent result
  if (result.technicalScore !== undefined || Array.isArray(result.projectAnalysis)) {
    const total = result.totalProjects ?? (result.projectAnalysis || []).length;
    const score = result.technicalScore ?? result.score ?? "N/A";
    const analyses = Array.isArray(result.projectAnalysis) && result.projectAnalysis.length
      ? result.projectAnalysis.map(p => `- **${p.title || "Project"}**: ${p.technologies ? `Technologies: ${p.technologies}. ` : ""}${p.feedback || p.description || ""}`).join("\n")
      : "";
    const recs = Array.isArray(result.recommendations) && result.recommendations.length
      ? `\n\n**Portfolio Recommendations:**\n` + result.recommendations.map(r => `- ${r}`).join("\n")
      : "";
    return `### Project Portfolio Evaluation\n\n**Technical Score:** ${score}/100 across ${total} project${total === 1 ? "" : "s"}\n\n${analyses}${recs}`.trim();
  }

  // 7. Career Agent result
  if (Array.isArray(result.recommendedRoles) && result.recommendedRoles.length) {
    const roles = result.recommendedRoles.map(r => `#### 🎯 ${r.role || r.title}\n- **Match Rate:** ${r.matchPercentage || r.matchScore || r.score || "N/A"}%\n- **Matched Competencies:** ${(r.matchingSkills || r.matchedSkills || []).join(", ") || "Foundations"}\n- **Growth Opportunities:** ${r.growthTips || r.advice || r.description || "Build portfolio proof"}`).join("\n\n");
    return `### Recommended Career Paths\n\n${roles}`;
  }

  // 8. Technical Skills Agent result
  if (result.totalSkills !== undefined || Array.isArray(result.topSkills)) {
    const total = result.totalSkills ?? (result.skills || []).length;
    const verified = result.verifiedSkills ?? 0;
    const top = Array.isArray(result.topSkills) && result.topSkills.length
      ? result.topSkills.map(s => `- **${typeof s === "object" ? s.name || s.skill : s}**${s.level ? ` (${s.level})` : ""}`).join("\n")
      : "";
    const recs = Array.isArray(result.recommendations) && result.recommendations.length
      ? `\n\n**Recommendations:**\n` + result.recommendations.map(r => `- ${r}`).join("\n")
      : "";
    return `### Technical Skills Evaluation\n\n**Total Skills Listed:** ${total} (${verified} backed by project/credential evidence)\n\n**Top Strengths:**\n${top}${recs}`.trim();
  }

  // 9. Resume Agent result
  if (result.score !== undefined && (result.suggestions || result.sections)) {
    const score = result.score;
    const sugs = Array.isArray(result.suggestions) && result.suggestions.length
      ? `\n\n**Optimization Suggestions:**\n` + result.suggestions.map(s => `- ${s}`).join("\n")
      : "";
    return `### Resume Evaluation\n\n**Estimated Resume Quality Score:** ${score}/100${sugs}`;
  }

  // 10. Live Resume markdown result
  if (result.markdown) {
    return result.markdown;
  }

  return "";
}

function getResultText(result) {
  if (
    typeof result === "string" &&
    result.trim()
  ) {
    return result.trim();
  }

  if (
    !result ||
    typeof result !== "object"
  ) {
    return "";
  }

  const candidates = [
    result.summary,
    result.answer,
    result.response,
    result.message,
    result.description,
  ];

  for (
    const value
    of candidates
  ) {
    if (
      typeof value === "string" &&
      value.trim() &&
      !value.includes("could not complete the requested analysis") &&
      !value.includes("temporarily unavailable")
    ) {
      return value.trim();
    }
  }

  const structured = formatStructuredAgentResult(result);
  if (structured) {
    return structured;
  }

  return "";
}

function getAgentByName(
  agentResults,
  agentName
) {
  const result =
    agentResults?.[agentName];

  if (
    !result ||
    result.status === "error"
  ) {
    return null;
  }

  return result;
}

function findUsefulAgentResult(
  agentResults,
  userQuery
) {
  const query =
    String(userQuery || "")
      .trim()
      .toLowerCase();

  const preferred = [];

  const addPreferred = (
    agentName
  ) => {
    if (
      agentName &&
      !preferred.includes(agentName)
    ) {
      preferred.push(agentName);
    }
  };

  if (
    query.includes("live resume") ||
    query.includes("live-resume")
  ) {
    addPreferred(
      AGENT_NAMES.liveResume
    );
  }

  if (
    query.includes("resume") ||
    query.includes("cv") ||
    query.includes("ats")
  ) {
    addPreferred(
      AGENT_NAMES.resume
    );
    addPreferred(
      AGENT_NAMES.liveResume
    );
  }

  if (
    query.includes("github") ||
    query.includes("repository") ||
    query.includes("repo")
  ) {
    addPreferred(
      AGENT_NAMES.github
    );
  }

  if (
    query.includes("linkedin")
  ) {
    addPreferred(
      AGENT_NAMES.linkedin
    );
  }

  if (
    query.includes("skill gap") ||
    query.includes("skill gaps") ||
    query.includes("missing skill") ||
    query.includes("missing skills") ||
    query.includes("what should i learn") ||
    query.includes("what should i improve")
  ) {
    addPreferred(
      AGENT_NAMES.gaps
    );
  }

  if (
    query.includes("readiness") ||
    query.includes("job ready") ||
    query.includes("job-ready")
  ) {
    addPreferred(
      AGENT_NAMES.readiness
    );
  }

  if (
    query.includes("profile") ||
    query.includes("about me") ||
    query.includes("bio") ||
    query.includes("career objective")
  ) {
    addPreferred(
      AGENT_NAMES.profile
    );
  }

  if (
    query.includes("skill") ||
    query.includes("technology") ||
    query.includes("tech stack")
  ) {
    addPreferred(
      AGENT_NAMES.skills
    );
  }

  if (
    query.includes("project") ||
    query.includes("projects")
  ) {
    addPreferred(
      AGENT_NAMES.projects
    );
  }

  if (
    query.includes("career") ||
    query.includes("job") ||
    query.includes("role")
  ) {
    addPreferred(
      AGENT_NAMES.career
    );
  }

  if (
    query.includes("code") ||
    query.includes("coding") ||
    query.includes("debug") ||
    query.includes("programming") ||
    query.includes("javascript") ||
    query.includes("typescript") ||
    query.includes("python") ||
    query.includes("react") ||
    query.includes("next.js") ||
    query.includes("node.js")
  ) {
    addPreferred(
      AGENT_NAMES.coding
    );
  }

  if (
    query.includes("learn") ||
    query.includes("teach") ||
    query.includes("explain") ||
    query.includes("practice") ||
    query.includes("study")
  ) {
    addPreferred(
      AGENT_NAMES.teaching
    );
  }

  for (
    const agentName
    of preferred
  ) {
    const item =
      getAgentByName(
        agentResults,
        agentName
      );

    if (!item) {
      continue;
    }

    const text =
      getResultText(
        item.result
      );

    if (text) {
      return text;
    }
  }

  for (
    const [, item]
    of getSuccessfulResults(
      agentResults
    )
  ) {
    const text =
      getResultText(
        item?.result
      );

    if (text) {
      return text;
    }
  }

  return "";
}

function buildFallbackResponse(
  profile,
  userQuery,
  agentResults,
  language
) {
  const useful =
    findUsefulAgentResult(
      agentResults,
      userQuery
    );

  if (useful) {
    return useful;
  }

  const successful =
    getSuccessfulResults(
      agentResults
    );

  for (
    const [, item]
    of successful
  ) {
    const text =
      getResultText(
        item?.result
      );

    if (text) {
      return text;
    }
  }

  if (profile && typeof profile === "object") {
    const name = profile.full_name || profile.name || "there";
    const skills = Array.isArray(profile.skills)
      ? profile.skills
          .map((s) => (typeof s === "object" ? s.name || s.skill : s))
          .filter(Boolean)
          .slice(0, 5)
          .join(", ")
      : "";
    const projectCount = Array.isArray(profile.projects) ? profile.projects.length : 0;

    return `Hello ${name}! Based on your verified HireVision profile, you have ${
      skills ? `skills in **${skills}**` : "profile records"
    } and **${projectCount}** project(s) on record.

You can ask me to:
- **Analyze my profile**: Get section-by-section completeness and optimization tips.
- **What is my readiness score?**: See your overall job-readiness percentage and component breakdown.
- **What are my skill gaps?**: Identify missing competencies for roles like React Developer, Full Stack Engineer, or Cloud Architect.
- **Improve my resume**: Receive ATS suggestions and bullet-point enhancements.
- **Technical & coding help**: Explain concepts, debug code snippets, or compare frameworks.`;
  }

  return getGenericFallback(language);
}

function buildGroundedGeneralReply(query, profile, conversation, language) {
  const q = String(query || "").trim().toLowerCase();

  // Helper to extract candidate's actual profile data
  const candidateName = profile?.full_name || profile?.name || "there";
  const rawSkills = Array.isArray(profile?.skills)
    ? profile.skills.map(s => typeof s === "object" ? s.name || s.skill || s.title : s).filter(Boolean)
    : [];
  const skillsList = [...new Set(rawSkills)];
  const projectsList = Array.isArray(profile?.projects)
    ? profile.projects.map(p => typeof p === "object" ? p.title || p.name : p).filter(Boolean)
    : [];
  const experienceList = Array.isArray(profile?.experience)
    ? profile.experience.map(e => typeof e === "object" ? `${e.role || e.title || "Developer"} at ${e.company || "Company"}` : e).filter(Boolean)
    : [];

  // Extract recent conversation topic for follow-up questions
  let recentTopic = "";
  if (Array.isArray(conversation) && conversation.length > 0) {
    for (let i = conversation.length - 1; i >= 0; i--) {
      const msg = String(conversation[i]?.content || "").toLowerCase();
      if (msg.includes("useeffect") || msg.includes("hook")) { recentTopic = "useEffect"; break; }
      if (msg.includes("react")) { recentTopic = "React"; break; }
      if (msg.includes("node") || msg.includes("express")) { recentTopic = "Node.js"; break; }
      if (msg.includes("sql") || msg.includes("postgres") || msg.includes("database")) { recentTopic = "PostgreSQL"; break; }
      if (msg.includes("interview") || msg.includes("star")) { recentTopic = "Interview"; break; }
      if (msg.includes("resume") || msg.includes("ats")) { recentTopic = "Resume"; break; }
      if (msg.includes("system design") || msg.includes("scale")) { recentTopic = "System Design"; break; }
      if (msg.includes("full stack")) { recentTopic = "Full Stack Engineer"; break; }
    }
  }

  // 1. Greetings
  if (
    q === "hello" ||
    q === "hi" ||
    q === "hey" ||
    q.startsWith("hello ") ||
    q.startsWith("hi ") ||
    q.startsWith("good morning") ||
    q.startsWith("good afternoon")
  ) {
    return `Hello ${candidateName}! Welcome to HireVision AI. I am your specialized career intelligence, live resume, and technical copilot.

Here is how I can assist you directly from your profile data:
- 📊 **Readiness Evaluation**: Calculate your job-readiness percentage across Profile, Skills, Projects, and Certifications.
- 🎯 **Skill Gap Analysis**: Discover which skills you are missing for specific target roles (e.g. React Developer, Full Stack Engineer).
- 💼 **Resume & ATS Review**: Review your Live Resume and get actionable bullet-point improvements.
- 💻 **Coding & Concepts**: Debug code, explain algorithms, architecture, or teach technologies step by step.
- 🚀 **Mock Interview Prep**: Practice behavioral questions (STAR method) and technical architecture challenges.

What would you like to explore today?`;
  }

  // 2. Candidate's own profile, skills, projects inquiry
  if (
    q.includes("my profile") ||
    q.includes("my skills") ||
    q.includes("what skills do i have") ||
    q.includes("my projects") ||
    q.includes("my experience")
  ) {
    let summary = `### Profile Overview for **${candidateName}**\n\n`;
    summary += `**Documented Skills (${skillsList.length}):**\n` +
      (skillsList.length > 0 ? skillsList.map(s => `- ${s}`).join("\n") : "- No skills documented yet. Add skills to your profile to calculate readiness.") + "\n\n";

    summary += `**Documented Projects (${projectsList.length}):**\n` +
      (projectsList.length > 0 ? projectsList.map(p => `- 📁 **${p}**`).join("\n") : "- No projects linked yet.") + "\n\n";

    if (experienceList.length > 0) {
      summary += `**Experience (${experienceList.length}):**\n` +
        experienceList.map(e => `- 💼 ${e}`).join("\n") + "\n\n";
    }

    summary += `**Recommendations to Boost Your HireVision Score:**\n` +
      `- Link live deployed URLs and GitHub repositories to your projects to verify your code with our Evidence Agent.\n` +
      `- Add missing high-demand tools (like TypeScript, Next.js, Docker) to unlock higher match scores with active recruiters.`;
    return summary;
  }

  // 3. Follow-up queries (Why?, Tell me more, How?, Give me an example)
  if (
    q === "why?" ||
    q === "why" ||
    q.includes("tell me more") ||
    q.includes("explain more") ||
    q.includes("elaborate") ||
    q.includes("give me an example") ||
    q.includes("show me an example")
  ) {
    if (recentTopic === "useEffect") {
      return `### Deep Dive: React \`useEffect\` & Lifecycle Synchronization

In React, \`useEffect\` serves as the bridge between React's declarative state and external asynchronous APIs:

#### Key Mental Model:
1. **Render Phase**: React calls your component function, calculates JSX, and creates the Virtual DOM.
2. **Commit Phase**: React applies updates to the real DOM.
3. **Effect Phase**: \`useEffect\` runs *after* the DOM has been painted, ensuring side effects do not block UI responsiveness.

#### Practical Pattern: AbortController with Fetch
\`\`\`javascript
useEffect(() => {
  const controller = new AbortController();

  async function loadData() {
    try {
      const res = await fetch('/api/user', { signal: controller.signal });
      const data = await res.json();
      setUser(data);
    } catch (err) {
      if (err.name !== 'AbortError') console.error(err);
    }
  }

  loadData();
  return () => controller.abort(); // Cancels pending request on re-render/unmount
}, [userId]);
\`\`\``;
    }

    if (recentTopic === "Node.js") {
      return `### Deep Dive: Node.js Event Loop & Non-Blocking I/O

Node.js executes single-threaded JavaScript using an event-driven architecture powered by **libuv**:

1. **Call Stack**: Synchronous functions execute LIFO.
2. **Node APIs & Worker Threads**: File system operations, DNS lookups, and crypto are delegated to the libuv thread pool.
3. **Event Loop Phases**:
   - **Timers**: \`setTimeout\`, \`setInterval\`.
   - **Pending Callbacks**: I/O callbacks deferred from previous iterations.
   - **Poll Phase**: Retrieves new I/O events.
   - **Check Phase**: \`setImmediate()\` callbacks.
   - **Close Callbacks**: \`socket.on('close')\`.
4. **Microtask Queue**: \`process.nextTick()\` and Promise callbacks run with the highest priority between each phase.`;
    }

    if (recentTopic === "Interview") {
      return `### Detailed Example: Mastering the STAR Method

When an interviewer asks: *"Tell me about a time you encountered a difficult technical bug under a tight deadline."*

1. **Situation (S)**: "In my previous project, two days before our production launch, our API began returning 504 Gateway Timeouts under load."
2. **Task (T)**: "As the backend developer, my objective was to locate the latency bottleneck without delaying the release."
3. **Action (A)**: "I used PostgreSQL \`EXPLAIN ANALYZE\` and identified an unindexed sequential scan on a table with 250k rows. I added a composite B-tree index and introduced Redis caching for read-heavy endpoints."
4. **Result (R)**: "Query response times dropped from 1,200ms to 18ms, our server handled 5x concurrent traffic, and we delivered the release on schedule with zero downtime."`;
    }

    return `### Contextual Elaboration

Target role recommendations and skill gaps are calculated by evaluating your profile's documented skills (${skillsList.join(", ") || "none specified"}) against industry competency benchmarks. To maximize recruiter match scores, deepening your portfolio with live deployed applications and adding missing tools (like TypeScript or Next.js) provides concrete proof of capability.

Would you like to explore technical interview preparation, code debugging, or a personalized learning roadmap?`;
  }

  // 4. React vs Angular comparison
  if (
    (q.includes("compare") || q.includes("difference") || q.includes("vs")) &&
    q.includes("react") &&
    q.includes("angular")
  ) {
    return `### Comparison: React vs Angular

| Feature | React | Angular |
| :--- | :--- | :--- |
| **Type** | UI Library | Full-fledged Framework |
| **Architecture** | Component-based, Virtual DOM | Component-based, Incremental DOM |
| **Language** | JavaScript / TypeScript (JSX) | TypeScript-first (HTML templates) |
| **Data Binding** | One-way (unidirectional) | Two-way data binding |
| **State Management**| Built-in hooks (\`useState\`, \`useReducer\`), Redux/Zustand | RxJS, Signals, NgRx |
| **Ecosystem** | Flexible, pick your own routing/HTTP libraries | Batteries-included (built-in router, forms, HTTP client) |
| **Learning Curve** | Gentle initial curve, requires architecture choices | Steeper initial curve with strict conventions |

**Summary Recommendation:**
- Choose **React** if you want flexibility, a huge component ecosystem, and seamless adoption in modern full-stack web applications.
- Choose **Angular** if you are building enterprise applications requiring strict opinionated architecture and integrated tooling.`;
  }

  // 5. REST vs GraphQL
  if (
    (q.includes("rest") && q.includes("graphql")) ||
    q.includes("rest vs graphql")
  ) {
    return `### REST vs GraphQL: Architectural Comparison

| Dimension | REST (Representational State Transfer) | GraphQL |
| :--- | :--- | :--- |
| **Data Fetching** | Multiple endpoints (\`/api/users\`, \`/api/orders\`) | Single endpoint (\`/graphql\`) with custom query |
| **Over/Under-fetching**| Common (returns fixed payload schema) | Eliminated (clients request exact fields needed) |
| **Versioning** | URI versioning (\`/v1/users\`, \`/v2/users\`) | Evolution without versions (deprecate specific fields) |
| **Caching** | Native HTTP caching (ETags, CDN, Cache-Control) | Requires client-side cache normalized by ID (Apollo/Relay) |
| **File Uploads** | Simple multipart/form-data | Requires specialized multipart specifications |

**Best Practice Guide:**
- Use **REST** for public APIs, file transfers, simple CRUD microservices, and applications relying on standard HTTP caching.
- Use **GraphQL** for complex frontend applications requiring aggregated data from multiple services in a single round-trip.`;
  }

  // 6. SQL vs NoSQL (PostgreSQL vs MongoDB)
  if (
    (q.includes("sql") && q.includes("nosql")) ||
    (q.includes("postgres") && q.includes("mongo"))
  ) {
    return `### SQL (Relational) vs NoSQL (Document): When to Use Which

#### 1. SQL (e.g. PostgreSQL)
- **Data Model**: Structured tables with predefined schemas, primary keys, and foreign key relations.
- **ACID Guarantees**: Strong consistency, atomic transactions, and relational integrity.
- **Best For**: Financial ledgers, e-commerce checkouts, authentication, and core application data with complex relational queries.
- **PostgreSQL Superpower**: Supports JSONB columns, allowing relational tables to store flexible document data with GIN indexing.

#### 2. NoSQL (e.g. MongoDB)
- **Data Model**: Schema-less JSON/BSON documents organized in collections.
- **Scaling**: Horizontal partitioning (sharding) out of the box.
- **Best For**: Rapid prototyping, polymorphic data, IoT telemetry, real-time logging, and unstructured catalogs.`;
  }

  // 7. Authentication: JWT vs Session
  if (
    q.includes("jwt") ||
    (q.includes("auth") && (q.includes("session") || q.includes("token")))
  ) {
    return `### Authentication: JWT vs Session-Based Auth

#### 1. JSON Web Tokens (JWT)
- **State**: Stateless. The token is cryptographically signed and stored client-side (HttpOnly cookie or memory).
- **Pros**: Scalable across distributed microservices; no database lookup needed to verify authentication.
- **Cons**: Difficult to invalidate before expiration unless maintaining a token blacklist.
- **Best Practice**: Use short-lived Access Tokens (15 min) paired with rotatable Refresh Tokens stored in secure HttpOnly cookies.

#### 2. Session-Based Authentication
- **State**: Stateful. A session ID is given to the client cookie, while session data is stored in Redis or PostgreSQL.
- **Pros**: Instant revocation (logout invalidates session record on server immediately).
- **Cons**: Requires database/cache lookup on every authenticated request.`;
  }

  // 8. Interview Preparation: Behavioral STAR Method
  if (
    q.includes("behavioral") ||
    q.includes("star method") ||
    q.includes("interview questions") ||
    q.includes("how to prepare for interview")
  ) {
    return `### Technical & Behavioral Interview Preparation Guide

#### 1. The STAR Method for Behavioral Questions
- **Situation**: Set the context (company, role, scale, challenge).
- **Task**: Explain your specific responsibility.
- **Action**: Describe the precise technical steps and decisions **you** took.
- **Result**: Quantify the impact (e.g., "reduced latency by 45%", "delivered 2 weeks early").

#### 2. Top Technical Interview Topics:
1. **Frontend / React**: Component lifecycle, hooks (\`useEffect\`, \`useMemo\`, \`useCallback\`), state management, Virtual DOM reconciliation.
2. **Backend / Node.js**: Event loop phases, middleware architecture, async error handling, database indexing.
3. **System Design**: Client-server communication, caching strategies (Redis), database schema design, rate limiting.
4. **Live Coding / DSA**: Array two-pointers, hash maps for O(1) lookups, recursion, and tree traversals.`;
  }

  // 9. Resume & ATS Optimization
  if (
    q.includes("resume") ||
    q.includes("ats") ||
    q.includes("cv") ||
    q.includes("improve my resume")
  ) {
    return `### How to Optimize Your Tech Resume for ATS & Recruiters

1. **Use the Google XYZ Formula for Bullet Points:**
   - *"Accomplished [X], as measured by [Y], by doing [Z]."*
   - *Example:* "Engineered a candidate evaluation pipeline in Node.js and PostgreSQL, processing 5,000+ applicants daily and reducing screening time by 40%."

2. **Format Cleanly for ATS Scanners:**
   - Single-column layout. Avoid dual-column sidebars, tables, or complex graphic elements that trip up parsers.
   - Standard section titles: **Experience**, **Projects**, **Technical Skills**, **Education**.

3. **Showcase Verified Proof:**
   - Include direct GitHub links, live deployed demo URLs, and tech stacks used for each project.
   - On HireVision, your **Live Resume** automatically pairs verified project commits with declared skills!`;
  }

  // 10. React Learning Roadmap & Fundamentals
  if (
    q.includes("teach me react") ||
    q.includes("learn react") ||
    (q.includes("react") && (q.includes("beginner") || q.includes("roadmap")))
  ) {
    return `### React Learning Roadmap: Beginner to Advanced

#### Phase 1: Fundamentals (Week 1–2)
- JSX syntax, conditional rendering, and list mapping with unique \`key\` props.
- Functional components, props, and unidirectional data flow.
- Handling events and managing local state with \`useState\`.

#### Phase 2: Hooks & Asynchronous Effects (Week 3–4)
- Managing side effects, API fetching, and cleanup with \`useEffect\`.
- Controlled form components and input validation.
- Direct DOM interactions using \`useRef\`.

#### Phase 3: Architecture & Performance (Week 5–6)
- Global context with \`useContext\` and predictable state with \`useReducer\`.
- Performance optimization: \`useMemo\`, \`useCallback\`, and \`React.memo\`.
- Custom hooks creation to isolate reusable business logic.

#### Phase 4: Production & Full Stack (Week 7+)
- Modern meta-frameworks: **Next.js (App Router, Server Components)**.
- Global state management (Zustand or Redux Toolkit).
- Unit and component testing using Vitest and React Testing Library.`;
  }

  // 11. What is React
  if (
    q === "what is react" ||
    q === "what is react?" ||
    q === "what is react.js" ||
    q === "what is react.js?" ||
    q === "what is reactjs" ||
    q === "what is reactjs?"
  ) {
    return `### What is React?

**React** is an open-source JavaScript library developed by Meta for building dynamic, interactive user interfaces, primarily for single-page web applications.

#### Core Concepts:
1. **Component-Based Architecture**: UIs are built as isolated, reusable building blocks (components) that manage their own state.
2. **Virtual DOM**: React maintains a virtual representation of the DOM in memory. When state changes, React diffs the virtual DOM with the real DOM and batches updates (reconciliation) for maximum rendering performance.
3. **Declarative Syntax (JSX)**: You describe *what* the UI should look like for a given state, and React handles DOM updates.
4. **Unidirectional Data Flow**: Data flows down from parent to child components via props, making state transitions predictable.
5. **Modern Hooks**: Since React 16.8, functional components use hooks like \`useState\` for state and \`useEffect\` for side effects.`;
  }

  // 12. Explain useEffect
  if (
    q.includes("useeffect") ||
    q.includes("use effect")
  ) {
    return `### Understanding React \`useEffect\`

\`useEffect\` is a React Hook that lets you synchronize a component with external systems and perform side effects (data fetching, subscriptions, timers, or manual DOM manipulations) in functional components.

#### Anatomy of \`useEffect\`:
\`\`\`javascript
import React, { useState, useEffect } from 'react';

function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchUserData() {
      setLoading(true);
      try {
        const response = await fetch(\`/api/users/\${userId}\`);
        const data = await response.json();
        if (isMounted) setUser(data);
      } catch (err) {
        console.error("Fetch failed", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchUserData();

    // Cleanup function: runs before unmount or before re-running the effect
    return () => {
      isMounted = false;
    };
  }, [userId]); // Dependency array: re-runs only when userId changes

  if (loading) return <p>Loading user profile...</p>;
  return <div><h1>{user?.name}</h1></div>;
}
\`\`\`

#### Dependency Array Rules:
1. **No dependencies (\`useEffect(fn)\`)**: Runs after *every* render.
2. **Empty array (\`[]\`)**: Runs *once* after the initial mount.
3. **Dependencies (\`[a, b]\`)**: Runs after mount and whenever \`a\` or \`b\` changes.`;
  }

  // 13. Career advice: Next steps
  if (
    q.includes("what should i do first") ||
    q.includes("what should i learn next") ||
    q.includes("what next") ||
    q.includes("career advice")
  ) {
    const hasReact = skillsList.some(s => s.toLowerCase().includes("react"));
    return `### Recommended Next Steps for Your Career Growth:
1. **Prioritize TypeScript & Modern Frameworks**: Since you already have experience with ${hasReact ? "React and JavaScript" : "web development"}, adopting TypeScript is the highest-ROI skill for software engineering roles.
2. **Document Full-Stack Projects**: Ensure your projects have live deployment URLs (e.g. Vercel, Netlify) and clear GitHub READMEs highlighting architecture and API design.
3. **Verify Profile Information**: Check that all experience and certification details on HireVision are up to date to increase your overall job readiness score.`;
  }

  // 14. Fallback for open-ended technical questions
  return `### HireVision AI Career & Technical Guidance

I analyzed your query: **"${query}"**

#### Actionable Recommendations:
- **Profile Readiness**: Keep your verified skills and portfolio projects updated on HireVision to maximize recruiter discovery.
- **Technical Deep-Dive**: You can ask me to write code snippets, debug errors, explain architectural trade-offs, or break down system design concepts.
- **Interview Coaching**: Practice answering technical and behavioral interview questions using the STAR framework.

What specific area would you like to explore next?`;
}

function getAnalysisUnavailableFallback(
  language
) {
  const normalized =
    normalizeLanguage(
      language
    );

  if (normalized === "hi") {
    return "मैं उपलब्ध information के आधार पर अभी reliable analysis पूरा नहीं कर पाया। कृपया अपना सवाल दोबारा पूछें या थोड़ी और information दें।";
  }

  if (normalized === "gu") {
    return "ઉપલબ્ધ informationના આધારે હું અત્યારે reliable analysis પૂર્ણ કરી શક્યો નથી. કૃપા કરીને તમારો પ્રશ્ન ફરીથી પૂછો અથવા થોડી વધુ information આપો.";
  }

  return "I couldn't complete a reliable analysis from the available information. Please try again or provide a little more context.";
}

function getGenericFallback(
  language
) {
  const normalized =
    normalizeLanguage(
      language
    );

  if (normalized === "hi") {
    return "मैं आपकी मदद करने के लिए तैयार हूँ। आप profile, resume, skills, projects, GitHub, LinkedIn, career, learning या technical questions पूछ सकते हैं।";
  }

  if (normalized === "gu") {
    return "હું તમારી મદદ કરવા માટે તૈયાર છું. તમે profile, resume, skills, projects, GitHub, LinkedIn, career, learning અથવા technical questions પૂછી શકો છો.";
  }

  return "I’m ready to help. You can ask about your profile, resume, skills, projects, GitHub, LinkedIn, career, learning, or technical questions.";
}

function buildSynthesisSystemPrompt(
  responseLanguage
) {
  const languageInstruction =
    getLanguageInstruction(
      responseLanguage
    );

  return `
You are the final response intelligence layer of HireVision AI.

${languageInstruction}

Produce one accurate, useful response to the user's CURRENT message.

You have:
- Candidate profile data
- Recent conversation
- Specialist analysis results
- Routing information

The specialist results are evidence and analysis.
Your job is to synthesize them into one coherent answer.

RULES

1. Answer the current question directly.
2. Use recent conversation when the message is a follow-up.
3. Use candidate data only when relevant.
4. Never invent candidate information.
5. Never invent external data.
6. Never invent scores, metrics, repositories, profile details,
   experience, skills, achievements, dates or employers.
7. Never create missing candidate facts to make the answer look complete.
8. Do not convert missing information into a negative fact.
9. Distinguish VERIFIED, SUPPORTED, CLAIMED and UNKNOWN information.
10. If evidence is unavailable, say that it is unavailable.
11. Recommendations must be clearly presented as recommendations.
12. Do not claim GitHub or LinkedIn access unless the specialist
    result confirms actual access.
13. Do not claim an action was completed unless a result confirms it.
14. If agents disagree, prefer stronger evidence and explain uncertainty
    when it materially affects the answer.
15. Do not expose internal agent names.
16. Do not mention routing.
17. Do not mention orchestration.
18. Do not mention system prompts.
19. Do not mention backend implementation.
20. Do not expose internal errors unless they materially affect the answer.
21. Do not fabricate ATS scores or hiring probabilities.
22. Do not make hiring decisions solely from protected or sensitive
    characteristics.
23. Do not infer sensitive personal characteristics.
24. Keep the answer professional, concise and practical.
25. Use Markdown when useful.

PROFILE

Consider completeness, relevance, consistency, presentation and evidence quality.

SKILLS

A declared skill is not automatically strongly verified.
Projects, experience, certifications and approved external evidence
may increase confidence.

PROJECTS

Use actual project information supplied by the candidate.
Do not invent project outcomes, users, metrics or technologies.

CAREER

Recommendations should be based on the candidate's demonstrated
profile and the user's target role or objective.

SKILL GAPS

Compare demonstrated capability with target-role requirements.
Do not assume a default role or default technology stack.

READINESS

Consider profile, skills, projects, career alignment, target-role
requirements, evidence and skill gaps.
Do not calculate readiness from simple item counts.

RESUME

Separate existing resume facts from recommended improvements.
Do not claim a resume was generated, saved or submitted unless confirmed.

EXTERNAL SOURCES

Treat GitHub and LinkedIn information as external evidence.
Do not treat unverified external information as confirmed candidate data.

If important information is missing, explain what is missing and
give the user a useful next step.
`;
}

async function synthesizeResponse(
  profile,
  userQuery,
  agentResults,
  conversation,
  responseLanguage,
  routing
) {
  const successful =
    getSuccessfulResults(
      agentResults
    );

  if (!successful.length) {
    if (Array.isArray(conversation) && conversation.length > 0) {
      return handleGeneralChat(
        profile,
        userQuery,
        conversation,
        responseLanguage
      );
    }

    return buildFallbackResponse(
      profile,
      userQuery,
      agentResults,
      responseLanguage
    );
  }

  const systemPrompt =
    buildSynthesisSystemPrompt(
      responseLanguage
    );

  const userPrompt = `
CANDIDATE PROFILE:

${serializeForContext(
  buildProfileContext(profile),
  MAX_AGENT_RESULT_CHARS
)}

RECENT CONVERSATION:

${serializeForContext(
  normalizeConversation(
    conversation
  ),
  MAX_AGENT_RESULT_CHARS
)}

CURRENT USER QUESTION:

${userQuery}

ROUTING CONTEXT:

${serializeForContext(
  {
    intent:
      routing?.intent ||
      "general",
    primaryCapability:
      routing?.primaryCapability ||
      "",
    targetRoleForGaps:
      routing?.targetRoleForGaps ||
      "",
    confidence:
      routing?.confidence ?? 0,
    capabilities:
      routing?.capabilities || [],
  },
  10000
)}

SPECIALIST RESULTS:

${serializeForContext(
  buildSynthesisResults(
    agentResults
  ),
  MAX_AGENT_RESULT_CHARS * 2
)}

Produce the final answer to the current user question.
`;

  try {
    const response =
      await callLLM(
        systemPrompt,
        userPrompt,
        false,
        {
          conversation:
            normalizeConversation(
              conversation
            ),

          temperature: 0.35,

          maxTokens:
            Number(
              process.env.AI_SYNTHESIS_MAX_TOKENS ||
                4500
            ),
        }
      );

    const text =
      extractTextResponse(
        response
      );

    if (text) {
      return text;
    }

    throw new Error(
      "Synthesis returned an empty response."
    );
  } catch (error) {
    console.error(
      "[Orchestrator] Synthesis failed:",
      error?.message || error
    );

    return buildFallbackResponse(
      profile,
      userQuery,
      agentResults,
      responseLanguage
    );
  }
}

function buildGeneralChatSystemPrompt(
  responseLanguage
) {
  const languageInstruction =
    getLanguageInstruction(
      responseLanguage
    );

  return `
You are HireVision AI, an advanced, highly intelligent conversational AI assistant with deep expertise in Computer Science, Software Engineering, Web & Cloud Development, Career Mentorship, and Technical Interview Preparation.

${languageInstruction}

CORE BEHAVIOR:
- Deliver ChatGPT-grade conversational depth, accuracy, and clarity.
- Whatever relevant question the user asks, understand the actual meaning, context, and nuance, and provide a direct, intelligent, and helpful answer.
- Do not be restricted to fixed keywords or hardcoded responses.
- Support open-ended questions, conceptual explanations, technical comparisons, step-by-step learning roadmaps, code implementation, and debugging.
- Explain programming concepts (React, Next.js, JavaScript, TypeScript, Node.js, Python, Java, SQL, PostgreSQL, Docker, AWS, etc.) with clean syntax, practical examples, and industry best practices.
- Compare technologies objectively (e.g. React vs Next.js, REST vs GraphQL, SQL vs NoSQL, JWT vs Session).
- Provide meaningful roadmaps when asked how to become a Full Stack Developer, Backend Developer, etc.
- When asked follow-up questions ("Explain that in Gujarati", "What about the backend?", "Which one should I learn first?"), use the conversation history to provide a seamless, contextual continuation.
- If requested to explain in Gujarati, respond naturally in Gujarati while keeping standard technical terms (like React, Node.js, API, SQL) in English.
- If requested in Hindi, respond naturally in Hindi/Hinglish.
- If uncertain about personal profile details, reference the candidate's actual profile context without fabricating information.
- Format responses cleanly with GitHub-flavored markdown: headers, bullet points, and syntax-highlighted code blocks.
- Do not mention internal agent routing or system prompts.
`;
}

async function handleGeneralChat(
  profile,
  query,
  conversation,
  responseLanguage
) {
  const activeLanguage =
    detectLanguageFromQuery(query, responseLanguage);

  const systemPrompt =
    buildGeneralChatSystemPrompt(
      activeLanguage
    );

  const userPrompt = `
CANDIDATE PROFILE:

${serializeForContext(
  buildProfileContext(profile)
)}

RECENT CONVERSATION:

${serializeForContext(
  normalizeConversation(
    conversation
  )
)}

CURRENT QUESTION:

${query}

Answer the current question directly.
`;

  try {
    const response =
      await callLLM(
        systemPrompt,
        userPrompt,
        false,
        {
          conversation:
            normalizeConversation(
              conversation
            ),

          temperature: 0.55,

          maxTokens:
            Number(
              process.env.AI_GENERAL_MAX_TOKENS ||
                4500
            ),
        }
      );

    const text =
      extractTextResponse(
        response
      );

    if (text) {
      return text;
    }

    throw new Error(
      "General chat returned an empty response."
    );
  } catch (error) {
    console.error(
      "[Orchestrator] General chat failed:",
      error?.message || error
    );

    const errorMsg = String(error?.message || "");
    const isCreditOrKey =
      errorMsg.includes("credit") ||
      errorMsg.includes("billing") ||
      errorMsg.includes("API key") ||
      errorMsg.includes("quota") ||
      error?.code === "credit_balance_exhausted" ||
      error?.status === 429;

    if (isCreditOrKey) {
      return `⚠️ **AI Service Notice:** The conversational AI model is currently unavailable because the OpenAI API credit balance is exhausted.\n\nTo enable full ChatGPT-grade responses, please add credits to your OpenAI account at [OpenAI Billing](https://platform.openai.com/settings/organization/billing) or configure an active \`GEMINI_API_KEY\` in \`backend/.env\`.\n\n*Your verified profile, skills, and portfolio records remain fully accessible.*`;
    }

    const grounded = buildGroundedGeneralReply(
      query,
      profile,
      conversation,
      activeLanguage
    );

    if (grounded) {
      return grounded;
    }

    return `I am currently unable to answer this question due to an AI model connectivity issue: ${errorMsg || "Service temporarily unavailable"}. Please try again shortly.`;
  }
}

function buildOrchestratorContext(
  options,
  routing,
  conversation,
  responseLanguage
) {
  return {
    conversation,
    history: conversation,

    language:
      responseLanguage,

    responseLanguage,

    targetRole:
      routing.targetRoleForGaps ||
      options.targetRole ||
      "",

    userId:
      options.userId,

    chatId:
      options.chatId,

    source:
      options.source ||
      "hirevision-ai-orchestrator",

    client:
      options.client ||
      "floating-ai-agent",

    requestId:
      options.requestId ||
      "",

    metadata:
      options.metadata || {},

    agentTimeoutMs:
      options.agentTimeoutMs ||
      DEFAULT_AGENT_TIMEOUT_MS,
  };
}

async function resolveRouting(
  query,
  conversation,
  profile
) {
  try {
    const result =
      await detectRequiredCandidateAgents(
        query,
        conversation,
        profile
      );

    return expandRoutingForDependencies(
      result
    );
  } catch (error) {
    console.error(
      "[Orchestrator] Candidate router failed:",
      error?.message || error
    );

    return normalizeRoutingResult({
      needsCoding: true,
      primaryCapability:
        "needsCoding",
      confidence: 0,
      intent: "technical",
    });
  }
}

async function processUserQuery(
  profileOrQuery,
  queryOrProfile,
  options = {}
) {
  let profile = profileOrQuery;
  let userQuery = queryOrProfile;
  if (typeof profileOrQuery === "string" && queryOrProfile && typeof queryOrProfile === "object" && !Array.isArray(queryOrProfile)) {
    profile = queryOrProfile;
    userQuery = profileOrQuery;
  }

  const query =
    String(userQuery || "")
      .trim();

  if (!query) {
    return "Please enter a question so I can help you.";
  }

  const conversation =
    normalizeConversation(
      options.conversation ||
        options.history ||
        []
    );

  const responseLanguage =
    options.responseLanguage ||
    options.language ||
    "auto";

  const routing =
    await resolveRouting(
      query,
      conversation,
      profile
    );

  if (routing.isGeneral) {
    return handleGeneralChat(
      profile,
      query,
      conversation,
      responseLanguage
    );
  }

  const context =
    buildOrchestratorContext(
      options,
      routing,
      conversation,
      responseLanguage
    );

  let agentResults =
    await executeIndependentAgents(
      profile,
      query,
      routing,
      context
    );

  agentResults =
    await executeDependentAgents(
      profile,
      query,
      routing,
      context,
      agentResults
    );

  const successfulResults =
    getSuccessfulResults(
      agentResults
    );

  const usefulDirectResult =
    findUsefulAgentResult(
      agentResults,
      query
    );

  const activeAgents =
    Object.keys(
      agentResults
    );

  if (
    activeAgents.length === 1 &&
    successfulResults.length === 1 &&
    usefulDirectResult
  ) {
    return usefulDirectResult;
  }

  return synthesizeResponse(
    profile,
    query,
    agentResults,
    conversation,
    responseLanguage,
    routing
  );
}

module.exports = {
  processUserQuery,
  normalizeConversation,
  normalizeLanguage,
  buildProfileContext,
  normalizeRoutingResult,
  expandRoutingForDependencies,
  serializeForContext,
  getAgentName,
};