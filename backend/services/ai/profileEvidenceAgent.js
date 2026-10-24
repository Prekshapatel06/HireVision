const { callLLM } = require("./openaiService");
const {
  normalizeAgentResponse,
  failedAgentResponse,
  isValidAgentResponse
} = require("./agentResponseSchema");

const EVIDENCE_LEVELS = [
  "VERIFIED",
  "SUPPORTED",
  "CLAIMED",
  "INCONSISTENT",
  "UNKNOWN"
];

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeSkill(skill) {
  if (typeof skill === "string") {
    return {
      name: skill.trim(),
      level: null,
      evidence: []
    };
  }

  if (!skill || typeof skill !== "object") {
    return null;
  }

  return {
    name: normalizeText(
      skill.name ||
      skill.skill ||
      skill.title ||
      skill.label
    ),
    level:
      skill.level ??
      skill.proficiency ??
      skill.experience_level ??
      null,
    evidence: safeArray(
      skill.evidence ||
      skill.links ||
      skill.sources
    )
  };
}

function normalizeSkills(candidate) {
  if (Array.isArray(candidate?.skills)) {
    return candidate.skills
      .map(normalizeSkill)
      .filter(skill => skill && skill.name);
  }

  if (candidate?.skills && typeof candidate.skills === "object") {
    return Object.entries(candidate.skills)
      .map(([name, value]) => {
        if (typeof value === "string" || typeof value === "number") {
          return {
            name,
            level: value,
            evidence: []
          };
        }

        const normalized = normalizeSkill({
          ...(value || {}),
          name
        });

        return normalized;
      })
      .filter(Boolean);
  }

  return [];
}

function normalizeProjects(candidate) {
  return safeArray(candidate?.projects).map(project => {
    if (typeof project === "string") {
      return {
        title: project,
        description: "",
        github_link: "",
        live_link: "",
        technologies: []
      };
    }

    return {
      title: normalizeText(
        project?.title ||
        project?.name ||
        project?.project_name
      ),
      description: normalizeText(
        project?.description ||
        project?.summary
      ),
      github_link: normalizeText(
        project?.github_link ||
        project?.github ||
        project?.repository_url
      ),
      live_link: normalizeText(
        project?.live_link ||
        project?.liveUrl ||
        project?.url
      ),
      technologies: safeArray(
        project?.technologies ||
        project?.tech_stack ||
        project?.skills
      ).map(normalizeText).filter(Boolean)
    };
  });
}

function normalizeSocialProfiles(candidate) {
  const social = candidate?.social_profiles || candidate?.socialProfiles || {};

  return {
    github: normalizeText(
      social.github ||
      candidate?.github ||
      candidate?.github_url
    ),
    linkedin: normalizeText(
      social.linkedin ||
      candidate?.linkedin ||
      candidate?.linkedin_url
    ),
    portfolio: normalizeText(
      social.portfolio ||
      candidate?.portfolio ||
      candidate?.portfolio_url
    )
  };
}

function extractCandidateEvidence(candidate) {
  const skills = normalizeSkills(candidate);
  const projects = normalizeProjects(candidate);
  const socialProfiles = normalizeSocialProfiles(candidate);

  const certifications = safeArray(
    candidate?.certifications ||
    candidate?.certificates
  ).map(item => {
    if (typeof item === "string") {
      return {
        name: item,
        issuer: "",
        credentialUrl: ""
      };
    }

    return {
      name: normalizeText(
        item?.name ||
        item?.title ||
        item?.certificate
      ),
      issuer: normalizeText(
        item?.issuer ||
        item?.organization ||
        item?.provider
      ),
      credentialUrl: normalizeText(
        item?.credential_url ||
        item?.credentialUrl ||
        item?.url
      )
    };
  });

  const assessments = safeArray(
    candidate?.assessments ||
    candidate?.assessment_results
  );

  const experience = safeArray(
    candidate?.experience ||
    candidate?.work_experience ||
    candidate?.workExperience
  );

  const education = safeArray(candidate?.education);

  return {
    skills,
    projects,
    socialProfiles,
    certifications,
    assessments,
    experience,
    education
  };
}

function createEvidenceIndex(candidate) {
  const evidence = extractCandidateEvidence(candidate);

  const projectTechnologies = new Set();

  evidence.projects.forEach(project => {
    project.technologies.forEach(technology => {
      projectTechnologies.add(technology.toLowerCase());
    });
  });

  const certifiedSkills = new Set();

  evidence.certifications.forEach(certification => {
    if (certification.name) {
      certifiedSkills.add(certification.name.toLowerCase());
    }
  });

  const assessedSkills = new Set();

  evidence.assessments.forEach(assessment => {
    if (typeof assessment === "object" && assessment) {
      const skill =
        assessment.skill ||
        assessment.name ||
        assessment.subject;

      if (skill) {
        assessedSkills.add(String(skill).toLowerCase());
      }
    }
  });

  return {
    ...evidence,
    projectTechnologies,
    certifiedSkills,
    assessedSkills
  };
}

function hasStrongDirectEvidence(skillName, index) {
  const normalizedSkill = normalizeText(skillName).toLowerCase();

  if (!normalizedSkill) return false;

  if (index.certifiedSkills.has(normalizedSkill)) {
    return true;
  }

  if (index.assessedSkills.has(normalizedSkill)) {
    return true;
  }

  return index.projects.some(project =>
    project.technologies.some(
      technology =>
        technology.toLowerCase() === normalizedSkill
    )
  );
}

function hasProjectEvidence(skillName, index) {
  const normalizedSkill = normalizeText(skillName).toLowerCase();

  if (!normalizedSkill) return false;

  return index.projects.some(project => {
    const technologyMatch = project.technologies.some(
      technology =>
        technology.toLowerCase() === normalizedSkill
    );

    const repositoryEvidence =
      Boolean(project.github_link) ||
      Boolean(project.live_link);

    return technologyMatch && repositoryEvidence;
  });
}

function hasClaimOnly(skillName, index) {
  const normalizedSkill = normalizeText(skillName).toLowerCase();

  if (!normalizedSkill) return false;

  const appearsInProject = index.projects.some(project =>
    project.technologies.some(
      technology =>
        technology.toLowerCase() === normalizedSkill
    )
  );

  const certified = index.certifiedSkills.has(normalizedSkill);
  const assessed = index.assessedSkills.has(normalizedSkill);

  return !appearsInProject && !certified && !assessed;
}

function buildLocalEvidenceAnalysis(candidate, query) {
  const index = createEvidenceIndex(candidate);

  const skillResults = index.skills.map(skill => {
    const directEvidence = hasStrongDirectEvidence(
      skill.name,
      index
    );

    const projectEvidence = hasProjectEvidence(
      skill.name,
      index
    );

    let classification = "CLAIMED";
    let sources = [];

    if (directEvidence) {
      classification = "VERIFIED";

      if (index.certifiedSkills.has(skill.name.toLowerCase())) {
        sources.push("Certification");
      }

      if (index.assessedSkills.has(skill.name.toLowerCase())) {
        sources.push("Assessment");
      }

      if (
        index.projects.some(project =>
          project.technologies.some(
            technology =>
              technology.toLowerCase() === skill.name.toLowerCase()
          )
        )
      ) {
        sources.push("Project technology");
      }
    } else if (projectEvidence) {
      classification = "SUPPORTED";
      sources.push("Project + external link");
    } else if (hasClaimOnly(skill.name, index)) {
      classification = "CLAIMED";
      sources.push("Candidate profile");
    } else {
      classification = "UNKNOWN";
    }

    return {
      skill: skill.name,
      classification,
      evidence: sources,
      level: skill.level
    };
  });

  const githubProjectCount = index.projects.filter(
    project => Boolean(project.github_link)
  ).length;

  const linkedProjectCount = index.projects.filter(
    project =>
      Boolean(project.github_link) ||
      Boolean(project.live_link)
  ).length;

  const verifiedCount = skillResults.filter(
    item => item.classification === "VERIFIED"
  ).length;

  const supportedCount = skillResults.filter(
    item => item.classification === "SUPPORTED"
  ).length;

  const claimedCount = skillResults.filter(
    item => item.classification === "CLAIMED"
  ).length;

  const unknownCount = skillResults.filter(
    item => item.classification === "UNKNOWN"
  ).length;

  return {
    candidate: {
      id: candidate?.user_id || candidate?.id || null,
      name: candidate?.full_name || candidate?.name || "Candidate"
    },
    query: query || "",
    summary: {
      totalSkills: skillResults.length,
      verified: verifiedCount,
      supported: supportedCount,
      claimed: claimedCount,
      inconsistent: 0,
      unknown: unknownCount,
      githubLinkedProjects: githubProjectCount,
      externallyLinkedProjects: linkedProjectCount,
      certifications: index.certifications.length,
      assessments: index.assessments.length
    },
    projects: index.projects || [],
    certifications: index.certifications || [],
    experience: index.experience || [],
    education: index.education || [],
    assessments: index.assessments || [],
    socialProfiles: index.socialProfiles || {},
    skillEvidence: skillResults,
    availableEvidence: {
      github: Boolean(index.socialProfiles.github),
      linkedin: Boolean(index.socialProfiles.linkedin),
      portfolio: Boolean(index.socialProfiles.portfolio),
      projects: index.projects.length > 0,
      certifications: index.certifications.length > 0,
      assessments: index.assessments.length > 0,
      experience: index.experience.length > 0,
      education: index.education.length > 0
    },
    limitations: [
      "A profile claim is not treated as independently verified without supporting evidence.",
      "A repository URL alone does not prove authorship, activity, or proficiency.",
      "LinkedIn or portfolio information should be treated as supporting evidence unless independently validated.",
      "No negative conclusion is drawn solely from missing evidence."
    ]
  };
}

function buildSystemPrompt() {
  return `
You are the Profile Evidence Agent for HireVision AI.

Your responsibility is to evaluate candidate profile claims against evidence that is actually present in the supplied data.

Evaluate:
- Skills
- Work experience
- Projects
- GitHub/repository references
- Portfolio links
- Certifications
- Assessments
- Education
- Other explicitly supplied evidence

Evidence classifications:

VERIFIED:
Use only when the supplied evidence directly and materially supports the claim, such as an explicit certification, assessment result, or concrete project technology with reliable supporting evidence.

SUPPORTED:
Use when multiple profile details reasonably support the claim, such as a skill appearing in projects, experience, or linked portfolio information, but the evidence is not sufficient for independent verification.

CLAIMED:
Use when the candidate lists or states the skill/experience but no meaningful secondary evidence is supplied.

INCONSISTENT:
Use only when two supplied pieces of information clearly conflict with each other. Do not infer inconsistency from missing information.

UNKNOWN:
Use when there is insufficient information to classify the claim.

Important rules:
1. Never invent repositories, commits, certifications, projects, employers, dates, assessments, URLs, or verification results.
2. Never state that a GitHub repository is active unless repository/activity data is actually supplied.
3. A GitHub URL by itself is not proof of authorship or proficiency.
4. A LinkedIn URL by itself is not proof of profile information.
5. Never convert missing evidence into negative evidence.
6. Never accuse, shame, or imply dishonesty by default.
7. Clearly distinguish candidate claims from independently supported evidence.
8. If evidence is insufficient, say exactly what additional evidence would be useful.
9. Be objective, professional, and recruiter-friendly.
10. Return structured JSON only.

Required JSON structure:
{
  "summary": "short evidence assessment",
  "skillEvidence": [
    {
      "skill": "string",
      "classification": "VERIFIED|SUPPORTED|CLAIMED|INCONSISTENT|UNKNOWN",
      "reason": "string",
      "sources": ["string"],
      "confidence": 0-1
    }
  ],
  "experienceEvidence": [],
  "projectEvidence": [],
  "certificationEvidence": [],
  "inconsistencies": [],
  "missingEvidence": [],
  "recommendations": []
}
`;
}

function buildUserPrompt(candidate, query, context) {
  const evidence = extractCandidateEvidence(candidate);

  return `
Analyze this candidate using only the supplied information.

Candidate:
${JSON.stringify(candidate, null, 2)}

Normalized evidence:
${JSON.stringify(evidence, null, 2)}

User query:
${normalizeText(query) || "Provide a complete profile evidence assessment."}

Additional context:
${JSON.stringify(context || {}, null, 2)}

Do not assume that external URLs were opened or verified.
Do not claim live GitHub/LinkedIn verification unless the supplied data explicitly contains that verification evidence.
`;
}

function normalizeLLMResult(result) {
  let parsed = result;

  if (typeof result === "string") {
    const cleaned = result
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return {
        summary: cleaned,
        skillEvidence: [],
        experienceEvidence: [],
        projectEvidence: [],
        certificationEvidence: [],
        inconsistencies: [],
        missingEvidence: [],
        recommendations: []
      };
    }
  }

  if (!parsed || typeof parsed !== "object") {
    return {
      summary: "No structured evidence assessment was returned.",
      skillEvidence: [],
      experienceEvidence: [],
      projectEvidence: [],
      certificationEvidence: [],
      inconsistencies: [],
      missingEvidence: [],
      recommendations: []
    };
  }

  return {
    summary: normalizeText(parsed.summary),
    skillEvidence: safeArray(parsed.skillEvidence),
    experienceEvidence: safeArray(parsed.experienceEvidence),
    projectEvidence: safeArray(parsed.projectEvidence),
    certificationEvidence: safeArray(parsed.certificationEvidence),
    inconsistencies: safeArray(parsed.inconsistencies),
    missingEvidence: safeArray(parsed.missingEvidence),
    recommendations: safeArray(parsed.recommendations)
  };
}

function validateClassification(value) {
  return EVIDENCE_LEVELS.includes(value)
    ? value
    : "UNKNOWN";
}

function sanitizeEvidenceItems(items) {
  return safeArray(items).map(item => {
    if (typeof item === "string") {
      return {
        claim: item,
        classification: "UNKNOWN",
        reason: item,
        sources: [],
        confidence: 0
      };
    }

    return {
      skill: normalizeText(item?.skill),
      claim: normalizeText(item?.claim),
      classification: validateClassification(
        item?.classification
      ),
      reason: normalizeText(
        item?.reason ||
        item?.evidence ||
        item?.explanation
      ),
      sources: safeArray(item?.sources)
        .map(normalizeText)
        .filter(Boolean),
      confidence:
        typeof item?.confidence === "number"
          ? Math.max(0, Math.min(1, item.confidence))
          : 0
    };
  });
}

function sanitizeAnalysis(analysis) {
  return {
    summary:
      analysis.summary ||
      "Evidence assessment completed using the supplied candidate data.",
    skillEvidence: sanitizeEvidenceItems(
      analysis.skillEvidence
    ),
    experienceEvidence: sanitizeEvidenceItems(
      analysis.experienceEvidence
    ),
    projectEvidence: sanitizeEvidenceItems(
      analysis.projectEvidence
    ),
    certificationEvidence: sanitizeEvidenceItems(
      analysis.certificationEvidence
    ),
    inconsistencies: safeArray(
      analysis.inconsistencies
    ).map(item =>
      typeof item === "string"
        ? item
        : normalizeText(
            item?.description ||
            item?.reason ||
            item?.claim
          )
    ).filter(Boolean),
    missingEvidence: safeArray(
      analysis.missingEvidence
    ).map(normalizeText).filter(Boolean),
    recommendations: safeArray(
      analysis.recommendations
    ).map(normalizeText).filter(Boolean)
  };
}

function buildAgentResponse({
  candidate,
  query,
  analysis,
  source
}) {
  const sanitized = sanitizeAnalysis(analysis);

  const allEvidence = [
    ...sanitized.skillEvidence,
    ...sanitized.experienceEvidence,
    ...sanitized.projectEvidence,
    ...sanitized.certificationEvidence
  ];

  const classifications = {
    VERIFIED: allEvidence.filter(
      item => item.classification === "VERIFIED"
    ).length,
    SUPPORTED: allEvidence.filter(
      item => item.classification === "SUPPORTED"
    ).length,
    CLAIMED: allEvidence.filter(
      item => item.classification === "CLAIMED"
    ).length,
    INCONSISTENT: allEvidence.filter(
      item => item.classification === "INCONSISTENT"
    ).length,
    UNKNOWN: allEvidence.filter(
      item => item.classification === "UNKNOWN"
    ).length
  };

  return normalizeAgentResponse({
    success: true,
    status: "completed",
    agent: "profileEvidenceAgent",
    response: sanitized.summary,
    data: {
      candidate: {
        id:
          candidate?.user_id ||
          candidate?.id ||
          null,
        name:
          candidate?.full_name ||
          candidate?.name ||
          "Candidate"
      },
      query: normalizeText(query),
      evidenceClassifications: classifications,
      ...sanitized,
      source,
      evidencePolicy: {
        externalVerificationPerformed: false,
        missingEvidenceIsNotNegativeEvidence: true,
        profileClaimsAreNotAutomaticallyVerified: true
      }
    },
    metadata: {
      grounded: true,
      source,
      generatedAt: new Date().toISOString()
    }
  });
}

async function execute(query, context = {}) {
  const candidates = safeArray(context.candidates);
  const targetCandidateId =
    context.targetCandidateId ||
    context.candidateId;

  const candidate =
    candidates.find(
      item =>
        String(item?.user_id || item?.id) ===
        String(targetCandidateId)
    ) ||
    candidates[0];

  if (!candidate) {
    return failedAgentResponse(
      "profileEvidenceAgent",
      "No candidate details found to inspect profile evidence."
    );
  }

  const localAnalysis = buildLocalEvidenceAnalysis(
    candidate,
    query
  );

  try {
    const llmResult = await callLLM(
      buildSystemPrompt(),
      buildUserPrompt(candidate, query, {
        ...context,
        localEvidence: localAnalysis
      }),
      true
    );

    const parsed = normalizeLLMResult(llmResult);

    return buildAgentResponse({
      candidate,
      query,
      analysis: parsed,
      source: "llm+candidate-data"
    });
  } catch (error) {
    console.error(
      "[ProfileEvidenceAgent] LLM analysis failed:",
      error.message
    );

    return buildAgentResponse({
      candidate,
      query,
      analysis: {
        summary:
          "Evidence assessment was completed from the candidate data available locally. External verification was not performed.",
        skillEvidence: safeArray(localAnalysis.skillEvidence).map(
          item => ({
            skill: item.skill,
            classification: item.classification,
            reason:
              safeArray(item.evidence).length > 0
                ? `Supported by ${safeArray(item.evidence).join(", ")} in the supplied candidate data.`
                : "The supplied candidate profile contains the claim without sufficient secondary evidence.",
            sources: safeArray(item.evidence),
            confidence:
              item.classification === "VERIFIED"
                ? 0.85
                : item.classification === "SUPPORTED"
                  ? 0.65
                  : item.classification === "CLAIMED"
                    ? 0.35
                    : 0.2
          })
        ),
        experienceEvidence: [],
        projectEvidence: safeArray(localAnalysis.projects).map(
          project => ({
            claim: project.title,
            classification:
              project.github_link || project.live_link
                ? "SUPPORTED"
                : "CLAIMED",
            reason:
              project.github_link || project.live_link
                ? "The project has an externally linked resource in the supplied candidate data."
                : "The project is listed without an external resource in the supplied candidate data.",
            sources: [
              project.github_link,
              project.live_link
            ].filter(Boolean),
            confidence:
              project.github_link || project.live_link
                ? 0.65
                : 0.35
          })
        ),
        certificationEvidence:
          safeArray(localAnalysis.certifications).map(
            certification => ({
              claim: certification.name,
              classification:
                certification.credentialUrl
                  ? "SUPPORTED"
                  : "CLAIMED",
              reason:
                certification.credentialUrl
                  ? "A credential URL is present in the supplied candidate data."
                  : "The certification is listed, but no credential URL was supplied.",
              sources:
                certification.credentialUrl
                  ? [certification.credentialUrl]
                  : [],
              confidence:
                certification.credentialUrl
                  ? 0.65
                  : 0.35
            })
          ),
        inconsistencies: [],
        missingEvidence: [
          !localAnalysis.socialProfiles?.github
            ? "GitHub profile or repository evidence"
            : null,
          !localAnalysis.socialProfiles?.linkedin
            ? "LinkedIn profile evidence"
            : null,
          (localAnalysis.assessments?.length || 0) === 0
            ? "Assessment results"
            : null
        ].filter(Boolean),
        recommendations: [
          "Provide concrete repository or portfolio evidence for important technical skills.",
          "Use credential or assessment evidence when available.",
          "Treat profile-only claims as claims rather than independent verification."
        ]
      },
      source: "local-grounded-fallback"
    });
  }
}

async function handleQuery(query, context = {}) {
  return execute(query, context);
}

module.exports = {
  execute,
  handleQuery,
  EVIDENCE_LEVELS,
  extractCandidateEvidence,
  buildLocalEvidenceAnalysis
};