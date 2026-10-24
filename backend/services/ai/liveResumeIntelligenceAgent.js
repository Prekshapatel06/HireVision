const { callLLM } = require("./openaiService");
const { normalizeAgentResponse } = require("./agentResponseSchema");

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function flattenSkills(skills) {
  if (!skills) return [];

  if (Array.isArray(skills)) {
    return skills
      .map((skill) => {
        if (typeof skill === "string") return skill.trim();
        return String(skill?.name || skill?.skill || "").trim();
      })
      .filter(Boolean);
  }

  if (typeof skills === "object") {
    return Object.values(skills)
      .flat(Infinity)
      .map((skill) => {
        if (typeof skill === "string") return skill.trim();
        return String(skill?.name || skill?.skill || "").trim();
      })
      .filter(Boolean);
  }

  return [];
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCandidate(candidate = {}) {
  return {
    user_id: candidate.user_id || candidate.id || null,
    full_name: cleanText(candidate.full_name || candidate.name),
    career_objective: cleanText(candidate.career_objective),
    email: cleanText(candidate.email),
    phone: cleanText(candidate.phone),
    city: cleanText(candidate.city),
    skills: flattenSkills(candidate.skills),
    projects: normalizeArray(candidate.projects),
    experience: normalizeArray(candidate.experience),
    internships: normalizeArray(candidate.internships),
    education: normalizeArray(candidate.education),
    certifications: normalizeArray(candidate.certifications),
    social_profiles:
      candidate.social_profiles &&
      typeof candidate.social_profiles === "object"
        ? candidate.social_profiles
        : {},
  };
}

function getProjectTitle(project) {
  return cleanText(project?.title || project?.name);
}

function getProjectTechnologies(project) {
  if (Array.isArray(project?.technologies)) {
    return project.technologies
      .map((technology) =>
        cleanText(
          typeof technology === "string"
            ? technology
            : technology?.name || technology?.skill
        )
      )
      .filter(Boolean);
  }

  if (typeof project?.technologies === "string") {
    return project.technologies
      .split(",")
      .map(cleanText)
      .filter(Boolean);
  }

  return [];
}

function getExperienceRole(experience) {
  return cleanText(
    experience?.role ||
      experience?.title ||
      experience?.position
  );
}

function getExperienceCompany(experience) {
  return cleanText(
    experience?.company ||
      experience?.organization ||
      experience?.employer
  );
}

function buildEvidenceSummary(candidate) {
  const githubProjects = candidate.projects
    .filter(
      (project) =>
        project?.github_link ||
        project?.github ||
        project?.repository
    )
    .map((project) => ({
      title: getProjectTitle(project),
      github:
        project.github_link ||
        project.github ||
        project.repository,
      technologies: getProjectTechnologies(project),
    }));

  const linkedin =
    candidate.social_profiles?.linkedin ||
    candidate.social_profiles?.linkedIn ||
    null;

  return {
    github_projects: githubProjects,
    github_project_count: githubProjects.length,
    linkedin_present: Boolean(linkedin),
    linkedin_url: linkedin || null,
    evidence_sources: [
      githubProjects.length ? "candidate_project_github_links" : null,
      linkedin ? "candidate_linkedin_profile" : null,
      candidate.projects.length ? "candidate_projects" : null,
      candidate.experience.length || candidate.internships.length
        ? "candidate_experience"
        : null,
      candidate.education.length ? "candidate_education" : null,
    ].filter(Boolean),
  };
}

function identifyMissingData(candidate) {
  const missing = [];

  if (!candidate.full_name) missing.push("Candidate name");
  if (!candidate.career_objective) {
    missing.push("Professional summary / career objective");
  }
  if (!candidate.skills.length) missing.push("Technical skills");
  if (!candidate.projects.length) missing.push("Projects");
  if (!candidate.experience.length && !candidate.internships.length) {
    missing.push("Work experience or internships");
  }
  if (!candidate.education.length) missing.push("Education");
  if (!candidate.certifications.length) {
    missing.push("Certifications");
  }

  const hasContact =
    candidate.email ||
    candidate.phone ||
    candidate.city;

  if (!hasContact) {
    missing.push("Contact information");
  }

  return [...new Set(missing)];
}

function buildCandidateContext(candidate) {
  return {
    identity: {
      user_id: candidate.user_id,
      full_name: candidate.full_name,
    },
    professional_summary: candidate.career_objective || null,
    skills: candidate.skills,
    projects: candidate.projects.map((project) => ({
      title: getProjectTitle(project),
      technologies: getProjectTechnologies(project),
      description: cleanText(project.description),
      github_link: cleanText(
        project.github_link ||
          project.github ||
          project.repository
      ),
    })),
    experience: [
      ...candidate.experience,
      ...candidate.internships,
    ].map((item) => ({
      company: getExperienceCompany(item),
      role: getExperienceRole(item),
      description: cleanText(item.description || item.summary),
      start_date: cleanText(
        item.joining_date ||
          item.start_date ||
          item.startDate
      ),
      end_date: cleanText(
        item.ending_date ||
          item.end_date ||
          item.endDate
      ),
    })),
    education: candidate.education,
    certifications: candidate.certifications,
    social_profiles: candidate.social_profiles,
  };
}

function extractJsonObject(value) {
  if (!value) return null;

  if (typeof value === "object") {
    if (value.result && typeof value.result === "object") {
      return value.result;
    }

    return value;
  }

  const text = String(value).trim();

  try {
    return JSON.parse(text);
  } catch {}

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {}
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {}
  }

  return null;
}

function normalizeAnalysis(value, candidate, missingData, evidence) {
  const parsed = extractJsonObject(value) || {};

  const normalizeStringArray = (items) =>
    Array.isArray(items)
      ? items.map(cleanText).filter(Boolean)
      : [];

  const projects = Array.isArray(parsed.project_highlights)
    ? parsed.project_highlights.map((item) => {
        const title = cleanText(item?.title);

        const actualProject = candidate.projects.find(
          (project) =>
            getProjectTitle(project).toLowerCase() ===
            title.toLowerCase()
        );

        return {
          title:
            getProjectTitle(actualProject) ||
            title,
          technologies: actualProject
            ? getProjectTechnologies(actualProject)
            : normalizeStringArray(item?.technologies),
          highlight: cleanText(
            item?.highlight ||
              item?.description
          ),
        };
      })
    : [];

  const experienceHighlights = Array.isArray(
    parsed.experience_highlights
  )
    ? parsed.experience_highlights.map((item) => ({
        company: cleanText(item?.company),
        role: cleanText(item?.role),
        highlight: cleanText(
          item?.highlight ||
            item?.description
        ),
      }))
    : [];

  const result = {
    summary: cleanText(parsed.summary),
    top_technical_highlights: normalizeStringArray(
      parsed.top_technical_highlights
    ),
    engineering_evidence: normalizeStringArray(
      parsed.engineering_evidence
    ),
    project_highlights: projects,
    experience_highlights: experienceHighlights,
    strengths: normalizeStringArray(parsed.strengths),
    missing_data: [
      ...missingData,
      ...normalizeStringArray(parsed.missing_data),
    ],
    evidence: evidence,
    limitations: normalizeStringArray(parsed.limitations),
  };

  result.missing_data = [...new Set(result.missing_data)];

  return result;
}

async function execute(query, context = {}) {
  const candidates = normalizeArray(context.candidates);

  const targetCandidateId =
    context.targetCandidateId ||
    context.target_candidate_id ||
    null;

  const rawCandidate =
    candidates.find(
      (candidate) =>
        String(candidate?.user_id || candidate?.id) ===
        String(targetCandidateId)
    ) || candidates[0];

  if (!rawCandidate) {
    return normalizeAgentResponse("live_resume_intelligence_agent", {
      result: {
        summary:
          "No candidate data is available for analysis.",
        top_technical_highlights: [],
        engineering_evidence: [],
        project_highlights: [],
        experience_highlights: [],
        strengths: [],
        missing_data: ["Candidate profile"],
        evidence: {
          evidence_sources: [],
          github_projects: [],
          github_project_count: 0,
          linkedin_present: false,
          linkedin_url: null,
        },
        limitations: [
          "Candidate data was not available from the database context.",
        ],
      },
      missing_data: ["Candidate profile"],
    });
  }

  const candidate = normalizeCandidate(rawCandidate);
  const missingData = identifyMissingData(candidate);
  const evidence = buildEvidenceSummary(candidate);
  const candidateContext = buildCandidateContext(candidate);

  const systemPrompt = `
You are HireVision's Live Resume Intelligence Agent.

Your purpose is to analyze recruiter-visible candidate resume/profile information and produce evidence-grounded professional intelligence.

You must:
- Analyze only the candidate information supplied in the context.
- Never invent facts.
- Never invent skills, employers, projects, dates, education, certifications, achievements, metrics, repositories, or social-profile activity.
- Distinguish verified/supplied information from missing or unknown information.
- Do not claim that a GitHub repository was technically verified merely because a URL exists.
- Do not claim LinkedIn information was verified merely because a LinkedIn URL exists.
- Do not produce fake ATS scores.
- Do not produce fake hiring probabilities or recruiter metrics.
- Do not infer employment achievements that are not present.
- If evidence is insufficient, explicitly say so.
- Preserve actual project and company names.
- Give useful recruiter-facing insights without overstating certainty.
- Keep the response concise but meaningful.
- Return valid JSON only.

Return exactly:
{
  "summary": "",
  "top_technical_highlights": [],
  "engineering_evidence": [],
  "project_highlights": [],
  "experience_highlights": [],
  "strengths": [],
  "missing_data": [],
  "limitations": []
}

For project_highlights use:
{
  "title": "",
  "technologies": [],
  "highlight": ""
}

For experience_highlights use:
{
  "company": "",
  "role": "",
  "highlight": ""
}
`;

  const userPrompt = JSON.stringify(
    {
      user_query: String(query || "").trim(),
      candidate: candidateContext,
      known_missing_data: missingData,
      evidence_inventory: evidence,
    },
    null,
    2
  );

  try {
    const response = await callLLM(
      systemPrompt,
      userPrompt,
      true,
      {
        conversation: context.conversation || [],
        temperature: 0.2,
      }
    );

    const analysis = normalizeAnalysis(
      response,
      candidate,
      missingData,
      evidence
    );

    return normalizeAgentResponse(
      "live_resume_intelligence_agent",
      {
        result: analysis,
        missing_data: analysis.missing_data,
        metadata: {
          target_candidate_id: candidate.user_id,
          source: "database_candidate_profile",
          evidence_grounded: true,
        },
      }
    );
  } catch (error) {
    const fallback = {
      summary:
        candidate.career_objective ||
        "A professional summary is not available in the supplied candidate profile.",
      top_technical_highlights: candidate.skills.slice(0, 10),
      engineering_evidence: candidate.projects
        .map((project) => {
          const title = getProjectTitle(project);
          const technologies = getProjectTechnologies(project);

          if (!title && !technologies.length) return null;

          return [
            title ? `Project: ${title}` : null,
            technologies.length
              ? `Technologies: ${technologies.join(", ")}`
              : null,
          ]
            .filter(Boolean)
            .join(" — ");
        })
        .filter(Boolean),
      project_highlights: candidate.projects.map((project) => ({
        title: getProjectTitle(project),
        technologies: getProjectTechnologies(project),
        highlight: cleanText(project.description),
      })),
      experience_highlights: [
        ...candidate.experience,
        ...candidate.internships,
      ].map((item) => ({
        company: getExperienceCompany(item),
        role: getExperienceRole(item),
        highlight: cleanText(
          item.description || item.summary
        ),
      })),
      strengths: [
        candidate.skills.length
          ? "Technical skills are present in the supplied profile."
          : null,
        candidate.projects.length
          ? "Projects provide evidence of practical work."
          : null,
        candidate.experience.length ||
        candidate.internships.length
          ? "Professional or internship experience is present."
          : null,
      ].filter(Boolean),
      missing_data: missingData,
      evidence,
      limitations: [
        "AI analysis is temporarily unavailable.",
        "The available information was not independently verified during this analysis.",
      ],
    };

    return normalizeAgentResponse(
      "live_resume_intelligence_agent",
      {
        result: fallback,
        missing_data: missingData,
        metadata: {
          target_candidate_id: candidate.user_id,
          source: "database_candidate_profile",
          fallback: "deterministic",
          evidence_grounded: true,
        },
      },
      {
        error: {
          code: "LIVE_RESUME_INTELLIGENCE_UNAVAILABLE",
          message:
            "AI resume intelligence is temporarily unavailable.",
          retryable: true,
        },
      }
    );
  }
}

module.exports = {
  execute,
};