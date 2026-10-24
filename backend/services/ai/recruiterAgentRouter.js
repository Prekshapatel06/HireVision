const { callLLM } = require("./openaiService");

const MAX_HISTORY_MESSAGES = 20;
const ROUTER_MAX_TOKENS = Number(
  process.env.AI_RECRUITER_ROUTER_MAX_TOKENS || 700
);

const AGENTS = [
  "requirement",
  "discovery",
  "resume_intelligence",
  "matching",
  "ranking",
  "comparison",
  "evidence",
  "shortlist",
  "pool",
  "pipeline",
  "analytics",
  "reengagement",
];

const WORKFLOWS = {
  search: [
    "requirement",
    "discovery",
    "matching",
    "evidence",
    "ranking",
    "shortlist",
  ],
  analysis: [
    "resume_intelligence",
    "evidence",
    "matching",
  ],
  comparison: [
    "matching",
    "resume_intelligence",
    "evidence",
    "comparison",
  ],
};

const AGENT_PRIORITY = {
  comparison: 100,
  ranking: 95,
  shortlist: 90,
  matching: 85,
  requirement: 80,
  discovery: 75,
  evidence: 70,
  resume_intelligence: 68,
  pipeline: 65,
  analytics: 60,
  pool: 55,
  reengagement: 50,
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
    .slice(-MAX_HISTORY_MESSAGES);
}

function normalizeAgentList(agents) {
  if (!Array.isArray(agents)) {
    return [];
  }

  return [
    ...new Set(
      agents.filter((agent) =>
        AGENTS.includes(agent)
      )
    ),
  ].sort(
    (a, b) =>
      (AGENT_PRIORITY[b] || 0) -
      (AGENT_PRIORITY[a] || 0)
  );
}

function normalizeIntent(value) {
  const allowed = [
    "requirement",
    "discovery",
    "resume_intelligence",
    "matching",
    "ranking",
    "comparison",
    "evidence",
    "shortlist",
    "pool",
    "pipeline",
    "analytics",
    "reengagement",
    "general",
  ];

  return allowed.includes(value)
    ? value
    : "general";
}

function normalizeWorkflow(value) {
  return [
    "search",
    "analysis",
    "comparison",
  ].includes(value)
    ? value
    : null;
}

function getWorkflowForIntent(intent) {
  if (
    intent === "discovery" ||
    intent === "ranking" ||
    intent === "shortlist"
  ) {
    return "search";
  }

  if (
    intent === "matching" ||
    intent === "resume_intelligence"
  ) {
    return "analysis";
  }

  if (intent === "comparison") {
    return "comparison";
  }

  return null;
}

function buildRoutingResult({
  intent = "general",
  workflow = null,
  agents = [],
  confidence = 0,
  source = "router",
} = {}) {
  const normalizedIntent =
    normalizeIntent(intent);

  const normalizedAgents =
    normalizeAgentList(agents);

  let finalWorkflow =
    normalizeWorkflow(workflow);

  if (
    !finalWorkflow &&
    normalizedIntent !== "general"
  ) {
    finalWorkflow =
      getWorkflowForIntent(
        normalizedIntent
      );
  }

  if (
    finalWorkflow &&
    WORKFLOWS[finalWorkflow]
  ) {
    const workflowAgents =
      WORKFLOWS[finalWorkflow];

    for (const agent of normalizedAgents) {
      if (!workflowAgents.includes(agent)) {
        continue;
      }
    }
  }

  return {
    intent: normalizedIntent,
    workflow: finalWorkflow,
    agents: normalizedAgents,
    primaryAgent:
      normalizedAgents[0] || "",
    confidence: Math.max(
      0,
      Math.min(1, Number(confidence) || 0)
    ),
    source,
  };
}

function detectRecruiterIntentFallback(
  query,
  conversation = []
) {
  const text = String(query || "")
    .toLowerCase()
    .trim();

  const history =
    normalizeConversation(
      conversation
    );

  if (!text) {
    return buildRoutingResult({
      confidence: 1,
      source: "deterministic",
    });
  }

  const combinedContext = [
    ...history.slice(-6).map(
      (message) => message.content
    ),
    text,
  ]
    .join(" ")
    .toLowerCase();

  const isFollowUp =
    text.length <= 120 &&
    /^(why|how|explain|what about|what next|then what|tell me more|continue|improve|fix|and then|also)/i.test(
      text
    );

  // 0. Active jobs, job counts, dashboard job metrics, applicant volumes
  if (
    /\b(how many (active )?jobs|my jobs|active jobs|open jobs|job count|total jobs|list jobs|what jobs|openings|vacancies|positions|highest number of applicants|most applicants|most popular job|job with the most)\b/i.test(
      text
    )
  ) {
    return buildRoutingResult({
      intent: "analytics",
      workflow: null,
      agents: ["analytics"],
      confidence: 0.95,
      source: "deterministic",
    });
  }

  // 1. Missing required skills or candidate skill gaps against jobs
  if (
    /\b(missing required skills|missing skills|unmet requirements|skill gaps?|who lacks|candidates with missing)\b/i.test(
      text
    )
  ) {
    return buildRoutingResult({
      intent: "matching",
      workflow: "analysis",
      agents: [
        "requirement",
        "matching",
        "evidence",
      ],
      confidence: 0.94,
      source: "deterministic",
    });
  }

  if (
    /\b(compare|comparison|versus|vs\.?|side by side|difference between|compare the top (two|three|2|3|\d+)|compare top (two|three|2|3|\d+)|compare these (two|three|2|3|\d+)?|compare them|compare candidates)\b/i.test(
      text
    )
  ) {
    return buildRoutingResult({
      intent: "comparison",
      workflow: "comparison",
      agents:
        WORKFLOWS.comparison,
      confidence: 0.96,
      source: "deterministic",
    });
  }

  if (
    /\b(shortlist|short listing|short-list|shortlisted|final candidates)\b/i.test(
      text
    )
  ) {
    return buildRoutingResult({
      intent: "shortlist",
      workflow: "search",
      agents: [
        "requirement",
        "discovery",
        "matching",
        "evidence",
        "ranking",
        "shortlist",
      ],
      confidence: 0.94,
      source: "deterministic",
    });
  }

  if (
    /\b(rank|ranking|rank candidates|top candidates|highest scoring|best candidates|top talent|strongest|strongest match|which one is strongest|which one is best|who is better|review first|which candidates should i review first)\b/i.test(
      text
    )
  ) {
    return buildRoutingResult({
      intent: "ranking",
      workflow: "search",
      agents: [
        "requirement",
        "discovery",
        "matching",
        "evidence",
        "ranking",
      ],
      confidence: 0.93,
      source: "deterministic",
    });
  }

  if (
    /\b(find|search|look for|discover|source|source candidates|developers|engineers|talent|which candidates|show candidates|who has|who knows|candidates with|candidates having|profiles with|list candidates)\b/i.test(
      text
    )
  ) {
    return buildRoutingResult({
      intent: "discovery",
      workflow: "search",
      agents:
        WORKFLOWS.search,
      confidence: 0.9,
      source: "deterministic",
    });
  }

  if (
    /\b(match|matching|candidate fit|fit for|best fit|suited|suitable candidate|who fits)\b/i.test(
      text
    )
  ) {
    return buildRoutingResult({
      intent: "matching",
      workflow: "analysis",
      agents: [
        "requirement",
        "matching",
        "evidence",
        "resume_intelligence",
      ],
      confidence: 0.92,
      source: "deterministic",
    });
  }

  if (
    /\b(requirement|requirements|job requirement|job requirements|must have|required skills|preferred skills|preferred qualification|optional skill|job description|jd)\b/i.test(
      text
    )
  ) {
    return buildRoutingResult({
      intent: "requirement",
      workflow: null,
      agents: ["requirement"],
      confidence: 0.91,
      source: "deterministic",
    });
  }

  if (
    /\b(evidence|verify|verified|verification|claimed|supported|proof|proof of skill|validate|validation|why|why recommended|why is this candidate|rationale|justify|insufficient evidence)\b/i.test(
      text
    )
  ) {
    return buildRoutingResult({
      intent: "evidence",
      workflow: null,
      agents: ["evidence"],
      confidence: 0.92,
      source: "deterministic",
    });
  }

  if (
    /\b(resume|cv|curriculum vitae|live resume|resume intelligence|ats|resume analysis|resume review)\b/.test(
      text
    )
  ) {
    return buildRoutingResult({
      intent: "resume_intelligence",
      workflow: "analysis",
      agents:
        WORKFLOWS.analysis,
      confidence: 0.93,
      source: "deterministic",
    });
  }

  if (
    /\b(pipeline|hiring stage|hiring stages|candidate stage|funnel|recruitment funnel|hiring progress|bottleneck|bottlenecks|hiring bottleneck)\b/i.test(
      text
    )
  ) {
    return buildRoutingResult({
      intent: "pipeline",
      workflow: null,
      agents: ["pipeline"],
      confidence: 0.94,
      source: "deterministic",
    });
  }

  if (
    /\b(analytics|analytics report|recruiting analytics|recruitment analytics|stats|statistics|metrics|metric|trend|trends|conversion|time to hire|hiring performance)\b/.test(
      text
    )
  ) {
    return buildRoutingResult({
      intent: "analytics",
      workflow: null,
      agents: ["analytics"],
      confidence: 0.93,
      source: "deterministic",
    });
  }

  if (
    /\b(talent pool|candidate pool|pool|talent database|talent community)\b/.test(
      text
    )
  ) {
    return buildRoutingResult({
      intent: "pool",
      workflow: null,
      agents: ["pool"],
      confidence: 0.93,
      source: "deterministic",
    });
  }

  if (
    /\b(reengage|re-engage|reengagement|re-engagement|inactive candidates|inactive talent|passive candidates|passive talent|reach out again)\b/.test(
      text
    )
  ) {
    return buildRoutingResult({
      intent: "reengagement",
      workflow: null,
      agents: ["reengagement"],
      confidence: 0.93,
      source: "deterministic",
    });
  }

  if (isFollowUp && history.length) {
    if (
      /\b(compare|comparison|versus|vs|side by side)\b/.test(
        combinedContext
      )
    ) {
      return buildRoutingResult({
        intent: "comparison",
        workflow: "comparison",
        agents:
          WORKFLOWS.comparison,
        confidence: 0.78,
        source: "context",
      });
    }

    if (
      /\b(shortlist|shortlisting|final candidates)\b/.test(
        combinedContext
      )
    ) {
      return buildRoutingResult({
        intent: "shortlist",
        workflow: "search",
        agents:
          WORKFLOWS.search,
        confidence: 0.76,
        source: "context",
      });
    }

    if (
      /\b(rank|ranking|top candidates|highest scoring)\b/.test(
        combinedContext
      )
    ) {
      return buildRoutingResult({
        intent: "ranking",
        workflow: "search",
        agents: [
          "matching",
          "evidence",
          "ranking",
        ],
        confidence: 0.76,
        source: "context",
      });
    }

    if (
      /\b(match|matching|fit|suited|candidate fit)\b/.test(
        combinedContext
      )
    ) {
      return buildRoutingResult({
        intent: "matching",
        workflow: "analysis",
        agents:
          WORKFLOWS.analysis,
        confidence: 0.76,
        source: "context",
      });
    }

    if (
      /\b(resume|cv|ats|resume intelligence)\b/.test(
        combinedContext
      )
    ) {
      return buildRoutingResult({
        intent: "resume_intelligence",
        workflow: "analysis",
        agents:
          WORKFLOWS.analysis,
        confidence: 0.75,
        source: "context",
      });
    }

    if (
      /\b(requirement|requirements|job description|must have|required skills)\b/.test(
        combinedContext
      )
    ) {
      return buildRoutingResult({
        intent: "requirement",
        agents: ["requirement"],
        confidence: 0.75,
        source: "context",
      });
    }

    if (
      /\b(evidence|verify|verified|proof|supported)\b/.test(
        combinedContext
      )
    ) {
      return buildRoutingResult({
        intent: "evidence",
        agents: ["evidence"],
        confidence: 0.74,
        source: "context",
      });
    }

    if (
      /\b(pipeline|stage|funnel)\b/.test(
        combinedContext
      )
    ) {
      return buildRoutingResult({
        intent: "pipeline",
        agents: ["pipeline"],
        confidence: 0.74,
        source: "context",
      });
    }

    if (
      /\b(analytics|metrics|stats|trends)\b/.test(
        combinedContext
      )
    ) {
      return buildRoutingResult({
        intent: "analytics",
        agents: ["analytics"],
        confidence: 0.74,
        source: "context",
      });
    }
  }

  return buildRoutingResult({
    confidence: 0.72,
    source: "deterministic",
  });
}

function extractJSONObject(value) {
  if (
    value &&
    typeof value === "object"
  ) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {}

  const cleaned =
    text
      .replace(
        /^```(?:json)?\s*/i,
        ""
      )
      .replace(
        /\s*```$/i,
        ""
      )
      .trim();

  try {
    return JSON.parse(cleaned);
  } catch {}

  const start =
    cleaned.indexOf("{");

  const end =
    cleaned.lastIndexOf("}");

  if (
    start !== -1 &&
    end > start
  ) {
    try {
      return JSON.parse(
        cleaned.slice(
          start,
          end + 1
        )
      );
    } catch {}
  }

  return null;
}

function validateLLMRouting(
  result,
  fallback
) {
  if (
    !result ||
    typeof result !== "object"
  ) {
    return fallback;
  }

  const intent =
    normalizeIntent(result.intent);

  let agents =
    normalizeAgentList(
      result.agents
    );

  if (!agents.length) {
    agents =
      fallback.agents;
  }

  const workflow =
    normalizeWorkflow(
      result.workflow
    ) ||
    getWorkflowForIntent(intent);

  let confidence =
    Number(result.confidence);

  if (!Number.isFinite(confidence)) {
    confidence =
      fallback.confidence;
  }

  if (confidence > 1) {
    confidence /= 100;
  }

  if (
    intent !== "general" &&
    !agents.length
  ) {
    return fallback;
  }

  return buildRoutingResult({
    intent,
    workflow,
    agents,
    confidence,
    source: "llm",
  });
}

async function detectRequiredRecruiterAgents(
  query,
  conversation = []
) {
  const normalizedQuery =
    String(query || "").trim();

  const normalizedConversation =
    normalizeConversation(
      conversation
    );

  if (!normalizedQuery) {
    return buildRoutingResult({
      confidence: 1,
      source: "deterministic",
    });
  }

  const fallback =
    detectRecruiterIntentFallback(
      normalizedQuery,
      normalizedConversation
    );

  const systemPrompt = `
You are HireVision's professional recruiter intent-routing engine.

Your task is to determine which internal recruiter capabilities are required to answer the user's latest message.

You are NOT the final answer generator.

Use recent conversation context to resolve follow-up questions.

Return ONLY valid JSON.

AVAILABLE AGENTS

requirement
Extract and analyze job requirements, mandatory skills, preferred qualifications, experience, constraints.

discovery
Find or identify relevant candidates from the available candidate data.

resume_intelligence
Analyze candidate resumes, CVs, ATS information, experience and qualifications.

matching
Evaluate candidate-to-job fit using requirements, skills, experience and available evidence.

ranking
Rank candidates by relevance or fit.

comparison
Compare candidates side by side.

evidence
Analyze verification, supporting evidence, claims and confidence.

shortlist
Create or refine a candidate shortlist.

pool
Manage or analyze talent-pool candidates.

pipeline
Analyze hiring stages, candidate movement and recruitment funnel.

analytics
Analyze recruiter metrics, statistics, trends and hiring performance.

reengagement
Identify or analyze inactive/passive candidates and re-engagement opportunities.

ROUTING RULES

1. Multiple agents may be selected.

2. Select only agents genuinely required.

3. Discovery questions normally require discovery plus matching/evidence when evaluating candidate quality.

4. Ranking normally requires matching and evidence.

5. Shortlisting normally requires requirement, discovery, matching, evidence, ranking and shortlist.

6. Candidate comparison normally requires matching, resume_intelligence, evidence and comparison.

7. Resume analysis normally uses resume_intelligence and may use matching/evidence when the question involves job fit or verification.

8. Matching requires matching and may require requirement, resume_intelligence and evidence depending on available context.

9. Requirement-only questions should not trigger candidate discovery.

10. Analytics questions should use analytics only unless the user explicitly asks for another operation.

11. Pipeline questions should use pipeline only unless another capability is clearly required.

12. Talent-pool questions should use pool.

13. Re-engagement questions should use reengagement.

14. Follow-up questions such as "why?", "what about this?", "which is better?", "explain", or "what next?" must use conversation context.

15. Do not route every recruiter request to every agent.

16. Choose the smallest sufficient set of agents.

17. primaryAgent must be the most important selected agent.

18. confidence must be between 0 and 1.

19. workflow may be:
search
analysis
comparison
or null.

20. intent must be one of:
requirement
discovery
resume_intelligence
matching
ranking
comparison
evidence
shortlist
pool
pipeline
analytics
reengagement
general

OUTPUT

{
  "intent": "general",
  "workflow": null,
  "agents": [],
  "primaryAgent": "",
  "confidence": 0
}
`;

  const userPrompt = `
LATEST RECRUITER MESSAGE:

${normalizedQuery}

RECENT CONVERSATION:

${JSON.stringify(
  normalizedConversation,
  null,
  2
)}

DETERMINISTIC INITIAL ROUTING:

${JSON.stringify(
  fallback,
  null,
  2
)}

Determine the final routing.

Return ONLY JSON.
`;

  try {
    const result =
      await callLLM(
        systemPrompt,
        userPrompt,
        true,
        {
          model:
            process.env.OPENAI_RECRUITER_ROUTER_MODEL ||
            process.env.OPENAI_ROUTER_MODEL ||
            process.env.OPENAI_FALLBACK_MODEL ||
            "gpt-4o-mini",

          temperature: 0,

          maxTokens:
            ROUTER_MAX_TOKENS,
        }
      );

    const parsed =
      extractJSONObject(result);

    if (!parsed) {
      return fallback;
    }

    return validateLLMRouting(
      parsed,
      fallback
    );
  } catch (error) {
    console.error(
      "[Recruiter Agent Router] LLM routing failed:",
      error.message
    );

    return fallback;
  }
}

module.exports = {
  detectRequiredRecruiterAgents,
  detectRecruiterIntentFallback,
  normalizeConversation,
  normalizeAgentList,
  normalizeIntent,
  normalizeWorkflow,
  buildRoutingResult,
  extractJSONObject,
};