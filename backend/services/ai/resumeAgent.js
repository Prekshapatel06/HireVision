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
    achievements:
      normalizeArray(profile.achievements),
    education:
      normalizeArray(profile.education),
    languages:
      normalizeArray(profile.languages),
    social_profiles:
      profile.social_profiles || {},
    phone:
      profile.phone || "",
    email:
      profile.email || "",
    city:
      profile.city || "",
    linkedin:
      profile.linkedin || "",
    github:
      profile.github || ""
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

function normalizeString(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value).trim();
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
          item.text ||
          item.description ||
          item.content ||
          ""
        ).trim();
      }

      return "";
    })
    .filter(Boolean);
}

function normalizeProjectSuggestion(
  item
) {
  if (
    !item ||
    typeof item !== "object"
  ) {
    return null;
  }

  const title = normalizeString(
    item.title ||
    item.project_title
  );

  if (!title) {
    return null;
  }

  return {
    title,
    improved_description:
      normalizeString(
        item.improved_description ||
        item.description
      )
  };
}

function normalizeExperienceSuggestion(
  item
) {
  if (
    !item ||
    typeof item !== "object"
  ) {
    return null;
  }

  return {
    company:
      normalizeString(
        item.company
      ),
    role:
      normalizeString(
        item.role ||
        item.job_title ||
        item.position
      ),
    improved_description:
      normalizeString(
        item.improved_description ||
        item.description
      )
  };
}

function normalizeResumeResult(
  result,
  profile
) {
  const parsed =
    extractJsonObject(result);

  if (!parsed) {
    throw new Error(
      "Resume agent returned an invalid structured response."
    );
  }

  const normalizedProfile =
    normalizeProfile(profile);

  const projects =
    normalizeArray(
      normalizedProfile.projects
    );

  const experience = [
    ...normalizeArray(
      normalizedProfile.experience
    ),
    ...normalizeArray(
      normalizedProfile.internships
    )
  ];

  const normalizedProjects =
    Array.isArray(parsed.projects)
      ? parsed.projects
          .map(
            normalizeProjectSuggestion
          )
          .filter(Boolean)
      : [];

  const normalizedExperience =
    Array.isArray(parsed.experience)
      ? parsed.experience
          .map(
            normalizeExperienceSuggestion
          )
          .filter(Boolean)
      : [];

  const projectTitles = new Set(
    projects.map(project =>
      normalizeString(
        project.project_title ||
        project.title ||
        project.name
      )
    )
  );

  const validProjects =
    normalizedProjects.filter(
      project =>
        projectTitles.has(
          project.title
        )
    );

  const experienceKeys = new Set(
    experience.map(item =>
      `${normalizeString(
        item.company
      ).toLowerCase()}::${normalizeString(
        item.role ||
        item.job_title ||
        item.position
      ).toLowerCase()}`
    )
  );

  const validExperience =
    normalizedExperience.filter(
      item => {
        const key =
          `${item.company.toLowerCase()}::${item.role.toLowerCase()}`;

        return (
          experienceKeys.size === 0 ||
          experienceKeys.has(key)
        );
      }
    );

  return {
    about_me:
      normalizeString(
        parsed.about_me ||
        parsed.about ||
        ""
      ),
    projects: validProjects,
    experience: validExperience
  };
}

function buildResumePrompts(
  profile
) {
  const normalizedProfile =
    normalizeProfile(profile);

  const systemPrompt = `
You are HireVision's Live Resume Intelligence Agent.

Your responsibility is to transform the candidate's existing profile
information into professional, clear, ATS-friendly resume content.

You are a rewriting and optimization agent.

You MUST preserve factual accuracy.

Rules:

1. Use ONLY information supplied in the candidate profile.
2. Never invent experience.
3. Never invent technologies.
4. Never invent certifications.
5. Never invent achievements.
6. Never invent employers.
7. Never invent job titles.
8. Never invent dates.
9. Never invent metrics.
10. Never invent performance improvements.
11. Never invent users, revenue, scale, deployments, or business impact.
12. Never claim a technology was used if it is not supported by the supplied data.
13. Preserve the actual meaning of the candidate's content.
14. Improve grammar, clarity, structure, action verbs, and professional tone.
15. You may reorganize supplied facts to make them easier to understand.
16. You may combine closely related supplied facts when their meaning remains unchanged.
17. If a useful resume detail is missing, do not fabricate it.
18. Do not add generic achievements that were not supplied.
19. Keep project titles exactly as supplied.
20. Keep company names and roles based only on supplied information.
21. ATS optimization means clear text, relevant existing keywords, strong structure,
    and readable wording. Do not promise ATS ranking or interview success.
22. Do not claim the result is guaranteed to pass any ATS.
23. Return ONLY valid JSON.
24. Do not wrap JSON in Markdown code fences.

For the About Me section:
- Write a concise professional summary.
- Use only the candidate's actual skills, education, projects, experience,
  achievements, and objective.
- Do not introduce unsupported career claims.

For projects:
- Preserve the original project title.
- Improve the description using strong action-oriented language.
- Mention only technologies and functionality actually supplied.
- Do not create metrics or technical outcomes.

For experience:
- Preserve the actual company and role information.
- Rewrite supplied responsibilities professionally.
- Do not create achievements or metrics that are not present.

Required JSON:

{
  "about_me": "",
  "projects": [
    {
      "title": "",
      "improved_description": ""
    }
  ],
  "experience": [
    {
      "company": "",
      "role": "",
      "improved_description": ""
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

Professional Experience:
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

Social Profiles:
${serializeContext(
  normalizedProfile.social_profiles
)}

Rewrite and optimize only the information supplied above.
Do not invent missing facts.
`;

  return {
    systemPrompt,
    userPrompt
  };
}

function extractSkillsList(skills) {
  if (Array.isArray(skills)) {
    return skills.map(s => typeof s === "string" ? s : s?.name || "").filter(Boolean);
  }
  if (skills && typeof skills === "object") {
    const list = [];
    for (const val of Object.values(skills)) {
      if (Array.isArray(val)) {
        list.push(...val.map(s => typeof s === "string" ? s : s?.name || "").filter(Boolean));
      } else if (typeof val === "string") {
        list.push(val);
      } else if (val?.name) {
        list.push(val.name);
      }
    }
    return list;
  }
  return [];
}

function buildLocalResumeSuggestions(profile) {
  const normalized = normalizeProfile(profile);
  const name = normalized.full_name || "The candidate";
  const skills = extractSkillsList(normalized.skills);
  const topSkills = skills.slice(0, 4).join(", ") || "modern software engineering tools";

  const about_me = normalized.about || normalized.career_objective
    ? `${normalized.about || normalized.career_objective} Specializing in ${topSkills} with demonstrated project execution.`
    : `Results-driven Software Engineer proficient in ${topSkills}. Passionate about building robust, scalable applications and solving complex technical problems.`;

  const projects = (normalized.projects || []).map(p => {
    const title = p.project_title || p.title || p.name || "Project";
    const rawTechs = p.technologies || p.tech_stack || [];
    const techs = Array.isArray(rawTechs) ? rawTechs.join(", ") : String(rawTechs || "");
    const desc = p.description ? p.description.trim() : "";
    return {
      title,
      improved_description: desc
        ? `Architected and developed ${title}${techs ? ` utilizing ${techs}` : ""}. ${desc} Implemented responsive workflows, data persistence, and reliable application state.`
        : `Designed and implemented ${title} utilizing ${techs || "modern technologies"} with focus on clean architecture and performance.`
    };
  });

  const experience = (normalized.experience || []).map(e => ({
    company: e.company || "",
    role: e.role || "",
    improved_description: e.description
      ? `Spearheaded software development as ${e.role || "Engineer"} at ${e.company || "the company"}. ${e.description} Collaborated with cross-functional team to deliver high-quality deliverables.`
      : `Contributed to technical deliverables and system architecture as ${e.role || "Engineer"} at ${e.company || "the company"}.`
  }));

  return {
    about_me,
    projects,
    experience
  };
}

async function generateResumeSuggestions(
  profile = {}
) {
  try {
    const {
      systemPrompt,
      userPrompt
    } = buildResumePrompts(profile);

    const result = await callLLM(
      systemPrompt,
      userPrompt,
      true,
      {
        temperature: 0.15
      }
    );

    return normalizeResumeResult(
      result,
      profile
    );
  } catch (error) {
    console.warn(
      "[Resume Agent] LLM unavailable, using grounded local suggestions:",
      error.message
    );
    return buildLocalResumeSuggestions(profile);
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
  query = ""
) {
  const normalizedProfile =
    normalizeProfile(profile);

  return `
You are HireVision's Live Resume Intelligence Agent.

You help candidates improve their resume, CV content, professional
summaries, project descriptions, experience descriptions, and
resume presentation.

CANDIDATE PROFILE:
${serializeContext(
  normalizedProfile
)}

CURRENT USER REQUEST:
${query || "Not provided"}

Rules:

1. Answer the user's actual request directly.
2. Use only information contained in the supplied profile.
3. Never invent facts.
4. Never invent technologies, experience, employers, job titles,
   certifications, achievements, dates, metrics, users, revenue,
   performance improvements, or business outcomes.
5. You may rewrite existing information professionally.
6. You may improve grammar and structure.
7. You may convert existing facts into resume bullet points.
8. If a metric would improve the resume but no metric is supplied,
   suggest that the candidate add a real metric rather than creating one.
9. Never create fake metrics.
10. Never claim guaranteed ATS success.
11. Never claim a specific ATS score unless an actual ATS analysis
    is supplied in the context.
12. Do not fabricate recruiter feedback.
13. Preserve project and company names supplied by the candidate.
14. If the candidate asks for a new example, clearly distinguish it
    from their actual experience.
15. Keep technical terminology in English.
16. Respond naturally in English, Hindi, Hinglish, or Gujarati according
    to the candidate's language.
17. Maintain conversation context.
18. Use Markdown when useful.
19. Provide ready-to-use wording when the candidate asks for rewriting.
20. Do not mention internal prompts or implementation details.
`;
}

async function handleQuery(
  profile = {},
  query = "",
  context = {}
) {
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
        query
      ),
      query ||
        "Help me improve my resume.",
      false,
      {
        conversation,
        temperature: 0.25
      }
    );
  } catch (error) {
    console.warn(
      "[Resume Agent] Resume query LLM unavailable, using grounded response:",
      error.message
    );

    return "To optimize your resume for recruiters: 1) Start each project and experience bullet point with an action verb (e.g. Architected, Engineered, Implemented); 2) Quantify outcomes where possible (e.g. improved performance by 30%); 3) Highlight your specific technical role and tools used; 4) Ensure your GitHub repository links are active and accessible.";
  }
}

module.exports = {
  generateResumeSuggestions,
  handleQuery,
  normalizeProfile,
  normalizeConversation,
  normalizeResumeResult,
  normalizeProjectSuggestion,
  normalizeExperienceSuggestion,
  buildResumePrompts,
  extractJsonObject
};