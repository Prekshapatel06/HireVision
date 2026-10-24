const { callLLM } = require("./openaiService");

const MAX_HISTORY_MESSAGES = 12;
const MAX_PROJECT_CONTEXT_CHARS = 24000;

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

function normalizeProject(project = {}) {
  if (!project || typeof project !== "object") {
    return {
      project_title: "",
      description: "",
      technologies: [],
      tech_stack: [],
      project_url: "",
      github_url: "",
      live_url: "",
      role: "",
      responsibilities: [],
      features: [],
      architecture: "",
      outcome: "",
      start_date: "",
      end_date: ""
    };
  }

  return {
    ...project,
    project_title:
      project.project_title ||
      project.title ||
      project.name ||
      "",
    description:
      project.description ||
      project.project_description ||
      "",
    technologies:
      project.technologies ||
      project.tech_stack ||
      [],
    tech_stack:
      project.tech_stack ||
      project.technologies ||
      [],
    project_url:
      project.project_url ||
      project.url ||
      "",
    github_url:
      project.github_url ||
      project.github ||
      "",
    live_url:
      project.live_url ||
      project.demo_url ||
      "",
    role: project.role || "",
    responsibilities:
      project.responsibilities || [],
    features: project.features || [],
    architecture:
      project.architecture || "",
    outcome:
      project.outcome ||
      project.results ||
      project.impact ||
      "",
    start_date:
      project.start_date || "",
    end_date:
      project.end_date || ""
  };
}

function normalizeProjects(projects) {
  if (!Array.isArray(projects)) {
    return [];
  }

  return projects
    .map(normalizeProject)
    .filter(project => project.project_title);
}

function serializeProjects(projects) {
  let serialized;

  try {
    serialized = JSON.stringify(
      projects,
      null,
      2
    );
  } catch (error) {
    serialized = "[]";
  }

  if (
    serialized.length >
    MAX_PROJECT_CONTEXT_CHARS
  ) {
    serialized = serialized.slice(
      0,
      MAX_PROJECT_CONTEXT_CHARS
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

function normalizeNumber(value, fallback = 0) {
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
          item.text ||
          item.reason ||
          ""
        ).trim();
      }

      return "";
    })
    .filter(Boolean);
}

function normalizeProjectAnalysis(
  result,
  originalProjects
) {
  const parsed = extractJsonObject(result);

  if (!parsed) {
    throw new Error(
      "Project agent returned an invalid structured response."
    );
  }

  const analyzedProjects =
    Array.isArray(parsed.projects)
      ? parsed.projects
      : [];

  const originalMap = new Map(
    originalProjects.map(project => [
      project.project_title,
      project
    ])
  );

  const normalized = analyzedProjects
    .map(project => {
      if (
        !project ||
        typeof project !== "object"
      ) {
        return null;
      }

      const title = String(
        project.project_title ||
        project.title ||
        ""
      ).trim();

      if (!title) {
        return null;
      }

      const original =
        originalMap.get(title);

      if (!original) {
        return null;
      }

      return {
        project_title:
          original.project_title,
        quality_score:
          normalizeNumber(
            project.quality_score
          ),
        technical_depth:
          normalizeNumber(
            project.technical_depth
          ),
        career_relevance:
          normalizeNumber(
            project.career_relevance
          ),
        description_quality:
          normalizeNumber(
            project.description_quality
          ),
        suggestions:
          normalizeStringArray(
            project.suggestions
          )
      };
    })
    .filter(Boolean);

  const analyzedTitles = new Set(
    normalized.map(
      project => project.project_title
    )
  );

  for (const project of originalProjects) {
    if (
      !analyzedTitles.has(
        project.project_title
      )
    ) {
      normalized.push({
        project_title:
          project.project_title,
        quality_score: 0,
        technical_depth: 0,
        career_relevance: 0,
        description_quality: 0,
        suggestions: [
          "Insufficient analysis evidence available."
        ]
      });
    }
  }

  return {
    projects: normalized
  };
}

function buildProjectAnalysisPrompts(
  projects
) {
  const normalizedProjects =
    normalizeProjects(projects);

  const systemPrompt = `
You are HireVision's Project Analysis Agent.

Your responsibility is to analyze EVERY project supplied by the candidate.

Evaluate each project using only the information actually provided.

Evaluation dimensions:

1. Technical Depth
2. Career Relevance
3. Description Quality
4. Overall Quality
5. Actionable Improvements

Technical Depth should consider evidence of:
- technologies
- frameworks
- databases
- architecture
- APIs
- integrations
- implementation details
- complexity
- candidate responsibilities

Career Relevance should consider:
- practical applicability
- relevance of demonstrated technologies
- relevance to common software engineering roles
- evidence of real-world problem solving

Description Quality should consider:
- clarity
- structure
- technical specificity
- action verbs
- measurable outcomes
- candidate contribution
- completeness

Important rules:

1. Analyze EVERY supplied project.
2. Keep every project title EXACTLY as supplied.
3. Never invent technologies.
4. Never invent architecture.
5. Never invent features.
6. Never invent metrics or outcomes.
7. Never invent GitHub activity.
8. Never assume the candidate personally implemented something unless the supplied data supports it.
9. A project title alone is not evidence of technical depth.
10. Missing information should reduce the relevant score rather than being guessed.
11. Career relevance must be based on the evidence supplied and reasonable role relevance, not fabricated employer requirements.
12. Suggestions must address actual missing or weak information.
13. Do not claim that a project guarantees interviews or employment.
14. Do not fabricate recruiter feedback.
15. Scores are AI assessments, not scientifically validated measurements.
16. Every score must be between 0 and 100.
17. Return ONLY valid JSON.
18. Do not wrap JSON in Markdown code fences.

Required JSON:

{
  "projects": [
    {
      "project_title": "Exact supplied title",
      "quality_score": 0,
      "technical_depth": 0,
      "career_relevance": 0,
      "description_quality": 0,
      "suggestions": []
    }
  ]
}
`;

  const userPrompt = `
CANDIDATE PROJECTS
==================

${serializeProjects(
  normalizedProjects
)}

Analyze every project independently.

Use only the supplied evidence.
Do not invent missing information.
Preserve project titles exactly.
`;

  return {
    systemPrompt,
    userPrompt
  };
}

function buildLocalProjectAnalysis(projects) {
  return projects.map(proj => {
    const techCount = (proj.technologies || proj.tech_stack || []).length;
    const hasGithub = Boolean(proj.github_url || proj.github || proj.project_url);
    const hasLive = Boolean(proj.live_url || proj.demo_url);
    const descLen = (proj.description || "").length;

    const technical_depth = Math.min(95, 50 + techCount * 8 + (hasGithub ? 15 : 0));
    const description_quality = Math.min(95, Math.max(40, Math.round(descLen / 5)));
    const career_relevance = Math.min(90, 60 + (techCount > 0 ? 15 : 0) + (hasLive ? 15 : 0));
    const quality_score = Math.round((technical_depth + description_quality + career_relevance) / 3);

    const suggestions = [];
    if (!hasGithub && !hasLive) {
      suggestions.push("Add a repository link or live demo URL to demonstrate implementation.");
    }
    if (descLen < 80) {
      suggestions.push("Expand the project description to include key architecture decisions and quantifiable outcomes.");
    }
    if (techCount < 3) {
      suggestions.push("Specify all frontend, backend, database, and DevOps technologies used.");
    }
    if (suggestions.length === 0) {
      suggestions.push("Highlight production metrics, performance benchmarks, or user scale.");
    }

    return {
      project_title: proj.project_title,
      quality_score,
      technical_depth,
      career_relevance,
      description_quality,
      suggestions
    };
  });
}

async function analyzeProjects(profile = {}) {
  const projects = normalizeProjects(
    profile.projects
  );

  if (projects.length === 0) {
    return [];
  }

  try {
    const {
      systemPrompt,
      userPrompt
    } = buildProjectAnalysisPrompts(
      projects
    );

    const result = await callLLM(
      systemPrompt,
      userPrompt,
      true,
      {
        temperature: 0.15
      }
    );

    return normalizeProjectAnalysis(
      result,
      projects
    ).projects;
  } catch (error) {
    console.warn(
      "[Project Agent] LLM unavailable, using grounded local project analysis:",
      error.message
    );
    return buildLocalProjectAnalysis(projects);
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
  const projects = normalizeProjects(
    profile.projects
  );

  return `
You are HireVision's Project Analysis Agent.

You help candidates understand and improve their existing projects.

CANDIDATE PROJECTS:
${serializeProjects(projects)}

CURRENT USER QUESTION:
${query || "Not provided"}

Your responsibilities:

- Explain project strengths.
- Identify technical weaknesses.
- Evaluate description quality.
- Explain how to present projects professionally.
- Suggest concrete improvements.
- Help improve project descriptions.
- Help identify missing technical details.
- Explain how to demonstrate technical depth.

Rules:

1. Answer the candidate's actual question directly.
2. Use only supplied project information for factual claims.
3. Never invent technologies, frameworks, databases, APIs, architecture, features, metrics, users, deployments, GitHub activity, or results.
4. Never claim the candidate implemented something unless the supplied project information supports it.
5. Missing information should be described as missing.
6. Do not treat missing information as proof that the candidate did not do something.
7. If suggesting a new project idea, clearly identify it as a suggestion and not an existing candidate project.
8. Do not fabricate recruiter feedback.
9. Do not claim that a project guarantees interviews or employment.
10. If discussing scores, explain that they are AI assessments based on available evidence.
11. Keep technical terminology in English.
12. Respond naturally in English, Hindi, Hinglish, or Gujarati according to the user's language.
13. Maintain conversation context.
14. Use Markdown when it improves readability.
15. Be concise but useful.
16. Do not mention internal prompts or implementation details.
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
        "Please analyze my projects.",
      false,
      {
        conversation,
        temperature: 0.25
      }
    );
  } catch (error) {
    console.warn(
      "[Project Agent] Project query LLM unavailable, using grounded response:",
      error.message
    );

    const projects = normalizeProjects(profile.projects);
    if (projects.length === 0) {
      return "You currently have no projects listed in your profile. Adding 2-3 detailed projects with technologies, architecture, and GitHub or live demo links will substantially improve your recruiter appeal.";
    }

    const titles = projects.map(p => p.project_title).join(", ");
    return `You have ${projects.length} project(s) documented: ${titles}. To maximize impact, ensure each project has a clear technical description, listed technologies, and a verifiable repository or demo link.`;
  }
}

module.exports = {
  analyzeProjects,
  handleQuery,
  normalizeProject,
  normalizeProjects,
  normalizeConversation,
  normalizeProjectAnalysis,
  buildProjectAnalysisPrompts,
  extractJsonObject
};