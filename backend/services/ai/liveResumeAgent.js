const db = require("../../config/db");
const { callLLM } = require("./openaiService");
const { normalizeAgentResponse } = require("./agentResponseSchema");

function flattenSkills(skills) {
  if (!skills) return [];

  if (Array.isArray(skills)) {
    return skills
      .map((item) => {
        if (typeof item === "string") return item.trim();
        return String(item?.name || item?.skill || "").trim();
      })
      .filter(Boolean);
  }

  if (typeof skills === "object") {
    return Object.values(skills)
      .flat(Infinity)
      .map((item) => {
        if (typeof item === "string") return item.trim();
        return String(item?.name || item?.skill || "").trim();
      })
      .filter(Boolean);
  }

  return [];
}

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeProfile(profile = {}) {
  return {
    full_name: String(profile.full_name || "").trim(),
    career_objective: String(profile.career_objective || "").trim(),
    phone: String(profile.phone || "").trim(),
    email: String(profile.email || "").trim(),
    city: String(profile.city || "").trim(),
    address: String(profile.address || "").trim(),
    skills: flattenSkills(profile.skills),
    projects: normalizeArray(profile.projects),
    experience: normalizeArray(profile.experience),
    internships: normalizeArray(profile.internships),
    education: normalizeArray(profile.education),
    certifications: normalizeArray(profile.certifications),
    social_profiles:
      profile.social_profiles && typeof profile.social_profiles === "object"
        ? profile.social_profiles
        : {},
  };
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function safeJson(value, fallback = []) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify(fallback);
  }
}

function getProjectTitle(project) {
  return cleanText(project?.title || project?.name);
}

function getProjectTechnologies(project) {
  if (Array.isArray(project?.technologies)) {
    return project.technologies
      .map((item) => cleanText(typeof item === "string" ? item : item?.name))
      .filter(Boolean);
  }

  if (typeof project?.technologies === "string") {
    return project.technologies
      .split(",")
      .map((item) => cleanText(item))
      .filter(Boolean);
  }

  return [];
}

function getExperienceRole(item) {
  return cleanText(item?.role || item?.title || item?.position);
}

function getExperienceCompany(item) {
  return cleanText(item?.company || item?.organization || item?.employer);
}

function buildDeterministicResume(profileInput) {
  const profile = normalizeProfile(profileInput);

  const missing = [];

  if (!profile.full_name) missing.push("Full name");
  if (!profile.career_objective) {
    missing.push("Professional summary / career objective");
  }
  if (profile.skills.length === 0) missing.push("Technical skills");
  if (profile.projects.length === 0) missing.push("Key projects");
  if (profile.experience.length === 0 && profile.internships.length === 0) {
    missing.push("Work experience or internships");
  }
  if (profile.education.length === 0) missing.push("Education");
  if (profile.certifications.length === 0) {
    missing.push("Certifications");
  }

  const sections = [];

  sections.push(`# ${profile.full_name || "Candidate"}`);

  if (profile.career_objective) {
    sections.push(profile.career_objective);
  } else {
    sections.push("Professional summary is not available yet.");
  }

  if (profile.email || profile.phone || profile.city) {
    const contact = [
      profile.email,
      profile.phone,
      profile.city,
    ].filter(Boolean);

    sections.push(contact.join(" • "));
  }

  sections.push(
    [
      "## Technical Skills",
      profile.skills.length
        ? profile.skills.map((skill) => `- ${skill}`).join("\n")
        : "- Not provided",
    ].join("\n")
  );

  const allExperience = [
    ...profile.experience.map((item) => ({
      ...item,
      type: "experience",
    })),
    ...profile.internships.map((item) => ({
      ...item,
      type: "internship",
    })),
  ];

  sections.push(
    [
      "## Work Experience",
      allExperience.length
        ? allExperience
            .map((item) => {
              const role = getExperienceRole(item);
              const company = getExperienceCompany(item);

              const start =
                cleanText(
                  item.joining_date ||
                    item.start_date ||
                    item.startDate ||
                    item.from
                );

              const end =
                cleanText(
                  item.ending_date ||
                    item.end_date ||
                    item.endDate ||
                    item.to
                );

              const period =
                start || end
                  ? ` (${start || ""}${start || end ? " - " : ""}${end || "Present"})`
                  : "";

              const description = cleanText(
                item.description || item.summary
              );

              const heading = [role, company ? `at ${company}` : ""]
                .filter(Boolean)
                .join(" ");

              return [
                `- **${heading || "Experience"}**${period}`,
                description ? `  ${description}` : "",
              ]
                .filter(Boolean)
                .join("\n");
            })
            .join("\n\n")
        : "- Not provided",
    ].join("\n")
  );

  sections.push(
    [
      "## Key Projects",
      profile.projects.length
        ? profile.projects
            .map((project) => {
              const title = getProjectTitle(project) || "Project";
              const technologies = getProjectTechnologies(project);
              const description = cleanText(project.description);
              const github = cleanText(
                project.github_link || project.github || project.repository
              );
              const liveLink = cleanText(
                project.live_link || project.liveUrl || project.live_demo || project.url
              );

              return [
                `- **${title}**`,
                technologies.length
                  ? `  - Technologies: ${technologies.join(", ")}`
                  : "",
                description ? `  - ${description}` : "",
                github ? `  - GitHub: ${github}` : "",
                liveLink ? `  - Live Demo: ${liveLink}` : "",
              ]
                .filter(Boolean)
                .join("\n");
            })
            .join("\n\n")
        : "- Not provided",
    ].join("\n")
  );

  sections.push(
    [
      "## Education",
      profile.education.length
        ? profile.education
            .map((item) => {
              const degree = cleanText(item.degree);
              const branch = cleanText(
                item.branch || item.field_of_study || item.specialization
              );
              const institution = cleanText(
                item.college_name ||
                  item.institution ||
                  item.university
              );

              const start = cleanText(
                item.start_year || item.start_date
              );
              const end = cleanText(
                item.end_year ||
                  item.passing_year ||
                  item.end_date
              );

              const field = [degree, branch ? `in ${branch}` : ""]
                .filter(Boolean)
                .join(" ");

              const institutionText = institution
                ? `, **${institution}**`
                : "";

              const period =
                start || end
                  ? ` (${start || ""}${start || end ? " - " : ""}${end || ""})`
                  : "";

              return `- **${field || "Education"}**${institutionText}${period}`;
            })
            .join("\n")
        : "- Not provided",
    ].join("\n")
  );

  sections.push(
    [
      "## Certifications",
      profile.certifications.length
        ? profile.certifications
            .map((item) => {
              const name = cleanText(
                item.certificate_name ||
                  item.name ||
                  item.title
              );

              const issuer = cleanText(
                item.platform ||
                  item.issuer ||
                  item.organization
              );

              if (name && issuer) {
                return `- **${name}** — ${issuer}`;
              }

              return `- **${name || "Certification"}**`;
            })
            .join("\n")
        : "- Not provided",
    ].join("\n")
  );

  return {
    markdown: sections.join("\n\n"),
    missing_data: [...new Set(missing)],
    generated_from: "verified_profile_data",
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

function normalizeGeneratedResume(value, deterministic) {
  const parsed = extractJsonObject(value) || {};

  const markdown =
    typeof parsed.markdown === "string" && parsed.markdown.trim()
      ? parsed.markdown.trim()
      : deterministic.markdown;

  const missingData = Array.isArray(parsed.missing_data)
    ? parsed.missing_data
        .map((item) => cleanText(item))
        .filter(Boolean)
    : deterministic.missing_data;

  return {
    markdown,
    missing_data: [...new Set(missingData)],
    headline: cleanText(parsed.headline),
  };
}

async function generateLiveResume(profileInput) {
  const profile = normalizeProfile(profileInput);
  const deterministic = buildDeterministicResume(profile);

  const systemPrompt = `
You are HireVision's Live Resume Agent.

Your job is to generate and improve a professional, ATS-friendly resume using only verified candidate information supplied in the input.

Rules:
- Never invent facts.
- Never invent employers, job titles, dates, education, certifications, projects, technologies, metrics, achievements, links, or responsibilities.
- Do not convert assumptions into facts.
- Preserve factual candidate information.
- You may improve wording, grammar, structure, clarity, keyword placement, and professional presentation.
- Do not add ATS scores unless explicitly requested and there is sufficient evidence for a transparent estimate.
- Do not claim that a resume is guaranteed to pass any ATS.
- Do not create fake quantified achievements.
- If information is missing, leave it out or clearly identify it in missing_data.
- Keep project names, company names, institutions, dates, and technologies faithful to the supplied data.
- Use professional resume language.
- Return only valid JSON.

Required JSON:
{
  "markdown": "complete resume in markdown",
  "missing_data": [],
  "headline": ""
}
`;

  const userPayload = {
    candidate: {
      full_name: profile.full_name,
      career_objective: profile.career_objective,
      email: profile.email,
      phone: profile.phone,
      city: profile.city,
      skills: profile.skills,
      projects: profile.projects,
      experience: profile.experience,
      internships: profile.internships,
      education: profile.education,
      certifications: profile.certifications,
      social_profiles: profile.social_profiles,
    },
    deterministic_resume: deterministic.markdown,
    known_missing_data: deterministic.missing_data,
  };

  try {
    const result = await callLLM(
      systemPrompt,
      safeJson(userPayload, {}),
      true,
      {
        temperature: 0.2,
      }
    );

    const generated = normalizeGeneratedResume(result, deterministic);

    return normalizeAgentResponse("live_resume_agent", {
      result: generated,
      missing_data: generated.missing_data,
      metadata: {
        source: "verified_profile_data",
        deterministic_fallback_available: true,
      },
    });
  } catch (error) {
    return normalizeAgentResponse(
      "live_resume_agent",
      {
        result: {
          markdown: deterministic.markdown,
          missing_data: [
            ...deterministic.missing_data,
            "AI resume polishing unavailable",
          ],
          headline: "",
        },
        missing_data: [
          ...deterministic.missing_data,
          "AI resume polishing unavailable",
        ],
        metadata: {
          source: "verified_profile_data",
          fallback: "deterministic",
        },
      },
      {
        error: {
          code: "LIVE_RESUME_LLM_UNAVAILABLE",
          message: "AI resume polishing is temporarily unavailable.",
          retryable: true,
        },
      }
    );
  }
}

async function generateAndStore(userId, profile) {
  if (!userId) {
    throw new Error("userId is required to store the live resume");
  }

  const generated = await generateLiveResume(profile);
  const markdown =
    generated?.result?.markdown ||
    generated?.markdown ||
    "";

  const missingData =
    generated?.missing_data ||
    generated?.result?.missing_data ||
    [];

  await db.query(
    `INSERT INTO live_resumes (user_id, content, missing_data, updated_at)
     VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id)
     DO UPDATE SET
       content = EXCLUDED.content,
       missing_data = EXCLUDED.missing_data,
       updated_at = CURRENT_TIMESTAMP`,
    [
      userId,
      markdown,
      JSON.stringify(Array.isArray(missingData) ? missingData : []),
    ]
  );

  return generated;
}

function buildResumeContext(profileInput) {
  const profile = normalizeProfile(profileInput);

  return {
    name: profile.full_name,
    summary: profile.career_objective,
    skills: profile.skills,
    projects: profile.projects.map((project) => ({
      title: getProjectTitle(project),
      technologies: getProjectTechnologies(project),
      description: cleanText(project.description),
    })),
    experience: [
      ...profile.experience,
      ...profile.internships,
    ].map((item) => ({
      company: getExperienceCompany(item),
      role: getExperienceRole(item),
      description: cleanText(item.description || item.summary),
      start_date: cleanText(
        item.joining_date || item.start_date || item.startDate
      ),
      end_date: cleanText(
        item.ending_date || item.end_date || item.endDate
      ),
    })),
    education: profile.education,
    certifications: profile.certifications,
  };
}

function detectIntent(query) {
  const lower = String(query || "").toLowerCase();

  const bio =
    /(bio|objective|professional summary|profile summary|about me)/i.test(
      lower
    );

  const improve =
    /(improve|rewrite|update|optimize|enhance|fix|polish|make .*better)/i.test(
      lower
    );

  const analyze =
    /(analy[sz]e|review|evaluate|check|assess|feedback|ats|score)/i.test(
      lower
    );

  const resume =
    /(live resume|my resume|resume|cv|curriculum vitae)/i.test(lower);

  if (bio && improve) return "improve_bio";
  if (resume && improve) return "improve_resume";
  if (resume && analyze) return "analyze_resume";
  if (analyze) return "analyze_resume";

  return "resume_chat";
}

async function handleQuery(profileInput, query, context = {}) {
  const profile = normalizeProfile(profileInput);
  const intent = detectIntent(query);
  const resumeContext = buildResumeContext(profile);

  const systemPrompt = `
You are HireVision's professional Live Resume Agent.

You help candidates:
- analyze their live resume
- improve resume content
- improve professional summaries/bios
- identify missing resume information
- improve ATS readability and keyword alignment
- explain resume weaknesses and practical fixes

Use only the supplied candidate information.

Important:
- Never invent candidate facts.
- Never invent metrics or achievements.
- Never invent companies, roles, projects, skills, dates, education, certifications, or links.
- If a recommendation requires information that is not supplied, explicitly say what information is needed.
- ATS guidance must be presented as an estimate or general optimization guidance, never as a guaranteed ATS result.
- Do not fabricate a numerical ATS score.
- When rewriting the bio, only use the candidate's verified skills, projects, education, and experience.
- Preserve the candidate's actual identity and factual history.
- Be conversational and professional.
- If the user asks for a rewrite, provide the rewritten content directly.
- If the user asks for analysis, explain findings and actionable improvements.
- Respect previous conversation context when relevant.
`;

  const userPayload = {
    intent,
    query,
    candidate_context: resumeContext,
    conversation: Array.isArray(context.conversation)
      ? context.conversation
      : [],
  };

  try {
    return await callLLM(
      systemPrompt,
      safeJson(userPayload, {}),
      false,
      {
        conversation: context.conversation || [],
        temperature: 0.25,
      }
    );
  } catch (error) {
    const deterministic = buildDeterministicResume(profile);

    if (intent === "improve_bio") {
      const bioText = buildGroundedBioImprovement(profile);
      return normalizeAgentResponse("live_resume_agent", {
        result: {
          response: bioText,
          summary: bioText,
          current_bio: profile.career_objective || null,
          available_skills: profile.skills,
          available_projects: profile.projects.map(getProjectTitle).filter(Boolean),
          missing_data: deterministic.missing_data,
        },
        missing_data: deterministic.missing_data,
      });
    }

    if (intent === "improve_resume" || intent === "analyze_resume") {
      const resumeAnalysis = buildGroundedResumeAnalysis(profile, deterministic);
      return normalizeAgentResponse("live_resume_agent", {
        result: {
          response: resumeAnalysis,
          summary: resumeAnalysis,
          markdown: deterministic.markdown,
          missing_data: deterministic.missing_data,
        },
        missing_data: deterministic.missing_data,
      });
    }

    const defaultOverview = buildGroundedResumeAnalysis(profile, deterministic);
    return normalizeAgentResponse("live_resume_agent", {
      result: {
        response: defaultOverview,
        summary: defaultOverview,
        available_data: {
          skills: profile.skills,
          projects: profile.projects.map(getProjectTitle).filter(Boolean),
          experience: profile.experience.length,
          internships: profile.internships.length,
          education: profile.education.length,
          certifications: profile.certifications.length,
        },
        missing_data: deterministic.missing_data,
      },
      missing_data: deterministic.missing_data,
    });
  }
}

function buildGroundedBioImprovement(profile) {
  const skills = (profile.skills || []).slice(0, 5).join(", ");
  const projects = (profile.projects || []).map(getProjectTitle).filter(Boolean).slice(0, 2);
  const projectMention = projects.length ? ` with demonstrated experience delivering projects like ${projects.join(" and ")}` : "";
  const current = profile.career_objective ? `\n\n**Current Bio:**\n> "${profile.career_objective}"` : "";

  return `Here are two tailored, impact-focused bio options grounded directly in your verified profile data:${current}

### Option 1 (Technical & Impact-Oriented)
"Results-driven software developer with strong hands-on expertise in ${skills || 'modern software engineering'}${projectMention}. Committed to writing clean, maintainable architecture, solving complex technical challenges, and shipping high-performance applications."

### Option 2 (Concise & Recruiter-Friendly)
"Software Engineer specializing in ${skills || 'scalable web technologies'}. Passionate about engineering robust solutions, optimizing system performance, and continuous technical growth."

**Tips to further improve:**
1. Highlight your most technically challenging project achievement.
2. Add any cloud or DevOps certifications you hold to substantiate engineering rigor.`;
}

function buildGroundedResumeAnalysis(profile, deterministic) {
  const skillsCount = (profile.skills || []).length;
  const projectsCount = (profile.projects || []).length;
  const expCount = (profile.experience || []).length;
  const eduCount = (profile.education || []).length;

  const suggestions = [];
  if (skillsCount < 5) suggestions.push("Add at least 5-8 verified skills with proficiency levels to improve recruiter keyword search.");
  if (projectsCount < 2) suggestions.push("Add at least 2 distinct technical projects highlighting architecture, database schema, and live demo / GitHub links.");
  if (!expCount) suggestions.push("Include internship or freelance experience, or document open-source contributions to demonstrate production readiness.");
  if (deterministic.missing_data?.length) {
    suggestions.push(`Complete missing profile sections: ${deterministic.missing_data.join(", ")}.`);
  }

  return `### Live Resume Grounded Intelligence

**Profile Data Overview:**
- Technical Skills: **${skillsCount}** listed (${(profile.skills || []).slice(0, 4).join(", ") || 'None'})
- Projects Documented: **${projectsCount}**
- Experience Records: **${expCount}**
- Educational Records: **${eduCount}**

**Actionable Resume Optimization Steps:**
${suggestions.map(s => `- ${s}`).join("\n")}

**Generated Resume Structure:**
${deterministic.markdown}`;
}

module.exports = {
  generateLiveResume,
  generateAndStore,
  handleQuery,
};