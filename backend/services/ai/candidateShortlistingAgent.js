const { callLLM } = require("./openaiService");
const {
  normalizeAgentResponse,
  failedAgentResponse
} = require("./agentResponseSchema");

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

function extractSkills(candidate) {
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
          typeof value === "number"
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

function extractProjects(candidate) {
  return safeArray(candidate?.projects)
    .map(normalizeProject)
    .filter(Boolean);
}

function normalizeExperience(experience) {
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
      .filter(Boolean)
      .map(skill => skill.name),
    technologies: safeArray(
      experience.technologies ||
      experience.tech_stack
    )
      .map(normalizeText)
      .filter(Boolean)
  };
}

function extractExperience(candidate) {
  return safeArray(
    candidate?.experience ||
    candidate?.work_experience ||
    candidate?.workExperience
  )
    .map(normalizeExperience)
    .filter(Boolean);
}

function normalizeEducation(education) {
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
}

function extractEducation(candidate) {
  return safeArray(candidate?.education)
    .map(normalizeEducation)
    .filter(Boolean);
}

function normalizeJob(job) {
  if (!job || typeof job !== "object") {
    return null;
  }

  return {
    id:
      job.id ||
      job.job_id ||
      job._id ||
      null,

    title:
      normalizeText(
        job.title ||
        job.job_title ||
        job.position ||
        job.role
      ) || "Untitled Job",

    description: normalizeText(
      job.description ||
      job.job_description ||
      job.summary
    ),

    requirements:
      job.requirements ||
      job.required_skills ||
      job.requiredSkills ||
      [],

    preferredSkills:
      job.preferred_skills ||
      job.preferredSkills ||
      job.nice_to_have ||
      [],

    responsibilities:
      safeArray(
        job.responsibilities
      )
        .map(normalizeText)
        .filter(Boolean),

    experience:
      job.experience ||
      job.experience_required ||
      job.experienceRequired ||
      null,

    location:
      normalizeText(
        job.location
      ),

    employmentType:
      normalizeText(
        job.employment_type ||
        job.employmentType
      )
  };
}

function extractRequirementItems(value) {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    return value
      .split(/[,\n;|]/)
      .map(normalizeText)
      .filter(Boolean);
  }

  if (Array.isArray(value)) {
    return value
      .flatMap(item => {
        if (typeof item === "string") {
          return [item];
        }

        if (
          item &&
          typeof item === "object"
        ) {
          return [
            item.name ||
            item.skill ||
            item.title ||
            item.requirement ||
            item.technology ||
            ""
          ];
        }

        return [];
      })
      .map(normalizeText)
      .filter(Boolean);
  }

  if (typeof value === "object") {
    return Object.entries(value)
      .flatMap(([key, item]) => {
        if (
          typeof item === "boolean" &&
          item
        ) {
          return [key];
        }

        if (
          typeof item === "string" ||
          typeof item === "number"
        ) {
          return [key, String(item)];
        }

        if (
          item &&
          typeof item === "object"
        ) {
          return [
            item.name ||
            item.skill ||
            item.title ||
            key
          ];
        }

        return [];
      })
      .map(normalizeText)
      .filter(Boolean);
  }

  return [];
}

function getJobRequirements(job) {
  if (!job) {
    return {
      required: [],
      preferred: [],
      unclear: []
    };
  }

  const required = [
    ...extractRequirementItems(
      job.requirements
    ),
    ...extractRequirementItems(
      job.required_skills
    ),
    ...extractRequirementItems(
      job.requiredSkills
    )
  ];

  const preferred = [
    ...extractRequirementItems(
      job.preferredSkills
    ),
    ...extractRequirementItems(
      job.preferred_skills
    ),
    ...extractRequirementItems(
      job.nice_to_have
    )
  ];

  return {
    required: [
      ...new Map(
        required.map(item => [
          normalizeKey(item),
          item
        ])
      ).values()
    ],

    preferred: [
      ...new Map(
        preferred.map(item => [
          normalizeKey(item),
          item
        ])
      ).values()
    ],

    unclear: []
  };
}

function buildCandidateEvidence(candidate) {
  const skills =
    extractSkills(candidate);

  const projects =
    extractProjects(candidate);

  const experience =
    extractExperience(candidate);

  const education =
    extractEducation(candidate);

  const technicalTerms = new Set();

  skills.forEach(skill => {
    const key = normalizeKey(skill.name);

    if (key) {
      technicalTerms.add(key);
    }
  });

  projects.forEach(project => {
    project.technologies.forEach(
      technology => {
        const key =
          normalizeKey(
            technology
          );

        if (key) {
          technicalTerms.add(key);
        }
      }
    );
  });

  experience.forEach(item => {
    item.skills.forEach(skill => {
      const key =
        normalizeKey(skill);

      if (key) {
        technicalTerms.add(key);
      }
    });

    item.technologies.forEach(
      technology => {
        const key =
          normalizeKey(
            technology
          );

        if (key) {
          technicalTerms.add(key);
        }
      }
    );
  });

  return {
    skills,
    projects,
    experience,
    education,
    technicalTerms
  };
}

function requirementMatches(
  requirement,
  evidence
) {
  const requirementKey =
    normalizeKey(
      requirement
    );

  if (!requirementKey) {
    return false;
  }

  if (
    evidence.technicalTerms.has(
      requirementKey
    )
  ) {
    return true;
  }

  const requirementTokens =
    requirementKey
      .split(" ")
      .filter(Boolean);

  if (!requirementTokens.length) {
    return false;
  }

  for (
    const candidateTerm of evidence.technicalTerms
  ) {
    if (
      candidateTerm ===
      requirementKey
    ) {
      return true;
    }

    if (
      candidateTerm.includes(
        requirementKey
      ) ||
      requirementKey.includes(
        candidateTerm
      )
    ) {
      return true;
    }

    const candidateTokens =
      candidateTerm
        .split(" ")
        .filter(Boolean);

    const overlap =
      requirementTokens.filter(
        token =>
          candidateTokens.includes(
            token
          )
      ).length;

    if (
      requirementTokens.length >= 2 &&
      overlap >=
        Math.ceil(
          requirementTokens.length *
            0.7
        )
    ) {
      return true;
    }
  }

  return false;
}

function evaluateCandidate(
  candidate,
  job
) {
  const evidence =
    buildCandidateEvidence(
      candidate
    );

  const requirements =
    getJobRequirements(
      job
    );

  const requiredResults =
    requirements.required.map(
      requirement => ({
        requirement,
        status:
          requirementMatches(
            requirement,
            evidence
          )
            ? "SUPPORTED"
            : "NOT_EVIDENCED"
      })
    );

  const preferredResults =
    requirements.preferred.map(
      requirement => ({
        requirement,
        status:
          requirementMatches(
            requirement,
            evidence
          )
            ? "SUPPORTED"
            : "NOT_EVIDENCED"
      })
    );

  const requiredSupported =
    requiredResults.filter(
      item =>
        item.status ===
        "SUPPORTED"
    ).length;

  const preferredSupported =
    preferredResults.filter(
      item =>
        item.status ===
        "SUPPORTED"
    ).length;

  const requiredCount =
    requiredResults.length;

  const preferredCount =
    preferredResults.length;

  const requiredCoverage =
    requiredCount > 0
      ? Math.round(
          (
            requiredSupported /
            requiredCount
          ) * 100
        )
      : null;

  const preferredCoverage =
    preferredCount > 0
      ? Math.round(
          (
            preferredSupported /
            preferredCount
          ) * 100
        )
      : null;

  let recommendation =
    "REVIEW";

  if (
    requiredCount > 0 &&
    requiredSupported ===
      requiredCount
  ) {
    recommendation =
      "PRIORITY_REVIEW";
  } else if (
    requiredCount > 0 &&
    requiredSupported <
      requiredCount
  ) {
    recommendation =
      "REVIEW_GAPS";
  }

  if (
    requiredCount === 0 &&
    preferredCount > 0 &&
    preferredSupported ===
      preferredCount
  ) {
    recommendation =
      "PRIORITY_REVIEW";
  }

  return {
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

    recommendation,

    requiredCoverage,

    preferredCoverage,

    requiredMatches:
      requiredResults,

    preferredMatches:
      preferredResults,

    evidenceSummary: {
      skillCount:
        evidence.skills.length,

      projectCount:
        evidence.projects.length,

      experienceCount:
        evidence.experience.length,

      educationCount:
        evidence.education.length,

      suppliedSkills:
        evidence.skills.map(
          skill =>
            skill.name
        ),

      suppliedProjects:
        evidence.projects.map(
          project =>
            project.title
        )
      .filter(Boolean)
    },

    strengths:
      requiredResults
        .filter(
          item =>
            item.status ===
            "SUPPORTED"
        )
        .map(
          item =>
            `Required skill/evidence supplied: ${item.requirement}`
        ),

    gaps:
      requiredResults
        .filter(
          item =>
            item.status ===
            "NOT_EVIDENCED"
        )
        .map(
          item =>
            `Required skill/evidence not found in supplied candidate data: ${item.requirement}`
        ),

    limitations: [
      "Skill presence does not establish depth or proficiency.",
      "Missing data is not proof that the candidate lacks the capability.",
      "External links are not independently verified by this agent.",
      "The assessment is decision support and not an automated hiring decision."
    ]
  };
}

function buildLocalShortlist(
  candidates,
  job
) {
  const evaluations =
    candidates.map(
      candidate =>
        evaluateCandidate(
          candidate,
          job
        )
    );

  const sorted =
    [...evaluations].sort(
      (a, b) => {
        const aRequired =
          a.requiredCoverage ??
          -1;

        const bRequired =
          b.requiredCoverage ??
          -1;

        if (
          bRequired !==
          aRequired
        ) {
          return (
            bRequired -
            aRequired
          );
        }

        const aPreferred =
          a.preferredCoverage ??
          -1;

        const bPreferred =
          b.preferredCoverage ??
          -1;

        return (
          bPreferred -
          aPreferred
        );
      }
    );

  const priorityCandidates =
    sorted.filter(
      candidate =>
        candidate.recommendation ===
        "PRIORITY_REVIEW"
    );

  return {
    job: job
      ? {
          id: job.id,
          title: job.title
        }
      : null,

    candidates: sorted,

    shortlistRecommendation:
      priorityCandidates.length
        ? priorityCandidates
            .slice(0, 5)
            .map(
              candidate => ({
                candidateId:
                  candidate.candidateId,
                candidateName:
                  candidate.candidateName,
                reason:
                  "Supplied candidate evidence covers the stated required criteria without generating an automated hiring decision."
              })
            )
        : [],

    nextActions: [
      "Review the supplied evidence for the shortlisted candidates.",
      "Verify important skills and experience through the appropriate recruiter-led screening process.",
      "Resolve any requirements marked NOT_EVIDENCED before treating them as confirmed gaps.",
      "Keep the final shortlist and hiring decision under human recruiter control."
    ]
  };
}

function buildSystemPrompt() {
  return `
You are the Candidate Shortlisting Agent for HireVision AI.

You provide recruiter decision-support recommendations for shortlisting candidates against a supplied job.

You MUST:
- Use only supplied job and candidate information.
- Compare candidates against explicit job requirements when available.
- Distinguish required requirements from preferred requirements.
- Explain why evidence supports or does not support each requirement.
- Identify information that is unavailable.
- Clearly distinguish evidence from inference.
- Keep the final hiring decision with the human recruiter.
- Never invent candidate data.
- Never invent job requirements.
- Never invent ATS scores.
- Never invent percentages, probabilities, rankings, employers, skills, projects, certifications, or experience.
- Never claim an external profile, GitHub repository, portfolio, certificate, or document was verified unless verification evidence is supplied.
- Never treat missing information as proof that a candidate lacks a skill.
- Never make an automated rejection or hiring decision.

FAIRNESS AND SAFETY:

Do not use, infer, rank, or recommend candidates based on:
- Gender
- Age
- Religion
- Caste
- Race
- Ethnicity
- Political views
- Disability
- Health information
- Sexual orientation
- Marital status
- Family status
- Other sensitive or protected characteristics

Do not use proxies for these attributes.

A candidate with more skills, projects, or experience records is not automatically better.

Return valid JSON only in this structure:

{
  "summary": "short decision-support summary",
  "job": {
    "id": "string or null",
    "title": "string"
  },
  "recommendations": [
    {
      "candidateId": "string",
      "candidateName": "string",
      "recommendation": "PRIORITY_REVIEW|REVIEW|REVIEW_GAPS|INFORMATION_UNAVAILABLE",
      "fitSummary": "evidence-grounded explanation",
      "strengths": [],
      "skillGaps": [],
      "requiredCriteria": [
        {
          "requirement": "string",
          "status": "SUPPORTED|NOT_EVIDENCED|INFORMATION_UNAVAILABLE",
          "evidence": "string"
        }
      ],
      "preferredCriteria": [],
      "evidenceConfidence": 0-1,
      "nextAction": "string"
    }
  ],
  "overallRecommendation": {
    "recommendedForHumanReview": [],
    "reason": "string"
  },
  "dataLimitations": [],
  "fairnessGuardrails": []
}

IMPORTANT:
- "PRIORITY_REVIEW" means the supplied evidence deserves recruiter attention; it is NOT a hiring decision.
- Do not use ATS-style scores.
- If requirements are unavailable, say so instead of inventing them.
- If multiple candidates are similarly supported, say they are comparable.
`;
}

function buildUserPrompt(
  query,
  job,
  candidates,
  localAnalysis,
  context
) {
  return `
User Query:
${
  normalizeText(query) ||
  "Review these candidates for the supplied job."
}

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

Local evidence analysis:
${JSON.stringify(
  localAnalysis,
  null,
  2
)}

Additional recruiter context:
${JSON.stringify(
  {
    targetJobId:
      context?.targetJobId ||
      context?.jobId ||
      null,
    targetRole:
      context?.targetRole ||
      context?.role ||
      null
  },
  null,
  2
)}

Use the local analysis only as a grounding aid. Re-check it against the supplied raw data.

Do not invent missing requirements or candidate information.
Do not create ATS scores.
Do not make a final hiring or rejection decision.
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
    return {};
  }
}

function sanitizeRecommendation(value) {
  const normalized =
    normalizeText(value)
      .toUpperCase()
      .replace(
        /[\s-]+/g,
        "_"
      );

  const allowed = [
    "PRIORITY_REVIEW",
    "REVIEW",
    "REVIEW_GAPS",
    "INFORMATION_UNAVAILABLE"
  ];

  return allowed.includes(
    normalized
  )
    ? normalized
    : "INFORMATION_UNAVAILABLE";
}

function sanitizeStatus(value) {
  const normalized =
    normalizeText(value)
      .toUpperCase()
      .replace(
        /[\s-]+/g,
        "_"
      );

  const allowed = [
    "SUPPORTED",
    "NOT_EVIDENCED",
    "INFORMATION_UNAVAILABLE"
  ];

  return allowed.includes(
    normalized
  )
    ? normalized
    : "INFORMATION_UNAVAILABLE";
}

function sanitizeCandidateRecommendations(
  recommendations,
  candidateMap
) {
  return safeArray(
    recommendations
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

      if (!candidate) {
        return null;
      }

      const requiredCriteria =
        safeArray(
          item?.requiredCriteria
        )
          .map(criteria => ({
            requirement:
              normalizeText(
                criteria?.requirement ||
                criteria?.name
              ),

            status:
              sanitizeStatus(
                criteria?.status
              ),

            evidence:
              normalizeText(
                criteria?.evidence
              )
          }))
          .filter(
            criteria =>
              criteria.requirement
          );

      const preferredCriteria =
        safeArray(
          item?.preferredCriteria
        )
          .map(criteria => ({
            requirement:
              normalizeText(
                criteria?.requirement ||
                criteria?.name
              ),

            status:
              sanitizeStatus(
                criteria?.status
              ),

            evidence:
              normalizeText(
                criteria?.evidence
              )
          }))
          .filter(
            criteria =>
              criteria.requirement
          );

      return {
        candidateId:
          candidateId,

        candidateName:
          normalizeText(
            item?.candidateName ||
            item?.candidate_name ||
            candidate?.full_name ||
            candidate?.name
          ) ||
          "Candidate",

        recommendation:
          sanitizeRecommendation(
            item?.recommendation
          ),

        fitSummary:
          normalizeText(
            item?.fitSummary ||
            item?.fit_summary
          ) ||
          "Assessment is based only on supplied candidate and job evidence.",

        strengths:
          safeArray(
            item?.strengths
          )
            .map(
              normalizeText
            )
            .filter(Boolean),

        skillGaps:
          safeArray(
            item?.skillGaps ||
            item?.skill_gaps
          )
            .map(
              normalizeText
            )
            .filter(Boolean),

        requiredCriteria,

        preferredCriteria,

        evidenceConfidence:
          typeof item?.evidenceConfidence ===
            "number"
            ? Math.max(
                0,
                Math.min(
                  1,
                  item.evidenceConfidence
                )
              )
            : 0.5,

        nextAction:
          normalizeText(
            item?.nextAction ||
            item?.next_action
          ) ||
          "Review the supplied evidence with a human recruiter."
      };
    })
    .filter(Boolean);
}

function sanitizeOverallRecommendation(
  recommendation,
  candidateMap
) {
  const recommended =
    safeArray(
      recommendation?.recommendedForHumanReview ||
      recommendation?.recommended_for_human_review
    )
      .map(normalizeId)
      .filter(
        id =>
          id &&
          candidateMap.has(id)
      );

  return {
    recommendedForHumanReview:
      [...new Set(
        recommended
      )],

    reason:
      normalizeText(
        recommendation?.reason
      ) ||
      "Recommendations are intended for human recruiter review only."
  };
}

function buildAgentResponse(
  query,
  job,
  analysis,
  source
) {
  return normalizeAgentResponse({
    success: true,
    status: "completed",
    agent:
      "candidateShortlistingAgent",

    response:
      analysis.summary ||
      `Shortlisting analysis completed for ${
        job?.title ||
        "the supplied job"
      }.`,

    data: {
      query:
        normalizeText(query),

      job: job
        ? {
            id: job.id,
            title: job.title
          }
        : null,

      recommendations:
        analysis.recommendations,

      overallRecommendation:
        analysis.overallRecommendation,

      dataLimitations:
        analysis.dataLimitations,

      fairnessGuardrails:
        analysis.fairnessGuardrails,

      integrity: {
        groundedInSuppliedData: true,
        fabricatedCandidateData: false,
        fabricatedJobRequirements: false,
        fabricatedATSScore: false,
        sensitiveAttributesUsed: false,
        automatedHiringDecision: false
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
      "candidateShortlistingAgent",
      "No candidates are available in the supplied system data for shortlisting."
    );
  }

  const targetJobId =
    context?.targetJobId ||
    context?.jobId ||
    null;

  const selectedJob =
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
    ) ||
    jobs[0] ||
    context?.job ||
    null;

  const job =
    normalizeJob(
      selectedJob
    );

  const shortlistCandidates =
    candidates.slice(0, 50);

  const localAnalysis =
    buildLocalShortlist(
      shortlistCandidates,
      job
    );

  const candidateMap =
    new Map(
      shortlistCandidates.map(
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

  if (!job) {
    const localWithoutJob =
      shortlistCandidates.map(
        candidate => ({
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

          recommendation:
            "INFORMATION_UNAVAILABLE",

          fitSummary:
            "No target job was supplied, so a job-specific shortlist cannot be determined.",

          strengths: [],

          skillGaps: [],

          requiredCriteria: [],

          preferredCriteria: [],

          evidenceConfidence: 0.1,

          nextAction:
            "Provide a target job with explicit requirements before performing job-specific shortlisting."
        })
      );

    return buildAgentResponse(
      query,
      null,
      {
        summary:
          "A target job is required for evidence-grounded shortlisting.",

        recommendations:
          localWithoutJob,

        overallRecommendation: {
          recommendedForHumanReview:
            [],

          reason:
            "No target job or explicit requirements were supplied."
        },

        dataLimitations: [
          "No target job was supplied.",
          "A job-specific shortlist cannot be generated without explicit requirements.",
          "No ATS score or automated hiring decision was generated."
        ],

        fairnessGuardrails: [
          "Sensitive and protected attributes are excluded from evaluation.",
          "Final hiring decisions remain with a human recruiter."
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
          query,
          job,
          shortlistCandidates,
          localAnalysis,
          context
        ),
        true
      );

    const parsed =
      parseLLMResult(
        llmResult
      );

    const recommendations =
      sanitizeCandidateRecommendations(
        parsed?.recommendations,
        candidateMap
      );

    if (!recommendations.length) {
      const fallback =
        localAnalysis.candidates.map(
          evaluation => ({
            candidateId:
              evaluation.candidateId,

            candidateName:
              evaluation.candidateName,

            recommendation:
              evaluation.recommendation,

            fitSummary:
              evaluation.requiredCoverage !==
                null
                ? `Required-criteria evidence coverage is ${evaluation.requiredCoverage}% based only on the supplied candidate and job data.`
                : "The supplied job does not contain enough explicit requirements for a quantified requirement-coverage assessment.",

            strengths:
              evaluation.strengths,

            skillGaps:
              evaluation.gaps,

            requiredCriteria:
              evaluation.requiredMatches.map(
                item => ({
                  requirement:
                    item.requirement,

                  status:
                    item.status ===
                    "SUPPORTED"
                      ? "SUPPORTED"
                      : "NOT_EVIDENCED",

                  evidence:
                    item.status ===
                    "SUPPORTED"
                      ? "Matching candidate evidence was found in the supplied profile."
                      : "No matching evidence was found in the supplied profile."
                })
              ),

            preferredCriteria:
              evaluation.preferredMatches.map(
                item => ({
                  requirement:
                    item.requirement,

                  status:
                    item.status ===
                    "SUPPORTED"
                      ? "SUPPORTED"
                      : "NOT_EVIDENCED",

                  evidence:
                    item.status ===
                    "SUPPORTED"
                      ? "Matching candidate evidence was found in the supplied profile."
                      : "No matching evidence was found in the supplied profile."
                })
              ),

            evidenceConfidence:
              evaluation.requiredCoverage !==
                null
                ? 0.7
                : 0.3,

            nextAction:
              evaluation.recommendation ===
              "PRIORITY_REVIEW"
                ? "Review this candidate's supplied evidence and conduct recruiter-led screening."
                : "Review the identified gaps and verify relevant evidence before progressing."
          })
        );

      return buildAgentResponse(
        query,
        job,
        {
          summary:
            `Shortlisting analysis completed for ${job.title} using only the supplied candidate and job evidence.`,

          recommendations:
            fallback,

          overallRecommendation: {
            recommendedForHumanReview:
              fallback
                .filter(
                  item =>
                    item.recommendation ===
                    "PRIORITY_REVIEW"
                )
                .map(
                  item =>
                    normalizeId(
                      item.candidateId
                    )
                ),

            reason:
              "Candidates marked PRIORITY_REVIEW have stronger coverage of the supplied required criteria. This is a recruiter-review recommendation, not a hiring decision."
          },

          dataLimitations:
            localAnalysis
              .candidates[0]
              ?.limitations ||
            [
              "Assessment is limited to supplied candidate and job information."
            ],

          fairnessGuardrails: [
            "Sensitive and protected attributes are excluded.",
            "Missing evidence is not treated as proof of a skill gap.",
            "Final hiring decisions remain with a human recruiter."
          ]
        },
        "local-grounded-fallback"
      );
    }

    const sanitizedOverall =
      sanitizeOverallRecommendation(
        parsed?.overallRecommendation,
        candidateMap
      );

    return buildAgentResponse(
      query,
      job,
      {
        summary:
          normalizeText(
            parsed?.summary
          ) ||
          `Shortlisting analysis completed for ${job.title}.`,

        recommendations,

        overallRecommendation:
          sanitizedOverall,

        dataLimitations:
          safeArray(
            parsed?.dataLimitations
          )
            .map(
              normalizeText
            )
            .filter(Boolean),

        fairnessGuardrails:
          safeArray(
            parsed?.fairnessGuardrails
          )
            .map(
              normalizeText
            )
            .filter(Boolean)
      },
      "llm+candidate-shortlisting"
    );
  } catch (error) {
    console.error(
      "[CandidateShortlistingAgent] LLM analysis failed:",
      error.message
    );

    const fallback =
      localAnalysis.candidates.map(
        evaluation => ({
          candidateId:
            evaluation.candidateId,

          candidateName:
            evaluation.candidateName,

          recommendation:
            evaluation.recommendation,

          fitSummary:
            evaluation.requiredCoverage !==
              null
              ? `Required-criteria evidence coverage is ${evaluation.requiredCoverage}% based only on supplied job and candidate data.`
              : "The supplied job does not contain enough explicit requirements for a job-specific coverage assessment.",

          strengths:
            evaluation.strengths,

          skillGaps:
            evaluation.gaps,

          requiredCriteria:
            evaluation.requiredMatches,

          preferredCriteria:
            evaluation.preferredMatches,

          evidenceConfidence:
            evaluation.requiredCoverage !==
              null
              ? 0.7
              : 0.3,

          nextAction:
            "Review the supplied evidence with a human recruiter and verify important requirements through the appropriate screening process."
        })
      );

    return buildAgentResponse(
      query,
      job,
      {
        summary:
          `Shortlisting analysis completed for ${job.title} using the supplied candidate evidence.`,

        recommendations:
          fallback,

        overallRecommendation: {
          recommendedForHumanReview:
            fallback
              .filter(
                item =>
                  item.recommendation ===
                  "PRIORITY_REVIEW"
              )
              .map(
                item =>
                  normalizeId(
                    item.candidateId
                  )
              ),

          reason:
            "The recommendation is based on explicit supplied requirements and candidate evidence. It is not an automated hiring decision."
        },

        dataLimitations: [
          "LLM analysis was unavailable, so the result uses deterministic evidence matching.",
          "Deterministic matching cannot establish skill depth, quality, or candidate suitability beyond the supplied data.",
          "External evidence was not independently verified.",
          "Missing information is not treated as proof of a gap."
        ],

        fairnessGuardrails: [
          "Sensitive and protected attributes are excluded.",
          "Only job-relevant supplied information is considered.",
          "Final hiring decisions remain with a human recruiter."
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
  evaluateCandidate,
  buildLocalShortlist
};