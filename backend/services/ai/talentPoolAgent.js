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

function getCandidateProfile(candidate) {
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
    const key =
      normalizeKey(skill.name);

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
      "Candidate",

    skills,

    projects,

    experience,

    education,

    objective:
      normalizeText(
        candidate?.career_objective ||
        candidate?.careerObjective ||
        candidate?.objective ||
        candidate?.summary
      ),

    location:
      normalizeText(
        candidate?.location ||
        candidate?.city
      ),

    technicalTerms
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
      ) ||
      "Untitled Job",

    description:
      normalizeText(
        job.description ||
        job.job_description ||
        job.summary
      ),

    requiredSkills: [
      ...extractRequirementItems(
        job.requirements
      ),
      ...extractRequirementItems(
        job.required_skills
      ),
      ...extractRequirementItems(
        job.requiredSkills
      )
    ],

    preferredSkills: [
      ...extractRequirementItems(
        job.preferred_skills
      ),
      ...extractRequirementItems(
        job.preferredSkills
      ),
      ...extractRequirementItems(
        job.nice_to_have
      )
    ],

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

function requirementMatches(
  requirement,
  profile
) {
  const requirementKey =
    normalizeKey(
      requirement
    );

  if (!requirementKey) {
    return false;
  }

  if (
    profile.technicalTerms.has(
      requirementKey
    )
  ) {
    return true;
  }

  for (
    const candidateTerm of profile.technicalTerms
  ) {
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

    const requiredTokens =
      requirementKey
        .split(" ")
        .filter(Boolean);

    const candidateTokens =
      candidateTerm
        .split(" ")
        .filter(Boolean);

    if (
      requiredTokens.length >= 2
    ) {
      const overlap =
        requiredTokens.filter(
          token =>
            candidateTokens.includes(
              token
            )
        ).length;

      if (
        overlap >=
        Math.ceil(
          requiredTokens.length *
            0.7
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

function evaluateCandidateForJob(
  candidate,
  job
) {
  const profile =
    getCandidateProfile(
      candidate
    );

  if (!job) {
    return {
      candidateId:
        profile.id,

      candidateName:
        profile.name,

      status:
        "INFORMATION_UNAVAILABLE",

      matchedRequiredSkills: [],
      missingRequiredSkills: [],
      matchedPreferredSkills: [],
      missingPreferredSkills: [],

      requiredCoverage: null,
      preferredCoverage: null,

      evidence: {
        skills:
          profile.skills.map(
            skill =>
              skill.name
          ),
        projects:
          profile.projects.map(
            project =>
              project.title
          ).filter(Boolean),
        experienceCount:
          profile.experience.length
      }
    };
  }

  const required =
    [
      ...new Map(
        job.requiredSkills.map(
          item => [
            normalizeKey(item),
            item
          ]
        )
      ).values()
    ];

  const preferred =
    [
      ...new Map(
        job.preferredSkills.map(
          item => [
            normalizeKey(item),
            item
          ]
        )
      ).values()
    ];

  const matchedRequiredSkills =
    required.filter(
      requirement =>
        requirementMatches(
          requirement,
          profile
        )
    );

  const missingRequiredSkills =
    required.filter(
      requirement =>
        !requirementMatches(
          requirement,
          profile
        )
    );

  const matchedPreferredSkills =
    preferred.filter(
      requirement =>
        requirementMatches(
          requirement,
          profile
        )
    );

  const missingPreferredSkills =
    preferred.filter(
      requirement =>
        !requirementMatches(
          requirement,
          profile
        )
    );

  const requiredCoverage =
    required.length
      ? Math.round(
          (
            matchedRequiredSkills.length /
            required.length
          ) * 100
        )
      : null;

  const preferredCoverage =
    preferred.length
      ? Math.round(
          (
            matchedPreferredSkills.length /
            preferred.length
          ) * 100
        )
      : null;

  let status =
    "REVIEW";

  if (
    required.length > 0 &&
    matchedRequiredSkills.length ===
      required.length
  ) {
    status =
      "PRIORITY_REVIEW";
  } else if (
    required.length > 0
  ) {
    status =
      "REVIEW_GAPS";
  } else if (
    preferred.length === 0
  ) {
    status =
      "INFORMATION_UNAVAILABLE";
  }

  return {
    candidateId:
      profile.id,

    candidateName:
      profile.name,

    status,

    matchedRequiredSkills,

    missingRequiredSkills,

    matchedPreferredSkills,

    missingPreferredSkills,

    requiredCoverage,

    preferredCoverage,

    evidence: {
      skills:
        profile.skills.map(
          skill =>
            skill.name
        ),

      projects:
        profile.projects.map(
          project =>
            ({
              title:
                project.title,
              technologies:
                project.technologies,
              hasGithub:
                Boolean(
                  project.github
                ),
              hasLiveUrl:
                Boolean(
                  project.liveUrl
                )
            })
        ),

      experience:
        profile.experience.map(
          item => ({
            role:
              item.role,
            company:
              item.company,
            skills:
              item.skills,
            technologies:
              item.technologies
          })
        ),

      education:
        profile.education
    }
  };
}

function buildTalentPoolAnalysis(
  candidates,
  job
) {
  const profiles =
    candidates.map(
      getCandidateProfile
    );

  const evaluations =
    job
      ? candidates.map(
          candidate =>
            evaluateCandidateForJob(
              candidate,
              job
            )
        )
      : [];

  const skillFrequency =
    new Map();

  profiles.forEach(
    profile => {
      profile.skills.forEach(
        skill => {
          const key =
            normalizeKey(
              skill.name
            );

          if (!key) {
            return;
          }

          const current =
            skillFrequency.get(
              key
            );

          if (current) {
            current.count += 1;
          } else {
            skillFrequency.set(
              key,
              {
                name:
                  skill.name,
                count: 1
              }
            );
          }
        }
      );
    }
  );

  const commonSkills =
    [...skillFrequency.values()]
      .sort(
        (a, b) =>
          b.count -
          a.count
      )
      .slice(0, 15);

  const jobMatches =
    [...evaluations].sort(
      (a, b) => {
        const aCoverage =
          a.requiredCoverage ??
          -1;

        const bCoverage =
          b.requiredCoverage ??
          -1;

        if (
          bCoverage !==
          aCoverage
        ) {
          return (
            bCoverage -
            aCoverage
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

  return {
    totalProfiles:
      candidates.length,

    commonSkills,

    job:
      job
        ? {
            id: job.id,
            title: job.title
          }
        : null,

    jobMatches,

    profileCoverage: {
      withSkills:
        profiles.filter(
          profile =>
            profile.skills.length
        ).length,

      withProjects:
        profiles.filter(
          profile =>
            profile.projects.length
        ).length,

      withExperience:
        profiles.filter(
          profile =>
            profile.experience.length
        ).length,

      withEducation:
        profiles.filter(
          profile =>
            profile.education.length
        ).length
    }
  };
}

function buildSystemPrompt() {
  return `
You are the Talent Pool Agent for HireVision AI.

Your task is to analyze the supplied candidate talent pool and help recruiters discover candidates who may be relevant to a supplied job or hiring need.

You are a decision-support agent, not an autonomous hiring decision-maker.

You MUST:

1. Use only candidate and job information supplied in the input.
2. Return only candidates that exist in the supplied database data.
3. Match candidates against explicit job requirements when a job is supplied.
4. If no job is supplied, provide a general talent-pool overview without inventing job fit.
5. Explain why a candidate appears relevant.
6. Distinguish supported evidence from missing information.
7. Treat missing data as UNKNOWN, not as a negative finding.
8. Never invent skills, experience, projects, employers, education, certifications, GitHub repositories, portfolio data, scores, or achievements.
9. Never fabricate ATS scores or hiring probabilities.
10. Never claim external profile verification unless actual verification evidence is supplied.
11. Never make an automated hiring, rejection, or final shortlist decision.
12. Keep final recruiter decisions under human control.

FAIRNESS:

Never use, infer, rank, or recommend candidates based on:
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

Do not use proxies for protected characteristics.

IMPORTANT:
- More skills do not automatically mean better fit.
- More projects do not automatically mean better fit.
- More experience records do not automatically mean better fit.
- A skill listed on a profile does not prove proficiency.
- A URL does not prove that external content was verified.
- Requirement coverage is evidence matching, not an ATS score.

Return valid JSON only:

{
  "summary": "short talent pool summary",
  "jobContext": {
    "jobId": "string or null",
    "jobTitle": "string or null"
  },
  "candidateRecommendations": [
    {
      "candidateId": "string",
      "candidateName": "string",
      "relevance": "HIGH|MEDIUM|LOW|INFORMATION_UNAVAILABLE",
      "reason": "evidence-grounded explanation",
      "matchedRequirements": [],
      "missingOrUnverifiedRequirements": [],
      "strengths": [],
      "evidence": [],
      "nextAction": "string",
      "confidence": 0-1
    }
  ],
  "talentPoolInsights": {
    "commonSkills": [],
    "availableProfileSignals": [],
    "gapsInPoolData": []
  },
  "dataLimitations": [],
  "fairnessGuardrails": []
}

Only recommend candidates for recruiter review. Do not make a final hiring decision.
`;
}

function buildUserPrompt(
  query,
  candidates,
  job,
  localAnalysis
) {
  return `
User Query:
${
  normalizeText(query) ||
  "Analyze the available talent pool."
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

Locally derived evidence analysis:
${JSON.stringify(
  localAnalysis,
  null,
  2
)}

Instructions:
- Ground every recommendation in supplied data.
- Do not invent missing job requirements.
- Do not invent candidate information.
- Do not produce ATS scores.
- Do not make an automated hiring or rejection decision.
- Do not use protected or sensitive characteristics.
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

function sanitizeRelevance(value) {
  const normalized =
    normalizeText(value)
      .toUpperCase()
      .replace(
        /[\s-]+/g,
        "_"
      );

  const allowed = [
    "HIGH",
    "MEDIUM",
    "LOW",
    "INFORMATION_UNAVAILABLE"
  ];

  return allowed.includes(
    normalized
  )
    ? normalized
    : "INFORMATION_UNAVAILABLE";
}

function sanitizeRecommendations(
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

      return {
        candidateId,

        candidateName:
          normalizeText(
            item?.candidateName ||
            item?.candidate_name ||
            candidate?.full_name ||
            candidate?.name
          ) ||
          "Candidate",

        relevance:
          sanitizeRelevance(
            item?.relevance
          ),

        reason:
          normalizeText(
            item?.reason
          ) ||
          "Candidate appears relevant based on the supplied profile evidence.",

        matchedRequirements:
          safeArray(
            item?.matchedRequirements ||
            item?.matched_requirements
          )
            .map(
              normalizeText
            )
            .filter(Boolean),

        missingOrUnverifiedRequirements:
          safeArray(
            item?.missingOrUnverifiedRequirements ||
            item?.missing_or_unverified_requirements
          )
            .map(
              normalizeText
            )
            .filter(Boolean),

        strengths:
          safeArray(
            item?.strengths
          )
            .map(
              normalizeText
            )
            .filter(Boolean),

        evidence:
          safeArray(
            item?.evidence
          )
            .map(
              normalizeText
            )
            .filter(Boolean),

        nextAction:
          normalizeText(
            item?.nextAction ||
            item?.next_action
          ) ||
          "Review the candidate evidence manually.",

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
    .filter(Boolean);
}

function buildLocalRecommendations(
  candidates,
  job
) {
  if (!job) {
    return candidates
      .map(candidate => {
        const profile =
          getCandidateProfile(
            candidate
          );

        const signals = [];

        if (
          profile.skills.length
        ) {
          signals.push(
            `Supplied skills: ${profile.skills
              .map(
                skill =>
                  skill.name
              )
              .slice(0, 8)
              .join(", ")}`
          );
        }

        if (
          profile.projects.length
        ) {
          signals.push(
            `${profile.projects.length} project record(s) supplied`
          );
        }

        if (
          profile.experience.length
        ) {
          signals.push(
            `${profile.experience.length} experience record(s) supplied`
          );
        }

        return {
          candidateId:
            profile.id,

          candidateName:
            profile.name,

          relevance:
            "INFORMATION_UNAVAILABLE",

          reason:
            "No target job was supplied, so job-specific fit cannot be determined.",

          matchedRequirements: [],

          missingOrUnverifiedRequirements: [],

          strengths:
            signals,

          evidence:
            signals,

          nextAction:
            "Select or provide a target job to evaluate this candidate against explicit requirements.",

          confidence: 0.2
        };
      });
  }

  return candidates
    .map(candidate => {
      const evaluation =
        evaluateCandidateForJob(
          candidate,
          job
        );

      let relevance =
        "LOW";

      if (
        evaluation.requiredCoverage !==
          null &&
        evaluation.requiredCoverage >=
          80
      ) {
        relevance =
          "HIGH";
      } else if (
        evaluation.requiredCoverage !==
          null &&
        evaluation.requiredCoverage >=
          50
      ) {
        relevance =
          "MEDIUM";
      } else if (
        evaluation.requiredCoverage ===
          null &&
        evaluation.preferredCoverage !==
          null &&
        evaluation.preferredCoverage >=
          50
      ) {
        relevance =
          "MEDIUM";
      } else if (
        evaluation.requiredCoverage ===
          null &&
        evaluation.preferredCoverage ===
          null
      ) {
        relevance =
          "INFORMATION_UNAVAILABLE";
      }

      const strengths =
        evaluation.matchedRequiredSkills.map(
          skill =>
            `Matches stated requirement: ${skill}`
        );

      evaluation.matchedPreferredSkills.forEach(
        skill => {
          strengths.push(
            `Matches preferred requirement: ${skill}`
          );
        }
      );

      if (
        evaluation.evidence.projects.length
      ) {
        strengths.push(
          `${evaluation.evidence.projects.length} project record(s) supplied`
        );
      }

      return {
        candidateId:
          evaluation.candidateId,

        candidateName:
          evaluation.candidateName,

        relevance,

        reason:
          evaluation.requiredCoverage !==
            null
            ? `The supplied profile covers ${evaluation.requiredCoverage}% of the explicitly stated required criteria.`
            : "The supplied job does not contain enough explicit requirements for a quantified job-specific assessment.",

        matchedRequirements:
          evaluation.matchedRequiredSkills,

        missingOrUnverifiedRequirements:
          evaluation.missingRequiredSkills,

        strengths,

        evidence: [
          ...evaluation.matchedRequiredSkills.map(
            skill =>
              `Required criterion supported by supplied profile data: ${skill}`
          ),
          ...evaluation.matchedPreferredSkills.map(
            skill =>
              `Preferred criterion supported by supplied profile data: ${skill}`
          )
        ],

        nextAction:
          relevance ===
          "HIGH"
            ? "Review the candidate's supplied evidence and proceed with recruiter-led screening if appropriate."
            : "Review the candidate's evidence and verify relevant requirements before progressing.",

        confidence:
          evaluation.requiredCoverage !==
            null
            ? 0.7
            : 0.3
      };
    });
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
      "talentPoolAgent",

    response:
      analysis.summary ||
      "Talent pool analysis completed using supplied candidate data.",

    data: {
      query:
        normalizeText(query),

      jobContext:
        job
          ? {
              jobId:
                job.id,
              jobTitle:
                job.title
            }
          : {
              jobId: null,
              jobTitle: null
            },

      candidateRecommendations:
        analysis.candidateRecommendations,

      talentPoolInsights:
        analysis.talentPoolInsights,

      dataLimitations:
        analysis.dataLimitations,

      fairnessGuardrails:
        analysis.fairnessGuardrails,

      integrity: {
        groundedInSuppliedData: true,
        fabricatedCandidates: false,
        fabricatedRequirements: false,
        fabricatedATSScore: false,
        sensitiveAttributesUsed: false,
        externalVerificationPerformed: false,
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
  const candidates =
    safeArray(
      context?.candidates ||
      context?.candidateList ||
      context?.data?.candidates
    );

  if (!candidates.length) {
    return failedAgentResponse(
      "talentPoolAgent",
      "No candidates were found in the supplied talent pool data."
    );
  }

  const jobs =
    safeArray(
      context?.jobs ||
      context?.data?.jobs
    );

  const targetJobId =
    context?.targetJobId ||
    context?.jobId ||
    null;

  const rawJob =
    context?.job ||
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
    null;

  const job =
    normalizeJob(
      rawJob
    );

  const talentPoolCandidates =
    candidates.slice(0, 100);

  const localAnalysis =
    buildTalentPoolAnalysis(
      talentPoolCandidates,
      job
    );

  const candidateMap =
    new Map(
      talentPoolCandidates.map(
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
          query,
          talentPoolCandidates,
          job,
          localAnalysis
        ),
        true
      );

    const parsed =
      parseLLMResult(
        llmResult
      );

    const candidateRecommendations =
      sanitizeRecommendations(
        parsed?.candidateRecommendations,
        candidateMap
      );

    if (
      !candidateRecommendations.length
    ) {
      return buildAgentResponse(
        query,
        job,
        {
          summary:
            job
              ? `Talent pool analysis completed for ${job.title} using supplied candidate evidence.`
              : "Talent pool overview completed using supplied candidate data.",

          candidateRecommendations:
            buildLocalRecommendations(
              talentPoolCandidates,
              job
            ),

          talentPoolInsights: {
            commonSkills:
              localAnalysis.commonSkills,

            availableProfileSignals: [
              `${localAnalysis.profileCoverage.withSkills} profile(s) contain skill data.`,
              `${localAnalysis.profileCoverage.withProjects} profile(s) contain project data.`,
              `${localAnalysis.profileCoverage.withExperience} profile(s) contain experience data.`,
              `${localAnalysis.profileCoverage.withEducation} profile(s) contain education data.`
            ],

            gapsInPoolData: [
              "Candidate data completeness varies by profile.",
              "Listed skills do not independently establish proficiency."
            ]
          },

          dataLimitations: [
            "LLM output did not contain valid candidate recommendations, so deterministic evidence matching was used.",
            "The analysis is limited to supplied candidate and job data.",
            "External candidate profiles were not independently verified.",
            "No ATS score or automated hiring decision was generated."
          ],

          fairnessGuardrails: [
            "Sensitive and protected characteristics are excluded.",
            "Only job-relevant supplied information is considered.",
            "Final recruiter decisions remain human-controlled."
          ]
        },
        "local-grounded-fallback"
      );
    }

    const llmInsights =
      parsed?.talentPoolInsights ||
      {};

    return buildAgentResponse(
      query,
      job,
      {
        summary:
          normalizeText(
            parsed?.summary
          ) ||
          `Talent pool analysis completed${
            job
              ? ` for ${job.title}`
              : ""
          }.`,

        candidateRecommendations,

        talentPoolInsights: {
          commonSkills:
            safeArray(
              llmInsights.commonSkills
            )
              .map(
                normalizeText
              )
              .filter(Boolean),

          availableProfileSignals:
            safeArray(
              llmInsights.availableProfileSignals
            )
              .map(
                normalizeText
              )
              .filter(Boolean),

          gapsInPoolData:
            safeArray(
              llmInsights.gapsInPoolData
            )
              .map(
                normalizeText
              )
              .filter(Boolean)
        },

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
      "llm+talent-pool"
    );
  } catch (error) {
    console.error(
      "[TalentPoolAgent] LLM analysis failed:",
      error.message
    );

    return buildAgentResponse(
      query,
      job,
      {
        summary:
          job
            ? `Talent pool analysis completed for ${job.title} using deterministic evidence matching.`
            : "Talent pool overview completed using supplied candidate data.",

        candidateRecommendations:
          buildLocalRecommendations(
            talentPoolCandidates,
            job
          ),

        talentPoolInsights: {
          commonSkills:
            localAnalysis.commonSkills,

          availableProfileSignals: [
            `${localAnalysis.profileCoverage.withSkills} profile(s) contain skill data.`,
            `${localAnalysis.profileCoverage.withProjects} profile(s) contain project data.`,
            `${localAnalysis.profileCoverage.withExperience} profile(s) contain experience data.`,
            `${localAnalysis.profileCoverage.withEducation} profile(s) contain education data.`
          ],

          gapsInPoolData: [
            "Candidate profile completeness may vary.",
            "Skill presence does not establish proficiency.",
            "External links are not independently verified by this agent."
          ]
        },

        dataLimitations: [
          "LLM analysis was unavailable, so deterministic evidence matching was used.",
          "Deterministic matching cannot establish skill depth or overall candidate quality.",
          "Missing information is not treated as proof that a candidate lacks a capability.",
          "No ATS score or automated hiring decision was generated."
        ],

        fairnessGuardrails: [
          "Sensitive and protected characteristics are excluded.",
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
  getCandidateProfile,
  evaluateCandidateForJob,
  buildTalentPoolAnalysis
};