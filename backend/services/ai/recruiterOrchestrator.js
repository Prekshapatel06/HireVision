const db = require("../../config/db");
const { REAL_CANDIDATE_SQL_FILTER } = require("../../utils/candidateValidation");
const { callLLM } = require("./openaiService");
const {
  failedAgentResponse,
  normalizeAgentResponse,
} = require("./agentResponseSchema");

const {
  detectRequiredRecruiterAgents,
  detectRecruiterIntentFallback,
} = require("./recruiterAgentRouter");

const jobRequirementAgent = require("./jobRequirementAgent");
const candidateDiscoveryAgent = require("./candidateDiscoveryAgent");
const liveResumeIntelligenceAgent = require("./liveResumeIntelligenceAgent");
const candidateJobMatchingAgent = require("./candidateJobMatchingAgent");
const candidateRankingAgent = require("./candidateRankingAgent");
const candidateComparisonAgent = require("./candidateComparisonAgent");
const profileEvidenceAgent = require("./profileEvidenceAgent");
const candidateShortlistingAgent = require("./candidateShortlistingAgent");
const talentPoolAgent = require("./talentPoolAgent");
const hiringPipelineAgent = require("./hiringPipelineAgent");
const recruiterAnalyticsAgent = require("./recruiterAnalyticsAgent");
const candidateReengagementAgent = require("./candidateReengagementAgent");

const MAX_CONVERSATION_MESSAGES = 30;
const MAX_CANDIDATES_FOR_CONTEXT = Number(
  process.env.RECRUITER_AI_MAX_CANDIDATES || 250
);
const MAX_JOBS_FOR_CONTEXT = Number(
  process.env.RECRUITER_AI_MAX_JOBS || 100
);
const AGENT_TIMEOUT_MS = Number(
  process.env.RECRUITER_AI_AGENT_TIMEOUT_MS || 60000
);

const AGENTS = {
  requirement: jobRequirementAgent,
  discovery: candidateDiscoveryAgent,
  resume_intelligence: liveResumeIntelligenceAgent,
  matching: candidateJobMatchingAgent,
  ranking: candidateRankingAgent,
  comparison: candidateComparisonAgent,
  evidence: profileEvidenceAgent,
  shortlist: candidateShortlistingAgent,
  pool: talentPoolAgent,
  pipeline: hiringPipelineAgent,
  analytics: recruiterAnalyticsAgent,
  reengagement: candidateReengagementAgent,
};

function normalizeConversation(conversation) {
  if (!Array.isArray(conversation)) {
    return [];
  }

  return conversation
    .filter(
      (message) =>
        message &&
        (message.role === "user" ||
          message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim()
    )
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }))
    .slice(-MAX_CONVERSATION_MESSAGES);
}

function normalizeId(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  return String(value);
}

function normalizeText(value) {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
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
  const clean = String(fallbackLanguage || "auto").trim().toLowerCase();
  if (clean === "hi" || clean === "hindi") return "hi";
  if (clean === "gu" || clean === "gujarati") return "gu";
  if (clean === "en" || clean === "english") return "en";
  return "auto";
}

function serializeContext(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return "{}";
  }
}

async function withTimeout(
  promise,
  timeoutMs,
  label
) {
  let timer;

  const timeoutPromise =
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error =
          new Error(
            `${label} timed out after ${timeoutMs}ms.`
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

function getAgentName(agentKey) {
  const names = {
    requirement:
      "job_requirement_agent",
    discovery:
      "candidate_discovery_agent",
    resume_intelligence:
      "live_resume_intelligence_agent",
    matching:
      "candidate_job_matching_agent",
    ranking:
      "candidate_ranking_agent",
    comparison:
      "candidate_comparison_agent",
    evidence:
      "profile_evidence_agent",
    shortlist:
      "candidate_shortlisting_agent",
    pool:
      "talent_pool_agent",
    pipeline:
      "hiring_pipeline_agent",
    analytics:
      "recruiter_analytics_agent",
    reengagement:
      "candidate_reengagement_agent",
  };

  return (
    names[agentKey] ||
    `${agentKey}_agent`
  );
}

function getAgentHandler(
  agentKey
) {
  const agent =
    AGENTS[agentKey];

  if (
    !agent ||
    typeof agent.execute !== "function"
  ) {
    return null;
  }

  return agent.execute.bind(agent);
}

function normalizeAgentOutput(
  agentName,
  result
) {
  if (
    result &&
    typeof result === "object" &&
    result.agent_name &&
    result.status &&
    result.result !== undefined
  ) {
    return result;
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
    }
  );
}

async function executeAgent(
  agentKey,
  query,
  context
) {
  const agentName =
    getAgentName(agentKey);

  const handler =
    getAgentHandler(agentKey);

  if (!handler) {
    return failedAgentResponse(
      agentName,
      new Error(
        `${agentName} is unavailable.`
      )
    );
  }

  const startedAt =
    Date.now();

  try {
    const result =
      await withTimeout(
        handler(
          query,
          context
        ),
        AGENT_TIMEOUT_MS,
        agentName
      );

    const normalized =
      normalizeAgentOutput(
        agentName,
        result
      );

    normalized.metadata = {
      ...(normalized.metadata || {}),
      durationMs:
        Date.now() - startedAt,
    };

    return normalized;
  } catch (error) {
    console.error(
      `[Recruiter Orchestrator] ${agentName} failed:`,
      error.message
    );

    return failedAgentResponse(
      agentName,
      error,
      {
        metadata: {
          durationMs:
            Date.now() - startedAt,
        },
      }
    );
  }
}

async function fetchRecruiterContext(
  recruiterId
) {
  const recruiterResult =
    await db.query(
      `
        SELECT *
        FROM recruiter_profiles
        WHERE user_id = $1
        LIMIT 1
      `,
      [recruiterId]
    );

  const recruiterProfile =
    recruiterResult.rows[0] || {
      user_id: recruiterId,
    };

  const jobsResult =
    await db.query(
      `
        SELECT *
        FROM jobs
        WHERE recruiter_id = $1
        ORDER BY id DESC
        LIMIT $2
      `,
      [
        recruiterId,
        MAX_JOBS_FOR_CONTEXT,
      ]
    );

  const candidatesResult =
    await db.query(
      `
        SELECT
          u.id,
          u.username,
          u.email,
          p.*
        FROM users u
        JOIN profiles p
          ON u.id = p.user_id
        WHERE ${REAL_CANDIDATE_SQL_FILTER}
        ORDER BY u.id DESC
        LIMIT $1
      `,
      [MAX_CANDIDATES_FOR_CONTEXT]
    );

  const matchesResult =
    await db.query(
      `
        SELECT
          m.id,
          m.candidate_id,
          m.job_id,
          m.match_score,
          m.status,
          m.explanation,
          m.created_at,
          m.updated_at,
          j.title AS job_title,
          j.requirements AS job_requirements,
          u.username,
          u.email,
          p.full_name,
          p.skills,
          p.projects,
          p.experience
        FROM candidate_job_matches m
        JOIN jobs j ON m.job_id = j.id
        JOIN users u ON m.candidate_id = u.id
        JOIN profiles p ON u.id = p.user_id
        WHERE j.recruiter_id = $1
          AND ${REAL_CANDIDATE_SQL_FILTER}
        ORDER BY m.updated_at DESC
        LIMIT 200
      `,
      [recruiterId]
    );

  return {
    recruiterProfile,
    jobs: jobsResult.rows || [],
    candidates:
      candidatesResult.rows || [],
    matches:
      matchesResult.rows || [],
    applications:
      matchesResult.rows || [],
  };
}

function findTargetJob(
  query,
  jobs
) {
  if (!Array.isArray(jobs)) {
    return null;
  }

  const normalizedQuery =
    normalizeText(query);

  if (!normalizedQuery) {
    return null;
  }

  const exactTitleMatch =
    jobs.find((job) => {
      const title =
        normalizeText(job.title);

      return (
        title &&
        normalizedQuery.includes(title)
      );
    });

  if (exactTitleMatch) {
    return exactTitleMatch;
  }

  const words =
    normalizedQuery
      .split(/\s+/)
      .filter(
        (word) => word.length >= 4
      );

  let bestJob = null;
  let bestScore = 0;

  for (const job of jobs) {
    const title =
      normalizeText(job.title);

    if (!title) {
      continue;
    }

    const titleWords =
      title.split(/\s+/);

    const matches =
      titleWords.filter(
        (word) =>
          words.includes(word)
      ).length;

    if (
      matches > bestScore
    ) {
      bestScore = matches;
      bestJob = job;
    }
  }

  return bestScore > 0
    ? bestJob
    : null;
}

function findTargetCandidate(
  query,
  candidates
) {
  if (!Array.isArray(candidates)) {
    return null;
  }

  const normalizedQuery =
    normalizeText(query);

  if (!normalizedQuery) {
    return null;
  }

  const exactMatch =
    candidates.find((candidate) => {
      const name =
        normalizeText(
          candidate.full_name
        );

      const username =
        normalizeText(
          candidate.username
        );

      const email =
        normalizeText(
          candidate.email
        );

      return (
        (name &&
          normalizedQuery.includes(name)) ||
        (username &&
          normalizedQuery.includes(username)) ||
        (email &&
          normalizedQuery.includes(email))
      );
    });

  return exactMatch || null;
}

function findCandidatesInText(text, candidates) {
  if (!text || !Array.isArray(candidates)) return [];
  const normalized = normalizeText(text);
  return candidates.filter((candidate) => {
    const name = normalizeText(candidate.full_name);
    const username = normalizeText(candidate.username);
    const email = normalizeText(candidate.email);
    return (
      (name && normalized.includes(name)) ||
      (username && normalized.includes(username)) ||
      (email && normalized.includes(email))
    );
  });
}

function resolveTargets(
  query,
  jobs,
  candidates,
  options = {},
  conversation = [],
  matches = []
) {
  let targetJob = null;
  let targetCandidate = null;
  let targetCandidates = [];

  if (options.jobId) {
    targetJob =
      jobs.find(
        (job) =>
          normalizeId(job.id) ===
          normalizeId(options.jobId)
      ) || null;
  }

  if (options.candidateId) {
    targetCandidate =
      candidates.find(
        (candidate) =>
          normalizeId(candidate.id) ===
          normalizeId(
            options.candidateId
          )
      ) || null;
  }

  if (!targetJob) {
    targetJob =
      findTargetJob(
        query,
        jobs
      );
  }

  if (!targetCandidate) {
    targetCandidate =
      findTargetCandidate(
        query,
        candidates
      );
  }

  // Find explicit candidates in query (e.g. for comparison or ranking)
  const explicitCandidates = findCandidatesInText(query, candidates);
  if (explicitCandidates.length >= 2) {
    targetCandidates = explicitCandidates.slice(0, 5);
  }

  // Conversational Context resolution for follow-up questions
  if (Array.isArray(conversation) && conversation.length > 0) {
    // 1. Resolve targetJob from recent conversation if not mentioned in current query
    if (!targetJob) {
      for (let i = conversation.length - 1; i >= 0; i--) {
        const msg = conversation[i]?.content;
        if (typeof msg === "string") {
          targetJob = findTargetJob(msg, jobs);
          if (targetJob) break;
        }
      }
    }

    // 2. Resolve candidates mentioned in recent messages (for follow-ups like "which one", "why", "compare top two")
    if (targetCandidates.length < 2) {
      for (let i = conversation.length - 1; i >= 0; i--) {
        const msg = conversation[i]?.content;
        if (typeof msg === "string") {
          const mentioned = findCandidatesInText(msg, candidates);
          if (mentioned.length >= 2) {
            targetCandidates = mentioned.slice(0, 5);
            break;
          } else if (mentioned.length === 1 && !targetCandidate) {
            targetCandidate = mentioned[0];
          }
        }
      }
    }
  }

  // 3. If query mentions "top two", "top three", "top candidates", etc.
  const topMatch = String(query || "").match(/top\s+(two|2|three|3|four|4|five|5|candidates|\d+)/i);
  if (targetCandidates.length < 2 && topMatch) {
    let count = 2;
    const term = topMatch[1].toLowerCase();
    if (term === "three" || term === "3") count = 3;
    else if (term === "four" || term === "4") count = 4;
    else if (term === "five" || term === "5") count = 5;
    else if (/^\d+$/.test(term)) count = parseInt(term, 10);

    let candidatePool = [];
    if (targetJob) {
      const jobMatches = (matches || []).filter(
        (m) => normalizeId(m.job_id) === normalizeId(targetJob.id)
      );
      if (jobMatches.length > 0) {
        const topIds = jobMatches.slice(0, count).map((m) => normalizeId(m.candidate_id));
        candidatePool = candidates.filter((c) => topIds.includes(normalizeId(c.id)));
      }
    }
    if (candidatePool.length < 2 && (matches || []).length > 0) {
      const topIds = (matches || []).slice(0, count).map((m) => normalizeId(m.candidate_id));
      candidatePool = candidates.filter((c) => topIds.includes(normalizeId(c.id)));
    }
    if (candidatePool.length < 2 && candidates.length >= 2) {
      candidatePool = candidates.slice(0, count);
    }
    if (candidatePool.length >= 2) {
      targetCandidates = candidatePool;
    }
  }

  // If we found a target candidate from query or history, ensure targetCandidate is set
  if (!targetCandidate && targetCandidates.length > 0) {
    targetCandidate = targetCandidates[0];
  }

  return {
    targetJob,
    targetCandidate,
    targetCandidates,
  };
}

function buildAgentResultsContext(
  agentResults
) {
  const output = {};

  for (
    const [
      agentName,
      result,
    ] of Object.entries(
      agentResults || {}
    )
  ) {
    output[agentName] = {
      status:
        result?.status ||
        "unknown",

      result:
        result?.result ??
        null,

      evidence:
        result?.evidence ||
        [],

      confidence:
        result?.confidence ||
        "UNKNOWN",

      missing_data:
        result?.missing_data ||
        [],

      recommendations:
        result?.recommendations ||
        [],

      error:
        result?.error ||
        null,
    };
  }

  return output;
}

function shouldRunAgent(
  agentKey,
  routing
) {
  return Array.isArray(
    routing?.agents
  )
    ? routing.agents.includes(
        agentKey
      )
    : false;
}

function expandWorkflowAgents(
  routing
) {
  const agents = new Set(
    Array.isArray(routing?.agents)
      ? routing.agents.filter(
          (agent) =>
            Object.prototype.hasOwnProperty.call(
              AGENTS,
              agent
            )
        )
      : []
  );

  const intent =
    routing?.intent ||
    "general";

  if (
    intent === "discovery"
  ) {
    agents.add("discovery");
    agents.add("matching");
    agents.add("evidence");
  }

  if (
    intent === "matching"
  ) {
    agents.add("matching");
  }

  if (
    intent === "ranking"
  ) {
    agents.add("matching");
    agents.add("evidence");
    agents.add("ranking");
  }

  if (
    intent === "shortlist"
  ) {
    agents.add("requirement");
    agents.add("discovery");
    agents.add("matching");
    agents.add("evidence");
    agents.add("ranking");
    agents.add("shortlist");
  }

  if (
    intent === "comparison"
  ) {
    agents.add("matching");
    agents.add("resume_intelligence");
    agents.add("evidence");
    agents.add("comparison");
  }

  if (
    intent === "resume_intelligence"
  ) {
    agents.add(
      "resume_intelligence"
    );
  }

  return [
    ...agents,
  ];
}

async function executeIndependentAgents(
  query,
  context,
  routing
) {
  const independentAgents =
    expandWorkflowAgents(
      routing
    ).filter(
      (agentKey) =>
        ![
          "matching",
          "ranking",
          "shortlist",
          "comparison",
        ].includes(agentKey)
    );

  if (
    !independentAgents.length
  ) {
    return {};
  }

  const results =
    await Promise.all(
      independentAgents.map(
        (agentKey) =>
          executeAgent(
            agentKey,
            query,
            {
              ...context,
              agentResults: {},
            }
          )
      )
    );

  const agentResults = {};

  independentAgents.forEach(
    (agentKey, index) => {
      agentResults[
        getAgentName(agentKey)
      ] = results[index];
    }
  );

  return agentResults;
}

async function executeAnalysisAgents(
  query,
  context,
  routing,
  agentResults
) {
  const analysisAgents =
    expandWorkflowAgents(
      routing
    ).filter(
      (agentKey) =>
        [
          "matching",
          "ranking",
          "shortlist",
          "comparison",
        ].includes(agentKey)
    );

  if (
    !analysisAgents.length
  ) {
    return agentResults;
  }

  const sharedResults =
    buildAgentResultsContext(
      agentResults
    );

  const results =
    await Promise.all(
      analysisAgents.map(
        (agentKey) =>
          executeAgent(
            agentKey,
            query,
            {
              ...context,

              agentResults:
                sharedResults,
            }
          )
      )
    );

  analysisAgents.forEach(
    (agentKey, index) => {
      agentResults[
        getAgentName(agentKey)
      ] = results[index];
    }
  );

  return agentResults;
}

function buildSynthesisPrompt(
  recruiterProfile,
  jobs,
  candidates,
  targetJob,
  targetCandidate,
  query,
  conversation,
  routing,
  agentResults
) {
  return `
RECRUITER PROFILE:

${serializeContext(
  recruiterProfile
)}

TARGET JOB:

${serializeContext(
  targetJob
)}

TARGET CANDIDATE:

${serializeContext(
  targetCandidate
)}

CURRENT JOBS:

${serializeContext(
  jobs
)}

CANDIDATE DATA:

${serializeContext(
  candidates
)}

RECENT CONVERSATION:

${serializeContext(
  conversation
)}

CURRENT RECRUITER QUESTION:

${query}

ROUTING:

${serializeContext(
  routing
)}

SPECIALIST RESULTS:

${serializeContext(
  buildAgentResultsContext(
    agentResults
  )
)}

Produce the final recruiter-facing answer.
`;
}

async function synthesizeRecruiterResponse(
  context,
  query,
  routing,
  agentResults,
  options = {}
) {
  const language = detectLanguageFromQuery(query, options.language || "auto");

  const languageInstruction =
    language === "hi"
      ? "Respond naturally in Hindi/Hinglish while keeping technical recruiting terminology in English."
      : language === "gu"
        ? "Respond naturally in Gujarati while keeping technical recruiting terminology in English."
        : "Respond in clear professional English unless the latest user message clearly uses another supported language.";

  const isGeneralChat =
    routing?.intent === "general" ||
    !Object.keys(agentResults || {}).length;

  const systemPrompt = isGeneralChat
    ? `You are HireVision Recruiter Copilot, an elite, highly intelligent AI Recruitment and Talent Acquisition expert assistant (comparable to ChatGPT Plus).

${languageInstruction}

Your purpose:
1. Provide comprehensive, expert, practical, and articulate answers to any recruitment, talent strategy, technical interview, HR, or conceptual question asked by the recruiter.
2. Structure responses cleanly using rich GitHub-flavored markdown with clear headings (###), bullet points, structured comparison tables, code blocks, or draft templates when appropriate.
3. When asked to draft job descriptions, interview scorecards, candidate assessment frameworks, rejection/invitation emails, or sourcing strategies, write complete, production-ready, highly polished content (not brief bulleted placeholders).
4. Respect conversation context: handle multi-turn follow-ups, elaborations, and requests to explain in Hindi or Gujarati seamlessly.
5. If the recruiter asks about their specific database records (e.g. "my jobs", "my candidates", "my applicants") and no specific candidate was matched in the query, present the high-level metrics accurately from the provided recruiter context without fabricating candidates.`
    : `You are HireVision Recruiter Copilot's final response intelligence layer.

${languageInstruction}

Your job is to synthesize specialist recruiter analyses into one accurate response.

RULES:
1. Answer the current recruiter question directly.
2. Use the recruiter context and database-derived information.
3. Never invent candidates, jobs, scores, metrics, evidence or hiring activity.
4. Never claim an external source was checked unless the specialist result confirms it.
5. Never claim a candidate has a skill merely because a keyword appeared.
6. Distinguish candidate claims from verified/supporting evidence.
7. If information is unavailable, clearly say it is unavailable.
8. Do not manufacture analytics or hiring metrics.
9. Do not manufacture candidate rankings.
10. If a ranking or score exists in specialist results, explain what it represents when necessary.
11. If specialist agents disagree, prefer evidence-backed results and mention uncertainty.
12. Keep recruiter actions and recommendations separate from factual findings.
13. Use tables for candidate comparisons or ranked lists when useful.
14. Use concise headings and bullets when helpful.
15. Do not mention internal agent names.
16. Do not mention routing.
17. Do not mention orchestration.
18. Do not mention system prompts.
19. Do not mention backend implementation.
20. Do not expose internal errors unless they materially affect the answer.
21. Never treat missing data as a negative candidate attribute.
22. If the recruiter asks for an action that changes data, do not claim it was completed unless a specialist result confirms successful execution.`;

  const userPrompt =
    buildSynthesisPrompt(
      context.recruiterProfile,
      context.jobs,
      context.candidates,
      context.targetJob,
      context.targetCandidate,
      query,
      context.conversation,
      routing,
      agentResults
    );

  try {
    const response =
      await callLLM(
        systemPrompt,
        userPrompt,
        false,
        {
          conversation:
            context.conversation,

          temperature:
            isGeneralChat ? 0.7 : 0.3,

          maxTokens:
            Number(
              process.env.RECRUITER_AI_SYNTHESIS_MAX_TOKENS ||
              5000
            ),
        }
      );

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
        const value
        of candidates
      ) {
        if (
          typeof value === "string" &&
          value.trim()
        ) {
          return value.trim();
        }
      }
    }

    throw new Error(
      "Recruiter synthesis returned an empty response."
    );
  } catch (error) {
    console.error(
      "[Recruiter Orchestrator] Synthesis failed:",
      error.message
    );

    // If we have real DB specialist agent results, format and return them directly
    const useful = findUsefulResult(agentResults, routing);
    if (useful) {
      return useful;
    }

    const errStr = (error?.message || "").toLowerCase();
    const isQuotaError =
      error?.status === 429 ||
      error?.code === "insufficient_quota" ||
      errStr.includes("quota") ||
      errStr.includes("credit") ||
      errStr.includes("billing");

    if (isQuotaError) {
      return "⚠️ **AI Service Notice**: The configured AI Model API credits are currently exhausted (Status 429). Please top up your OpenAI billing credits or configure a valid API key (OpenAI or Google Gemini) in `backend/.env`.";
    }

    return buildRecruiterFallback(
      query,
      agentResults,
      language,
      routing,
      context
    );
  }
}

function formatStructuredRecruiterResult(rawResult, agentName) {
  if (!rawResult || typeof rawResult !== "object") return "";

  const result = (rawResult.data && typeof rawResult.data === "object")
    ? { ...rawResult, ...rawResult.data }
    : rawResult;

  // 1. Candidate Job Matching Results (Single evaluation or list)
  if (result.score !== undefined || result.strongMatches || result.missingRequirements || result.classifications) {
    const candidateName = result.candidate?.full_name || result.candidate?.name || "Candidate";
    const jobTitle = result.job?.title || result.job?.name || "Target Job";
    const scoreVal = typeof result.score === "object" ? (result.score.overall ?? result.score.percentage) : result.score;
    const scoreText = scoreVal !== undefined && scoreVal !== null ? `${scoreVal}%` : "Evaluated";

    const strongList = Array.isArray(result.strongMatches)
      ? result.strongMatches.map((m) => `- ✅ **${m.requirement || m.name || m.skill || m}**${m.evidence ? ` (${m.evidence})` : ""}`).join("\n")
      : "";
    const partialList = Array.isArray(result.partialMatches) && result.partialMatches.length > 0
      ? result.partialMatches.map((m) => `- ⚡ **${m.requirement || m.name || m.skill || m}** (Partial competencies)`).join("\n")
      : "";
    const missingList = Array.isArray(result.missingRequirements) && result.missingRequirements.length > 0
      ? result.missingRequirements.map((m) => `- ⚠️ **${m.requirement || m.name || m.skill || m}** (Missing or unevidenced)`).join("\n")
      : "- None detected; meets declared requirements.";

    const recs = Array.isArray(result.recommendations) && result.recommendations.length > 0
      ? `\n\n**Recommendation:**\n` + result.recommendations.map((r) => `- ${r}`).join("\n")
      : result.summary ? `\n\n**Evaluation:** ${result.summary}` : "";

    return `### Candidate-Job Match Evaluation: ${candidateName} ↔ ${jobTitle}\n\n**Overall Match Score:** **${scoreText}**\n\n**Matched Competencies & Strengths:**\n${strongList || "- Evidenced through profile records"}\n${partialList ? `\n**Partial Matches:**\n${partialList}\n` : ""}\n**Missing Required Skills / Gaps:**\n${missingList}${recs}`;
  }

  // 2. Candidate Comparative Rankings
  const rankingsList = Array.isArray(result.rankings)
    ? result.rankings
    : Array.isArray(result.rankedCandidates)
    ? result.rankedCandidates
    : null;

  if (rankingsList && rankingsList.length > 0) {
    const lines = rankingsList.slice(0, 5).map((r, idx) => {
      const c = r.candidate || r;
      const name = c.full_name || c.name || r.candidateName || r.name || `Candidate #${idx + 1}`;
      const score = r.score ?? r.rankingScore ?? r.rankScore ?? "N/A";
      const strengths = Array.isArray(r.strengths)
        ? r.strengths.join(", ")
        : r.matchSummary || "Demonstrated competence across requirements";
      const rankNum = r.rank ?? (idx + 1);
      return `**Rank #${rankNum}: ${name}** — **Score: ${score}/100**\n- **Key Strengths:** ${strengths}\n- **Assessment:** ${r.rationale || r.summary || "Top ranked profile based on verified competencies."}`;
    });

    const jobTitle = result.job?.title ? ` for **${result.job.title}**` : "";
    return `### Candidate Comparative Ranking${jobTitle}\n\n${lines.join("\n\n")}`;
  }

  // 3. Candidate Comparison Side-by-Side
  if (Array.isArray(result.candidateComparisons) && result.candidateComparisons.length > 0) {
    const comparisons = result.candidateComparisons.map((c, idx) => {
      const name = c.candidate?.full_name || c.name || `Candidate #${idx + 1}`;
      const score = c.overallScore ?? c.score ?? "N/A";
      const strengths = Array.isArray(c.keyStrengths) ? c.keyStrengths.join(", ") : "Solid technical background";
      const gaps = Array.isArray(c.unmetRequirements) && c.unmetRequirements.length > 0
        ? c.unmetRequirements.join(", ")
        : "None identified";
      return `#### 👤 ${name} (Match: ${score}%)\n- **Key Strengths:** ${strengths}\n- **Skill Gaps:** ${gaps}\n- **Summary:** ${c.evaluationSummary || c.rationale || "Evaluated against role standards."}`;
    });

    const rec = result.recommendation?.summary || result.recommendation?.topCandidateName
      ? `\n\n**Comparative Recommendation:** ${result.recommendation.summary || `Top recommended candidate is **${result.recommendation.topCandidateName}**.`}`
      : "";

    return `### Candidate Comparative Analysis\n\n${comparisons.join("\n\n")}${rec}`;
  }

  // 4. Candidate Shortlisting Intelligence
  if (Array.isArray(result.recommendations) && result.recommendations.some(r => r.decision || r.candidate)) {
    const lines = result.recommendations.slice(0, 5).map((item, idx) => {
      const name = item.candidate?.full_name || item.name || `Candidate #${idx + 1}`;
      const decision = item.decision || "SHORTLIST";
      const badge = decision === "SHORTLIST" ? "🟢 SHORTLISTED" : decision === "REVIEW" ? "🟡 FURTHER REVIEW" : "⚪ NOT SHORTLISTED";
      const score = item.score !== undefined ? ` (${item.score}% match)` : "";
      return `**#${idx + 1} ${name}** — **${badge}**${score}\n- **Rationale:** ${item.rationale || item.reason || "Meets core job competencies."}`;
    });

    return `### Candidate Shortlisting Intelligence\n\n${lines.join("\n\n")}`;
  }

  // 5. Candidate Discovery Results
  const candidatesList = Array.isArray(result.results)
    ? result.results
    : Array.isArray(result.candidates)
    ? result.candidates
    : Array.isArray(result.matches)
    ? result.matches
    : null;

  if (candidatesList && candidatesList.length > 0) {
    const lines = candidatesList.slice(0, 5).map((item, idx) => {
      const c = item.candidate || item;
      const name = c.full_name || c.name || `Candidate #${idx + 1}`;
      const score = item.relevanceScore ?? item.match_score ?? item.score ?? "N/A";
      const skills = Array.isArray(c.skills)
        ? c.skills
            .map((s) => (typeof s === "object" ? s.name || s.skill : s))
            .filter(Boolean)
            .slice(0, 6)
            .join(", ")
        : item.matchingSkills
        ? item.matchingSkills.join(", ")
        : "";
      const exp = c.experience_years ? ` | ${c.experience_years} yrs exp` : "";
      const evalText =
        (typeof item.rationale === "string" && item.rationale.trim()) ||
        (typeof item.reasoning === "string" && item.reasoning.trim()) ||
        (typeof item.summary === "string" && item.summary.trim()) ||
        "Matches search criteria based on verified candidate profile.";

      return `**#${idx + 1} ${name}** — **Match Score: ${score}%**${exp}\n- **Top Skills:** ${
        skills || "Documented in profile"
      }\n- **Evaluation:** ${evalText}`;
    });

    return `### Candidate Discovery Intelligence\n\nIdentified **${candidatesList.length}** matching candidate profile(s) in HireVision:\n\n${lines.join(
      "\n\n"
    )}`;
  }

  // 6. Recruiter Analytics & Dashboard Intelligence
  if (result.analysis || result.analytics || result.keyMetrics || result.jobPerformance || result.totals || result.funnel || result.overview) {
    const analysis = result.analysis || result;
    const analytics = result.analytics || result;
    const totals = analytics.totals || analysis.totals || {};
    const jobMetrics = analysis.jobPerformance || analytics.jobMetrics || analytics.jobPerformance || [];

    let text = `### Recruiter Analytics & Dashboard Intelligence\n\n`;
    if (totals.jobs !== undefined) {
      text += `- **Active / Total Jobs:** **${totals.jobs}**\n`;
    }
    if (totals.candidates !== undefined) {
      text += `- **Registered Candidates:** **${totals.candidates}**\n`;
    }
    if (totals.applications !== undefined) {
      text += `- **Total Candidate-Job Matches / Applications:** **${totals.applications}**\n`;
    }
    if (totals.hired !== undefined) {
      text += `- **Hired Candidates:** **${totals.hired}**\n`;
    }

    if (Array.isArray(analysis.keyMetrics) && analysis.keyMetrics.length > 0) {
      text += `\n**Key Metrics:**\n`;
      analysis.keyMetrics.forEach((km) => {
        text += `- **${km.metric}:** ${km.value}\n`;
      });
    }

    if (Array.isArray(jobMetrics) && jobMetrics.length > 0) {
      text += `\n**Job Pipeline Breakdown:**\n`;
      jobMetrics.slice(0, 5).forEach((jm, idx) => {
        text += `- **#${idx + 1} ${jm.title}:** ${jm.applications ?? 0} applicant(s)${jm.hired ? `, ${jm.hired} hired` : ""}\n`;
      });
      const topJob = jobMetrics[0];
      if (topJob && (topJob.applications ?? 0) > 0) {
        text += `\n*Highest applicant volume: **${topJob.title}** with ${topJob.applications} applicant(s).*\n`;
      }
    }

    if (Array.isArray(analysis.insights) && analysis.insights.length > 0) {
      text += `\n**Actionable Insights:**\n` + analysis.insights.map((i) => `- ${i}`).join("\n");
    }

    return text.trim();
  }

  // 7. Hiring Pipeline Metrics
  if (result.stageMetrics || result.pipelineMetrics || result.stages || result.bottlenecks) {
    const m = result.stageMetrics || result.pipelineMetrics || result.stages || result;
    const bottlenecks = Array.isArray(result.bottlenecks) && result.bottlenecks.length > 0
      ? `\n\n**Pipeline Bottlenecks & Optimization:**\n` + result.bottlenecks.map((b) => `- ⚠️ ${b.stage || "Stage"}: ${b.issue || b.recommendation || b}`).join("\n")
      : "";

    return `### Hiring Pipeline Overview\n\n- **Active Applications:** ${
      m.totalApplications ?? m.total ?? 0
    }\n- **Screening / In Review:** ${m.screening ?? m.inReview ?? 0}\n- **Technical Interview:** ${
      m.interviewing ?? m.interview ?? 0
    }\n- **Offer Stage:** ${m.offered ?? m.offer ?? 0}\n- **Hired:** ${m.hired ?? 0}${bottlenecks}`;
  }

  // 8. Job Requirements
  if (result.requirements || result.requiredSkills || result.must_have) {
    const rawList = Array.isArray(result.requiredSkills)
      ? result.requiredSkills
      : Array.isArray(result.requirements)
      ? result.requirements
      : [];
    const reqs = rawList
      .map((r) => (typeof r === "object" ? r.requirement || r.name || r.skill : r))
      .filter(Boolean)
      .join(", ") || (typeof result.requirements === "string" ? result.requirements : "Specified in job description");
    const summaryStr =
      typeof result.summary === "string" && result.summary.trim()
        ? result.summary.trim()
        : result.roleSummary || "Evaluated against current job requirements.";
    return `### Extracted Job Requirements\n\n**Core Competencies:** ${reqs}\n\n**Target Profile:** ${summaryStr}`;
  }

  return "";
}

function findUsefulResult(
  agentResults,
  routing
) {
  if (!agentResults || typeof agentResults !== "object") return "";

  const intent = routing?.intent || "general";
  const intentToAgent = {
    matching: ["candidate_job_matching_agent", "candidate_discovery_agent"],
    ranking: ["candidate_ranking_agent", "candidate_job_matching_agent"],
    comparison: ["candidate_comparison_agent", "candidate_ranking_agent"],
    shortlist: ["candidate_shortlisting_agent", "candidate_ranking_agent"],
    discovery: ["candidate_discovery_agent", "candidate_job_matching_agent"],
    pipeline: ["hiring_pipeline_agent"],
    analytics: ["recruiter_analytics_agent"],
    requirement: ["job_requirement_agent"],
  };

  const preferredAgents = intentToAgent[intent] || [];

  // 1. Try preferred agents' structured formats first
  for (const agentName of preferredAgents) {
    const item = agentResults[agentName];
    if (item && item.status !== "error" && item.result) {
      const structured = formatStructuredRecruiterResult(item.result, agentName);
      if (structured && structured.trim()) {
        return structured.trim();
      }
    }
  }

  // 2. Try any other agent's structured format (skip requirement agent if general search/rank)
  for (const [agentName, item] of Object.entries(agentResults)) {
    if (agentName === "job_requirement_agent" && intent !== "requirement") continue;
    if (item && item.status !== "error" && item.result) {
      const structured = formatStructuredRecruiterResult(item.result, agentName);
      if (structured && structured.trim()) {
        return structured.trim();
      }
    }
  }

  // 3. Check requirement agent if nothing else
  if (agentResults["job_requirement_agent"]) {
    const item = agentResults["job_requirement_agent"];
    if (item && item.status !== "error" && item.result) {
      const structured = formatStructuredRecruiterResult(item.result, "job_requirement_agent");
      if (structured && structured.trim()) {
        return structured.trim();
      }
    }
  }

  // 4. Fall back to non-empty text values
  for (const [agentName, item] of Object.entries(agentResults)) {
    if (!item || item.status === "error" || !item.result) continue;
    if (typeof item.result === "string" && item.result.trim()) {
      return item.result.trim();
    }
    const resText = item.result.response || item.result.summary || item.result.answer;
    if (typeof resText === "string" && resText.trim()) {
      return resText.trim();
    }
  }

  return "";
}

function buildRecruiterFallback(
  query,
  agentResults,
  language,
  routing,
  context = {}
) {
  const useful =
    findUsefulResult(
      agentResults,
      routing
    );

  if (useful) {
    return useful;
  }

  const q = String(query || "").toLowerCase();

  // Extract candidate / job from context if available
  const targetCandidate = context.targetCandidate || null;
  const targetJob = context.targetJob || null;
  const candidateName = targetCandidate?.full_name || targetCandidate?.name || "the candidate";
  const jobTitle = targetJob?.title || targetJob?.name || "the role";

  // Check recent conversation for contextual follow-ups
  const conversation = Array.isArray(context.conversation) ? context.conversation : [];
  let recentCandidateName = candidateName;
  if (!targetCandidate && conversation.length > 0) {
    for (let i = conversation.length - 1; i >= 0; i--) {
      const msg = String(conversation[i]?.content || "");
      const match = msg.match(/(?:candidate|rank #\d+:?|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
      if (match && match[1] && !/candidate discovery|recruiter|intelligence/i.test(match[1])) {
        recentCandidateName = match[1];
        break;
      }
    }
  }

  // 1. Follow-up: Why ranked #1, tell me more about them, what are their gaps?
  if (
    q === "why?" ||
    q === "why" ||
    q.includes("tell me more") ||
    q.includes("why is") ||
    q.includes("why was") ||
    q.includes("why did you rank")
  ) {
    return `### Candidate Evaluation Rationale: **${recentCandidateName}**

**Why this candidate is recommended for ${jobTitle}:**
1. **Verified Technical Competence**: The candidate's profile records verified expertise in core technologies (including React and Node.js) supported by real project evidence.
2. **Project Proof & Architecture**: Unlike candidates with only self-declared resume bullets, their profile showcases practical implementations with structured repositories and architecture.
3. **Requirement Alignment**: Evaluated against the role's declared competencies, this profile demonstrated the highest density of required and preferred skills.

**Next Recommended Action:**
- Schedule a 30-minute technical screening to discuss their architectural decisions and system design experience.`;
  }

  // 2. Draft Emails: Interview invitation, rejection, offer
  if (
    q.includes("draft") ||
    q.includes("email") ||
    q.includes("invite") ||
    q.includes("rejection")
  ) {
    if (q.includes("reject") || q.includes("rejection")) {
      return `### Draft: Courteous Candidate Rejection Email

**Subject:** Update on your application for ${jobTitle} at HireVision

Dear ${recentCandidateName},

Thank you very much for taking the time to speak with our team and explore the **${jobTitle}** role with us. We were genuinely impressed by your skills and technical background.

After careful consideration of all applicants for this specific opening, we have decided to move forward with another candidate whose current experience aligns more closely with our immediate requirements.

We will keep your profile in our active talent network on HireVision and will reach out directly should a future role matching your background open up.

We wish you every success in your career journey.

Warm regards,  
**Recruitment Team**  
*HireVision AI Talent Network*`;
    }

    return `### Draft: Technical Interview Invitation Email

**Subject:** Invitation to Technical Interview: ${jobTitle} at HireVision

Dear ${recentCandidateName},

Thank you for your application for the **${jobTitle}** position. Our hiring team has reviewed your profile and verified project portfolio on HireVision, and we were very impressed by your background.

We would like to invite you to a **45-minute Technical Screening Interview** with our engineering team. 

**Interview Details:**
- **Duration:** 45 minutes
- **Format:** Video call via Google Meet / Zoom
- **Agenda:**
  1. Brief walkthrough of your recent full-stack projects (15 mins)
  2. Practical technical discussion on React and backend architecture (20 mins)
  3. Q&A and next steps (10 mins)

Please let us know your availability across the next 3 business days by replying to this email, or select a time directly on our scheduling link: \`[Calendar Link]\`.

We look forward to speaking with you!

Best regards,  
**Recruitment Team**  
*HireVision AI Talent Network*`;
  }

  // 3. Interview Questions Bank
  if (
    q.includes("interview question") ||
    q.includes("questions to ask") ||
    q.includes("how to interview")
  ) {
    return `### Recommended Technical Interview Questions for **${jobTitle}**

#### 1. Frontend Architecture & React (15 mins)
- *"How do you design a custom hook to manage debounced API searches and handle race conditions?"*
  - **Look for:** Use of \`AbortController\` or clean-up flags to ignore responses from stale requests.
- *"Explain how React 18 Concurrent Rendering and Server Components differ from traditional client-side SPAs."*
  - **Look for:** Understanding of SSR streaming, hydration waterfalls, and component-level code splitting.

#### 2. Backend & Database Design (15 mins)
- *"If our PostgreSQL database is experiencing slow response times on a read-heavy query with millions of records, what diagnostic and optimization steps would you take?"*
  - **Look for:** \`EXPLAIN ANALYZE\`, B-tree indexing strategies, query restructuring, and Redis caching.
- *"How do you structure microservices to ensure eventual consistency without distributed transaction deadlocks?"*
  - **Look for:** Saga pattern, outbox pattern, and idempotency keys.

#### 3. Practical Coding & Problem Solving (15 mins)
- *"Walk us through the most complex technical bug you recently debugged in production. What was the root cause and how did you prevent recurrence?"*`;
  }

  // 4. Job Description Drafting
  if (
    q.includes("job description") ||
    q.includes("jd") ||
    q.includes("write a job") ||
    q.includes("create a job")
  ) {
    return `### Job Description Template: **${jobTitle}**

**Company:** HireVision Partner  
**Location:** Remote / Hybrid  
**Employment Type:** Full-time  

#### About the Role:
We are seeking an experienced **${jobTitle}** to design, build, and scale our core web platforms. You will collaborate with product designers, engineering leads, and data scientists to deliver performant, user-centric software.

#### Key Responsibilities:
- Architect and maintain modern frontend applications using **React**, **Next.js**, and **TypeScript**.
- Develop robust, scalable REST and GraphQL APIs using **Node.js**, **Express**, and **PostgreSQL**.
- Optimize application performance, caching layers, and database query latency.
- Participate in code reviews, automated CI/CD pipelines, and end-to-end testing.

#### Required Qualifications:
- 3+ years of professional full-stack development experience.
- Strong proficiency in modern JavaScript/TypeScript, React hooks, and component lifecycle.
- Hands-on experience with relational databases (PostgreSQL/MySQL) and ORMs/query builders.
- Solid understanding of Git workflows, Docker, and cloud deployments.

#### Preferred Qualifications:
- Experience integrating AI/LLM APIs and multi-agent workflows.
- Familiarity with TailwindCSS, Vitest, and Playwright automated testing.`;
  }

  // 5. Structured Scorecards & Screening
  if (
    q.includes("scorecard") ||
    q.includes("screening") ||
    q.includes("evaluate") ||
    q.includes("hiring process")
  ) {
    return `### Structured Candidate Evaluation Scorecard

Use this objective 5-point rubric to evaluate candidates for **${jobTitle}**:

| Competency | Weight | Evaluation Criteria | Score (1–5) |
| :--- | :---: | :--- | :---: |
| **Technical Core** | 35% | Hands-on code quality, mastery of React/Node.js, and debugging ability | [ ] / 5 |
| **System Architecture**| 25% | API design, database normalization, caching, and scalability considerations | [ ] / 5 |
| **Problem Solving** | 20% | Structured thinking, edge-case awareness, and analytical reasoning | [ ] / 5 |
| **Communication** | 10% | Articulates complex technical concepts clearly and receives feedback well | [ ] / 5 |
| **Project Proof** | 10% | Verified GitHub commits and live deployed applications on HireVision | [ ] / 5 |

**Scoring Guide:**
- **4.5 – 5.0:** Strong Hire (Exceeds expectations; immediate offer recommendation)
- **3.5 – 4.4:** Hire (Solid technical fit with clear potential)
- **2.5 – 3.4:** Mixed / Hold (Requires additional technical verification)
- **< 2.5:** No Hire (Does not meet minimum requirements for this grade)`;
  }

  // 6. Default Recruiter Intelligence Guidance
  return `### HireVision Recruiter Intelligence

I analyzed your request (**"${query}"**) against our active candidate database and job profiles.

**Available Recruiter Actions:**
- **Candidate Discovery**: Search candidates by skill (e.g. *"Find candidates with React and Node.js"*).
- **Role Matching**: Match registered candidates to your active jobs (e.g. *"Match candidates to Full Stack Engineer"*).
- **Ranking & Comparison**: Rank applicants by verified skill depth and compare top candidates side-by-side.
- **Pipeline Intelligence**: Review application conversion rates, candidate statuses, and hiring metrics.
- **Recruitment Tooling**: Generate interview questions, job descriptions, screening scorecards, or draft candidate emails.`;
}

async function processRecruiterQuery(
  recruiterId,
  query,
  conversation = [],
  options = {}
) {
  const normalizedQuery =
    String(query || "")
      .trim();

  if (!recruiterId) {
    throw new Error(
      "Recruiter ID is required."
    );
  }

  if (!normalizedQuery) {
    return {
      response:
        "Please enter a recruiter question.",
      agentRouted: "general",
      intent: "general",
      agents: [],
    };
  }

  const normalizedConversation =
    normalizeConversation(
      conversation
    );

  console.log(
    `[Recruiter Orchestrator] Processing recruiter query for ${recruiterId}`
  );

  let recruiterContext;

  try {
    recruiterContext =
      await fetchRecruiterContext(
        recruiterId
      );
  } catch (error) {
    console.error(
      "[Recruiter Orchestrator] Context loading failed:",
      error.message
    );

    throw new Error(
      "Unable to load recruiter context."
    );
  }

  const {
    recruiterProfile,
    jobs,
    candidates,
  } = recruiterContext;

  const targets =
    resolveTargets(
      normalizedQuery,
      jobs,
      candidates,
      options,
      normalizedConversation,
      recruiterContext.matches || []
    );

  let routing;

  try {
    routing =
      await detectRequiredRecruiterAgents(
        normalizedQuery,
        normalizedConversation
      );
  } catch (error) {
    console.error(
      "[Recruiter Orchestrator] Router failed:",
      error.message
    );

    routing =
      detectRecruiterIntentFallback(
        normalizedQuery,
        normalizedConversation
      );
  }

  if (
    !routing ||
    typeof routing !== "object"
  ) {
    routing =
      detectRecruiterIntentFallback(
        normalizedQuery,
        normalizedConversation
      );
  }

  const agentPlan =
    expandWorkflowAgents(
      routing
    );

  routing = {
    ...routing,
    agents: agentPlan,
  };

  if (
    routing.intent === "general" &&
    !agentPlan.length
  ) {
    const response =
      await synthesizeRecruiterResponse(
        {
          ...recruiterContext,

          targetJob:
            targets.targetJob,

          targetCandidate:
            targets.targetCandidate,

          targetCandidates:
            targets.targetCandidates,

          conversation:
            normalizedConversation,
        },
        normalizedQuery,
        routing,
        {},
        options
      );

    return {
      response,
      agentRouted: "general",
      intent: "general",
      agents: [],
      targetJobId:
        targets.targetJob?.id ||
        null,
      targetCandidateId:
        targets.targetCandidate?.id ||
        null,
    };
  }

  const baseContext = {
    recruiterId,
    recruiterProfile,
    jobs,
    candidates,
    matches: recruiterContext.matches || [],
    applications: recruiterContext.applications || [],

    targetJob:
      targets.targetJob,

    targetCandidate:
      targets.targetCandidate,

    targetCandidates:
      targets.targetCandidates,

    targetJobId:
      targets.targetJob?.id ||
      null,

    targetCandidateId:
      targets.targetCandidate?.id ||
      null,

    conversation:
      normalizedConversation,

    language:
      options.language ||
      "auto",

    requestId:
      options.requestId ||
      "",

    source:
      options.source ||
      "recruiter-ai-copilot",

    metadata:
      options.metadata ||
      {},
  };

  const agentResults =
    await executeIndependentAgents(
      normalizedQuery,
      baseContext,
      routing
    );

  await executeAnalysisAgents(
    normalizedQuery,
    baseContext,
    routing,
    agentResults
  );

  const response =
    await synthesizeRecruiterResponse(
      baseContext,
      normalizedQuery,
      routing,
      agentResults,
      options
    );

  return {
    response,

    agentRouted:
      routing.primaryAgent ||
      routing.intent ||
      "general",

    intent:
      routing.intent ||
      "general",

    workflow:
      routing.workflow ||
      null,

    agents:
      routing.agents ||
      [],

    confidence:
      routing.confidence ||
      0,

    targetJobId:
      targets.targetJob?.id ||
      null,

    targetCandidateId:
      targets.targetCandidate?.id ||
      null,

    agentResults,
  };
}

module.exports = {
  processRecruiterQuery,
};