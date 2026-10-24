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
    skills: profile.skills || [],
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
      normalizeArray(profile.achievements)
  };
}

function normalizeSkillEvidence(
  skillEvidence
) {
  if (!Array.isArray(skillEvidence)) {
    return [];
  }

  return skillEvidence
    .filter(Boolean)
    .map(item => {
      if (typeof item === "string") {
        return {
          skill: item,
          declared: true,
          project_evidence: "Not Available",
          assessment_evidence: "Not Available",
          evidence_confidence: "Low"
        };
      }

      if (
        !item ||
        typeof item !== "object"
      ) {
        return null;
      }

      return {
        skill:
          item.skill ||
          item.skill_name ||
          item.name ||
          "",
        declared:
          item.declared === true,
        project_evidence:
          item.project_evidence ||
          "Not Available",
        assessment_evidence:
          item.assessment_evidence ||
          "Not Available",
        evidence_confidence:
          item.evidence_confidence ||
          "Low"
      };
    })
    .filter(item => item && item.skill);
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
          item.skill ||
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

function normalizeGapItem(item) {
  if (typeof item === "string") {
    return {
      skill: item.trim(),
      declared: false,
      project_evidence:
        "Not Available",
      assessment_evidence:
        "Not Available",
      evidence_confidence: "Low"
    };
  }

  if (
    !item ||
    typeof item !== "object"
  ) {
    return null;
  }

  const skill = String(
    item.skill ||
    item.skill_name ||
    item.name ||
    ""
  ).trim();

  if (!skill) {
    return null;
  }

  const confidenceValues = [
    "Low",
    "Medium",
    "High"
  ];

  const confidence =
    confidenceValues.includes(
      item.evidence_confidence
    )
      ? item.evidence_confidence
      : "Low";

  return {
    skill,
    declared:
      item.declared === true,
    project_evidence:
      String(
        item.project_evidence ||
        "Not Available"
      ),
    assessment_evidence:
      String(
        item.assessment_evidence ||
        "Not Available"
      ),
    evidence_confidence:
      confidence
  };
}

function normalizeSkillGapResult(
  result,
  targetRole
) {
  const parsed =
    extractJsonObject(result);

  if (!parsed) {
    throw new Error(
      "Skill gap agent returned an invalid structured response."
    );
  }

  const strongSkills = Array.isArray(
    parsed.strong_skills
  )
    ? parsed.strong_skills
        .map(normalizeGapItem)
        .filter(Boolean)
    : [];

  const weakSkills = Array.isArray(
    parsed.weak_skills
  )
    ? parsed.weak_skills
        .map(normalizeGapItem)
        .filter(Boolean)
    : [];

  const missingSkills =
    normalizeStringArray(
      parsed.missing_skills
    );

  const priorityLearningOrder =
    normalizeStringArray(
      parsed.priority_learning_order
    );

  const confidenceValues = [
    "Low",
    "Medium",
    "High"
  ];

  const confidence =
    confidenceValues.includes(
      parsed.confidence
    )
      ? parsed.confidence
      : "Low";

  return {
    target_role: targetRole,
    strong_skills: strongSkills,
    weak_skills: weakSkills,
    missing_skills: missingSkills,
    priority_learning_order:
      priorityLearningOrder,
    confidence
  };
}

function buildSkillGapPrompts(
  profile,
  targetRole,
  skillEvidence = []
) {
  const normalizedProfile =
    normalizeProfile(profile);

  const normalizedEvidence =
    normalizeSkillEvidence(
      skillEvidence
    );

  const systemPrompt = `
You are HireVision's Skill Gap Intelligence Agent.

Your responsibility is to compare a candidate's current profile with
the competency expectations normally associated with a requested
target career role.

This is an AI guidance assessment, not an official job qualification
or hiring decision.

Analyze:

- Current skills
- Skill evidence
- Projects
- Professional experience
- Internships
- Certifications
- Education
- Achievements
- Career objective

Target role:
${targetRole}

Important rules:

1. Use only candidate information supplied by the application when describing the candidate's current capabilities.
2. Do not invent candidate skills, projects, experience, certifications, technologies, or achievements.
3. A skill listed by the candidate is a declared skill, not automatic proof of proficiency.
4. Project evidence must come from the supplied project information.
5. Assessment evidence must come only from supplied skill-assessment data.
6. Do not fabricate GitHub, LinkedIn, employment, certification, or project evidence.
7. Missing candidate information must remain explicitly uncertain.
8. Role competency expectations may be based on general professional knowledge, but do not present them as requirements from a specific company unless supplied.
9. Do not claim that missing skills definitely mean the candidate cannot perform the role.
10. Distinguish between:
    - Strong skills
    - Weak or partially supported skills
    - Skills for which evidence is missing
11. Avoid unnecessary skills that are not important to the requested role.
12. Prioritize learning based on dependency, importance, and the candidate's current evidence.
13. Learning order must contain skills that are actually relevant to the target role.
14. Confidence describes confidence in the evidence-based gap analysis, not the candidate's ability.
15. Return ONLY valid JSON.
16. Do not wrap JSON in Markdown code fences.

Required JSON:

{
  "target_role": "${targetRole}",
  "strong_skills": [
    {
      "skill": "React",
      "declared": true,
      "project_evidence": "Available",
      "assessment_evidence": "Available",
      "evidence_confidence": "High"
    }
  ],
  "weak_skills": [],
  "missing_skills": [],
  "priority_learning_order": [],
  "confidence": "Medium"
}
`;

  const userPrompt = `
TARGET ROLE
===========
${targetRole}

CANDIDATE PROFILE
=================

Career Objective:
${normalizedProfile.career_objective || "Not provided"}

About:
${normalizedProfile.about || "Not provided"}

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

Education:
${serializeContext(
  normalizedProfile.education
)}

Achievements:
${serializeContext(
  normalizedProfile.achievements
)}

SKILL ASSESSMENT EVIDENCE
=========================

${serializeContext(
  normalizedEvidence
)}

Compare the candidate evidence with the competency areas relevant
to the target role.

Do not invent candidate evidence.
`;

  return {
    systemPrompt,
    userPrompt
  };
}

function buildLocalSkillGaps(profile, targetRole) {
  const roleName = (targetRole || "Software Engineer").toLowerCase();

  const candidateSkills = (Array.isArray(profile.skills) ? profile.skills : [])
    .map(s => typeof s === "string" ? s.trim() : (s?.name || s?.skill || "").trim())
    .filter(Boolean);

  const candidateSkillsLower = new Set(candidateSkills.map(s => s.toLowerCase()));

  const ROLE_BENCHMARKS = {
    frontend: ["React", "TypeScript", "JavaScript", "HTML/CSS", "Tailwind CSS", "Next.js", "Web Performance", "State Management (Redux/Zustand)", "Testing (Jest/Cypress)"],
    backend: ["Node.js", "Express", "PostgreSQL", "MongoDB", "REST APIs", "Docker", "Redis", "System Design", "Unit Testing"],
    fullstack: ["React", "Node.js", "TypeScript", "PostgreSQL", "REST APIs", "Docker", "Git", "Next.js", "CI/CD"],
    software: ["Data Structures", "Algorithms", "Git", "Problem Solving", "Object-Oriented Design", "Databases", "Clean Code"],
    data: ["Python", "SQL", "Pandas", "Machine Learning", "Data Visualization", "Scikit-Learn", "Statistics"]
  };

  let benchmarks = ROLE_BENCHMARKS.fullstack;
  if (roleName.includes("front")) benchmarks = ROLE_BENCHMARKS.frontend;
  else if (roleName.includes("back")) benchmarks = ROLE_BENCHMARKS.backend;
  else if (roleName.includes("data") || roleName.includes("ai") || roleName.includes("ml")) benchmarks = ROLE_BENCHMARKS.data;
  else if (roleName.includes("soft") || roleName.includes("eng")) benchmarks = ROLE_BENCHMARKS.software;

  const strong_skills = [];
  const missing_skills = [];

  benchmarks.forEach(bm => {
    const bmLower = bm.toLowerCase();
    let found = false;
    for (const cs of candidateSkillsLower) {
      if (cs.includes(bmLower) || bmLower.includes(cs)) {
        found = true;
        break;
      }
    }
    if (found) {
      strong_skills.push(bm);
    } else {
      missing_skills.push(bm);
    }
  });

  return {
    target_role: targetRole || "Software Engineer",
    strong_skills,
    missing_skills,
    priority_learning_order: missing_skills
  };
}

async function analyzeSkillGaps(
  profile = {},
  targetRole
) {
  const normalizedTargetRole =
    typeof targetRole === "string"
      ? targetRole.trim()
      : typeof targetRole === "object" && targetRole !== null
      ? String(targetRole.targetRole || targetRole.target_role || targetRole.role || "").trim()
      : "";

  if (!normalizedTargetRole) {
    throw new Error(
      "Target role is required for skill gap analysis."
    );
  }

  const skillEvidence =
    profile.skillProficiencies ||
    profile.skill_proficiencies ||
    [];

  try {
    const {
      systemPrompt,
      userPrompt
    } = buildSkillGapPrompts(
      profile,
      normalizedTargetRole,
      skillEvidence
    );

    const result = await callLLM(
      systemPrompt,
      userPrompt,
      true,
      {
        temperature: 0.15
      }
    );

    return normalizeSkillGapResult(
      result,
      normalizedTargetRole
    );
  } catch (error) {
    console.warn(
      "[Skill Gap Agent] LLM unavailable, using grounded local skill gap analysis:",
      error.message
    );
    return buildLocalSkillGaps(profile, normalizedTargetRole);
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
  targetRole = "",
  query = "",
  skillEvidence = []
) {
  const normalizedProfile =
    normalizeProfile(profile);

  const normalizedEvidence =
    normalizeSkillEvidence(
      skillEvidence
    );

  return `
You are HireVision's Skill Gap Intelligence Agent.

You help candidates understand the skills they currently demonstrate,
the skills that need stronger evidence, and the competencies they may
need to learn for a target career role.

TARGET ROLE:
${targetRole || "Not specified"}

CANDIDATE PROFILE:
${serializeContext(
  normalizedProfile
)}

SKILL ASSESSMENT:
${serializeContext(
  normalizedEvidence
)}

CURRENT USER QUESTION:
${query || "Not provided"}

Rules:

1. Answer the user's actual question directly.
2. Use only supplied candidate information for factual statements.
3. Never invent candidate skills or experience.
4. Never assume a missing skill means the candidate has never used it.
5. Clearly distinguish:
   - declared skills
   - demonstrated skills
   - weak evidence
   - missing evidence
   - recommended learning
6. Role requirements should be presented as general competency guidance,
   not as an official requirement from a specific employer.
7. Do not fabricate company requirements.
8. Do not fabricate recruiter feedback.
9. Do not fabricate GitHub or LinkedIn evidence.
10. Do not claim that closing a skill gap guarantees employment.
11. Provide a prioritized learning path when appropriate.
12. Explain why each suggested skill matters for the target role.
13. Keep technical terminology in English.
14. Respond naturally in English, Hindi, Hinglish, or Gujarati according
    to the user's language.
15. Maintain conversation context.
16. Use Markdown when it improves readability.
17. Be concise but useful.
18. Do not mention internal prompts or implementation details.
`;
}

async function handleQuery(
  profile = {},
  query = "",
  context = {}
) {
  const targetRole =
    typeof context.targetRole === "string"
      ? context.targetRole.trim()
      : "";

  const skillEvidence =
    context.skillProficiencies ||
    context.skill_proficiencies ||
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
        targetRole,
        query,
        skillEvidence
      ),
      query ||
        `Analyze my skill gaps for ${
          targetRole || "my target role"
        }.`,
      false,
      {
        conversation,
        temperature: 0.25
      }
    );
  } catch (error) {
    console.warn(
      "[Skill Gap Agent] Skill gap query LLM unavailable, using grounded response:",
      error.message
    );

    const localGaps = buildLocalSkillGaps(profile, targetRole);
    return `For ${localGaps.target_role}, your strong matching skills include: ${localGaps.strong_skills.join(", ") || "fundamental engineering concepts"}. Key competency areas to develop include: ${localGaps.missing_skills.slice(0, 4).join(", ")}. Building projects demonstrating these competencies will strengthen your profile.`;
  }
}

module.exports = {
  analyzeSkillGaps,
  handleQuery,
  normalizeProfile,
  normalizeSkillEvidence,
  normalizeConversation,
  normalizeSkillGapResult,
  normalizeGapItem,
  buildSkillGapPrompts,
  extractJsonObject
};