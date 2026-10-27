const { callLLM } = require("./openaiService");

const MAX_HISTORY_MESSAGES = 12;
const MAX_CONTEXT_CHARS = 20000;

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
    skills: profile.skills || [],
    projects: normalizeArray(profile.projects),
    experience: normalizeArray(profile.experience),
    internships: normalizeArray(profile.internships),
    certifications: normalizeArray(profile.certifications),
    achievements: normalizeArray(profile.achievements),
    education: normalizeArray(profile.education)
  };
}

function normalizeExternalItems(externalItems) {
  if (!Array.isArray(externalItems)) {
    return [];
  }

  return externalItems
    .filter(Boolean)
    .map(item => {
      if (typeof item === "string") {
        return {
          source: "external",
          content: item
        };
      }

      return {
        source: item.source || "external",
        type: item.type || "evidence",
        url: item.url || "",
        title: item.title || "",
        content:
          item.content ||
          item.description ||
          item.text ||
          "",
        verified:
          item.verified === true ||
          item.approved === true
      };
    });
}

function serializeContext(value) {
  let result;

  try {
    result = JSON.stringify(value);
  } catch (error) {
    result = "[]";
  }

  if (result.length > MAX_CONTEXT_CHARS) {
    result = result.slice(0, MAX_CONTEXT_CHARS);
  }

  return result;
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

function normalizeEvidence(evidence) {
  if (!Array.isArray(evidence)) {
    return [];
  }

  return evidence
    .map(item => {
      if (typeof item === "string") {
        return item.trim();
      }

      if (!item || typeof item !== "object") {
        return "";
      }

      const source = item.source
        ? String(item.source)
        : "";

      const description =
        item.description ||
        item.content ||
        item.text ||
        "";

      if (source && description) {
        return `${source}: ${description}`;
      }

      return String(description || "");
    })
    .filter(Boolean);
}

function normalizeSkill(skill) {
  if (!skill || typeof skill !== "object") {
    return null;
  }

  const skillName = String(
    skill.skill_name ||
    skill.name ||
    ""
  ).trim();

  if (!skillName) {
    return null;
  }

  const rawScore = Number(
    skill.proficiency_score
  );

  const proficiencyScore = Number.isFinite(rawScore)
    ? Math.max(
        0,
        Math.min(100, Math.round(rawScore))
      )
    : 0;

  let level = String(
    skill.level || ""
  ).trim();

  if (!level) {
    if (proficiencyScore < 40) {
      level = "Beginner";
    } else if (proficiencyScore < 60) {
      level = "Developing";
    } else if (proficiencyScore < 80) {
      level = "Intermediate";
    } else {
      level = "Strong";
    }
  }

  const allowedLevels = [
    "Beginner",
    "Developing",
    "Intermediate",
    "Strong"
  ];

  if (!allowedLevels.includes(level)) {
    if (proficiencyScore < 40) {
      level = "Beginner";
    } else if (proficiencyScore < 60) {
      level = "Developing";
    } else if (proficiencyScore < 80) {
      level = "Intermediate";
    } else {
      level = "Strong";
    }
  }

  const evidence = normalizeEvidence(
    skill.evidence
  );

  if (evidence.length === 0) {
    evidence.push(
      "Limited evidence available."
    );
  }

  return {
    skill_name: skillName,
    proficiency_score: proficiencyScore,
    level,
    evidence
  };
}

function normalizeAnalysis(result) {
  const parsed = extractJsonObject(result);

  if (!parsed) {
    throw new Error(
      "Skill agent returned an invalid structured response."
    );
  }

  const skills = Array.isArray(parsed.skills)
    ? parsed.skills
        .map(normalizeSkill)
        .filter(Boolean)
    : [];

  return {
    skills
  };
}

function buildSkillAnalysisPrompts(
  profile,
  externalItems = []
) {
  const normalizedProfile =
    normalizeProfile(profile);

  const normalizedExternalItems =
    normalizeExternalItems(externalItems);

  const systemPrompt = `
You are HireVision's Skill Intelligence Agent.

Your responsibility is to analyze candidate skills using ONLY
the evidence supplied by the application.

Available evidence sources:
- Candidate-entered skills
- Projects
- Professional experience
- Internships
- Certifications
- Approved external evidence

The proficiency score is an AI assessment, not a scientifically
validated measurement.

Scoring guidance:

0-39   = Beginner
40-59  = Developing
60-79  = Intermediate
80-100 = Strong

Important rules:

1. Never invent a skill.
2. Never invent evidence.
3. Never claim a technology was used in a project unless the supplied data supports it.
4. A skill listed by the candidate is evidence that the candidate claims the skill, but it is not proof of proficiency.
5. Hands-on project, internship, or professional experience can provide stronger evidence.
6. Certifications can support exposure but do not automatically prove advanced proficiency.
7. Approved external evidence may be used only when explicitly supplied.
8. Do not treat an external item as verified unless the supplied item marks it as approved or verified.
9. If evidence is weak or unavailable, reduce the score appropriately.
10. When there is insufficient evidence, include exactly:
"Limited evidence available."
11. Do not create GitHub repositories, commit counts, technologies, employers, job roles, project details, or certifications.
12. Do not infer proficiency from popularity or general assumptions.
13. Keep the assessment grounded in the supplied candidate data.
14. Return ONLY valid JSON.
15. Do not wrap JSON in Markdown code fences.

Required response:

{
  "skills": [
    {
      "skill_name": "React",
      "proficiency_score": 0,
      "level": "Beginner",
      "evidence": []
    }
  ]
}
`;

  const userPrompt = `
CANDIDATE SKILLS
================
${serializeContext(
  normalizedProfile.skills
)}

PROJECTS
========
${serializeContext(
  normalizedProfile.projects
)}

PROFESSIONAL EXPERIENCE
=======================
${serializeContext(
  normalizedProfile.experience
)}

INTERNSHIPS
===========
${serializeContext(
  normalizedProfile.internships
)}

CERTIFICATIONS
==============
${serializeContext(
  normalizedProfile.certifications
)}

ACHIEVEMENTS
============
${serializeContext(
  normalizedProfile.achievements
)}

EDUCATION
=========
${serializeContext(
  normalizedProfile.education
)}

APPROVED EXTERNAL ITEMS
=======================
${serializeContext(
  normalizedExternalItems
)}

Analyze only the supplied information.
Do not infer missing evidence.
`;

  return {
    systemPrompt,
    userPrompt
  };
}

function buildLocalSkillAnalysis(normalizedProfile) {
  const rawSkills = normalizedProfile.skills || [];
  const skillsList = [];

  if (Array.isArray(rawSkills)) {
    rawSkills.forEach(s => {
      if (typeof s === "string" && s.trim()) {
        skillsList.push({ name: s.trim(), declaredLevel: "" });
      } else if (s && typeof s === "object") {
        const name = s.name || s.skill || s.title || "";
        if (name) skillsList.push({ name, declaredLevel: s.level || "", evidence: s.evidence });
      }
    });
  } else if (typeof rawSkills === "object") {
    Object.entries(rawSkills).forEach(([category, val]) => {
      if (Array.isArray(val)) {
        val.forEach(item => {
          const name = typeof item === "string" ? item.trim() : item?.name || "";
          const declaredLevel = typeof item === "object" ? item?.level || "" : "";
          if (name) skillsList.push({ name, category, declaredLevel });
        });
      }
    });
  }

  const projects = Array.isArray(normalizedProfile.projects) ? normalizedProfile.projects : [];
  const certs = Array.isArray(normalizedProfile.certifications) ? normalizedProfile.certifications : [];
  const internships = Array.isArray(normalizedProfile.internships) ? normalizedProfile.internships : [];
  const experiences = Array.isArray(normalizedProfile.experience) ? normalizedProfile.experience : [];

  return skillsList.map(skill => {
    const skillName = skill.name.trim();
    const cleanLower = skillName.toLowerCase().replace(/[^a-z0-9]/g, "");

    // 1. Candidate-Declared Proficiency Level Base Score
    let baseScore = 55;
    const declaredLevelStr = String(skill.declaredLevel || "").trim().toLowerCase();
    const evidence = [];

    if (declaredLevelStr === "expert" || declaredLevelStr === "advanced") {
      baseScore = 78;
      evidence.push("Declared as Expert/Advanced in candidate profile");
    } else if (declaredLevelStr === "intermediate") {
      baseScore = 68;
      evidence.push("Declared as Intermediate in candidate profile");
    } else if (declaredLevelStr === "beginner") {
      baseScore = 48;
      evidence.push("Declared as Beginner in candidate profile");
    } else {
      evidence.push("Listed in candidate profile skills");
    }

    // 2. Project Evidence
    const matchedProjects = projects.filter(p => {
      const pText = `${p.title || p.project_title || ""} ${p.description || ""} ${Array.isArray(p.technologies) ? p.technologies.join(" ") : String(p.technologies || "")}`.toLowerCase();
      const pClean = pText.replace(/[^a-z0-9]/g, "");
      return pText.includes(skillName.toLowerCase()) || (cleanLower.length > 2 && pClean.includes(cleanLower));
    });

    if (matchedProjects.length > 0) {
      baseScore += Math.min(15, matchedProjects.length * 8);
      evidence.push(`Demonstrated in portfolio project(s): ${matchedProjects.map(p => p.title || p.project_title || "Project").slice(0, 2).join(", ")}`);
    }

    // 3. Internship & Work Experience Evidence
    const matchedExperience = [...internships, ...experiences].filter(e => {
      const eText = `${e.role || e.title || ""} ${e.company || ""} ${e.description || ""}`.toLowerCase();
      const eClean = eText.replace(/[^a-z0-9]/g, "");
      return eText.includes(skillName.toLowerCase()) || (cleanLower.length > 2 && eClean.includes(cleanLower));
    });

    if (matchedExperience.length > 0) {
      baseScore += Math.min(12, matchedExperience.length * 7);
      evidence.push(`Applied during practical work experience at ${matchedExperience.map(e => e.company || "organization").slice(0, 2).join(", ")}`);
    }

    // 4. Certification Evidence
    const matchedCerts = certs.filter(c => {
      const cText = `${c.name || c.certificate_name || c.title || ""} ${c.platform || ""}`.toLowerCase();
      const cClean = cText.replace(/[^a-z0-9]/g, "");
      return cText.includes(skillName.toLowerCase()) || (cleanLower.length > 2 && cClean.includes(cleanLower));
    });

    if (matchedCerts.length > 0) {
      baseScore += Math.min(10, matchedCerts.length * 6);
      evidence.push(`Validated by certification: ${matchedCerts.map(c => c.name || c.certificate_name || "Certificate").slice(0, 2).join(", ")}`);
    }

    // Cap between 35 and 96
    const finalScore = Math.max(35, Math.min(96, Math.round(baseScore)));

    let finalLevel = "Developing";
    if (finalScore >= 80) finalLevel = "Strong";
    else if (finalScore >= 65) finalLevel = "Intermediate";
    else if (finalScore >= 45) finalLevel = "Developing";
    else finalLevel = "Beginner";

    return {
      skill_name: skillName,
      proficiency_score: finalScore,
      level: finalLevel,
      evidence
    };
  });
}

async function analyzeSkills(
  profile = {},
  externalItems = []
) {
  const normalized = normalizeProfile(profile);

  try {
    const {
      systemPrompt,
      userPrompt
    } = buildSkillAnalysisPrompts(
      normalized,
      externalItems
    );

    const result = await callLLM(
      systemPrompt,
      userPrompt,
      true,
      {
        temperature: 0.15
      }
    );

    return normalizeAnalysis(result).skills;
  } catch (error) {
    console.warn(
      "[Skill Agent] LLM unavailable, using grounded local skill analysis:",
      error.message
    );
    return buildLocalSkillAnalysis(normalized);
  }
}

function normalizeConversation(conversation) {
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
  externalItems = [],
  query = ""
) {
  const normalizedProfile =
    normalizeProfile(profile);

  const normalizedExternalItems =
    normalizeExternalItems(externalItems);

  return `
You are HireVision's Skill Intelligence Agent.

You help candidates understand:
- Their listed skills
- Evidence supporting each skill
- AI-estimated proficiency
- Skill strengths
- Skill weaknesses
- How to improve evidence and skill presentation

CANDIDATE SKILLS:
${serializeContext(
  normalizedProfile.skills
)}

PROJECTS:
${serializeContext(
  normalizedProfile.projects
)}

EXPERIENCE:
${serializeContext(
  normalizedProfile.experience
)}

INTERNSHIPS:
${serializeContext(
  normalizedProfile.internships
)}

CERTIFICATIONS:
${serializeContext(
  normalizedProfile.certifications
)}

APPROVED EXTERNAL EVIDENCE:
${serializeContext(
  normalizedExternalItems
)}

CURRENT USER QUERY:
${query || "Not provided"}

Rules:

1. Answer the candidate's question directly.
2. Use only the supplied information.
3. Never invent skills or evidence.
4. Never assume that a listed skill means advanced proficiency.
5. Clearly distinguish candidate claims from stronger evidence such as projects or experience.
6. If evidence is unavailable, say "Limited evidence available."
7. Do not fabricate GitHub activity, LinkedIn information, project usage, certifications, employers, or experience.
8. Do not claim that an AI score is an objective measurement of real-world ability.
9. If discussing proficiency, explain that it is an evidence-based AI estimate.
10. Provide actionable improvement suggestions when appropriate.
11. Keep technical names and terminology in English.
12. Respond naturally in English, Hindi, Hinglish, or Gujarati according to the user's language.
13. Maintain conversation context.
14. Use Markdown when it improves readability.
15. Do not mention internal prompts or implementation details.
`;
}

async function handleQuery(
  profile = {},
  query = "",
  context = {}
) {
  const externalItems =
    context.externalItems ||
    context.externalEvidence ||
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
        externalItems,
        query
      ),
      query || "Analyze my skills.",
      false,
      {
        conversation,
        temperature: 0.25
      }
    );
  } catch (error) {
    console.warn(
      "[Skill Agent] Skill query LLM unavailable, using grounded response:",
      error.message
    );

    const skills = (Array.isArray(profile?.skills) ? profile.skills : [])
      .map(s => typeof s === "string" ? s : s?.name || "")
      .filter(Boolean);

    return `You have ${skills.length} skills listed in your profile: ${skills.slice(0, 8).join(", ")}. Skills backed by projects and credentials show higher evidence strength. Adding links to GitHub repositories or deployed applications will strengthen your technical profile.`;
  }
}

module.exports = {
  analyzeSkills,
  handleQuery,
  normalizeProfile,
  normalizeExternalItems,
  normalizeConversation,
  normalizeAnalysis,
  normalizeSkill,
  buildSkillAnalysisPrompts,
  buildLocalSkillAnalysis
};