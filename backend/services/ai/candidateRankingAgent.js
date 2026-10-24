const { callLLM } = require("./openaiService");
const {
  normalizeAgentResponse,
  failedAgentResponse
} = require("./agentResponseSchema");

const MATCH_CLASSIFICATIONS = [
  "STRONG_MATCH",
  "PARTIAL_MATCH",
  "LIMITED_MATCH",
  "INFORMATION_UNAVAILABLE"
];

const PRIORITIES = [
  "MUST_HAVE",
  "PREFERRED",
  "OPTIONAL",
  "UNCLEAR"
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
      .filter(
        skill =>
          skill &&
          skill.name
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
      .filter(
        skill =>
          skill &&
          skill.name
      );
  }

  return [];
}

function normalizeRequirement(
  requirement
) {
  if (typeof requirement === "string") {
    return {
      name: normalizeText(requirement),
      priority: "UNCLEAR",
      description: ""
    };
  }

  if (
    typeof requirement === "number" ||
    typeof requirement === "boolean"
  ) {
    return {
      name: String(requirement),
      priority: "UNCLEAR",
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
    )
      .toUpperCase()
      .replace(/[\s-]+/g, "_"),
    description: normalizeText(
      requirement.description ||
      requirement.details ||
      requirement.reason
    )
  };
}

function normalizeRequirementList(
  value
) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map(normalizeRequirement)
      .filter(
        item =>
          item &&
          item.name
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
    return Object.entries(
      value
    )
      .map(([name, value]) => {
        if (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
        ) {
          return {
            name,
            priority: "UNCLEAR",
            description:
              String(value)
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
        item =>
          item &&
          item.name
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
    ).map(item => ({
      ...item,
      priority: "MUST_HAVE"
    }));

  const preferred =
    normalizeRequirementList(
      requirements?.preferred ||
      requirements?.preferred_skills ||
      requirements?.preferredSkills
    ).map(item => ({
      ...item,
      priority: "PREFERRED"
    }));

  const optional =
    normalizeRequirementList(
      requirements?.optional ||
      requirements?.nice_to_have ||
      requirements?.niceToHave
    ).map(item => ({
      ...item,
      priority: "OPTIONAL"
    }));

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

function getAllRequirements(job) {
  const grouped =
    getJobRequirements(job);

  const combined = [
    ...grouped.mustHave,
    ...grouped.preferred,
    ...grouped.optional,
    ...grouped.general
  ];

  const seen = new Set();

  return combined.filter(
    item => {
      const key =
        normalizeKey(
          item.name
        );

      if (
        !key ||
        seen.has(key)
      ) {
        return false;
      }

      seen.add(key);

      if (
        !PRIORITIES.includes(
          item.priority
        )
      ) {
        item.priority =
          "UNCLEAR";
      }

      return true;
    }
  );
}

function normalizeProject(
  project
) {
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

function normalizeProjects(
  candidate
) {
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
  )
    .map(experience => {
      if (
        typeof experience ===
        "string"
      ) {
        return {
          role: experience,
          company: "",
          description: "",
          skills: [],
          technologies: []
        };
      }

      if (
        !experience ||
        typeof experience !==
          "object"
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
        description:
          normalizeText(
            experience.description ||
            experience.summary
          ),
        skills:
          safeArray(
            experience.skills
          )
            .map(normalizeSkill)
            .filter(Boolean)
            .map(
              skill =>
                skill.name
            ),
        technologies:
          safeArray(
            experience.technologies ||
            experience.tech_stack
          )
            .map(normalizeText)
            .filter(Boolean)
      };
    })
    .filter(Boolean);
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

  const skillSet =
    new Set(
      skills.map(
        skill =>
          normalizeKey(
            skill.name
          )
      )
    );

  const projectTechnologySet =
    new Set();

  projects.forEach(
    project => {
      project.technologies.forEach(
        technology => {
          projectTechnologySet.add(
            normalizeKey(
              technology
            )
          );
        }
      );
    }
  );

  const experienceTechnologySet =
    new Set();

  experience.forEach(
    item => {
      item.skills.forEach(
        skill => {
          experienceTechnologySet.add(
            normalizeKey(
              skill
            )
          );
        }
      );

      item.technologies.forEach(
        technology => {
          experienceTechnologySet.add(
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
    skillSet,
    projectTechnologySet,
    experienceTechnologySet
  };
}

function hasExactMatch(
  requirement,
  evidence
) {
  const key =
    normalizeKey(
      requirement.name
    );

  return (
    evidence.skillSet.has(key) ||
    evidence.projectTechnologySet.has(
      key
    ) ||
    evidence.experienceTechnologySet.has(
      key
    )
  );
}

function hasRelatedMatch(
  requirement,
  evidence
) {
  const key =
    normalizeKey(
      requirement.name
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

  const searchableText = [
    ...Array.from(
      evidence.skillSet
    ),
    ...Array.from(
      evidence.projectTechnologySet
    ),
    ...Array.from(
      evidence.experienceTechnologySet
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
      searchableText.includes(
        token
      )
  );
}

function getEvidenceSources(
  requirement,
  evidence
) {
  const key =
    normalizeKey(
      requirement.name
    );

  const sources = [];

  if (
    evidence.skillSet.has(key)
  ) {
    sources.push(
      "Candidate skill profile"
    );
  }

  if (
    evidence.projectTechnologySet.has(
      key
    )
  ) {
    sources.push(
      "Project technology"
    );
  }

  if (
    evidence.experienceTechnologySet.has(
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

function classifyCandidateForJob(
  job,
  candidate
) {
  const requirements =
    getAllRequirements(
      job
    );

  const evidence =
    buildCandidateEvidence(
      candidate
    );

  const classifications =
    requirements.map(
      requirement => {
        const exact =
          hasExactMatch(
            requirement,
            evidence
          );

        const related =
          hasRelatedMatch(
            requirement,
            evidence
          );

        const sources =
          getEvidenceSources(
            requirement,
            evidence
          );

        if (exact) {
          return {
            requirement:
              requirement.name,
            priority:
              requirement.priority,
            classification:
              "STRONG_MATCH",
            evidence:
              sources,
            reason:
              "The candidate data directly contains this requirement in skills, project technologies, or relevant experience.",
            confidence: 0.9
          };
        }

        if (related) {
          return {
            requirement:
              requirement.name,
            priority:
              requirement.priority,
            classification:
              "PARTIAL_MATCH",
            evidence:
              sources,
            reason:
              "The candidate data contains related evidence, but there is no direct exact match.",
            confidence: 0.65
          };
        }

        const hasCandidateData =
          evidence.skills.length >
            0 ||
          evidence.projects.length >
            0 ||
          evidence.experience.length >
            0;

        if (!hasCandidateData) {
          return {
            requirement:
              requirement.name,
            priority:
              requirement.priority,
            classification:
              "INFORMATION_UNAVAILABLE",
            evidence: [],
            reason:
              "The candidate profile does not contain enough technical profile information to evaluate this requirement.",
            confidence: 0.2
          };
        }

        return {
          requirement:
            requirement.name,
          priority:
            requirement.priority,
          classification:
            "LIMITED_MATCH",
          evidence: [],
          reason:
            "No supporting evidence for this requirement was found in the supplied candidate profile. This does not prove the candidate lacks the capability.",
          confidence: 0.75
        };
      }
    );

  return classifications;
}

function calculateCandidateScore(
  classifications
) {
  if (
    !classifications.length
  ) {
    return {
      score: null,
      basis:
        "No explicit job requirements were supplied."
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
    LIMITED_MATCH: 0,
    INFORMATION_UNAVAILABLE: null
  };

  let earned = 0;
  let possible = 0;

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

      possible += weight;
      earned +=
        weight * point;
    }
  );

  if (!possible) {
    return {
      score: null,
      basis:
        "Insufficient classifiable requirement data was available."
    };
  }

  const score =
    Math.round(
      (earned / possible) *
        100
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
      "Score is calculated from explicit job requirements and supplied candidate evidence. MUST_HAVE requirements receive the highest weight, followed by PREFERRED and OPTIONAL requirements."
  };
}

function rankCandidatesLocally(
  job,
  candidates
) {
  return candidates
    .map(candidate => {
      const classifications =
        classifyCandidateForJob(
          job,
          candidate
        );

      const score =
        calculateCandidateScore(
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
            "LIMITED_MATCH"
        );

      const unavailable =
        classifications.filter(
          item =>
            item.classification ===
            "INFORMATION_UNAVAILABLE"
        );

      const missingMustHave =
        missing.filter(
          item =>
            item.priority ===
            "MUST_HAVE"
        );

      return {
        candidate,
        score:
          score.score,
        scoreBasis:
          score.basis,
        classifications,
        strongMatches,
        partialMatches,
        missing,
        unavailable,
        missingMustHave
      };
    })
    .sort(
      (a, b) => {
        if (
          a.score === null &&
          b.score === null
        ) {
          return 0;
        }

        if (
          a.score === null
        ) {
          return 1;
        }

        if (
          b.score === null
        ) {
          return -1;
        }

        return (
          b.score -
          a.score
        );
      }
    );
}

function buildCandidateContext(
  rankedCandidate
) {
  const candidate =
    rankedCandidate.candidate;

  return {
    id:
      candidate?.user_id ||
      candidate?.id ||
      candidate?._id ||
      null,

    full_name:
      normalizeText(
        candidate?.full_name ||
        candidate?.name
      ) || "Candidate",

    skills:
      normalizeSkills(
        candidate
      ),

    projects:
      safeArray(
        candidate?.projects
      ),

    experience:
      safeArray(
        candidate?.experience ||
        candidate?.work_experience ||
        candidate?.workExperience
      ),

    education:
      safeArray(
        candidate?.education
      ),

    career_objective:
      normalizeText(
        candidate?.career_objective ||
        candidate?.careerObjective ||
        candidate?.objective ||
        candidate?.summary
      ),

    localAnalysis: {
      score:
        rankedCandidate.score,
      strongMatches:
        rankedCandidate.strongMatches.map(
          item =>
            item.requirement
        ),
      partialMatches:
        rankedCandidate.partialMatches.map(
          item =>
            item.requirement
        ),
      missingMustHave:
        rankedCandidate.missingMustHave.map(
          item =>
            item.requirement
        )
    }
  };
}

function buildSystemPrompt() {
  return `
You are the Candidate Ranking Agent for HireVision AI.

Your job is to rank supplied candidates for a supplied job using ONLY job-relevant information.

Allowed evaluation factors:
- Explicit job requirements
- Technical skills
- Relevant experience
- Relevant projects
- Relevant education when it is part of the job requirements
- Evidence explicitly supplied in the candidate profile

NEVER use or mention protected or sensitive attributes, including:
- Gender
- Age
- Religion
- Caste
- Ethnicity
- Race
- Political views
- Disability
- Health information
- Sexual orientation
- Marital status
- Nationality when used as a proxy for protected status
- Any other sensitive personal characteristic

CRITICAL DATA INTEGRITY RULES:

1. Never invent candidate information.
2. Never invent job requirements.
3. Never fabricate ATS scores.
4. Never fabricate GitHub verification.
5. Never fabricate certifications.
6. Never claim a project is verified unless supporting evidence is supplied.
7. Never assume a technology is required simply because it is common for the role.
8. Missing information must not automatically be treated as a negative.
9. Do not rank candidates based on number of skills alone.
10. Do not rank candidates based on number of projects alone.
11. Prioritize actual alignment with the supplied job requirements.
12. Give higher weight to explicit MUST_HAVE requirements.
13. Consider relevant evidence from projects and experience.
14. Explain why each candidate received their position.
15. A relevance score is an AI-assisted comparison score, NOT an ATS score, hiring probability, or guarantee of employment.
16. Do not make final hiring decisions.
17. If requirements are insufficient, explicitly state that ranking confidence is limited.
18. If candidate data is insufficient, mark information as unavailable.
19. Never claim that a candidate is objectively better as a person.
20. Remain professional, neutral, and job-related.
21. Return valid JSON only.

Required JSON:

{
  "summary": "short ranking summary",
  "rankings": [
    {
      "rank": 1,
      "candidateId": "string",
      "candidateName": "string",
      "relevanceScore": 0-100,
      "matchClassification": "STRONG_MATCH|PARTIAL_MATCH|LIMITED_MATCH|INFORMATION_UNAVAILABLE",
      "matchedRequirements": [],
      "partialRequirements": [],
      "missingRequirements": [],
      "reason": "explainable job-related reasoning",
      "confidence": 0-1
    }
  ],
  "rankingMethod": "string",
  "fairnessGuardrails": [],
  "dataLimitations": [],
  "recommendations": []
}

Only rank candidates present in the supplied data.
`;
}

function buildUserPrompt(
  job,
  rankedCandidates,
  query,
  context
) {
  const candidates =
    rankedCandidates.map(
      buildCandidateContext
    );

  return `
Recruiter Query:
${normalizeText(query) || "Rank candidates for this job."}

Job:
${JSON.stringify(
  job,
  null,
  2
)}

Candidates:
${JSON.stringify(
  candidates,
  null,
  2
)}

Additional Context:
${JSON.stringify(
  {
    targetJobId:
      context?.targetJobId ||
      context?.jobId ||
      null
  },
  null,
  2
)}

Rank ONLY the supplied candidates.
Use ONLY job-relevant information.
Do not infer sensitive attributes.
Do not invent missing evidence.
`;
}

function parseLLMResult(
  result
) {
  if (
    result &&
    typeof result === "object"
  ) {
    return result;
  }

  if (
    typeof result !==
    "string"
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
    return {};
  }
}

function sanitizeMatchClassification(
  value
) {
  const normalized =
    normalizeText(value)
      .toUpperCase()
      .replace(/[\s-]+/g, "_");

  return MATCH_CLASSIFICATIONS.includes(
    normalized
  )
    ? normalized
    : "INFORMATION_UNAVAILABLE";
}

function sanitizeRankings(
  rankings,
  candidateMap,
  localRankings
) {
  const localMap =
    new Map(
      localRankings.map(item => [
        normalizeId(
          item.candidate?.user_id ||
          item.candidate?.id ||
          item.candidate?._id
        ),
        item
      ])
    );

  const seen = new Set();

  return safeArray(
    rankings
  )
    .map(item => {
      const candidateId =
        item?.candidateId ||
        item?.candidate_id ||
        item?.id;

      const key =
        normalizeId(
          candidateId
        );

      const candidate =
        candidateMap.get(
          key
        );

      const local =
        localMap.get(
          key
        );

      if (
        !candidate ||
        seen.has(key)
      ) {
        return null;
      }

      seen.add(key);

      let relevanceScore =
        typeof item?.relevanceScore ===
          "number"
          ? Math.max(
              0,
              Math.min(
                100,
                Math.round(
                  item.relevanceScore
                )
              )
            )
          : local?.score ??
            null;

      if (
        relevanceScore !==
          null &&
        local?.score !==
          null &&
        typeof local?.score ===
          "number"
      ) {
        relevanceScore =
          Math.round(
            (
              relevanceScore +
              local.score
            ) / 2
          );
      }

      return {
        rank:
          typeof item?.rank ===
            "number"
            ? item.rank
            : null,

        candidateId:
          candidateId ||
          candidate?.user_id ||
          candidate?.id ||
          candidate?._id ||
          null,

        candidateName:
          normalizeText(
            item?.candidateName ||
            item?.candidate_name ||
            candidate?.full_name ||
            candidate?.name
          ) || "Candidate",

        relevanceScore,

        matchClassification:
          sanitizeMatchClassification(
            item?.matchClassification ||
            item?.classification
          ),

        matchedRequirements:
          safeArray(
            item?.matchedRequirements
          )
            .map(normalizeText)
            .filter(Boolean),

        partialRequirements:
          safeArray(
            item?.partialRequirements
          )
            .map(normalizeText)
            .filter(Boolean),

        missingRequirements:
          safeArray(
            item?.missingRequirements
          )
            .map(normalizeText)
            .filter(Boolean),

        reason:
          normalizeText(
            item?.reason
          ) ||
          "Ranking is based on the supplied job and candidate information.",

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
    .filter(Boolean)
    .sort(
      (a, b) => {
        if (
          a.relevanceScore ===
            null &&
          b.relevanceScore ===
            null
        ) {
          return 0;
        }

        if (
          a.relevanceScore ===
          null
        ) {
          return 1;
        }

        if (
          b.relevanceScore ===
          null
        ) {
          return -1;
        }

        return (
          b.relevanceScore -
          a.relevanceScore
        );
      }
    )
    .map(
      (item, index) => ({
        ...item,
        rank:
          index + 1
      })
    );
}

function buildLocalRankings(
  rankedCandidates
) {
  return rankedCandidates.map(
    (item, index) => ({
      rank:
        index + 1,

      candidateId:
        item.candidate?.user_id ||
        item.candidate?.id ||
        item.candidate?._id ||
        null,

      candidateName:
        normalizeText(
          item.candidate?.full_name ||
          item.candidate?.name
        ) ||
        "Candidate",

      relevanceScore:
        item.score,

      matchClassification:
        item.score === null
          ? "INFORMATION_UNAVAILABLE"
          : item.score >= 75
            ? "STRONG_MATCH"
            : item.score >= 40
              ? "PARTIAL_MATCH"
              : "LIMITED_MATCH",

      matchedRequirements:
        item.strongMatches.map(
          match =>
            match.requirement
        ),

      partialRequirements:
        item.partialMatches.map(
          match =>
            match.requirement
        ),

      missingRequirements:
        item.missing.map(
          match =>
            match.requirement
        ),

      reason:
        item.score === null
          ? "Insufficient requirement data is available for a meaningful ranking."
          : `The candidate received a ${item.score}% job-relevance score based on the supplied requirements and candidate evidence.`,

      confidence:
        item.score === null
          ? 0.2
          : Math.min(
              0.95,
              0.5 +
                (
                  item.classifications
                    .length /
                  Math.max(
                    1,
                    item.classifications
                      .length
                  )
                ) *
                0.45
            )
    })
  );
}

function buildAgentResponse(
  job,
  query,
  analysis,
  source
) {
  return normalizeAgentResponse({
    success: true,
    status: "completed",
    agent:
      "candidateRankingAgent",

    response:
      analysis.summary ||
      `Ranked ${safeArray(
        analysis.rankings
      ).length} candidate(s) using the supplied job-relevant data.`,

    data: {
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

      query:
        normalizeText(query),

      rankings:
        analysis.rankings,

      rankingMethod:
        analysis.rankingMethod,

      fairnessGuardrails:
        analysis.fairnessGuardrails,

      dataLimitations:
        analysis.dataLimitations,

      recommendations:
        analysis.recommendations,

      integrity: {
        groundedInJobData: true,
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
      generatedAt:
        new Date().toISOString()
    }
  });
}

async function execute(
  query,
  context = {}
) {
  const jobs =
    safeArray(
      context?.jobs ||
      context?.jobList ||
      context?.data?.jobs
    );

  const candidates =
    safeArray(
      context?.candidates ||
      context?.candidateList ||
      context?.data?.candidates
    );

  if (!candidates.length) {
    return failedAgentResponse(
      "candidateRankingAgent",
      "No candidates are currently available to rank."
    );
  }

  if (!jobs.length) {
    return failedAgentResponse(
      "candidateRankingAgent",
      "No job listing is currently available for candidate ranking."
    );
  }

  const targetJobId =
    context?.targetJobId ||
    context?.jobId ||
    context?.target_job_id;

  let job = null;

  if (
    targetJobId !==
      undefined &&
    targetJobId !==
      null
  ) {
    job =
      jobs.find(
        item =>
          normalizeId(
            item?.id ||
            item?.job_id ||
            item?._id
          ) ===
          normalizeId(
            targetJobId
          )
      ) || null;
  }

  job =
    job ||
    jobs[0];

  const requirements =
    getAllRequirements(
      job
    );

  const localRankings =
    rankCandidatesLocally(
      job,
      candidates
    );

  if (
    !requirements.length
  ) {
    return buildAgentResponse(
      job,
      query,
      {
        summary:
          "The selected job does not contain explicit requirements, so a reliable job-specific candidate ranking cannot be calculated.",
        rankings:
          candidates.map(
            (candidate, index) => ({
              rank:
                index + 1,
              candidateId:
                candidate?.user_id ||
                candidate?.id ||
                candidate?._id ||
                null,
              candidateName:
                normalizeText(
                  candidate?.full_name ||
                  candidate?.name
                ) ||
                "Candidate",
              relevanceScore:
                null,
              matchClassification:
                "INFORMATION_UNAVAILABLE",
              matchedRequirements: [],
              partialRequirements: [],
              missingRequirements: [],
              reason:
                "No explicit job requirements were supplied for comparison.",
              confidence: 0.1
            })
          ),
        rankingMethod:
          "No ranking score was generated because the job does not contain enough explicit requirements.",
        fairnessGuardrails: [
          "Ranking is limited to job-relevant information.",
          "Sensitive or protected attributes are excluded."
        ],
        dataLimitations: [
          "Explicit job requirements are missing."
        ],
        recommendations: [
          "Define must-have and preferred requirements for the job before ranking candidates.",
          "Specify the technical skills, experience, and competencies required for the role."
        ]
      },
      "local-grounded"
    );
  }

  const candidateMap =
    new Map(
      candidates.map(
        candidate => [
          normalizeId(
            candidate?.user_id ||
            candidate?.id ||
            candidate?._id
          ),
          candidate
        ]
      )
    );

  try {
    const llmResult =
      await callLLM(
        buildSystemPrompt(),
        buildUserPrompt(
          job,
          localRankings,
          query,
          context
        ),
        true
      );

    const parsed =
      parseLLMResult(
        llmResult
      );

    const rankings =
      sanitizeRankings(
        parsed?.rankings,
        candidateMap,
        localRankings
      );

    if (!rankings.length) {
      return buildAgentResponse(
        job,
        query,
        {
          summary:
            "The AI ranking response did not contain usable candidate rankings, so the evidence-based local ranking was returned.",
          rankings:
            buildLocalRankings(
              localRankings
            ),
          rankingMethod:
            "Evidence-based comparison against explicit job requirements.",
          fairnessGuardrails: [
            "Only job-relevant skills, experience, projects, and explicitly relevant education are considered.",
            "Sensitive and protected attributes are excluded."
          ],
          dataLimitations: [
            "Ranking is limited to the information present in the supplied candidate profiles.",
            "Missing evidence is not treated as proof that a candidate lacks a capability."
          ],
          recommendations: [
            "Validate top-ranked candidates through consistent role-specific screening.",
            "Collect additional evidence for important requirements that are currently unavailable."
          ]
        },
        "local-grounded-fallback"
      );
    }

    return buildAgentResponse(
      job,
      query,
      {
        summary:
          normalizeText(
            parsed?.summary
          ) ||
          `Ranked ${rankings.length} candidate(s) based on job-relevant evidence.`,

        rankings,

        rankingMethod:
          normalizeText(
            parsed?.rankingMethod
          ) ||
          "Candidates were ranked using explicit job requirements and supplied job-relevant candidate evidence.",

        fairnessGuardrails:
          safeArray(
            parsed?.fairnessGuardrails
          )
            .map(normalizeText)
            .filter(Boolean),

        dataLimitations:
          safeArray(
            parsed?.dataLimitations
          )
            .map(normalizeText)
            .filter(Boolean),

        recommendations:
          safeArray(
            parsed?.recommendations
          )
            .map(normalizeText)
            .filter(Boolean)
      },
      "llm+local-ranking"
    );
  } catch (error) {
    console.error(
      "[CandidateRankingAgent] LLM analysis failed:",
      error.message
    );

    return buildAgentResponse(
      job,
      query,
      {
        summary:
          `Ranked ${localRankings.length} candidate(s) using an evidence-based local comparison because the AI analysis was unavailable.`,

        rankings:
          buildLocalRankings(
            localRankings
          ),

        rankingMethod:
          "Weighted comparison of explicit job requirements against supplied candidate skills, projects, and relevant experience.",

        fairnessGuardrails: [
          "Only job-relevant information is used.",
          "Sensitive and protected attributes are excluded.",
          "Missing information is not treated as proof of absence."
        ],

        dataLimitations: [
          "External profiles and repositories were not independently verified.",
          "The ranking uses only data supplied in the current context."
        ],

        recommendations: [
          "Use the ranking as a screening aid rather than a final hiring decision.",
          "Validate critical requirements using consistent role-specific assessments."
        ]
      },
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
  getJobRequirements,
  getAllRequirements,
  classifyCandidateForJob,
  calculateCandidateScore,
  rankCandidatesLocally
};