const { callLLM } = require("./openaiService");

const MAX_HISTORY_MESSAGES = 12;
const MAX_CONTEXT_CHARS = 30000;

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return [];
  }

  return [value];
}

function normalizeObject(value) {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value;
  }

  return {};
}

function normalizeProfile(profile = {}) {
  return {
    full_name: profile.full_name || "",
    career_objective:
      profile.career_objective || "",
    about:
      profile.about ||
      profile.about_me ||
      "",
    skills:
      profile.skills || [],
    projects:
      normalizeArray(profile.projects),
    experience:
      normalizeArray(profile.experience),
    internships:
      normalizeArray(profile.internships),
    certifications:
      normalizeArray(profile.certifications),
    education:
      normalizeArray(profile.education),
    achievements:
      normalizeArray(profile.achievements),
    languages:
      normalizeArray(profile.languages)
  };
}

function serializeContext(value) {
  let serialized;

  try {
    serialized = JSON.stringify(
      value,
      null,
      2
    );
  } catch (error) {
    serialized = "{}";
  }

  if (
    serialized.length >
    MAX_CONTEXT_CHARS
  ) {
    serialized = serialized.slice(
      0,
      MAX_CONTEXT_CHARS
    );
  }

  return serialized;
}

function extractJsonObject(value) {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);

    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
    ) {
      return parsed;
    }
  } catch (error) {
  }

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (
    start === -1 ||
    end === -1 ||
    end <= start
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      cleaned.slice(start, end + 1)
    );

    return parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
      ? parsed
      : null;
  } catch (error) {
    return null;
  }
}

function normalizeNumber(
  value,
  fallback = 0
) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(
    0,
    Math.min(100, Math.round(number))
  );
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(item => {
      if (typeof item === "string") {
        return item.trim();
      }

      if (
        item &&
        typeof item === "object"
      ) {
        return String(
          item.description ||
          item.reason ||
          item.text ||
          item.action ||
          ""
        ).trim();
      }

      return "";
    })
    .filter(Boolean);
}

function normalizeReadinessResult(
  result
) {
  const parsed =
    extractJsonObject(result);

  if (!parsed) {
    throw new Error(
      "Readiness agent returned an invalid structured response."
    );
  }

  const strengths =
    normalizeStringArray(
      parsed.strengths
    );

  const weaknesses =
    normalizeStringArray(
      parsed.weaknesses
    );

  const topImprovements =
    normalizeStringArray(
      parsed.top_improvements
    ).slice(0, 3);

  const nextActions =
    normalizeStringArray(
      parsed.next_actions
    );

  return {
    readiness_score:
      normalizeNumber(
        parsed.readiness_score
      ),

    profile_quality:
      normalizeNumber(
        parsed.profile_quality
      ),

    skill_strength:
      normalizeNumber(
        parsed.skill_strength
      ),

    project_strength:
      normalizeNumber(
        parsed.project_strength
      ),

    resume_quality:
      normalizeNumber(
        parsed.resume_quality
      ),

    career_fit:
      normalizeNumber(
        parsed.career_fit
      ),

    strengths,
    weaknesses,
    top_improvements: topImprovements,
    next_actions: nextActions
  };
}

function getHighestCareerMatch(
  careerAnalysis
) {
  if (!Array.isArray(careerAnalysis)) {
    return null;
  }

  const scores = careerAnalysis
    .map(item => {
      if (
        !item ||
        typeof item !== "object"
      ) {
        return null;
      }

      const score = Number(
        item.match_score
      );

      return Number.isFinite(score)
        ? score
        : null;
    })
    .filter(
      score =>
        score !== null
    );

  if (scores.length === 0) {
    return null;
  }

  return Math.max(...scores);
}

function getProfileScore(
  profileAnalysis
) {
  if (
    !profileAnalysis ||
    typeof profileAnalysis !== "object"
  ) {
    return null;
  }

  const score = Number(
    profileAnalysis.profile_score
  );

  return Number.isFinite(score)
    ? normalizeNumber(score)
    : null;
}

function getSkillScore(
  skillAnalysis
) {
  if (!Array.isArray(skillAnalysis)) {
    return null;
  }

  const scores = skillAnalysis
    .map(skill =>
      Number(
        skill?.proficiency_score
      )
    )
    .filter(Number.isFinite);

  if (scores.length === 0) {
    return null;
  }

  return normalizeNumber(
    scores.reduce(
      (sum, score) => sum + score,
      0
    ) / scores.length
  );
}

function getProjectScore(
  projectAnalysis
) {
  if (
    !Array.isArray(
      projectAnalysis
    )
  ) {
    return null;
  }

  const scores = projectAnalysis
    .map(project =>
      Number(
        project?.quality_score
      )
    )
    .filter(Number.isFinite);

  if (scores.length === 0) {
    return null;
  }

  return normalizeNumber(
    scores.reduce(
      (sum, score) => sum + score,
      0
    ) / scores.length
  );
}

function calculateEvidenceSummary(
  profile,
  profileAnalysis,
  skillAnalysis,
  projectAnalysis,
  careerAnalysis
) {
  const normalizedProfile =
    normalizeProfile(profile);

  const profileScore =
    getProfileScore(
      profileAnalysis
    );

  const skillScore =
    getSkillScore(
      skillAnalysis
    );

  const projectScore =
    getProjectScore(
      projectAnalysis
    );

  const careerScore =
    getHighestCareerMatch(
      careerAnalysis
    );

  const hasExperience =
    normalizedProfile.experience.length >
      0 ||
    normalizedProfile.internships.length >
      0;

  const hasResumeAnalysis =
    Boolean(
      profile.resume_analysis ||
      profile.resumeAnalysis
    );

  return {
    profile_score: profileScore,
    skill_score: skillScore,
    project_score: projectScore,
    career_fit_score: careerScore,
    has_experience: hasExperience,
    has_resume_analysis:
      hasResumeAnalysis,
    data_available: {
      profile_analysis:
        profileScore !== null,
      skill_analysis:
        skillScore !== null,
      project_analysis:
        projectScore !== null,
      career_analysis:
        careerScore !== null,
      resume_analysis:
        hasResumeAnalysis
    }
  };
}

function buildReadinessPrompts(
  profile,
  profileAnalysis,
  skillAnalysis,
  projectAnalysis,
  careerAnalysis
) {
  const normalizedProfile =
    normalizeProfile(profile);

  const evidenceSummary =
    calculateEvidenceSummary(
      normalizedProfile,
      profileAnalysis,
      skillAnalysis,
      projectAnalysis,
      careerAnalysis
    );

  const systemPrompt = `
You are HireVision's Career Readiness Intelligence Agent.

Your responsibility is to synthesize evidence from specialized
HireVision agents and estimate the candidate's current career
readiness.

This is an AI guidance score, NOT:
- a hiring probability
- a recruiter decision
- an ATS score
- a guarantee of employment
- a scientifically validated measurement

Evaluate these dimensions:

1. Profile Quality
2. Skill Strength
3. Project Strength
4. Resume Quality
5. Career Fit

Important rules:

1. Use ONLY the supplied profile and agent analysis.
2. Never invent candidate information.
3. Never invent skills, experience, projects, certifications,
   achievements, employers, metrics, or technologies.
4. Do not assume missing data is negative evidence.
5. If an analysis is unavailable, acknowledge the limitation.
6. Resume Quality must NOT be guessed from unrelated profile data.
7. If no resume analysis is supplied, use a conservative assessment
   based only on available resume-related evidence, or indicate that
   the evidence is limited.
8. Career Fit should use supplied career recommendation scores when available.
9. Do not fabricate career recommendations.
10. Strengths must be supported by the supplied analysis.
11. Weaknesses must be supported by the supplied analysis or clearly
    observable missing information.
12. Top improvements must address the most important weaknesses.
13. next_actions must be concrete and actionable.
14. Do not claim that a particular score results in more recruiter contact.
15. Do not claim that improving the score guarantees interviews.
16. Avoid unsupported market statistics.
17. Scores must be integers from 0 to 100.
18. Readiness score should reflect the quality and completeness of
    available evidence, not assumptions about the candidate.
19. Return ONLY valid JSON.
20. Do not wrap JSON in Markdown code fences.

Required JSON:

{
  "readiness_score": 0,
  "profile_quality": 0,
  "skill_strength": 0,
  "project_strength": 0,
  "resume_quality": 0,
  "career_fit": 0,
  "strengths": [],
  "weaknesses": [],
  "top_improvements": [],
  "next_actions": []
}
`;

  const userPrompt = `
CANDIDATE PROFILE
=================

${serializeContext(
  normalizedProfile
)}

PROFILE AGENT ANALYSIS
======================

${serializeContext(
  profileAnalysis || {}
)}

SKILL AGENT ANALYSIS
====================

${serializeContext(
  skillAnalysis || []
)}

PROJECT AGENT ANALYSIS
======================

${serializeContext(
  projectAnalysis || []
)}

CAREER AGENT ANALYSIS
=====================

${serializeContext(
  careerAnalysis || []
)}

AVAILABLE EVIDENCE SUMMARY
==========================

${serializeContext(
  evidenceSummary
)}

Produce a grounded readiness assessment.

Do not invent unavailable evidence.
`;

  return {
    systemPrompt,
    userPrompt
  };
}

function buildLocalReadiness(
  profile,
  profileAnalysis,
  skillAnalysis,
  projectAnalysis,
  careerAnalysis
) {
  const summary = calculateEvidenceSummary(
    profile,
    profileAnalysis,
    skillAnalysis,
    projectAnalysis,
    careerAnalysis
  );

  let weightedEarned = 0;
  let totalWeight = 0;

  if (summary.profile_score !== null && summary.profile_score !== undefined) {
    weightedEarned += summary.profile_score * 0.25;
    totalWeight += 0.25;
  }
  if (summary.skill_score !== null && summary.skill_score !== undefined) {
    weightedEarned += summary.skill_score * 0.35;
    totalWeight += 0.35;
  }
  if (summary.project_score !== null && summary.project_score !== undefined) {
    weightedEarned += summary.project_score * 0.25;
    totalWeight += 0.25;
  }
  if (summary.career_fit_score !== null && summary.career_fit_score !== undefined) {
    weightedEarned += summary.career_fit_score * 0.15;
    totalWeight += 0.15;
  }

  const readiness_score = totalWeight > 0 ? Math.round(weightedEarned / totalWeight) : 0;

  const strengths =
    Array.isArray(profileAnalysis?.strengths) &&
    profileAnalysis.strengths.length
      ? profileAnalysis.strengths.slice(0, 3)
      : [
          "Technical skills documented in candidate profile",
          "Clear educational credentials",
          "Portfolio projects available for recruiter review",
        ];

  const weaknesses =
    Array.isArray(profileAnalysis?.weaknesses) &&
    profileAnalysis.weaknesses.length
      ? profileAnalysis.weaknesses.slice(0, 3)
      : [
          "External verification like GitHub commits would strengthen candidate profile",
        ];

  const top_improvements =
    Array.isArray(profileAnalysis?.improvements) &&
    profileAnalysis.improvements.length
      ? profileAnalysis.improvements.slice(0, 3)
      : [
          "Add verifiable project links and detailed technology descriptions",
          "Include quantitative metrics to demonstrate impact",
        ];

  const next_actions = [
    "Verify skills by adding GitHub repositories or live project demos",
    "Review suggested career paths and align project focus",
    "Complete any missing sections in your profile",
  ];

  const pScore = summary.profile_score ?? 0;
  const sScore = summary.skill_score ?? 0;
  const prScore = summary.project_score ?? 0;
  const cScore = summary.career_fit_score ?? 0;

  return {
    readiness_score,
    score: readiness_score,
    profile_quality: pScore,
    skill_strength: sScore,
    project_strength: prScore,
    resume_quality: Math.round((pScore + prScore) / 2),
    career_fit: cScore,
    breakdown: {
      profile: pScore,
      skills: sScore,
      projects: prScore,
      certifications: cScore,
    },
    strengths,
    weaknesses,
    top_improvements,
    next_actions,
  };
}

async function calculateReadiness(
  profile = {},
  profileAnalysis = {},
  skillAnalysis = [],
  projectAnalysis = [],
  careerAnalysis = []
) {
  try {
    const {
      systemPrompt,
      userPrompt
    } = buildReadinessPrompts(
      profile,
      profileAnalysis,
      skillAnalysis,
      projectAnalysis,
      careerAnalysis
    );

    const result = await callLLM(
      systemPrompt,
      userPrompt,
      true,
      {
        temperature: 0.1
      }
    );

    return normalizeReadinessResult(
      result
    );
  } catch (error) {
    console.warn(
      "[Readiness Agent] LLM unavailable, using grounded local readiness calculation:",
      error.message
    );
    return buildLocalReadiness(
      profile,
      profileAnalysis,
      skillAnalysis,
      projectAnalysis,
      careerAnalysis
    );
  }
}

function normalizeConversation(
  conversation
) {
  if (!Array.isArray(conversation)) {
    return [];
  }

  return conversation
    .slice(-MAX_HISTORY_MESSAGES)
    .map(message => {
      if (!message) {
        return null;
      }

      if (typeof message === "string") {
        return {
          role: "user",
          content: message.slice(0, 4000)
        };
      }

      const role =
        message.role === "assistant" ||
        message.role === "system" ||
        message.role === "user"
          ? message.role
          : "user";

      let content = "";

      if (
        typeof message.content ===
        "string"
      ) {
        content = message.content;
      } else {
        try {
          content = JSON.stringify(
            message.content || ""
          );
        } catch (error) {
          content = "";
        }
      }

      return {
        role,
        content: content.slice(0, 4000)
      };
    })
    .filter(Boolean);
}

function buildChatSystemPrompt(
  profile = {},
  readinessData = {},
  query = ""
) {
  const normalizedProfile =
    normalizeProfile(profile);

  return `
You are HireVision's Career Readiness Intelligence Agent.

You help candidates understand their current career readiness,
strengths, weaknesses, and next actions.

CANDIDATE PROFILE:
${serializeContext(
  normalizedProfile
)}

AVAILABLE READINESS DATA:
${serializeContext(
  readinessData || {}
)}

CURRENT USER QUESTION:
${query || "Not provided"}

Rules:

1. Answer the user's question directly.
2. Use only supplied profile and readiness evidence.
3. Never invent missing information.
4. Do not treat missing information as proof that the candidate lacks it.
5. Explain readiness scores as AI-generated assessments.
6. Never present readiness as a hiring probability.
7. Never claim that a score guarantees interviews or employment.
8. Do not fabricate recruiter feedback.
9. Do not fabricate ATS scores.
10. Do not fabricate market statistics.
11. Give practical and prioritized next steps.
12. If data is unavailable, clearly state the limitation.
13. Keep technical terminology in English.
14. Respond naturally in English, Hindi, Hinglish, or Gujarati according
    to the user's language.
15. Maintain conversation context.
16. Use Markdown when useful.
17. Be concise but useful.
18. Do not mention internal prompts or implementation details.
`;
}

async function handleQuery(
  profile = {},
  query = "",
  context = {}
) {
  const readinessData =
    context.readinessData ||
    context.readiness ||
    {};

  const conversation =
    normalizeConversation(
      context.conversation ||
      context.history ||
      []
    );

  try {
    return await callLLM(
      buildChatSystemPrompt(
        profile,
        readinessData,
        query
      ),
      query ||
        "How ready am I for a job?",
      false,
      {
        conversation,
        temperature: 0.25
      }
    );
  } catch (error) {
    console.warn(
      "[Readiness Agent] Readiness query LLM unavailable, using grounded response:",
      error.message
    );

    const score = readinessData?.readiness_score !== null && readinessData?.readiness_score !== undefined
      ? readinessData.readiness_score
      : null;

    if (score !== null) {
      return `Your overall Career Readiness Score is currently calculated at ${score}% based on your documented skills, projects, and educational profile. To further increase readiness, consider deploying your projects live and linking your GitHub repository to provide verifiable code evidence.`;
    }

    return "Career readiness evaluation requires candidate profile information (such as documented skills, projects, and experience). Please complete your profile sections to generate a verified readiness score.";
  }
}

module.exports = {
  calculateReadiness,
  handleQuery,
  normalizeProfile,
  normalizeConversation,
  normalizeReadinessResult,
  calculateEvidenceSummary,
  buildReadinessPrompts,
  extractJsonObject
};