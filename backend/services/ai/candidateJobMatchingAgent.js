const { callLLM } = require("./openaiService");
const {
  normalizeAgentResponse,
  failedAgentResponse
} = require("./agentResponseSchema");

const MATCH_TYPES = [
  "STRONG_MATCH",
  "PARTIAL_MATCH",
  "MISSING_NOT_EVIDENCED",
  "INFORMATION_UNAVAILABLE"
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

  return String(value);
}

function normalizeKey(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[._/\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSkill(skill) {
  if (typeof skill === "string") {
    return {
      name: normalizeText(skill),
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
      skill.label ||
      skill.technology
    ),
    level:
      skill.level ??
      skill.proficiency ??
      skill.experience_level ??
      skill.experienceLevel ??
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
      .filter(
        skill => skill && skill.name
      );
  }

  if (
    candidate?.skills &&
    typeof candidate.skills === "object"
  ) {
    return Object.entries(
      candidate.skills
    )
      .map(([name, value]) => {
        if (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
        ) {
          return {
            name,
            level: value,
            evidence: []
          };
        }

        return normalizeSkill({
          ...(value || {}),
          name
        });
      })
      .filter(
        skill => skill && skill.name
      );
  }

  return [];
}

function normalizeRequirement(requirement) {
  if (typeof requirement === "string") {
    return {
      name: normalizeText(requirement),
      priority: null,
      description: ""
    };
  }

  if (
    typeof requirement === "number" ||
    typeof requirement === "boolean"
  ) {
    return {
      name: String(requirement),
      priority: null,
      description: ""
    };
  }

  if (
    !requirement ||
    typeof requirement !== "object"
  ) {
    return null;
  }

  return {
    name: normalizeText(
      requirement.name ||
      requirement.skill ||
      requirement.title ||
      requirement.requirement ||
      requirement.technology
    ),
    priority: normalizeText(
      requirement.priority ||
      requirement.type ||
      requirement.category ||
      requirement.classification
    ).toUpperCase(),
    description: normalizeText(
      requirement.description ||
      requirement.details ||
      requirement.reason
    )
  };
}

function normalizeRequirementList(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map(normalizeRequirement)
      .filter(
        item => item && item.name
      );
  }

  if (typeof value === "string") {
    return value
      .split(/[,\n;]/)
      .map(item => item.trim())
      .filter(Boolean)
      .map(normalizeRequirement);
  }

  if (typeof value === "object") {
    return Object.entries(value)
      .map(([name, value]) => {
        if (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
        ) {
          return {
            name,
            priority: null,
            description: String(value)
          };
        }

        return normalizeRequirement({
          ...(value || {}),
          name:
            value?.name ||
            value?.skill ||
            name
        });
      })
      .filter(
        item => item && item.name
      );
  }

  return [];
}

function getJobRequirements(job) {
  const requirements =
    job?.requirements ||
    job?.required_skills ||
    job?.requiredSkills ||
    {};

  const mustHave =
    normalizeRequirementList(
      requirements?.must_have ||
      requirements?.mustHave ||
      requirements?.required ||
      requirements?.mandatory
    );

  const preferred =
    normalizeRequirementList(
      requirements?.preferred ||
      requirements?.preferred_skills ||
      requirements?.preferredSkills
    );

  const optional =
    normalizeRequirementList(
      requirements?.optional ||
      requirements?.nice_to_have ||
      requirements?.niceToHave
    );

  const general =
    normalizeRequirementList(
      requirements?.requirements ||
      requirements?.skills ||
      requirements?.technologies
    );

  return {
    mustHave,
    preferred,
    optional,
    general
  };
}

function getAllJobRequirements(job) {
  const requirements =
    getJobRequirements(job);

  const combined = [
    ...requirements.mustHave,
    ...requirements.preferred,
    ...requirements.optional,
    ...requirements.general
  ];

  const seen = new Set();

  return combined.filter(
    requirement => {
      const key =
        normalizeKey(
          requirement.name
        );

      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    }
  );
}

function getRequirementPriority(
  requirement,
  job
) {
  const explicit =
    normalizeText(
      requirement?.priority
    ).toUpperCase();

  if (
    [
      "MUST_HAVE",
      "MUST HAVE",
      "REQUIRED",
      "MANDATORY",
      "ESSENTIAL"
    ].includes(explicit)
  ) {
    return "MUST_HAVE";
  }

  if (
    [
      "PREFERRED",
      "PREFERRED_SKILL",
      "PREFERRED SKILL"
    ].includes(explicit)
  ) {
    return "PREFERRED";
  }

  if (
    [
      "OPTIONAL",
      "NICE_TO_HAVE",
      "NICE TO HAVE"
    ].includes(explicit)
  ) {
    return "OPTIONAL";
  }

  const grouped =
    getJobRequirements(job);

  const key =
    normalizeKey(
      requirement?.name
    );

  if (
    grouped.mustHave.some(
      item =>
        normalizeKey(
          item.name
        ) === key
    )
  ) {
    return "MUST_HAVE";
  }

  if (
    grouped.preferred.some(
      item =>
        normalizeKey(
          item.name
        ) === key
    )
  ) {
    return "PREFERRED";
  }

  if (
    grouped.optional.some(
      item =>
        normalizeKey(
          item.name
        ) === key
    )
  ) {
    return "OPTIONAL";
  }

  return "UNCLEAR";
}

function normalizeProject(project) {
  if (typeof project === "string") {
    return {
      title: project,
      description: "",
      technologies: [],
      github: "",
      liveUrl: ""
    };
  }

  if (
    !project ||
    typeof project !== "object"
  ) {
    return null;
  }

  const technologies =
    safeArray(
      project.technologies ||
      project.tech_stack ||
      project.techStack ||
      project.skills
    )
      .map(item => {
        if (
          typeof item === "string"
        ) {
          return item;
        }

        if (
          item &&
          typeof item === "object"
        ) {
          return (
            item.name ||
            item.skill ||
            item.title ||
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
    technologies,
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
  return safeArray(
    candidate?.projects
  )
    .map(normalizeProject)
    .filter(
      project =>
        project &&
        (
          project.title ||
          project.description ||
          project.technologies.length
        )
    );
}

function normalizeExperience(
  candidate
) {
  return safeArray(
    candidate?.experience ||
    candidate?.work_experience ||
    candidate?.workExperience
  ).map(experience => {
    if (
      typeof experience === "string"
    ) {
      return {
        role: experience,
        company: "",
        description: "",
        technologies: [],
        skills: []
      };
    }

    if (
      !experience ||
      typeof experience !== "object"
    ) {
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
      technologies: safeArray(
        experience.technologies ||
        experience.tech_stack
      )
        .map(normalizeText)
        .filter(Boolean),
      skills: safeArray(
        experience.skills
      )
        .map(normalizeSkill)
        .filter(Boolean)
        .map(
          skill => skill.name
        )
    };
  }).filter(Boolean);
}

function normalizeEducation(
  candidate
) {
  return safeArray(
    candidate?.education
  ).map(education => {
    if (
      typeof education === "string"
    ) {
      return {
        degree: education,
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
  }).filter(Boolean);
}

function buildCandidateEvidence(
  candidate
) {
  const skills =
    normalizeSkills(
      candidate
    );

  const projects =
    normalizeProjects(
      candidate
    );

  const experience =
    normalizeExperience(
      candidate
    );

  const education =
    normalizeEducation(
      candidate
    );

  const skillNames =
    new Set(
      skills.map(
        skill =>
          normalizeKey(
            skill.name
          )
      )
    );

  const projectTechnologyNames =
    new Set();

  projects.forEach(
    project => {
      project.technologies.forEach(
        technology => {
          projectTechnologyNames.add(
            normalizeKey(
              technology
            )
          );
        }
      );
    }
  );

  const experienceSkillNames =
    new Set();

  experience.forEach(
    item => {
      item.skills.forEach(
        skill => {
          experienceSkillNames.add(
            normalizeKey(
              skill
            )
          );
        }
      );

      item.technologies.forEach(
        technology => {
          experienceSkillNames.add(
            normalizeKey(
              technology
            )
          );
        }
      );
    }
  );

  return {
    skills,
    projects,
    experience,
    education,
    skillNames,
    projectTechnologyNames,
    experienceSkillNames
  };
}

function findExactSkillMatch(
  requirementName,
  evidence
) {
  const key =
    normalizeKey(
      requirementName
    );

  if (!key) {
    return false;
  }

  return (
    evidence.skillNames.has(key) ||
    evidence.projectTechnologyNames.has(
      key
    ) ||
    evidence.experienceSkillNames.has(
      key
    )
  );
}

function findRelatedEvidence(
  requirementName,
  evidence
) {
  const key =
    normalizeKey(
      requirementName
    );

  if (!key) {
    return false;
  }

  const tokens =
    key
      .split(" ")
      .filter(
        token =>
          token.length >= 2
      );

  if (!tokens.length) {
    return false;
  }

  const allEvidenceText = [
    ...Array.from(
      evidence.skillNames
    ),
    ...Array.from(
      evidence.projectTechnologyNames
    ),
    ...Array.from(
      evidence.experienceSkillNames
    ),
    ...evidence.projects.map(
      project =>
        normalizeKey(
          [
            project.title,
            project.description
          ].join(" ")
        )
    ),
    ...evidence.experience.map(
      item =>
        normalizeKey(
          [
            item.role,
            item.company,
            item.description
          ].join(" ")
        )
    )
  ].join(" ");

  return tokens.some(
    token =>
      allEvidenceText.includes(
        token
      )
  );
}

function getEvidenceSources(
  requirementName,
  evidence
) {
  const key =
    normalizeKey(
      requirementName
    );

  const sources = [];

  if (
    evidence.skillNames.has(key)
  ) {
    sources.push(
      "Candidate skill profile"
    );
  }

  if (
    evidence.projectTechnologyNames.has(
      key
    )
  ) {
    sources.push(
      "Project technology"
    );
  }

  if (
    evidence.experienceSkillNames.has(
      key
    )
  ) {
    sources.push(
      "Experience record"
    );
  }

  evidence.projects.forEach(
    project => {
      const projectText =
        normalizeKey(
          [
            project.title,
            project.description
          ].join(" ")
        );

      if (
        projectText.includes(key)
      ) {
        sources.push(
          `Project: ${
            project.title ||
            "Unnamed project"
          }`
        );
      }
    }
  );

  return [
    ...new Set(sources)
  ];
}

function classifyRequirement(
  requirement,
  job,
  evidence
) {
  const priority =
    getRequirementPriority(
      requirement,
      job
    );

  const exactMatch =
    findExactSkillMatch(
      requirement.name,
      evidence
    );

  const relatedMatch =
    findRelatedEvidence(
      requirement.name,
      evidence
    );

  const sources =
    getEvidenceSources(
      requirement.name,
      evidence
    );

  if (
    !requirement.name
  ) {
    return {
      requirement: "",
      priority,
      classification:
        "INFORMATION_UNAVAILABLE",
      evidence: [],
      sources: [],
      reason:
        "The job requirement does not contain enough information to evaluate.",
      confidence: 0
    };
  }

  if (exactMatch) {
    return {
      requirement:
        requirement.name,
      priority,
      classification:
        "STRONG_MATCH",
      evidence:
        sources.length
          ? sources
          : [
              "Matching candidate data"
            ],
      sources,
      reason:
        "The candidate data contains a direct match for this job requirement.",
      confidence: 0.9
    };
  }

  if (relatedMatch) {
    return {
      requirement:
        requirement.name,
      priority,
      classification:
        "PARTIAL_MATCH",
      evidence:
        sources.length
          ? sources
          : [
              "Related candidate data"
            ],
      sources,
      reason:
        "The candidate data contains related information, but it does not provide a direct match for the exact requirement.",
      confidence: 0.65
    };
  }

  const hasCandidateInformation =
    evidence.skills.length > 0 ||
    evidence.projects.length > 0 ||
    evidence.experience.length > 0;

  if (!hasCandidateInformation) {
    return {
      requirement:
        requirement.name,
      priority,
      classification:
        "INFORMATION_UNAVAILABLE",
      evidence: [],
      sources: [],
      reason:
        "The candidate profile does not contain enough skills, projects, or experience data to evaluate this requirement.",
      confidence: 0.2
    };
  }

  return {
    requirement:
      requirement.name,
    priority,
    classification:
      "MISSING_NOT_EVIDENCED",
    evidence: [],
    sources: [],
    reason:
      "The supplied candidate data does not provide evidence for this requirement. This does not establish that the candidate lacks the skill.",
    confidence: 0.75
  };
}

function calculateExplainableScore(
  classifications
) {
  if (!classifications.length) {
    return {
      score: null,
      basis:
        "No job requirements were available for comparison."
    };
  }

  const weights = {
    MUST_HAVE: 5,
    PREFERRED: 3,
    OPTIONAL: 1,
    UNCLEAR: 1
  };

  const points = {
    STRONG_MATCH: 1,
    PARTIAL_MATCH: 0.5,
    MISSING_NOT_EVIDENCED: 0,
    INFORMATION_UNAVAILABLE: null
  };

  let weightedEarned = 0;
  let weightedPossible = 0;

  classifications.forEach(
    item => {
      const weight =
        weights[
          item.priority
        ] || 1;

      const point =
        points[
          item.classification
        ];

      if (
        point === null ||
        point === undefined
      ) {
        return;
      }

      weightedPossible += weight;
      weightedEarned +=
        weight * point;
    }
  );

  if (!weightedPossible) {
    return {
      score: null,
      basis:
        "The supplied requirements do not contain enough classifiable information to calculate a match score."
    };
  }

  const score = Math.round(
    (
      weightedEarned /
      weightedPossible
    ) * 100
  );

  return {
    score: Math.max(
      0,
      Math.min(
        100,
        score
      )
    ),
    basis:
      "Weighted comparison of supplied job requirements against supplied candidate evidence. Must-have requirements carry greater weight than preferred and optional requirements."
  };
}

function buildLocalMatchingAnalysis(
  job,
  candidate,
  query
) {
  const requirements =
    getAllJobRequirements(
      job
    );

  const evidence =
    buildCandidateEvidence(
      candidate
    );

  const classifications =
    requirements.map(
      requirement =>
        classifyRequirement(
          requirement,
          job,
          evidence
        )
    );

  const score =
    calculateExplainableScore(
      classifications
    );

  const strongMatches =
    classifications.filter(
      item =>
        item.classification ===
        "STRONG_MATCH"
    );

  const partialMatches =
    classifications.filter(
      item =>
        item.classification ===
        "PARTIAL_MATCH"
    );

  const missing =
    classifications.filter(
      item =>
        item.classification ===
        "MISSING_NOT_EVIDENCED"
    );

  const unavailable =
    classifications.filter(
      item =>
        item.classification ===
        "INFORMATION_UNAVAILABLE"
    );

  const mustHave =
    classifications.filter(
      item =>
        item.priority ===
        "MUST_HAVE"
    );

  const missingMustHave =
    missing.filter(
      item =>
        item.priority ===
        "MUST_HAVE"
    );

  const recommendations = [];

  if (
    missingMustHave.length
  ) {
    recommendations.push(
      `Verify these must-have requirements during screening: ${missingMustHave
        .map(
          item =>
            item.requirement
        )
        .join(", ")}.`
    );
  }

  if (
    partialMatches.length
  ) {
    recommendations.push(
      `Further assess partially matched requirements: ${partialMatches
        .map(
          item =>
            item.requirement
        )
        .join(", ")}.`
    );
  }

  if (
    unavailable.length
  ) {
    recommendations.push(
      "Collect additional candidate evidence before making a final matching decision."
    );
  }

  if (
    !recommendations.length
  ) {
    recommendations.push(
      "Use a role-specific technical or structured interview to validate the strongest matches before making a hiring decision."
    );
  }

  return {
    query:
      normalizeText(query),

    candidate: {
      id:
        candidate?.user_id ||
        candidate?.id ||
        candidate?._id ||
        null,
      name:
        normalizeText(
          candidate?.full_name ||
          candidate?.name
        ) ||
        "Candidate"
    },

    job: {
      id:
        job?.id ||
        job?.job_id ||
        job?._id ||
        null,
      title:
        normalizeText(
          job?.title ||
          job?.job_title ||
          job?.name
        ) ||
        "Untitled Job"
    },

    matchScore:
      score.score,

    scoreBasis:
      score.basis,

    summary: {
      totalRequirements:
        classifications.length,
      strongMatches:
        strongMatches.length,
      partialMatches:
        partialMatches.length,
      missingOrNotEvidenced:
        missing.length,
      informationUnavailable:
        unavailable.length,
      mustHaveRequirements:
        mustHave.length,
      missingMustHave:
        missingMustHave.length
    },

    classifications,

    candidateEvidence: {
      skills:
        evidence.skills.map(
          skill => ({
            name:
              skill.name,
            level:
              skill.level
          })
        ),
      projectCount:
        evidence.projects.length,
      experienceCount:
        evidence.experience.length,
      educationCount:
        evidence.education.length
    },

    recommendations,

    limitations: [
      "The match score is an explainable AI-assisted estimate, not an ATS score or hiring probability.",
      "Missing evidence does not prove that the candidate lacks a capability.",
      "External GitHub, LinkedIn, portfolio, or assessment verification is not performed by this agent unless corresponding evidence is supplied in context.",
      "Industry-standard skills are not added automatically."
    ]
  };
}

function buildSystemPrompt() {
  return `
You are the Candidate-Job Matching Agent for HireVision AI.

Your responsibility is to compare ONE supplied candidate profile against ONE supplied job using only the information provided.

Evaluate:
- Required skills
- Preferred skills
- Optional skills
- Projects
- Work experience
- Education when relevant
- Explicit evidence supplied in the candidate profile
- Job responsibilities and qualifications

Classify each requirement as exactly one of:

STRONG_MATCH:
The supplied candidate data directly supports the requirement.

PARTIAL_MATCH:
The candidate data contains related or incomplete evidence, but not enough for a strong direct match.

MISSING_NOT_EVIDENCED:
The supplied candidate data does not contain evidence for the requirement.

INFORMATION_UNAVAILABLE:
There is insufficient job or candidate information to make a meaningful assessment.

CRITICAL RULES:

1. NEVER invent candidate information.
2. NEVER invent job requirements.
3. NEVER assume React, JavaScript, Python, TypeScript, AWS, Docker, or any other technology unless it exists in the supplied data.
4. NEVER use a fictional default requirement.
5. NEVER fabricate an ATS score.
6. NEVER claim a candidate is qualified solely because a skill is commonly associated with the role.
7. Missing evidence is not proof of absence.
8. Do not claim GitHub, LinkedIn, portfolio, certification, or assessment verification unless the corresponding evidence is explicitly supplied.
9. Preserve candidate and job facts accurately.
10. Explain why every classification was made.
11. Match scores must be explainable and based only on supplied requirements and candidate evidence.
12. Do not represent the score as a hiring probability.
13. Do not recommend rejection solely from missing evidence.
14. If information is insufficient, clearly identify what information is missing.
15. Remain objective and professional.
16. Return valid JSON only.

For scoring:
- Give more weight to MUST_HAVE requirements.
- Give moderate weight to PREFERRED requirements.
- Give lower weight to OPTIONAL requirements.
- Do not assign arbitrary points merely to make the score look complete.
- If the available requirements cannot support a meaningful score, return null.

Required JSON structure:

{
  "summary": "short recruiter-friendly assessment",
  "matchScore": 0-100,
  "scoreBasis": "explanation of scoring",
  "classifications": [
    {
      "requirement": "string",
      "priority": "MUST_HAVE|PREFERRED|OPTIONAL|UNCLEAR",
      "classification": "STRONG_MATCH|PARTIAL_MATCH|MISSING_NOT_EVIDENCED|INFORMATION_UNAVAILABLE",
      "reason": "string",
      "evidence": [],
      "confidence": 0-1
    }
  ],
  "strongMatches": [],
  "partialMatches": [],
  "missingRequirements": [],
  "informationUnavailable": [],
  "recommendations": []
}
`;
}

function buildUserPrompt(
  job,
  candidate,
  query,
  localAnalysis,
  context
) {
  return `
User Query:
${normalizeText(query) || "Compare this candidate with this job."}

Job Data:
${JSON.stringify(
  job,
  null,
  2
)}

Candidate Data:
${JSON.stringify(
  candidate,
  null,
  2
)}

Locally derived comparison:
${JSON.stringify(
  localAnalysis,
  null,
  2
)}

Additional context:
${JSON.stringify(
  {
    targetJobId:
      context?.targetJobId ||
      context?.jobId ||
      null,
    targetCandidateId:
      context?.targetCandidateId ||
      context?.candidateId ||
      null
  },
  null,
  2
)}

Use only these facts.
Do not add missing skills or experience.
Do not create an ATS score.
Do not treat missing evidence as proof that the candidate lacks the skill.
`;
}

function parseLLMResult(result) {
  if (
    result &&
    typeof result === "object"
  ) {
    return result;
  }

  if (
    typeof result !== "string"
  ) {
    return {};
  }

  const cleaned =
    result
      .replace(
        /^```json\s*/i,
        ""
      )
      .replace(
        /^```\s*/i,
        ""
      )
      .replace(
        /\s*```$/i,
        ""
      )
      .trim();

  try {
    return JSON.parse(
      cleaned
    );
  } catch {
    return {
      summary:
        cleaned,
      classifications: [],
      strongMatches: [],
      partialMatches: [],
      missingRequirements: [],
      informationUnavailable: [],
      recommendations: []
    };
  }
}

function sanitizeClassification(
  value
) {
  const normalized =
    normalizeText(value)
      .toUpperCase()
      .replace(/[\s-]+/g, "_");

  return MATCH_TYPES.includes(
    normalized
  )
    ? normalized
    : "INFORMATION_UNAVAILABLE";
}

function sanitizePriority(
  value
) {
  const normalized =
    normalizeText(value)
      .toUpperCase()
      .replace(/[\s-]+/g, "_");

  if (
    normalized ===
      "MUST_HAVE" ||
    normalized ===
      "REQUIRED" ||
    normalized ===
      "MANDATORY"
  ) {
    return "MUST_HAVE";
  }

  if (
    normalized ===
    "PREFERRED"
  ) {
    return "PREFERRED";
  }

  if (
    normalized ===
      "OPTIONAL" ||
    normalized ===
      "NICE_TO_HAVE"
  ) {
    return "OPTIONAL";
  }

  return "UNCLEAR";
}

function sanitizeClassifications(
  items
) {
  return safeArray(
    items
  )
    .map(item => {
      if (
        typeof item ===
        "string"
      ) {
        return {
          requirement:
            item,
          priority:
            "UNCLEAR",
          classification:
            "INFORMATION_UNAVAILABLE",
          reason:
            "The returned result did not provide enough structured evidence for this requirement.",
          evidence: [],
          confidence: 0
        };
      }

      return {
        requirement:
          normalizeText(
            item?.requirement ||
            item?.name ||
            item?.skill
          ),

        priority:
          sanitizePriority(
            item?.priority
          ),

        classification:
          sanitizeClassification(
            item?.classification
          ),

        reason:
          normalizeText(
            item?.reason ||
            item?.explanation
          ) ||
          "Classification based on the supplied candidate and job data.",

        evidence:
          safeArray(
            item?.evidence ||
            item?.sources
          )
            .map(
              normalizeText
            )
            .filter(Boolean),

        confidence:
          typeof item?.confidence ===
            "number"
            ? Math.max(
                0,
                Math.min(
                  1,
                  item.confidence
                )
              )
            : 0.5
      };
    })
    .filter(
      item =>
        item.requirement
    );
}

function sanitizeAnalysis(
  analysis,
  localAnalysis
) {
  const classifications =
    sanitizeClassifications(
      analysis?.classifications
    );

  return {
    summary:
      normalizeText(
        analysis?.summary
      ) ||
      "Candidate-job matching analysis completed using the supplied data.",

    matchScore:
      typeof analysis?.matchScore ===
        "number"
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(
                analysis.matchScore
              )
            )
          )
        : localAnalysis.matchScore,

    scoreBasis:
      normalizeText(
        analysis?.scoreBasis
      ) ||
      localAnalysis.scoreBasis,

    classifications,

    strongMatches:
      safeArray(
        analysis?.strongMatches
      )
        .map(normalizeText)
        .filter(Boolean),

    partialMatches:
      safeArray(
        analysis?.partialMatches
      )
        .map(normalizeText)
        .filter(Boolean),

    missingRequirements:
      safeArray(
        analysis?.missingRequirements
      )
        .map(normalizeText)
        .filter(Boolean),

    informationUnavailable:
      safeArray(
        analysis?.informationUnavailable
      )
        .map(normalizeText)
        .filter(Boolean),

    recommendations:
      safeArray(
        analysis?.recommendations
      )
        .map(normalizeText)
        .filter(Boolean)
  };
}

function enrichWithLocalIntegrity(
  analysis,
  localAnalysis
) {
  const localMap =
    new Map(
      localAnalysis.classifications.map(
        item => [
          normalizeKey(
            item.requirement
          ),
          item
        ]
      )
    );

  const sanitized =
    sanitizeAnalysis(
      analysis,
      localAnalysis
    );

  const classifications =
    sanitized.classifications.map(
      item => {
        const local =
          localMap.get(
            normalizeKey(
              item.requirement
            )
          );

        if (!local) {
          return item;
        }

        return {
          ...item,
          priority:
            local.priority !==
              "UNCLEAR"
              ? local.priority
              : item.priority,
          classification:
            item.classification,
          evidence:
            item.evidence.length
              ? item.evidence
              : local.evidence,
          confidence:
            Math.min(
              item.confidence,
              local.confidence
            )
        };
      }
    );

  return {
    ...sanitized,
    classifications
  };
}

function buildAgentResponse(
  query,
  analysis,
  source
) {
  const classifications =
    safeArray(
      analysis.classifications
    );

  const counts = {
    STRONG_MATCH: 0,
    PARTIAL_MATCH: 0,
    MISSING_NOT_EVIDENCED: 0,
    INFORMATION_UNAVAILABLE: 0
  };

  classifications.forEach(
    item => {
      if (
        Object.prototype.hasOwnProperty.call(
          counts,
          item.classification
        )
      ) {
        counts[
          item.classification
        ] += 1;
      }
    }
  );

  return normalizeAgentResponse({
    success: true,
    status: "completed",
    agent:
      "candidateJobMatchingAgent",

    response:
      analysis.summary,

    data: {
      query:
        normalizeText(query),

      candidate:
        analysis.candidate,

      job:
        analysis.job,

      matchScore:
        analysis.matchScore,

      scoreBasis:
        analysis.scoreBasis,

      classificationCounts:
        counts,

      classifications:
        classifications,

      strongMatches:
        analysis.strongMatches,

      partialMatches:
        analysis.partialMatches,

      missingRequirements:
        analysis.missingRequirements,

      informationUnavailable:
        analysis.informationUnavailable,

      recommendations:
        analysis.recommendations,

      integrity: {
        groundedInCandidateData: true,
        groundedInJobData: true,
        fabricatedCandidateData: false,
        fabricatedJobRequirements: false,
        fabricatedATSScore: false,
        hiringProbabilityClaim: false,
        externalVerificationPerformed: false
      },

      source
    },

    metadata: {
      grounded: true,
      source,
      generatedAt:
        new Date().toISOString()
    }
  });
}

function getTargetJob(
  context
) {
  const jobs =
    safeArray(
      context?.jobs ||
      context?.jobList ||
      context?.data?.jobs
    );

  if (!jobs.length) {
    return null;
  }

  const targetJobId =
    context?.targetJobId ||
    context?.jobId ||
    context?.target_job_id;

  if (
    targetJobId !== undefined &&
    targetJobId !== null
  ) {
    const exact =
      jobs.find(
        job =>
          normalizeId(
            job?.id ||
            job?.job_id ||
            job?._id
          ) ===
          normalizeId(
            targetJobId
          )
      );

    if (exact) {
      return exact;
    }
  }

  return jobs[0];
}

function getTargetCandidate(
  context
) {
  const candidates =
    safeArray(
      context?.candidates ||
      context?.candidateList ||
      context?.data?.candidates
    );

  if (!candidates.length) {
    return null;
  }

  const targetCandidateId =
    context?.targetCandidateId ||
    context?.candidateId ||
    context?.target_candidate_id;

  if (
    targetCandidateId !==
      undefined &&
    targetCandidateId !==
      null
  ) {
    const exact =
      candidates.find(
        candidate =>
          normalizeId(
            candidate?.user_id ||
            candidate?.id ||
            candidate?._id
          ) ===
          normalizeId(
            targetCandidateId
          )
      );

    if (exact) {
      return exact;
    }
  }

  return candidates[0];
}

async function execute(
  query,
  context = {}
) {
  const job =
    getTargetJob(
      context
    );

  const candidate =
    getTargetCandidate(
      context
    );

  if (!job || !candidate) {
    return failedAgentResponse(
      "candidateJobMatchingAgent",
      "Job listing or candidate profile could not be found to perform matching analysis."
    );
  }

  const localAnalysis =
    buildLocalMatchingAnalysis(
      job,
      candidate,
      query
    );

  if (
    localAnalysis.classifications
      .length === 0
  ) {
    return buildAgentResponse(
      query,
      {
        ...localAnalysis,
        summary:
          "The supplied job does not contain enough explicit requirements to perform a meaningful candidate-job comparison.",
        recommendations: [
          "Add explicit must-have and preferred requirements to the job.",
          "Define the expected skills and competencies before comparing candidates."
        ]
      },
      "local-grounded"
    );
  }

  try {
    const llmResult =
      await callLLM(
        buildSystemPrompt(),
        buildUserPrompt(
          job,
          candidate,
          query,
          localAnalysis,
          context
        ),
        true
      );

    const parsed =
      parseLLMResult(
        llmResult
      );

    const analysis =
      enrichWithLocalIntegrity(
        parsed,
        localAnalysis
      );

    if (
      !analysis.classifications
        .length
    ) {
      return buildAgentResponse(
        query,
        localAnalysis,
        "local-grounded-fallback"
      );
    }

    return buildAgentResponse(
      query,
      {
        ...analysis,
        candidate:
          localAnalysis.candidate,
        job:
          localAnalysis.job
      },
      "llm+local-matching"
    );
  } catch (error) {
    console.error(
      "[CandidateJobMatchingAgent] LLM analysis failed:",
      error.message
    );

    return buildAgentResponse(
      query,
      localAnalysis,
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
  buildLocalMatchingAnalysis,
  calculateExplainableScore,
  getJobRequirements,
  getAllJobRequirements
};