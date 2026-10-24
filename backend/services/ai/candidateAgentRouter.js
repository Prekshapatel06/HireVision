const { callLLM } = require("./openaiService");

const MAX_HISTORY_MESSAGES = 20;
const ROUTER_MAX_TOKENS = Number(
  process.env.AI_ROUTER_MAX_TOKENS || 700
);

const CAPABILITIES = [
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
];

const CAPABILITY_PRIORITY = {
  needsCoding: 100,
  needsReadiness: 95,
  needsLiveResume: 90,
  needsResume: 85,
  needsGithub: 80,
  needsLinkedin: 78,
  needsEvidence: 75,
  needsGaps: 70,
  needsCareer: 65,
  needsProfile: 60,
  needsSkills: 55,
  needsProjects: 50,
  needsTeaching: 30,
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

function emptyRouting() {
  return {
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
}

function toBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return ["true", "yes", "1"].includes(
      value.trim().toLowerCase()
    );
  }

  if (typeof value === "number") {
    return value === 1;
  }

  return false;
}

function cleanString(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function clampConfidence(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  if (numeric > 1 && numeric <= 100) {
    return Math.max(0, Math.min(1, numeric / 100));
  }

  return Math.max(0, Math.min(1, numeric));
}

function getCapabilities(result) {
  return CAPABILITIES.filter(
    (capability) => result[capability] === true
  ).sort(
    (a, b) =>
      CAPABILITY_PRIORITY[b] -
      CAPABILITY_PRIORITY[a]
  );
}

function normalizeRoutingResult(result) {
  const empty = emptyRouting();

  if (!result || typeof result !== "object") {
    return empty;
  }

  const normalized = {
    ...empty,
  };

  for (const capability of CAPABILITIES) {
    normalized[capability] = toBoolean(
      result[capability]
    );
  }

  normalized.targetRoleForGaps = cleanString(
    result.targetRoleForGaps
  );

  normalized.confidence = clampConfidence(
    result.confidence
  );

  const capabilities =
    getCapabilities(normalized);

  normalized.capabilities =
    Array.isArray(result.capabilities) &&
    result.capabilities.length
      ? result.capabilities
          .filter((item) =>
            CAPABILITIES.includes(item)
          )
          .sort(
            (a, b) =>
              CAPABILITY_PRIORITY[b] -
              CAPABILITY_PRIORITY[a]
          )
      : capabilities;

  if (!normalized.capabilities.length) {
    normalized.capabilities = capabilities;
  }

  normalized.primaryCapability =
    CAPABILITIES.includes(
      result.primaryCapability
    )
      ? result.primaryCapability
      : normalized.capabilities[0] || "";

  normalized.isGeneral =
    !normalized.capabilities.length;

  if (
    normalized.isGeneral &&
    toBoolean(result.needsTeaching)
  ) {
    normalized.isGeneral = false;
  }

  normalized.intent =
    cleanString(result.intent) ||
    getIntentFromCapabilities(
      normalized.capabilities
    );

  return normalized;
}

function getIntentFromCapabilities(
  capabilities = []
) {
  if (!capabilities.length) {
    return "general";
  }

  if (capabilities.includes("needsCoding")) {
    return "coding";
  }

  if (capabilities.includes("needsReadiness")) {
    return "readiness";
  }

  if (
    capabilities.includes("needsLiveResume") ||
    capabilities.includes("needsResume")
  ) {
    return "resume";
  }

  if (
    capabilities.includes("needsGithub") ||
    capabilities.includes("needsLinkedin") ||
    capabilities.includes("needsEvidence")
  ) {
    return "evidence";
  }

  if (capabilities.includes("needsGaps")) {
    return "skill_gap";
  }

  if (capabilities.includes("needsCareer")) {
    return "career";
  }

  if (
    capabilities.includes("needsProfile") ||
    capabilities.includes("needsSkills") ||
    capabilities.includes("needsProjects")
  ) {
    return "candidate_analysis";
  }

  if (capabilities.includes("needsTeaching")) {
    return "teaching";
  }

  return "general";
}

function detectTargetRole(query) {
  const text = String(query || "")
    .toLowerCase()
    .trim();

  if (!text) {
    return "";
  }

  const rolePatterns = [
    {
      role: "React Developer",
      patterns: [
        "react developer",
        "react js developer",
        "react.js developer",
        "react frontend developer",
        "react engineer",
      ],
    },
    {
      role: "Frontend Developer",
      patterns: [
        "frontend developer",
        "front-end developer",
        "front end developer",
        "frontend engineer",
        "front-end engineer",
      ],
    },
    {
      role: "Backend Developer",
      patterns: [
        "backend developer",
        "back-end developer",
        "back end developer",
        "backend engineer",
        "back-end engineer",
      ],
    },
    {
      role: "Full Stack Developer",
      patterns: [
        "full stack developer",
        "full-stack developer",
        "fullstack developer",
        "full stack engineer",
      ],
    },
    {
      role: "Node.js Backend Developer",
      patterns: [
        "node developer",
        "node.js developer",
        "nodejs developer",
        "node backend developer",
      ],
    },
    {
      role: "Python Developer",
      patterns: [
        "python developer",
        "python engineer",
        "django developer",
        "flask developer",
      ],
    },
    {
      role: "Java Developer",
      patterns: [
        "java developer",
        "java engineer",
        "spring boot developer",
      ],
    },
    {
      role: "Data Analyst",
      patterns: [
        "data analyst",
        "data analytics",
        "data analyst role",
      ],
    },
    {
      role: "Data Scientist",
      patterns: [
        "data scientist",
        "data science role",
      ],
    },
    {
      role: "DevOps Engineer",
      patterns: [
        "devops engineer",
        "devops developer",
        "dev ops engineer",
      ],
    },
    {
      role: "Software Engineer",
      patterns: [
        "software engineer",
        "software developer",
        "software development role",
      ],
    },
  ];

  for (const item of rolePatterns) {
    if (
      item.patterns.some((pattern) =>
        text.includes(pattern)
      )
    ) {
      return item.role;
    }
  }

  return "";
}

function getContextText(conversation) {
  return normalizeConversation(conversation)
    .slice(-10)
    .map((message) => message.content)
    .join(" ")
    .toLowerCase();
}

function detectFollowUp(
  query,
  conversation = []
) {
  const text = String(query || "")
    .toLowerCase()
    .trim();

  if (!text || !conversation.length) {
    return false;
  }

  if (text.length <= 120) {
    const exactFollowUps = [
      "why",
      "why?",
      "how",
      "how?",
      "what about it",
      "what about this",
      "what about that",
      "explain",
      "explain it",
      "explain that",
      "explain more",
      "tell me more",
      "continue",
      "go on",
      "improve it",
      "improve this",
      "fix it",
      "fix this",
      "make it better",
      "and then?",
      "also?",
      "how exactly?",
      "what next?",
      "then what?",
    ];

    if (exactFollowUps.includes(text)) {
      return true;
    }

    return /^(why|how|what about|explain|tell me more|continue|improve|fix|and then|also|what next)/i.test(
      text
    );
  }

  return false;
}

function detectAgentNeedsFast(
  userQuery,
  conversation = []
) {
  const originalQuery = String(
    userQuery || ""
  ).trim();

  const query =
    originalQuery.toLowerCase();

  const history =
    normalizeConversation(conversation);

  const result = emptyRouting();

  if (!query) {
    result.isGeneral = true;
    result.intent = "general";
    result.confidence = 1;
    return result;
  }

  const isLanguageFollowUp =
    /\b(in gujarati|in hindi|in english|explain that|explain this|translate|samjhao|repeat that|what do you mean|tell me more|give an example|elaborate)\b/i.test(
      query
    );

  const hasSpecificProfileKeyword =
    /\b(resume|cv|ats|github|linkedin|my skills|my readiness|my score|readiness score|my profile|my bio)\b/i.test(
      query
    );

  if (isLanguageFollowUp && !hasSpecificProfileKeyword && history.length > 0) {
    result.isGeneral = true;
    result.intent = "general";
    result.confidence = 0.95;
    return result;
  }

  const shortFollowUp =
    detectFollowUp(
      originalQuery,
      history
    );

  const contextText =
    shortFollowUp
      ? getContextText(history)
      : "";

  const resumeRegex =
    /\b(resume|cv|c\.v\.|ats|ats-friendly|ats friendly|résumé|curriculum vitae|resume builder|resume section|resume summary|resume headline|work experience section)\b/i;

  const liveResumeRegex =
    /\b(live resume|analyze my live resume|analyze my resume|review my live resume|improve my live resume|generate my resume|create my resume|build my resume|show my resume|update my resume|open my resume|resume draft|ats score)\b/i;

  const bioRegex =
    /\b(bio|my bio|career objective|about me|professional summary|improve my bio|write my bio|write a bio|update my bio|craft my bio|generate bio|fix my bio)\b/i;

  const candidateSkillRegex =
    /\b(my skills|my skill|my technical skills|my proficiency|my technologies|my tech stack|my stack|skills i have|skills on my profile|what skills do i have)\b/i;

  const generalSkillRegex =
    /\b(skill|skills|technology|technologies|proficiency|tech stack|technical stack)\b/i;

  const projectRegex =
    /\b(my project|my projects|project on my profile|portfolio|my portfolio|project quality|project depth|project idea|projects on my resume)\b/i;

  const githubRegex =
    /\b(github|github profile|github repository|github repo|repository analysis|repo analysis|readme)\b/i;

  const linkedinRegex =
    /\b(linkedin|linkedin profile|linkedin headline|linkedin summary|linkedin about)\b/i;

  const careerRegex =
    /\b(career|career path|career direction|job|jobs|job role|job roles|developer role|engineering role|internship|internships|career option|career options|which role|suitable role|best role|what role should i apply|find jobs|match jobs|job opportunities)\b/i;

  const gapRegex =
    /\b(skill gap|skill gaps|missing skill|missing skills|what should i learn|what should i learn next|what to learn|learn next|learning roadmap|learning path|skills to improve|skills i should improve|what skills do i need|what am i missing|how can i improve my skills)\b/i;

  const readinessRegex =
    /\b(readiness|readiness score|my readiness|am i ready|job ready|job-ready|job readiness|career readiness|hire ready|hire-ready|market ready|ready for (a|the)? ?job|ready for (a|the)? ?role|can i get this job|can i apply for|am i qualified|do i qualify)\b/i;

  const profileRegex =
    /\b(my profile|analyze my profile|review my profile|profile review|profile analysis|profile completeness|profile quality|about me|my candidate profile|my profile strength|profile score|improve my profile)\b/i;

  const evidenceRegex =
    /\b(evidence|verified|verification|supported|unsupported|claimed|proof of skill|proof for skill|skill evidence|prove my skill|proof)\b/i;

  const codingRegex =
    /\b(debug|debugging|bug|error|exception|stack trace|not working|doesn't work|doesnt work|not rendering|not render|rendering issue|syntax error|runtime error|compile error|compilation error|code review|review this code|fix this code|fix my code|write code|code this|implement this|function|snippet|typescript error|javascript error|python error|react error|node error|null|undefined|async|await|promise|api error|cors|refactor|implementation)\b/i;

  const codeBlockRegex =
    /```[\s\S]*```/;

  const teachingRegex =
    /\b(teach me|teach|explain|explain to me|how does|how do|what is|what are|learn|learning|tutorial|guide me|help me understand|understand|study|concept)\b/i;

  if (resumeRegex.test(query)) {
    result.needsResume = true;
  }

  if (liveResumeRegex.test(query)) {
    result.needsLiveResume = true;
    result.needsResume = true;
  }

  if (bioRegex.test(query)) {
    result.needsProfile = true;
    result.needsLiveResume = true;
  }

  if (candidateSkillRegex.test(query)) {
    result.needsSkills = true;
  } else if (
    generalSkillRegex.test(query) &&
    /\b(my|i|me)\b/i.test(query)
  ) {
    result.needsSkills = true;
  }

  if (projectRegex.test(query)) {
    result.needsProjects = true;
  }

  if (githubRegex.test(query)) {
    result.needsGithub = true;
    result.needsProjects = true;
    result.needsEvidence = true;
  }

  if (linkedinRegex.test(query)) {
    result.needsLinkedin = true;
    result.needsEvidence = true;
  }

  if (careerRegex.test(query)) {
    result.needsCareer = true;
  }

  if (gapRegex.test(query)) {
    result.needsGaps = true;
  }

  if (readinessRegex.test(query)) {
    result.needsReadiness = true;
    result.needsProfile = true;
    result.needsSkills = true;
    result.needsProjects = true;
    result.needsCareer = true;
    result.needsGaps = true;
  }

  if (profileRegex.test(query)) {
    result.needsProfile = true;
    result.needsEvidence = true;
    result.needsSkills = true;
    result.needsProjects = true;
  }

  if (evidenceRegex.test(query)) {
    result.needsEvidence = true;
  }

  const containsCode =
    codingRegex.test(query) ||
    codeBlockRegex.test(originalQuery);

  if (containsCode) {
    result.needsCoding = true;
  }

  const isPersonalCandidateQuery =
    /\b(my|me|i|for me|my profile|my resume|my skills|my projects|my readiness|readiness score|my gaps|score|percentage)\b/i.test(
      query
    );

  const simpleConceptQuestion =
    /^(what is|what are|explain|how does|how do|difference between|compare)\b/i.test(
      query
    ) &&
    !isPersonalCandidateQuery;

  if (
    teachingRegex.test(query) &&
    /\b(lesson|curriculum|practice questions|mini project|test my knowledge|structured lesson)\b/i.test(query) &&
    !containsCode &&
    !isPersonalCandidateQuery &&
    !result.needsReadiness &&
    !result.needsResume &&
    !result.needsGaps &&
    !result.needsProfile
  ) {
    result.needsTeaching = true;
  }

  if (
    shortFollowUp &&
    contextText
  ) {
    if (
      /\b(resume|cv|ats|résumé)\b/i.test(
        contextText
      )
    ) {
      result.needsResume = true;
    }

    if (
      /\b(live resume|resume builder|resume draft)\b/i.test(
        contextText
      )
    ) {
      result.needsLiveResume = true;
      result.needsResume = true;
    }

    if (
      /\b(my skills|skills|skill gap|learning|learn next|technology|technologies)\b/i.test(
        contextText
      )
    ) {
      result.needsSkills = true;
    }

    if (
      /\b(skill gap|missing skill|learning roadmap|learn next)\b/i.test(
        contextText
      )
    ) {
      result.needsGaps = true;
    }

    if (
      /\b(project|projects|portfolio|github|repository|repo)\b/i.test(
        contextText
      )
    ) {
      result.needsProjects = true;
    }

    if (
      /\b(github|repository|repo)\b/i.test(
        contextText
      )
    ) {
      result.needsGithub = true;
      result.needsEvidence = true;
    }

    if (
      /\b(linkedin)\b/i.test(
        contextText
      )
    ) {
      result.needsLinkedin = true;
      result.needsEvidence = true;
    }

    if (
      /\b(career|job|role|developer|internship)\b/i.test(
        contextText
      )
    ) {
      result.needsCareer = true;
    }

    if (
      /\b(readiness|ready|qualified|job-ready)\b/i.test(
        contextText
      )
    ) {
      result.needsReadiness = true;
    }

    if (
      /\b(code|coding|debug|error|exception|react|javascript|typescript|python|node)\b/i.test(
        contextText
      )
    ) {
      result.needsCoding = true;
    }

    if (
      /\b(explain|teach|learn|tutorial|concept)\b/i.test(
        contextText
      ) &&
      !result.needsCoding
    ) {
      result.needsTeaching = true;
    }
  }

  result.targetRoleForGaps =
    detectTargetRole(originalQuery);

  if (
    !result.targetRoleForGaps &&
    shortFollowUp
  ) {
    result.targetRoleForGaps =
      detectTargetRole(contextText);
  }

  if (
    /\b(i|my|me|for me)\b/i.test(query) &&
    result.needsGaps
  ) {
    result.needsSkills = true;
  }

  if (
    result.needsCoding
  ) {
    result.needsTeaching = false;
  }

  if (
    result.needsLiveResume
  ) {
    result.needsResume = true;
  }

  if (
    result.needsGithub
  ) {
    result.needsProjects = true;
    result.needsEvidence = true;
  }

  if (
    result.needsLinkedin
  ) {
    result.needsEvidence = true;
  }

  result.capabilities =
    getCapabilities(result);

  result.primaryCapability =
    result.capabilities[0] || "";

  result.isGeneral =
    result.capabilities.length === 0;

  result.intent =
    getIntentFromCapabilities(
      result.capabilities
    );

  result.confidence =
    result.isGeneral
      ? 0.8
      : shortFollowUp
        ? 0.72
        : 0.9;

  return result;
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

  const withoutFences =
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
    return JSON.parse(withoutFences);
  } catch {}

  const firstBrace =
    withoutFences.indexOf("{");

  const lastBrace =
    withoutFences.lastIndexOf("}");

  if (
    firstBrace !== -1 &&
    lastBrace > firstBrace
  ) {
    const candidate =
      withoutFences.slice(
        firstBrace,
        lastBrace + 1
      );

    try {
      return JSON.parse(candidate);
    } catch {}
  }

  return null;
}

function buildRoutingProfile(profile = {}) {
  return {
    name:
      profile?.full_name ||
      profile?.name ||
      "",

    skills: Array.isArray(profile?.skills)
      ? profile.skills.slice(0, 20)
      : [],

    projects: Array.isArray(profile?.projects)
      ? profile.projects
          .slice(0, 5)
          .map((project) => ({
            name:
              project?.name ||
              project?.title ||
              "",
            technologies:
              project?.technologies ||
              project?.tech_stack ||
              [],
          }))
      : [],

    careerObjective:
      profile?.career_objective ||
      profile?.careerObjective ||
      "",
  };
}

function buildRouterSystemPrompt() {
  return `
You are HireVision's professional candidate-intent routing engine.

Your task is to classify the user's latest message and determine which internal capabilities are required.

You are not the final answer generator.

Return ONLY valid JSON.

AVAILABLE CAPABILITIES

needsProfile:
Candidate profile analysis, profile quality, completeness, presentation, strengths.

needsSkills:
Candidate's skills, proficiency, technical stack, skill inventory.

needsProjects:
Candidate's projects, portfolio, project quality, project depth.

needsCareer:
Career direction, suitable roles, jobs, internships, career options.

needsGaps:
Candidate skill gaps, missing skills, learning priorities, learning roadmap.

needsReadiness:
Whether the candidate is ready or qualified for a role/job.

needsResume:
Resume/CV/ATS review, rewriting, optimization, resume content.

needsLiveResume:
Generate, update, open, show, or modify the candidate's Live Resume.

needsGithub:
GitHub profile, repositories, README, repository evidence.

needsLinkedin:
LinkedIn profile, headline, summary, about section, professional branding.

needsEvidence:
Verification, evidence, proof, claimed vs supported skills.

needsTeaching:
General educational explanations and concept learning.

needsCoding:
Coding, debugging, implementation, code review, errors, technical troubleshooting.

ROUTING RULES

1. Select every capability genuinely required.

2. Do not activate unrelated candidate capabilities.

3. Candidate-specific questions must use candidate capabilities.

4. General educational questions must not activate candidate analysis.

5. Coding/debugging requests should prioritize needsCoding.

6. A coding question may also use needsTeaching only when the user explicitly asks for conceptual teaching.

7. Resume requests use needsResume.

8. Live Resume modification or generation uses needsLiveResume and needsResume.

9. GitHub analysis uses needsGithub, needsProjects, and needsEvidence when repository/project evidence is relevant.

10. LinkedIn analysis uses needsLinkedin and may use needsEvidence.

11. Readiness questions normally require multiple candidate dimensions:
profile, skills, projects, career, gaps, and readiness.

12. Skill-gap questions about the candidate should use needsGaps and usually needsSkills.

13. Follow-up questions such as "why?", "explain", "what should I improve?", or "what next?" must use recent conversation context.

14. If the latest question is ambiguous, choose the smallest sufficient set of capabilities.

15. isGeneral must be true only when no specialist capability is needed.

16. primaryCapability must be the most important capability.

17. confidence must be a number from 0 to 1.

18. targetRoleForGaps should only contain a role when a target role is explicitly or clearly implied.

OUTPUT SHAPE

{
  "needsProfile": false,
  "needsSkills": false,
  "needsProjects": false,
  "needsCareer": false,
  "needsGaps": false,
  "needsReadiness": false,
  "needsResume": false,
  "needsGithub": false,
  "needsLinkedin": false,
  "needsEvidence": false,
  "needsLiveResume": false,
  "needsTeaching": false,
  "needsCoding": false,
  "isGeneral": false,
  "targetRoleForGaps": "",
  "primaryCapability": "",
  "capabilities": [],
  "confidence": 0,
  "intent": "general"
}
`;
}

async function detectRequiredCandidateAgents(
  userQuery,
  conversation = [],
  profile = {}
) {
  const query =
    String(userQuery || "").trim();

  if (!query) {
    const result = emptyRouting();
    result.isGeneral = true;
    result.intent = "general";
    result.confidence = 1;
    return result;
  }

  const normalizedConversation =
    normalizeConversation(conversation);

  const fastRouting =
    detectAgentNeedsFast(
      query,
      normalizedConversation
    );

  if (fastRouting.isGeneral && fastRouting.confidence >= 0.8) {
    return fastRouting;
  }

  const routingProfile =
    buildRoutingProfile(profile);

  const userPrompt = `
LATEST USER MESSAGE:

${query}

RECENT CONVERSATION:

${JSON.stringify(
  normalizedConversation,
  null,
  2
)}

CANDIDATE CONTEXT:

${JSON.stringify(
  routingProfile,
  null,
  2
)}

FAST ROUTER SIGNAL:

${JSON.stringify(
  fastRouting,
  null,
  2
)}

Determine the final routing independently while using the fast router only as a supporting signal.

Return ONLY valid JSON.
`;

  try {
    const result =
      await callLLM(
        buildRouterSystemPrompt(),
        userPrompt,
        true,
        {
          model:
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
      return normalizeRoutingResult(
        fastRouting
      );
    }

    const normalized =
      normalizeRoutingResult(parsed);

    if (
      !normalized.targetRoleForGaps &&
      fastRouting.targetRoleForGaps
    ) {
      normalized.targetRoleForGaps =
        fastRouting.targetRoleForGaps;
    }

    if (
      !normalized.capabilities.length &&
      fastRouting.capabilities.length
    ) {
      return normalizeRoutingResult(
        fastRouting
      );
    }

    if (
      normalized.confidence === 0
    ) {
      normalized.confidence =
        fastRouting.confidence;
    }

    return normalized;
  } catch (error) {
    console.error(
      "[Candidate Agent Router] LLM routing failed:",
      error.message
    );

    return normalizeRoutingResult(
      fastRouting
    );
  }
}

function detectAgentNeedsFallback(
  userQuery,
  conversation = []
) {
  return detectAgentNeedsFast(
    userQuery,
    conversation
  );
}

module.exports = {
  detectRequiredCandidateAgents,
  detectAgentNeedsFallback,
  detectAgentNeedsFast,
  normalizeConversation,
  normalizeRoutingResult,
  emptyRouting,
  detectTargetRole,
  extractJSONObject,
};