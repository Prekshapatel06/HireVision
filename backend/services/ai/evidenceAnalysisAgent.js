const { callLLM } = require("./openaiService");
const {
  normalizeAgentResponse,
  failedAgentResponse
} = require("./agentResponseSchema");

const AGENT_NAME = "evidenceAnalysisAgent";

const CLASSIFICATIONS = [
  "VERIFIED",
  "SUPPORTED",
  "CLAIMED",
  "INCONSISTENT",
  "UNKNOWN"
];

const CONFIDENCE_LEVELS = [
  "High",
  "Medium",
  "Low"
];

function cleanText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeArray(value) {
  return Array.isArray(value)
    ? value.filter(Boolean)
    : [];
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];

  normalizeArray(values).forEach(value => {
    const text = cleanText(value);

    if (!text) {
      return;
    }

    const key = text.toLowerCase();

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(text);
  });

  return result;
}

function flattenSkills(skills) {
  if (!skills) {
    return [];
  }

  if (Array.isArray(skills)) {
    return uniqueStrings(
      skills
        .map(item => {
          if (typeof item === "string") {
            return item;
          }

          if (
            typeof item === "number" ||
            typeof item === "boolean"
          ) {
            return String(item);
          }

          return (
            item?.name ||
            item?.skill ||
            item?.title ||
            item?.label ||
            item?.technology ||
            ""
          );
        })
    );
  }

  if (typeof skills === "object") {
    return uniqueStrings(
      Object.entries(skills)
        .flatMap(([key, value]) => {
          if (
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean"
          ) {
            return [key, String(value)];
          }

          if (Array.isArray(value)) {
            return value;
          }

          if (value && typeof value === "object") {
            return [
              value.name ||
                value.skill ||
                value.title ||
                value.technology ||
                key
            ];
          }

          return [key];
        })
        .flat(Infinity)
        .map(item => {
          if (typeof item === "string") {
            return item;
          }

          if (
            typeof item === "number" ||
            typeof item === "boolean"
          ) {
            return String(item);
          }

          return (
            item?.name ||
            item?.skill ||
            item?.title ||
            item?.technology ||
            ""
          );
        })
    );
  }

  return [];
}

function normalizeProject(project) {
  if (typeof project === "string") {
    return {
      title: cleanText(project),
      description: "",
      technologies: [],
      github: "",
      liveUrl: ""
    };
  }

  if (!project || typeof project !== "object") {
    return null;
  }

  const technologies = uniqueStrings(
    normalizeArray(
      project.technologies ||
      project.tech_stack ||
      project.techStack ||
      project.skills
    ).map(item => {
      if (typeof item === "string") {
        return item;
      }

      return (
        item?.name ||
        item?.skill ||
        item?.title ||
        item?.technology ||
        ""
      );
    })
  );

  return {
    title: cleanText(
      project.title ||
      project.name ||
      project.project_name
    ),

    description: cleanText(
      project.description ||
      project.summary
    ),

    technologies,

    github: cleanText(
      project.github_link ||
      project.github ||
      project.repository_url ||
      project.repositoryUrl
    ),

    liveUrl: cleanText(
      project.live_link ||
      project.liveUrl ||
      project.url
    )
  };
}

function normalizeProjects(projects) {
  return normalizeArray(projects)
    .map(normalizeProject)
    .filter(Boolean);
}

function normalizeExperienceItem(experience) {
  if (typeof experience === "string") {
    return {
      role: cleanText(experience),
      company: "",
      description: "",
      skills: [],
      technologies: []
    };
  }

  if (
    !experience ||
    typeof experience !== "object"
  ) {
    return null;
  }

  return {
    role: cleanText(
      experience.role ||
      experience.title ||
      experience.position ||
      experience.job_title
    ),

    company: cleanText(
      experience.company ||
      experience.organization ||
      experience.employer
    ),

    description: cleanText(
      experience.description ||
      experience.summary
    ),

    skills: flattenSkills(
      experience.skills
    ),

    technologies: uniqueStrings(
      normalizeArray(
        experience.technologies ||
        experience.tech_stack ||
        experience.techStack
      ).map(item => {
        if (typeof item === "string") {
          return item;
        }

        return (
          item?.name ||
          item?.skill ||
          item?.title ||
          item?.technology ||
          ""
        );
      })
    )
  };
}

function normalizeExperience(experience) {
  return normalizeArray(experience)
    .map(normalizeExperienceItem)
    .filter(Boolean);
}

function normalizeEducationItem(education) {
  if (typeof education === "string") {
    return {
      degree: cleanText(education),
      field: "",
      institution: ""
    };
  }

  if (
    !education ||
    typeof education !== "object"
  ) {
    return null;
  }

  return {
    degree: cleanText(
      education.degree ||
      education.course ||
      education.program
    ),

    field: cleanText(
      education.field ||
      education.specialization ||
      education.major
    ),

    institution: cleanText(
      education.institution ||
      education.university ||
      education.college
    )
  };
}

function normalizeEducation(education) {
  return normalizeArray(education)
    .map(normalizeEducationItem)
    .filter(Boolean);
}

function normalizeCertification(certification) {
  if (typeof certification === "string") {
    return {
      name: cleanText(certification),
      issuer: "",
      credentialId: "",
      url: ""
    };
  }

  if (
    !certification ||
    typeof certification !== "object"
  ) {
    return null;
  }

  return {
    name: cleanText(
      certification.name ||
      certification.title ||
      certification.certification
    ),

    issuer: cleanText(
      certification.issuer ||
      certification.organization ||
      certification.provider
    ),

    credentialId: cleanText(
      certification.credentialId ||
      certification.credential_id ||
      certification.id
    ),

    url: cleanText(
      certification.url ||
      certification.link ||
      certification.credential_url
    )
  };
}

function normalizeCertifications(certifications) {
  return normalizeArray(certifications)
    .map(normalizeCertification)
    .filter(Boolean);
}

function normalizeSocialProfiles(profile) {
  const social =
    profile?.social_profiles &&
    typeof profile.social_profiles === "object"
      ? profile.social_profiles
      : {};

  return {
    github: cleanText(
      social.github ||
      profile?.github
    ),

    linkedin: cleanText(
      social.linkedin ||
      profile?.linkedin
    ),

    portfolio: cleanText(
      social.portfolio ||
      profile?.portfolio ||
      profile?.portfolio_url
    )
  };
}

function normalizeProfile(profile = {}) {
  const internships =
    normalizeExperience(
      profile.internships
    );

  return {
    id:
      profile.user_id ||
      profile.id ||
      profile._id ||
      null,

    full_name: cleanText(
      profile.full_name ||
      profile.name
    ),

    career_objective: cleanText(
      profile.career_objective ||
      profile.careerObjective ||
      profile.objective ||
      profile.summary
    ),

    skills:
      flattenSkills(profile.skills),

    projects:
      normalizeProjects(
        profile.projects
      ),

    certifications:
      normalizeCertifications(
        profile.certifications
      ),

    experience:
      normalizeExperience(
        profile.experience ||
        profile.work_experience ||
        profile.workExperience
      ),

    education:
      normalizeEducation(
        profile.education
      ),

    internships,

    social_profiles:
      normalizeSocialProfiles(profile),

    assessments:
      normalizeArray(
        profile.assessments ||
        profile.assessment_results ||
        profile.tests
      ),

    externalVerification:
      normalizeArray(
        profile.externalVerification ||
        profile.external_verification ||
        profile.verificationEvidence ||
        profile.verification_evidence
      )
  };
}

function getSearchableText(value) {
  try {
    return JSON.stringify(value)
      .toLowerCase();
  } catch {
    return "";
  }
}

function normalizeSearchKey(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[._/\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsTerm(
  text,
  term
) {
  const source =
    normalizeSearchKey(text);

  const target =
    normalizeSearchKey(term);

  if (!source || !target) {
    return false;
  }

  return source.includes(target);
}

function hasGithubEvidence(profile) {
  return Boolean(
    cleanText(
      profile?.social_profiles?.github
    )
  );
}

function hasLinkedInEvidence(profile) {
  return Boolean(
    cleanText(
      profile?.social_profiles?.linkedin
    )
  );
}

function hasExplicitVerificationEvidence(
  profile,
  skill
) {
  const verificationText =
    getSearchableText(
      profile?.externalVerification
    );

  if (!verificationText) {
    return false;
  }

  return containsTerm(
    verificationText,
    skill
  );
}

function classifyLocalEvidence(
  profileInput
) {
  const profile =
    normalizeProfile(
      profileInput
    );

  const projectText =
    getSearchableText(
      profile.projects
    );

  const certificationText =
    getSearchableText(
      profile.certifications
    );

  const experienceText =
    getSearchableText([
      ...profile.experience,
      ...profile.internships
    ]);

  const educationText =
    getSearchableText(
      profile.education
    );

  const assessmentText =
    getSearchableText(
      profile.assessments
    );

  const githubPresent =
    hasGithubEvidence(profile);

  const linkedinPresent =
    hasLinkedInEvidence(profile);

  return profile.skills.map(skill => {
    const inProjects =
      containsTerm(
        projectText,
        skill
      );

    const inCertifications =
      containsTerm(
        certificationText,
        skill
      );

    const inExperience =
      containsTerm(
        experienceText,
        skill
      );

    const inEducation =
      containsTerm(
        educationText,
        skill
      );

    const inAssessments =
      containsTerm(
        assessmentText,
        skill
      );

    const explicitlyVerified =
      hasExplicitVerificationEvidence(
        profile,
        skill
      );

    const supportingSources = [];

    if (inProjects) {
      supportingSources.push(
        "projects"
      );
    }

    if (inCertifications) {
      supportingSources.push(
        "certifications"
      );
    }

    if (inExperience) {
      supportingSources.push(
        "experience"
      );
    }

    if (inEducation) {
      supportingSources.push(
        "education"
      );
    }

    if (inAssessments) {
      supportingSources.push(
        "assessments"
      );
    }

    let classification =
      "CLAIMED";

    let confidence =
      "Low";

    if (explicitlyVerified) {
      classification =
        "VERIFIED";

      confidence =
        "High";
    } else if (
      supportingSources.length >= 2
    ) {
      classification =
        "SUPPORTED";

      confidence =
        "Medium";
    } else if (
      supportingSources.length === 1
    ) {
      classification =
        "SUPPORTED";

      confidence =
        "Medium";
    }

    if (
      !supportingSources.length &&
      !explicitlyVerified
    ) {
      classification =
        "CLAIMED";

      confidence =
        "Low";
    }

    const missingData = [];

    if (
      !inProjects &&
      !inExperience
    ) {
      missingData.push(
        "Practical project or experience evidence"
      );
    }

    if (!inAssessments) {
      missingData.push(
        "Assessment or test evidence"
      );
    }

    if (!githubPresent) {
      missingData.push(
        "Connected GitHub evidence"
      );
    }

    if (!linkedinPresent) {
      missingData.push(
        "Connected LinkedIn evidence"
      );
    }

    return {
      skill,

      classification,

      confidence,

      supporting_sources:
        supportingSources,

      evidence: {
        project_evidence:
          inProjects,

        certification_evidence:
          inCertifications,

        experience_evidence:
          inExperience,

        education_evidence:
          inEducation,

        assessment_evidence:
          inAssessments,

        github_linked:
          githubPresent,

        linkedin_linked:
          linkedinPresent,

        explicit_verification:
          explicitlyVerified
      },

      missing_data:
        uniqueStrings(
          missingData
        )
    };
  });
}

function extractJsonObject(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "object") {
    if (
      value.result &&
      typeof value.result === "object"
    ) {
      return value.result;
    }

    return value;
  }

  const text =
    String(value).trim();

  try {
    return JSON.parse(text);
  } catch {}

  const fenced =
    text.match(
      /```(?:json)?\s*([\s\S]*?)```/i
    );

  if (fenced) {
    try {
      return JSON.parse(
        fenced[1].trim()
      );
    } catch {}
  }

  const start =
    text.indexOf("{");

  const end =
    text.lastIndexOf("}");

  if (
    start !== -1 &&
    end > start
  ) {
    try {
      return JSON.parse(
        text.slice(
          start,
          end + 1
        )
      );
    } catch {}
  }

  return null;
}

function normalizeClassification(
  value
) {
  const classification =
    cleanText(value)
      .toUpperCase()
      .replace(
        /[\s-]+/g,
        "_"
      );

  return CLASSIFICATIONS.includes(
    classification
  )
    ? classification
    : "UNKNOWN";
}

function normalizeConfidence(
  value
) {
  const confidence =
    cleanText(value)
      .toLowerCase();

  if (
    confidence === "high"
  ) {
    return "High";
  }

  if (
    confidence === "medium"
  ) {
    return "Medium";
  }

  if (
    confidence === "low"
  ) {
    return "Low";
  }

  return "Low";
}

function sanitizeSupportingSources(
  sources
) {
  return uniqueStrings(
    normalizeArray(
      sources
    ).map(cleanText)
  ).slice(0, 20);
}

function sanitizeEvidence(
  evidence
) {
  if (
    !evidence ||
    typeof evidence !== "object"
  ) {
    return {};
  }

  return {
    project_evidence:
      Boolean(
        evidence.project_evidence
      ),

    certification_evidence:
      Boolean(
        evidence.certification_evidence
      ),

    experience_evidence:
      Boolean(
        evidence.experience_evidence
      ),

    education_evidence:
      Boolean(
        evidence.education_evidence
      ),

    assessment_evidence:
      Boolean(
        evidence.assessment_evidence
      ),

    github_linked:
      Boolean(
        evidence.github_linked
      ),

    linkedin_linked:
      Boolean(
        evidence.linkedin_linked
      ),

    explicit_verification:
      Boolean(
        evidence.explicit_verification
      )
  };
}

function normalizeClassifications(
  value,
  localEvidence
) {
  const source =
    Array.isArray(value)
      ? value
      : [];

  const localMap =
    new Map(
      localEvidence.map(item => [
        normalizeSearchKey(
          item.skill
        ),
        item
      ])
    );

  const result = [];
  const seen = new Set();

  for (const item of source) {
    const skill =
      cleanText(
        item?.skill ||
        item?.name
      );

    if (!skill) {
      continue;
    }

    const key =
      normalizeSearchKey(skill);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    const local =
      localMap.get(key);

    let classification =
      normalizeClassification(
        item?.classification
      );

    const explicitVerification =
      Boolean(
        item?.evidence
          ?.explicit_verification
      );

    if (
      classification ===
        "VERIFIED" &&
      !explicitVerification &&
      !local?.evidence
        ?.explicit_verification
    ) {
      classification =
        "SUPPORTED";
    }

    result.push({
      skill:
        local?.skill ||
        skill,

      classification,

      confidence:
        normalizeConfidence(
          item?.confidence
        ),

      supporting_sources:
        sanitizeSupportingSources(
          item?.supporting_sources
        ),

      evidence:
        sanitizeEvidence(
          item?.evidence
        ),

      rationale:
        cleanText(
          item?.rationale ||
          item?.reason
        ),

      missing_data:
        uniqueStrings(
          normalizeArray(
            item?.missing_data
          ).map(cleanText)
        )
    });
  }

  for (const item of localEvidence) {
    const key =
      normalizeSearchKey(
        item.skill
      );

    if (
      seen.has(key)
    ) {
      continue;
    }

    result.push({
      ...item,

      rationale:
        "Classification is based on the evidence available in the supplied candidate profile."
    });
  }

  return result;
}

function deriveOverallConfidence(
  classifications
) {
  if (!classifications.length) {
    return "Low";
  }

  const values =
    classifications.map(
      item => item.confidence
    );

  if (
    values.includes("Low")
  ) {
    return "Low";
  }

  if (
    values.includes("Medium")
  ) {
    return "Medium";
  }

  return "High";
}

function collectMissingData(
  classifications
) {
  return uniqueStrings(
    classifications.flatMap(
      item =>
        Array.isArray(
          item.missing_data
        )
          ? item.missing_data
          : []
    )
  );
}

function buildRecommendations(
  classifications
) {
  const recommendations = [];

  const claimed =
    classifications.filter(
      item =>
        item.classification ===
        "CLAIMED"
    );

  const supported =
    classifications.filter(
      item =>
        item.classification ===
        "SUPPORTED"
    );

  if (claimed.length) {
    recommendations.push(
      `Add practical project, experience, assessment, or other relevant evidence for: ${claimed
        .map(item => item.skill)
        .slice(0, 8)
        .join(", ")}.`
    );
  }

  if (supported.length) {
    recommendations.push(
      "Use additional connected or independently verifiable evidence when stronger verification is required."
    );
  }

  if (!recommendations.length) {
    recommendations.push(
      "Maintain current evidence and add explicit verification only where it is genuinely available."
    );
  }

  return recommendations;
}

function buildSystemPrompt() {
  return `
You are HireVision AI's Evidence Analysis Agent.

Your responsibility is to evaluate the strength of evidence supporting candidate skill claims.

Allowed classifications:
- VERIFIED
- SUPPORTED
- CLAIMED
- INCONSISTENT
- UNKNOWN

Definitions:

CLAIMED:
The candidate or profile claims a skill, but meaningful supporting evidence is not supplied.

SUPPORTED:
The supplied profile contains relevant project, experience, education, certification, assessment, or other supporting evidence.

VERIFIED:
Use ONLY when the supplied context contains explicit verification evidence from a reliable connected source or an explicit verification record.

A GitHub URL, LinkedIn URL, portfolio URL, or any other URL alone is NOT verification.

INCONSISTENT:
Use ONLY when supplied evidence contains a clear factual conflict regarding the skill. Do not use this classification merely because evidence is missing or weak.

UNKNOWN:
There is insufficient information to determine the evidence status.

CRITICAL DATA-INTEGRITY RULES:

1. Use only supplied information.
2. Never invent external verification.
3. Never invent GitHub activity.
4. Never invent LinkedIn activity.
5. Never invent projects.
6. Never invent employment.
7. Never invent certifications.
8. Never invent assessments or test results.
9. Never invent technical proficiency.
10. Never create numerical skill scores.
11. Missing evidence is NOT negative evidence.
12. Never accuse a candidate of lying.
13. Never infer dishonesty from missing evidence.
14. A profile URL is not proof of ownership or proficiency.
15. Do not upgrade CLAIMED to VERIFIED without explicit verification evidence.
16. Do not downgrade a skill merely because evidence is incomplete.
17. Distinguish profile claims from supporting evidence.
18. Explain uncertainty clearly.
19. Keep classifications traceable to supplied evidence.
20. Do not use sensitive personal attributes.
21. Return valid JSON only.

Required JSON:

{
  "classifications": [
    {
      "skill": "",
      "classification": "VERIFIED|SUPPORTED|CLAIMED|INCONSISTENT|UNKNOWN",
      "confidence": "Low|Medium|High",
      "supporting_sources": [],
      "evidence": {
        "project_evidence": false,
        "certification_evidence": false,
        "experience_evidence": false,
        "education_evidence": false,
        "assessment_evidence": false,
        "github_linked": false,
        "linkedin_linked": false,
        "explicit_verification": false
      },
      "rationale": "",
      "missing_data": []
    }
  ],
  "confidence": "Low|Medium|High",
  "missing_data": [],
  "recommendations": []
}
`;
}

function buildUserPrompt(
  profile,
  localEvidence,
  context = {}
) {
  return JSON.stringify(
    {
      candidate_profile:
        profile,

      local_evidence:
        localEvidence,

      external_verification_context:
        context?.verificationEvidence ||
        context?.externalVerification ||
        context?.verification ||
        null,

      connected_sources:
        context?.connectedSources ||
        null,

      instructions: [
        "Use only supplied evidence.",
        "Do not invent verification.",
        "A URL alone is not verification.",
        "Missing evidence is not negative evidence.",
        "Use VERIFIED only when explicit verification evidence is supplied.",
        "Return valid JSON only."
      ]
    },
    null,
    2
  );
}

function buildLocalResult(
  profile,
  localEvidence
) {
  return {
    classifications:
      localEvidence,

    confidence:
      deriveOverallConfidence(
        localEvidence
      ),

    missing_data:
      collectMissingData(
        localEvidence
      ),

    recommendations:
      buildRecommendations(
        localEvidence
      ),

    metadata: {
      source:
        "candidate_profile",

      evidence_grounded:
        true,

      externalVerificationPerformed:
        false
    }
  };
}

async function analyzeEvidence(
  profileInput,
  context = {}
) {
  const profile =
    normalizeProfile(
      profileInput
    );

  const localEvidence =
    classifyLocalEvidence(
      profile
    );

  if (!profile.skills.length) {
    return normalizeAgentResponse(
      AGENT_NAME,
      {
        result: {
          classifications: [],
          confidence: "Low",
          missing_data: [
            "Technical skills"
          ],
          recommendations: [
            "Add technical skills to the HireVision profile before running skill-evidence analysis."
          ]
        },

        evidence: [],

        missing_data: [
          "Technical skills"
        ],

        metadata: {
          source:
            "candidate_profile",
          evidence_grounded:
            true
        }
      }
    );
  }

  const systemPrompt =
    buildSystemPrompt();

  const userPrompt =
    buildUserPrompt(
      profile,
      localEvidence,
      context
    );

  try {
    const result =
      await callLLM(
        systemPrompt,
        userPrompt,
        true,
        {
          temperature: 0.1
        }
      );

    const parsed =
      extractJsonObject(
        result
      ) || {};

    const classifications =
      normalizeClassifications(
        parsed.classifications,
        localEvidence
      );

    const confidence =
      normalizeConfidence(
        parsed.confidence ||
        deriveOverallConfidence(
          classifications
        )
      );

    const missingData =
      uniqueStrings([
        ...collectMissingData(
          classifications
        ),
        ...normalizeArray(
          parsed.missing_data
        )
      ]);

    const recommendations =
      uniqueStrings(
        normalizeArray(
          parsed.recommendations
        )
      );

    return normalizeAgentResponse(
      AGENT_NAME,
      {
        result: {
          classifications,
          confidence,
          missing_data:
            missingData,
          recommendations:
            recommendations.length
              ? recommendations
              : buildRecommendations(
                  classifications
                )
        },

        evidence:
          classifications,

        missing_data:
          missingData,

        metadata: {
          source:
            "candidate_profile+llm",
          evidence_grounded:
            true,
          externalVerificationPerformed:
            classifications.some(
              item =>
                item.classification ===
                "VERIFIED"
            )
        }
      }
    );
  } catch (error) {
    console.error(
      "[Evidence Analysis Agent] LLM analysis failed:",
      error?.message || error
    );

    return normalizeAgentResponse(
      AGENT_NAME,
      {
        result:
          buildLocalResult(
            profile,
            localEvidence
          ),

        evidence:
          localEvidence,

        missing_data:
          collectMissingData(
            localEvidence
          )
      },
      {
        error: {
          code:
            "EVIDENCE_AI_ANALYSIS_UNAVAILABLE",
          message:
            "AI evidence synthesis is temporarily unavailable. A grounded local evidence analysis was returned.",
          retryable: true
        }
      }
    );
  }
}

function buildConversationContext(
  context
) {
  const history =
    context?.conversation ||
    context?.history ||
    [];

  return normalizeArray(
    history
  )
    .map(message => {
      if (
        !message ||
        typeof message !== "object"
      ) {
        return null;
      }

      const role =
        cleanText(
          message.role ||
          message.sender
        ).toLowerCase();

      const content =
        cleanText(
          message.content ||
          message.message ||
          message.text
        );

      if (!content) {
        return null;
      }

      return {
        role:
          role === "assistant" ||
          role === "user" ||
          role === "system"
            ? role
            : "user",

        content
      };
    })
    .filter(Boolean)
    .slice(-20);
}

async function handleQuery(
  profile,
  query,
  context = {}
) {
  const normalizedQuery =
    cleanText(query);

  if (!normalizedQuery) {
    return failedAgentResponse(
      AGENT_NAME,
      "Please provide a question about candidate skill evidence or verification."
    );
  }

  const analysis =
    await analyzeEvidence(
      profile,
      context
    );

  const classifications =
    analysis?.result
      ?.classifications ||
    analysis?.classifications ||
    analysis?.evidence ||
    [];

  const missingData =
    analysis?.result
      ?.missing_data ||
    analysis?.missing_data ||
    [];

  if (!classifications.length) {
    return normalizeAgentResponse(
      AGENT_NAME,
      {
        result: {
          response:
            "There is not enough candidate skill information available to perform an evidence analysis.",
          classifications: [],
          missing_data:
            missingData
        }
      }
    );
  }

  const systemPrompt = `
You are HireVision AI's conversational Evidence Analysis Agent.

Answer the user's question using ONLY the supplied evidence analysis.

Rules:
- Explain evidence status clearly.
- VERIFIED requires explicit verification evidence.
- SUPPORTED means relevant supporting evidence exists.
- CLAIMED means the skill is primarily a profile claim.
- INCONSISTENT requires a clear factual conflict.
- UNKNOWN means there is insufficient information.
- Missing evidence is not proof of lack of skill.
- Never accuse a candidate of lying.
- Never invent GitHub activity.
- Never invent LinkedIn activity.
- Never invent verification.
- Never create numerical scores.
- Never make a hiring decision.
- Never use sensitive personal attributes.
- If stronger evidence is needed, explain exactly what type would help.
- Keep the answer professional and conversational.
`;

  const userPrompt =
    JSON.stringify(
      {
        question:
          normalizedQuery,

        evidence:
          classifications,

        overallConfidence:
          analysis?.result
            ?.confidence ||
          "Low",

        missingData,

        conversation:
          buildConversationContext(
            context
          )
      },
      null,
      2
    );

  try {
    return await callLLM(
      systemPrompt,
      userPrompt,
      false,
      {
        conversation:
          buildConversationContext(
            context
          ),
        temperature: 0.2
      }
    );
  } catch (error) {
    console.error(
      "[Evidence Analysis Agent] Query response failed:",
      error?.message || error
    );

    const lines =
      classifications
        .slice(0, 20)
        .map(item => {
          const rationale =
            cleanText(
              item.rationale
            );

          return `- **${item.skill}** — **${item.classification}** (${item.confidence} confidence)${
            rationale
              ? `: ${rationale}`
              : ""
          }`;
        });

    return normalizeAgentResponse(
      AGENT_NAME,
      {
        result: {
          response: [
            "### Skill Evidence Analysis",
            "",
            ...lines,
            "",
            "Missing evidence is treated as uncertainty rather than as a negative judgment.",
            ...(missingData.length
              ? [
                  "",
                  "**Additional evidence that may help:**",
                  ...missingData.map(
                    item =>
                      `- ${item}`
                  )
                ]
              : [])
          ].join("\n"),

          classifications,

          missing_data:
            missingData
        }
      },
      {
        error: {
          code:
            "EVIDENCE_QUERY_AI_UNAVAILABLE",
          message:
            "AI explanation is temporarily unavailable. A grounded evidence summary was returned.",
          retryable: true
        }
      }
    );
  }
}

module.exports = {
  analyzeEvidence,
  handleQuery,
  classifyLocalEvidence
};