const { callLLM } = require("./openaiService");
const {
  normalizeAgentResponse,
  failedAgentResponse
} = require("./agentResponseSchema");

const AGENT_NAME = "candidateComparisonAgent";

const COMPARISON_TYPES = [
  "STRONGER",
  "COMPARABLE",
  "LIMITED",
  "INFORMATION_UNAVAILABLE"
];

const SENSITIVE_TERMS = [
  "gender",
  "sex",
  "male",
  "female",
  "age",
  "religion",
  "caste",
  "race",
  "ethnicity",
  "political",
  "disability",
  "health",
  "medical",
  "sexual orientation",
  "marital",
  "pregnancy",
  "family status"
];

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function normalizeId(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function normalizeKey(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[._/\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clampConfidence(value, fallback = 0.5) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(0, Math.min(1, numeric));
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];

  safeArray(values).forEach(value => {
    const normalized = normalizeText(value);

    if (!normalized) {
      return;
    }

    const key = normalizeKey(normalized);

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(normalized);
  });

  return result;
}

function containsSensitiveAttribute(text) {
  const normalized = normalizeText(text).toLowerCase();

  if (!normalized) {
    return false;
  }

  return SENSITIVE_TERMS.some(term => {
    return normalized.includes(term);
  });
}

function sanitizeTextArray(values) {
  return uniqueStrings(
    safeArray(values).filter(value => {
      if (typeof value !== "string") {
        return false;
      }

      return !containsSensitiveAttribute(value);
    })
  );
}

function normalizeSkill(skill) {
  if (typeof skill === "string") {
    return {
      name: normalizeText(skill),
      level: null
    };
  }

  if (
    typeof skill === "number" ||
    typeof skill === "boolean"
  ) {
    return {
      name: String(skill),
      level: null
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
      skill.label ||
      skill.technology
    ),
    level:
      skill.level ??
      skill.proficiency ??
      skill.experience_level ??
      skill.experienceLevel ??
      null
  };
}

function normalizeSkills(candidate) {
  if (Array.isArray(candidate?.skills)) {
    return candidate.skills
      .map(normalizeSkill)
      .filter(skill => skill && skill.name);
  }

  if (
    candidate?.skills &&
    typeof candidate.skills === "object"
  ) {
    return Object.entries(candidate.skills)
      .map(([name, value]) => {
        if (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
        ) {
          return {
            name,
            level: value
          };
        }

        return normalizeSkill({
          ...(value || {}),
          name:
            value?.name ||
            value?.skill ||
            name
        });
      })
      .filter(skill => skill && skill.name);
  }

  return [];
}

function normalizeProject(project) {
  if (typeof project === "string") {
    return {
      title: normalizeText(project),
      description: "",
      technologies: [],
      github: "",
      liveUrl: ""
    };
  }

  if (!project || typeof project !== "object") {
    return null;
  }

  const technologies = safeArray(
    project.technologies ||
    project.tech_stack ||
    project.techStack ||
    project.skills
  )
    .map(item => {
      if (typeof item === "string") {
        return item;
      }

      if (item && typeof item === "object") {
        return (
          item.name ||
          item.skill ||
          item.title ||
          item.technology ||
          ""
        );
      }

      return "";
    })
    .map(normalizeText)
    .filter(Boolean);

  return {
    title: normalizeText(
      project.title ||
      project.name ||
      project.project_name
    ),
    description: normalizeText(
      project.description ||
      project.summary
    ),
    technologies: uniqueStrings(technologies),
    github: normalizeText(
      project.github_link ||
      project.github ||
      project.repository_url ||
      project.repositoryUrl
    ),
    liveUrl: normalizeText(
      project.live_link ||
      project.liveUrl ||
      project.url
    )
  };
}

function normalizeProjects(candidate) {
  return safeArray(candidate?.projects)
    .map(normalizeProject)
    .filter(Boolean);
}

function normalizeExperience(candidate) {
  return safeArray(
    candidate?.experience ||
    candidate?.work_experience ||
    candidate?.workExperience
  )
    .map(experience => {
      if (typeof experience === "string") {
        return {
          role: normalizeText(experience),
          company: "",
          description: "",
          skills: [],
          technologies: []
        };
      }

      if (!experience || typeof experience !== "object") {
        return null;
      }

      return {
        role: normalizeText(
          experience.role ||
          experience.title ||
          experience.position ||
          experience.job_title
        ),
        company: normalizeText(
          experience.company ||
          experience.organization ||
          experience.employer
        ),
        description: normalizeText(
          experience.description ||
          experience.summary
        ),
        skills: safeArray(experience.skills)
          .map(normalizeSkill)
          .filter(skill => skill && skill.name)
          .map(skill => skill.name),
        technologies: safeArray(
          experience.technologies ||
          experience.tech_stack ||
          experience.techStack
        )
          .map(item => {
            if (typeof item === "string") {
              return item;
            }

            if (item && typeof item === "object") {
              return (
                item.name ||
                item.skill ||
                item.title ||
                item.technology ||
                ""
              );
            }

            return "";
          })
          .map(normalizeText)
          .filter(Boolean)
      };
    })
    .filter(Boolean);
}

function normalizeEducation(candidate) {
  return safeArray(candidate?.education)
    .map(education => {
      if (typeof education === "string") {
        return {
          degree: normalizeText(education),
          field: "",
          institution: ""
        };
      }

      if (!education || typeof education !== "object") {
        return null;
      }

      return {
        degree: normalizeText(
          education.degree ||
          education.course ||
          education.program
        ),
        field: normalizeText(
          education.field ||
          education.specialization ||
          education.major
        ),
        institution: normalizeText(
          education.institution ||
          education.university ||
          education.college
        )
      };
    })
    .filter(Boolean);
}

function getCandidateIdentity(candidate) {
  const id = normalizeId(
    candidate?.user_id ||
    candidate?.id ||
    candidate?._id
  );

  const name =
    normalizeText(
      candidate?.full_name ||
      candidate?.name ||
      candidate?.fullName
    ) || "Candidate";

  return {
    id: id || null,
    name
  };
}

function buildCandidateEvidence(candidate) {
  const skills = normalizeSkills(candidate);
  const projects = normalizeProjects(candidate);
  const experience = normalizeExperience(candidate);
  const education = normalizeEducation(candidate);

  const skillSet = new Set();

  skills.forEach(skill => {
    const key = normalizeKey(skill.name);

    if (key) {
      skillSet.add(key);
    }
  });

  const projectTechnologySet = new Set();

  projects.forEach(project => {
    project.technologies.forEach(technology => {
      const key = normalizeKey(technology);

      if (key) {
        projectTechnologySet.add(key);
      }
    });
  });

  const experienceTechnologySet = new Set();

  experience.forEach(item => {
    item.skills.forEach(skill => {
      const key = normalizeKey(skill);

      if (key) {
        experienceTechnologySet.add(key);
      }
    });

    item.technologies.forEach(technology => {
      const key = normalizeKey(technology);

      if (key) {
        experienceTechnologySet.add(key);
      }
    });
  });

  const allTechnicalTerms = new Set([
    ...skillSet,
    ...projectTechnologySet,
    ...experienceTechnologySet
  ]);

  return {
    skills,
    projects,
    experience,
    education,
    skillSet,
    projectTechnologySet,
    experienceTechnologySet,
    allTechnicalTerms
  };
}

function intersectSets(setA, setB) {
  const result = [];

  setA.forEach(value => {
    if (setB.has(value)) {
      result.push(value);
    }
  });

  return result;
}

function calculatePairSimilarity(candidateA, candidateB) {
  const evidenceA = buildCandidateEvidence(candidateA);
  const evidenceB = buildCandidateEvidence(candidateB);

  const sharedSkills = intersectSets(
    evidenceA.allTechnicalTerms,
    evidenceB.allTechnicalTerms
  );

  const uniqueToA = [
    ...evidenceA.allTechnicalTerms
  ].filter(
    term => !evidenceB.allTechnicalTerms.has(term)
  );

  const uniqueToB = [
    ...evidenceB.allTechnicalTerms
  ].filter(
    term => !evidenceA.allTechnicalTerms.has(term)
  );

  const totalUniqueTerms = new Set([
    ...evidenceA.allTechnicalTerms,
    ...evidenceB.allTechnicalTerms
  ]).size;

  const similarity =
    totalUniqueTerms > 0
      ? Math.round(
          (sharedSkills.length / totalUniqueTerms) * 100
        )
      : null;

  return {
    sharedSkills,
    uniqueToA,
    uniqueToB,
    similarity
  };
}

function getCandidateSummary(candidate) {
  const evidence = buildCandidateEvidence(candidate);

  return {
    identity: getCandidateIdentity(candidate),

    skills: evidence.skills.map(skill => skill.name),

    projects: evidence.projects.map(project => ({
      title: project.title,
      technologies: project.technologies,
      hasGithub: Boolean(project.github),
      hasLiveUrl: Boolean(project.liveUrl)
    })),

    experience: evidence.experience.map(item => ({
      role: item.role,
      company: item.company,
      skills: item.skills,
      technologies: item.technologies
    })),

    education: evidence.education,

    careerObjective: normalizeText(
      candidate?.career_objective ||
      candidate?.careerObjective ||
      candidate?.objective ||
      candidate?.summary
    )
  };
}

function buildComparisonMatrix(candidates) {
  return candidates.map(candidate => {
    const evidence = buildCandidateEvidence(candidate);

    return {
      candidate: getCandidateIdentity(candidate),

      skillCount: evidence.skills.length,
      projectCount: evidence.projects.length,
      experienceCount: evidence.experience.length,
      educationCount: evidence.education.length,

      skills: evidence.skills.map(skill => skill.name),

      projectTechnologies: [
        ...evidence.projectTechnologySet
      ],

      experienceTechnologies: [
        ...evidence.experienceTechnologySet
      ],

      githubLinkedProjects:
        evidence.projects.filter(
          project => Boolean(project.github)
        ).length,

      liveLinkedProjects:
        evidence.projects.filter(
          project => Boolean(project.liveUrl)
        ).length
    };
  });
}

function calculateRelativeStrengths(candidates) {
  if (!candidates.length) {
    return [];
  }

  const matrix = buildComparisonMatrix(candidates);

  const maxSkillCount = Math.max(
    ...matrix.map(item => item.skillCount),
    0
  );

  const maxProjectCount = Math.max(
    ...matrix.map(item => item.projectCount),
    0
  );

  const maxExperienceCount = Math.max(
    ...matrix.map(item => item.experienceCount),
    0
  );

  return matrix.map(item => {
    const strengths = [];

    if (
      maxSkillCount > 0 &&
      item.skillCount === maxSkillCount
    ) {
      strengths.push("Largest supplied skill set");
    }

    if (
      maxProjectCount > 0 &&
      item.projectCount === maxProjectCount
    ) {
      strengths.push("Most supplied projects");
    }

    if (
      maxExperienceCount > 0 &&
      item.experienceCount === maxExperienceCount
    ) {
      strengths.push(
        "Most supplied experience records"
      );
    }

    if (item.githubLinkedProjects > 0) {
      strengths.push(
        "Has supplied GitHub-linked project evidence"
      );
    }

    if (item.liveLinkedProjects > 0) {
      strengths.push(
        "Has supplied live project links"
      );
    }

    return {
      candidate: item.candidate,
      strengths
    };
  });
}

function buildLocalAnalysis(candidates, query) {
  const summaries = candidates.map(
    getCandidateSummary
  );

  const matrix = buildComparisonMatrix(candidates);

  const relativeStrengths =
    calculateRelativeStrengths(candidates);

  const pairwiseComparisons = [];

  for (let i = 0; i < candidates.length; i += 1) {
    for (
      let j = i + 1;
      j < candidates.length;
      j += 1
    ) {
      const comparison = calculatePairSimilarity(
        candidates[i],
        candidates[j]
      );

      pairwiseComparisons.push({
        candidateA: getCandidateIdentity(
          candidates[i]
        ),
        candidateB: getCandidateIdentity(
          candidates[j]
        ),
        ...comparison
      });
    }
  }

  return {
    query: normalizeText(query),

    candidates: summaries,

    comparisonMatrix: matrix,

    relativeStrengths,

    pairwiseComparisons,

    limitations: [
      "The comparison uses only candidate information supplied to the agent.",
      "Skill count, project count, and experience count are descriptive signals, not proof of candidate quality.",
      "A GitHub or portfolio URL alone does not establish authorship or proficiency.",
      "Missing information is not treated as evidence that a candidate lacks a capability.",
      "No ATS score or hiring probability is generated.",
      "No final hiring decision is generated."
    ]
  };
}

function buildSystemPrompt() {
  return `
You are the Candidate Comparison Agent for HireVision AI.

Your task is to compare two or more candidate profiles objectively using ONLY the supplied candidate data and recruiter/job context.

Your comparison must focus on job-relevant evidence such as:
- Technical skills
- Relevant experience
- Projects
- Project technologies
- Education when relevant to the target role
- Explicit achievements when supplied
- Evidence quality
- Skill overlap
- Relevant strengths
- Relevant limitations
- Missing or unavailable information

IMPORTANT FAIRNESS RULES:

Never use, infer, mention, or rank candidates using:
- Gender
- Sex
- Age
- Religion
- Caste
- Race
- Ethnicity
- Political views
- Disability
- Health or medical information
- Sexual orientation
- Marital status
- Pregnancy
- Family status
- Protected personal characteristics
- Sensitive personal information

DATA INTEGRITY RULES:

1. Compare only candidates supplied in the input.
2. Never invent candidate information.
3. Never invent employers, technologies, projects, degrees, certifications, achievements, scores, or URLs.
4. Never fabricate ATS scores.
5. Never claim external verification unless actual verification evidence is supplied.
6. Never treat a URL as proof of authorship or proficiency.
7. Never rank a candidate higher simply because they have more skills.
8. Never rank a candidate higher simply because they have more projects.
9. Never rank a candidate higher simply because they have more experience records.
10. More records do not automatically mean higher quality.
11. Missing information is not evidence that a candidate lacks a capability.
12. Clearly distinguish supplied evidence from inference.
13. If information is unavailable, say so.
14. Do not make a final hiring decision.
15. If a target job is supplied, use only requirements relevant to that job.
16. If no target job is supplied, make a general evidence-based comparison.
17. Do not create requirements that are not supplied.
18. Do not use sensitive attributes directly or as proxies.
19. Do not convert descriptive evidence into unsupported certainty.
20. Return valid JSON only.

Required JSON:

{
  "summary": "short comparison summary",
  "candidateComparisons": [
    {
      "candidateId": "string",
      "candidateName": "string",
      "strengths": [],
      "limitations": [],
      "sharedSkills": [],
      "distinctiveSkills": [],
      "projectEvidence": [],
      "experienceEvidence": [],
      "overallAssessment": "STRONGER|COMPARABLE|LIMITED|INFORMATION_UNAVAILABLE",
      "confidence": 0-1
    }
  ],
  "pairwiseInsights": [
    {
      "candidateA": "candidate name or id",
      "candidateB": "candidate name or id",
      "insight": "objective comparison",
      "evidence": []
    }
  ],
  "recommendation": {
    "preferredCandidate": "candidate ID or null",
    "reason": "evidence-based reason",
    "confidence": 0-1
  },
  "dataLimitations": [],
  "fairnessGuardrails": []
}

If there is no objective evidence for preferring one candidate, preferredCandidate MUST be null.

Never output an invented candidate ID.

Never output an ATS score.

Never make a final hiring decision.
`;
}

function buildUserPrompt(
  candidates,
  query,
  context,
  localAnalysis
) {
  const targetJob = context?.job || null;

  return `
User Query:
${
  normalizeText(query) ||
  "Compare the supplied candidates side-by-side."
}

Candidate Data:
${JSON.stringify(
  candidates,
  null,
  2
)}

Locally Derived Comparison:
${JSON.stringify(
  localAnalysis,
  null,
  2
)}

Recruiter Context:
${JSON.stringify(
  {
    targetJobId:
      context?.targetJobId ||
      context?.jobId ||
      null,

    targetRole:
      context?.targetRole ||
      context?.role ||
      null,

    job: targetJob
  },
  null,
  2
)}

Instructions:
- Use only supplied candidate data.
- Use only supplied job requirements.
- Do not invent missing information.
- Do not use sensitive attributes.
- Do not create ATS scores.
- Do not make a final hiring decision.
- Do not claim external verification unless supplied.
- Missing evidence must remain unavailable rather than being interpreted as negative evidence.
`;
}

function parseLLMResult(result) {
  if (
    result &&
    typeof result === "object"
  ) {
    return result;
  }

  if (typeof result !== "string") {
    return {};
  }

  const cleaned = result
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    return {};
  }
}

function sanitizeAssessment(value) {
  const normalized = normalizeText(value)
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  return COMPARISON_TYPES.includes(normalized)
    ? normalized
    : "INFORMATION_UNAVAILABLE";
}

function candidateKey(candidate) {
  return normalizeId(
    candidate?.user_id ||
    candidate?.id ||
    candidate?._id
  );
}

function buildCandidateMap(candidates) {
  const map = new Map();

  candidates.forEach(candidate => {
    const id = candidateKey(candidate);

    if (id) {
      map.set(id, candidate);
    }
  });

  return map;
}

function sanitizeCandidateComparisons(
  items,
  candidateMap,
  candidates
) {
  const seen = new Set();

  return safeArray(items)
    .map(item => {
      const candidateId = normalizeId(
        item?.candidateId ||
        item?.candidate_id ||
        item?.id
      );

      if (!candidateId) {
        return null;
      }

      const candidate = candidateMap.get(candidateId);

      if (!candidate || seen.has(candidateId)) {
        return null;
      }

      seen.add(candidateId);

      const actualIdentity =
        getCandidateIdentity(candidate);

      return {
        candidateId,

        candidateName:
          actualIdentity.name,

        strengths:
          sanitizeTextArray(
            item?.strengths
          ),

        limitations:
          sanitizeTextArray(
            item?.limitations
          ),

        sharedSkills:
          sanitizeTextArray(
            item?.sharedSkills
          ),

        distinctiveSkills:
          sanitizeTextArray(
            item?.distinctiveSkills
          ),

        projectEvidence:
          sanitizeTextArray(
            item?.projectEvidence
          ),

        experienceEvidence:
          sanitizeTextArray(
            item?.experienceEvidence
          ),

        overallAssessment:
          sanitizeAssessment(
            item?.overallAssessment
          ),

        confidence:
          clampConfidence(
            item?.confidence,
            0.5
          )
      };
    })
    .filter(Boolean);
}

function sanitizePairwiseInsights(items) {
  return safeArray(items)
    .map(item => {
      if (typeof item === "string") {
        if (containsSensitiveAttribute(item)) {
          return null;
        }

        return normalizeText(item);
      }

      if (!item || typeof item !== "object") {
        return null;
      }

      const insight = normalizeText(
        item?.insight ||
        item?.reason ||
        item?.description
      );

      if (
        !insight ||
        containsSensitiveAttribute(insight)
      ) {
        return null;
      }

      return {
        candidateA: normalizeText(
          item?.candidateA ||
          item?.candidate_a
        ),

        candidateB: normalizeText(
          item?.candidateB ||
          item?.candidate_b
        ),

        insight,

        evidence:
          sanitizeTextArray(
            item?.evidence
          )
      };
    })
    .filter(Boolean);
}

function resolveCandidateReference(
  value,
  candidateMap
) {
  const key = normalizeId(value);

  if (!key) {
    return null;
  }

  if (candidateMap.has(key)) {
    return key;
  }

  const normalizedValue = normalizeKey(value);

  for (const [candidateId, candidate] of candidateMap.entries()) {
    const identity = getCandidateIdentity(candidate);

    if (
      normalizeKey(identity.name) ===
      normalizedValue
    ) {
      return candidateId;
    }
  }

  return null;
}

function sanitizeRecommendation(
  recommendation,
  candidateMap
) {
  if (
    !recommendation ||
    typeof recommendation !== "object"
  ) {
    return {
      preferredCandidate: null,
      reason:
        "There is not enough structured information to prefer one candidate.",
      confidence: 0
    };
  }

  const preferredReference =
    recommendation.preferredCandidate ||
    recommendation.preferred_candidate ||
    null;

  const preferredCandidate =
    resolveCandidateReference(
      preferredReference,
      candidateMap
    );

  if (
    preferredReference &&
    !preferredCandidate
  ) {
    return {
      preferredCandidate: null,
      reason:
        "The recommendation referenced a candidate that was not present in the supplied candidate data.",
      confidence: 0
    };
  }

  const reason =
    normalizeText(
      recommendation.reason
    );

  if (containsSensitiveAttribute(reason)) {
    return {
      preferredCandidate: null,
      reason:
        "The recommendation was removed because its reasoning contained unsupported sensitive-attribute criteria.",
      confidence: 0
    };
  }

  return {
    preferredCandidate,

    reason:
      reason ||
      (
        preferredCandidate
          ? "Preference is based only on supplied job-relevant candidate evidence."
          : "There is not enough objective evidence to prefer one candidate."
      ),

    confidence:
      preferredCandidate
        ? clampConfidence(
            recommendation.confidence,
            0.5
          )
        : 0
  };
}

function buildAgentResponse(
  query,
  analysis,
  source
) {
  return normalizeAgentResponse({
    success: true,
    status: "completed",
    agent: AGENT_NAME,

    response:
      analysis.summary ||
      `Compared ${safeArray(
        analysis.candidateComparisons
      ).length} candidate(s).`,

    data: {
      query: normalizeText(query),

      candidateComparisons:
        analysis.candidateComparisons,

      pairwiseInsights:
        analysis.pairwiseInsights,

      recommendation:
        analysis.recommendation,

      dataLimitations:
        analysis.dataLimitations,

      fairnessGuardrails:
        analysis.fairnessGuardrails,

      integrity: {
        groundedInCandidateData: true,
        fabricatedCandidates: false,
        fabricatedATSScore: false,
        sensitiveAttributesUsed: false,
        externalVerificationPerformed: false,
        finalHiringDecisionMade: false
      },

      source
    },

    metadata: {
      grounded: true,
      source,
      candidateCount:
        safeArray(
          analysis.candidateComparisons
        ).length,
      generatedAt:
        new Date().toISOString()
    }
  });
}

function buildLocalFallbackAnalysis(
  candidates,
  query
) {
  const local = buildLocalAnalysis(
    candidates,
    query
  );

  const candidateComparisons =
    candidates.map(candidate => {
      const identity =
        getCandidateIdentity(candidate);

      const evidence =
        buildCandidateEvidence(candidate);

      const strengths = [];

      if (evidence.skills.length) {
        strengths.push(
          `Supplied skills: ${evidence.skills
            .map(skill => skill.name)
            .slice(0, 8)
            .join(", ")}`
        );
      }

      if (evidence.projects.length) {
        strengths.push(
          `${evidence.projects.length} project record(s) supplied`
        );
      }

      if (evidence.experience.length) {
        strengths.push(
          `${evidence.experience.length} experience record(s) supplied`
        );
      }

      const githubProjects =
        evidence.projects.filter(
          project => Boolean(project.github)
        ).length;

      if (githubProjects > 0) {
        strengths.push(
          `${githubProjects} project(s) contain a supplied GitHub link`
        );
      }

      return {
        candidateId: identity.id,
        candidateName: identity.name,

        strengths,

        limitations: [
          "The supplied data does not establish the quality or depth of every listed skill.",
          "External profile links were not independently verified."
        ],

        sharedSkills: [],

        distinctiveSkills:
          evidence.skills
            .map(skill => skill.name),

        projectEvidence:
          evidence.projects
            .slice(0, 5)
            .map(
              project =>
                project.title ||
                "Unnamed project"
            ),

        experienceEvidence:
          evidence.experience
            .slice(0, 5)
            .map(item =>
              [
                item.role,
                item.company
              ]
                .filter(Boolean)
                .join(" at ")
            )
            .filter(Boolean),

        overallAssessment:
          "INFORMATION_UNAVAILABLE",

        confidence: 0.3
      };
    });

  return {
    summary:
      `Compared ${candidates.length} candidate profiles using the information supplied in the system data. No unsupported hiring conclusion was generated.`,

    candidateComparisons,

    pairwiseInsights:
      local.pairwiseComparisons.map(
        comparison => ({
          candidateA:
            comparison.candidateA.name,

          candidateB:
            comparison.candidateB.name,

          insight:
            comparison.similarity !== null
              ? `The supplied technical evidence has ${comparison.similarity}% normalized overlap based on shared technical terms.`
              : "There is insufficient technical data to calculate technical overlap.",

          evidence:
            comparison.sharedSkills
        })
      ),

    recommendation: {
      preferredCandidate: null,

      reason:
        "A reliable hiring preference should be based on explicit job requirements or additional recruiter criteria. No unsupported preference is generated.",

      confidence: 0.2
    },

    dataLimitations:
      local.limitations,

    fairnessGuardrails: [
      "Only job-relevant candidate information is considered.",
      "Sensitive and protected attributes are excluded.",
      "Missing information is not treated as evidence of weakness.",
      "Candidate quality is not inferred from record counts alone."
    ]
  };
}

function mergeMissingCandidateComparisons(
  sanitized,
  candidates
) {
  const existing = new Set(
    sanitized.map(item =>
      normalizeId(item.candidateId)
    )
  );

  const fallback = buildLocalFallbackAnalysis(
    candidates,
    ""
  );

  const missing = fallback.candidateComparisons
    .filter(
      item =>
        item.candidateId &&
        !existing.has(
          normalizeId(item.candidateId)
        )
    );

  return [
    ...sanitized,
    ...missing
  ];
}

async function execute(
  query,
  context = {}
) {
  const allCandidates = safeArray(
    context?.candidates ||
    context?.candidateList ||
    context?.data?.candidates
  ).filter(
    candidate =>
      candidate &&
      typeof candidate === "object"
  );

  const targeted = safeArray(
    context?.targetCandidates ||
    context?.targetedCandidates
  ).filter(c => c && typeof c === "object");

  const candidates = targeted.length >= 2 ? targeted : allCandidates;

  if (candidates.length < 2) {
    return failedAgentResponse(
      AGENT_NAME,
      "Please provide at least two candidate profiles to perform a side-by-side comparison."
    );
  }

  const comparisonCandidates =
    candidates.slice(0, 10);

  const localAnalysis =
    buildLocalAnalysis(
      comparisonCandidates,
      query
    );

  const candidateMap =
    buildCandidateMap(
      comparisonCandidates
    );

  try {
    const llmResult =
      await callLLM(
        buildSystemPrompt(),
        buildUserPrompt(
          comparisonCandidates,
          query,
          context,
          localAnalysis
        ),
        true
      );

    const parsed =
      parseLLMResult(llmResult);

    let candidateComparisons =
      sanitizeCandidateComparisons(
        parsed?.candidateComparisons,
        candidateMap,
        comparisonCandidates
      );

    if (!candidateComparisons.length) {
      return buildAgentResponse(
        query,
        buildLocalFallbackAnalysis(
          comparisonCandidates,
          query
        ),
        "local-grounded-fallback"
      );
    }

    candidateComparisons =
      mergeMissingCandidateComparisons(
        candidateComparisons,
        comparisonCandidates
      );

    const recommendation =
      sanitizeRecommendation(
        parsed?.recommendation,
        candidateMap
      );

    const pairwiseInsights =
      sanitizePairwiseInsights(
        parsed?.pairwiseInsights
      );

    const dataLimitations =
      sanitizeTextArray(
        parsed?.dataLimitations
      );

    const fairnessGuardrails =
      sanitizeTextArray(
        parsed?.fairnessGuardrails
      );

    const safeSummary =
      normalizeText(parsed?.summary);

    return buildAgentResponse(
      query,
      {
        summary:
          safeSummary ||
          `Compared ${candidateComparisons.length} candidate profiles using supplied candidate evidence.`,

        candidateComparisons,

        pairwiseInsights,

        recommendation,

        dataLimitations:
          dataLimitations.length
            ? dataLimitations
            : [
                "Comparison is limited to supplied candidate information.",
                "Missing evidence is not treated as negative evidence."
              ],

        fairnessGuardrails:
          fairnessGuardrails.length
            ? fairnessGuardrails
            : [
                "Only job-relevant information is considered.",
                "Sensitive attributes are excluded."
              ]
      },
      "llm+candidate-comparison"
    );
  } catch (error) {
    console.error(
      "[CandidateComparisonAgent] LLM analysis failed:",
      error?.message || error
    );

    return buildAgentResponse(
      query,
      buildLocalFallbackAnalysis(
        comparisonCandidates,
        query
      ),
      "local-grounded-fallback"
    );
  }
}

async function handleQuery(
  query,
  context = {}
) {
  return execute(
    query,
    context
  );
}

module.exports = {
  execute,
  handleQuery,
  buildLocalAnalysis,
  buildCandidateEvidence,
  calculatePairSimilarity
};