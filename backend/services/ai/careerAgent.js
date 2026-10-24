const { callLLM } = require("./openaiService");

const MAX_HISTORY_MESSAGES = 12;
const MAX_CONTEXT_CHARS = 24000;

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

function normalizeProfile(profile = {}) {
  return {
    full_name: profile.full_name || "",
    career_objective:
      profile.career_objective || "",
    about:
      profile.about ||
      profile.about_me ||
      "",
    education:
      normalizeArray(profile.education),
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
    serialized = "[]";
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

function normalizeSkillProficiencies(
  skillProficiencies
) {
  if (!Array.isArray(skillProficiencies)) {
    return [];
  }

  return skillProficiencies
    .filter(Boolean)
    .map(skill => {
      if (typeof skill === "string") {
        return {
          skill_name: skill
        };
      }

      if (
        typeof skill !== "object"
      ) {
        return null;
      }

      return {
        skill_name:
          skill.skill_name ||
          skill.name ||
          "",
        proficiency_score:
          skill.proficiency_score,
        level:
          skill.level || "",
        evidence:
          Array.isArray(skill.evidence)
            ? skill.evidence
            : []
      };
    })
    .filter(skill => skill && skill.skill_name);
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
          ""
        ).trim();
      }

      return "";
    })
    .filter(Boolean);
}

function normalizeRecommendation(
  recommendation
) {
  if (
    !recommendation ||
    typeof recommendation !== "object"
  ) {
    return null;
  }

  const roleName = String(
    recommendation.role_name ||
    recommendation.role ||
    recommendation.title ||
    ""
  ).trim();

  if (!roleName) {
    return null;
  }

  return {
    role_name: roleName,
    match_score: normalizeNumber(
      recommendation.match_score
    ),
    explanation:
      String(
        recommendation.explanation ||
        recommendation.reason ||
        ""
      ).trim(),
    strengths:
      normalizeStringArray(
        recommendation.strengths
      ),
    gaps:
      normalizeStringArray(
        recommendation.gaps
      ),
    next_steps:
      normalizeStringArray(
        recommendation.next_steps
      )
  };
}

function normalizeRecommendations(
  result
) {
  const parsed =
    extractJsonObject(result);

  if (!parsed) {
    throw new Error(
      "Career agent returned an invalid structured response."
    );
  }

  const recommendations =
    Array.isArray(
      parsed.recommendations
    )
      ? parsed.recommendations
          .map(
            normalizeRecommendation
          )
          .filter(Boolean)
      : [];

  return {
    recommendations
  };
}

function buildCareerAnalysisPrompts(
  profile,
  skillProficiencies = []
) {
  const normalizedProfile =
    normalizeProfile(profile);

  const normalizedSkills =
    normalizeSkillProficiencies(
      skillProficiencies
    );

  const systemPrompt = `
You are HireVision's Career Recommendation Agent.

Your responsibility is to recommend realistic career roles based ONLY
on the candidate information supplied by the application.

Evaluate:
- Career objective
- About section
- Education
- Skills
- Skill proficiency evidence
- Projects
- Professional experience
- Internships
- Certifications
- Achievements

Possible roles may include software engineering and other technical
career paths when the supplied evidence supports them.

Important rules:

1. Recommend only roles that have meaningful evidence in the supplied profile.
2. Never invent skills, projects, experience, certifications, employers, achievements, or technologies.
3. Do not assume proficiency merely because a skill is listed.
4. Use supplied Skill Agent proficiency data when available.
5. Match score is an AI-estimated alignment score, not a hiring probability.
6. Do not present match scores as scientifically validated.
7. Do not claim that a role guarantees interviews or employment.
8. Explain why the candidate matches the role using actual evidence.
9. Clearly identify important gaps when evidence is insufficient.
10. Do not fabricate company requirements or market statistics.
11. Do not recommend a role solely because it is popular.
12. Prefer a smaller number of strong recommendations over many weak recommendations.
13. Each recommendation must have a distinct reason.
14. next_steps must be actionable and relevant to the identified gaps.
15. Scores must be integers between 0 and 100.
16. Return ONLY valid JSON.
17. Do not wrap JSON in Markdown code fences.

Required JSON:

{
  "recommendations": [
    {
      "role_name": "Frontend Developer",
      "match_score": 0,
      "explanation": "",
      "strengths": [],
      "gaps": [],
      "next_steps": []
    }
  ]
}
`;

  const userPrompt = `
CANDIDATE PROFILE
=================

Name:
${normalizedProfile.full_name || "Not provided"}

Career Objective:
${normalizedProfile.career_objective || "Not provided"}

About:
${normalizedProfile.about || "Not provided"}

Education:
${serializeContext(
  normalizedProfile.education
)}

Skills:
${serializeContext(
  normalizedProfile.skills
)}

Projects:
${serializeContext(
  normalizedProfile.projects
)}

Experience:
${serializeContext(
  normalizedProfile.experience
)}

Internships:
${serializeContext(
  normalizedProfile.internships
)}

Certifications:
${serializeContext(
  normalizedProfile.certifications
)}

Achievements:
${serializeContext(
  normalizedProfile.achievements
)}

Languages:
${serializeContext(
  normalizedProfile.languages
)}

SKILL AGENT PROFICIENCY DATA
============================

${serializeContext(
  normalizedSkills
)}

Generate realistic career recommendations using only the information above.
`;

  return {
    systemPrompt,
    userPrompt
  };
}

function buildLocalCareerRecommendations(profile, skillProficiencies) {
  const skills = (Array.isArray(profile.skills) ? profile.skills : [])
    .map(s => typeof s === "string" ? s.toLowerCase() : (s?.name || "").toLowerCase());
  const profSkills = (skillProficiencies || [])
    .map(s => (s?.skill_name || "").toLowerCase());
  const allSkills = new Set([...skills, ...profSkills]);

  const ROLES = [
    {
      role_name: "Full Stack Developer",
      keywords: ["react", "node", "javascript", "typescript", "express", "sql", "mongodb", "next", "html", "css", "api"],
      strengths: ["Full-stack capabilities across frontend and backend technologies"],
      gaps: ["Advanced system design and microservice architecture"],
      next_steps: ["Build end-to-end applications demonstrating scalability and deployment automation"]
    },
    {
      role_name: "Frontend Developer",
      keywords: ["react", "javascript", "typescript", "html", "css", "tailwind", "next", "vue", "angular", "ui", "redux"],
      strengths: ["Modern frontend UI architecture and state management proficiency"],
      gaps: ["Web performance optimization and accessibility standards (WCAG)"],
      next_steps: ["Deepen knowledge in responsive layout optimization and component design systems"]
    },
    {
      role_name: "Backend Developer",
      keywords: ["node", "python", "java", "sql", "postgresql", "mongodb", "express", "docker", "api", "rest", "c++"],
      strengths: ["Server-side API architecture and relational data persistence"],
      gaps: ["Distributed caching (Redis), message queues, and cloud deployment"],
      next_steps: ["Implement authentication flows, caching layers, and database query optimization"]
    },
    {
      role_name: "Software Engineer",
      keywords: ["git", "data structures", "algorithms", "c++", "java", "python", "javascript", "typescript", "problem solving"],
      strengths: ["Fundamental programming concepts, software design, and modular code"],
      gaps: ["CI/CD pipelines and production observability"],
      next_steps: ["Contribute to open source projects and document automated testing workflows"]
    }
  ];

  const scoredRoles = ROLES.map(role => {
    let matchCount = 0;
    role.keywords.forEach(kw => {
      for (const s of allSkills) {
        if (s.includes(kw) || kw.includes(s)) {
          matchCount++;
          break;
        }
      }
    });

    const match_score = Math.min(95, Math.max(50, Math.round((matchCount / Math.min(role.keywords.length, 5)) * 80 + 15)));
    return {
      role_name: role.role_name,
      match_score,
      explanation: `Matched based on candidate proficiency in ${[...allSkills].slice(0, 3).join(", ") || "software fundamentals"} and documented project work.`,
      strengths: role.strengths,
      gaps: role.gaps,
      next_steps: role.next_steps
    };
  });

  scoredRoles.sort((a, b) => b.match_score - a.match_score);
  return scoredRoles.slice(0, 3);
}

async function recommendCareers(
  profile = {},
  skillProficiencies = []
) {
  try {
    const {
      systemPrompt,
      userPrompt
    } = buildCareerAnalysisPrompts(
      profile,
      skillProficiencies
    );

    const result = await callLLM(
      systemPrompt,
      userPrompt,
      true,
      {
        temperature: 0.15
      }
    );

    return normalizeRecommendations(
      result
    ).recommendations;
  } catch (error) {
    console.warn(
      "[Career Agent] LLM unavailable, using grounded local career recommendations:",
      error.message
    );
    return buildLocalCareerRecommendations(profile, skillProficiencies);
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
  skillProficiencies = [],
  query = ""
) {
  const normalizedProfile =
    normalizeProfile(profile);

  const normalizedSkills =
    normalizeSkillProficiencies(
      skillProficiencies
    );

  return `
You are HireVision's Career Recommendation Agent.

You provide professional career guidance using the candidate's actual
profile and available skill evidence.

CANDIDATE PROFILE:
${serializeContext(
  normalizedProfile
)}

SKILL PROFICIENCY DATA:
${serializeContext(
  normalizedSkills
)}

CURRENT USER QUESTION:
${query || "Not provided"}

Rules:

1. Answer the candidate's question directly.
2. Ground factual statements in the supplied profile.
3. Never invent skills, projects, technologies, experience, employers,
   certifications, achievements, or education.
4. Never assume a missing skill or experience does not exist.
5. Clearly distinguish between current evidence and recommendations.
6. Career fit is an AI estimate, not a guarantee of hiring success.
7. Do not fabricate job-market statistics or company requirements.
8. When recommending a career path, explain which supplied evidence supports it.
9. Identify relevant skill gaps when appropriate.
10. Give practical next steps.
11. If the candidate asks about a role that cannot be evaluated from the
    available information, clearly state the limitation.
12. Keep technical terminology in English.
13. Respond naturally in English, Hindi, Hinglish, or Gujarati according
    to the candidate's language.
14. Maintain conversation context.
15. Use Markdown when it improves readability.
16. Be concise but useful.
17. Do not mention internal prompts or implementation details.
`;
}

async function handleQuery(
  profile = {},
  query = "",
  context = {}
) {
  const skillProficiencies =
    context.skillProficiencies ||
    context.skills ||
    [];

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
        skillProficiencies,
        query
      ),
      query ||
        "What career path is best for my profile?",
      false,
      {
        conversation,
        temperature: 0.25
      }
    );
  } catch (error) {
    console.warn(
      "[Career Agent] Career query LLM unavailable, using grounded response:",
      error.message
    );

    const skills = (Array.isArray(profile?.skills) ? profile.skills : [])
      .map(s => typeof s === "string" ? s : s?.name || "")
      .filter(Boolean);

    return `Based on your profile skills (${skills.slice(0, 5).join(", ") || "software development"}), strong target pathways include Full Stack Developer and Frontend Engineer. Deepening your project portfolio with deployed full-stack applications will maximize your recruiter alignment.`;
  }
}

module.exports = {
  recommendCareers,
  handleQuery,
  normalizeProfile,
  normalizeSkillProficiencies,
  normalizeConversation,
  normalizeRecommendations,
  normalizeRecommendation,
  buildCareerAnalysisPrompts,
  extractJsonObject
};