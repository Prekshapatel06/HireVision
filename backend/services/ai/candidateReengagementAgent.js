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
    technologies: safeArray(
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
      .filter(Boolean),
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
    technologies: safeArray(
      experience.technologies ||
      experience.tech_stack ||
      experience.skills
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

function getTimestamp(candidate) {
  const raw =
    candidate?.updated_at ||
    candidate?.updatedAt ||
    candidate?.profile_updated_at ||
    candidate?.profileUpdatedAt ||
    candidate?.modified_at ||
    candidate?.modifiedAt ||
    null;

  if (!raw) {
    return null;
  }

  const timestamp =
    new Date(raw).getTime();

  return Number.isNaN(timestamp)
    ? null
    : timestamp;
}

function getUpdateDate(candidate) {
  const raw =
    candidate?.updated_at ||
    candidate?.updatedAt ||
    candidate?.profile_updated_at ||
    candidate?.profileUpdatedAt ||
    candidate?.modified_at ||
    candidate?.modifiedAt ||
    null;

  if (!raw) {
    return null;
  }

  const timestamp =
    new Date(raw).getTime();

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return new Date(
    timestamp
  ).toISOString();
}

function getDaysSinceUpdate(candidate) {
  const timestamp =
    getTimestamp(
      candidate
    );

  if (timestamp === null) {
    return null;
  }

  const difference =
    Date.now() -
    timestamp;

  if (difference < 0) {
    return 0;
  }

  return Math.floor(
    difference /
      (1000 * 60 * 60 * 24)
  );
}

function isRecentlyUpdated(
  candidate,
  windowDays = 90
) {
  const days =
    getDaysSinceUpdate(
      candidate
    );

  return (
    days !== null &&
    days >= 0 &&
    days <= windowDays
  );
}

function getCandidateProfile(candidate) {
  const skills =
    extractSkills(
      candidate
    );

  const projects =
    extractProjects(
      candidate
    );

  const experience =
    extractExperience(
      candidate
    );

  const technicalTerms =
    new Set();

  skills.forEach(skill => {
    const key =
      normalizeKey(
        skill.name
      );

    if (key) {
      technicalTerms.add(
        key
      );
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
          technicalTerms.add(
            key
          );
        }
      }
    );
  });

  experience.forEach(item => {
    item.technologies.forEach(
      technology => {
        const key =
          normalizeKey(
            technology
          );

        if (key) {
          technicalTerms.add(
            key
          );
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

    technicalTerms,

    updatedAt:
      getUpdateDate(
        candidate
      ),

    daysSinceUpdate:
      getDaysSinceUpdate(
        candidate
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
          return [
            key,
            String(item)
          ];
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
    ]
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

function calculateJobRelevance(
  profile,
  job
) {
  if (!job) {
    return {
      matchedRequiredSkills: [],
      missingRequiredSkills: [],
      matchedPreferredSkills: [],
      requiredCoverage: null,
      preferredCoverage: null
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

  return {
    matchedRequiredSkills,

    missingRequiredSkills,

    matchedPreferredSkills,

    requiredCoverage:
      required.length
        ? Math.round(
            (
              matchedRequiredSkills.length /
              required.length
            ) * 100
          )
        : null,

    preferredCoverage:
      preferred.length
        ? Math.round(
            (
              matchedPreferredSkills.length /
              preferred.length
            ) * 100
          )
        : null
  };
}

function detectUpdateSignals(
  candidate
) {
  const signals = [];

  const days =
    getDaysSinceUpdate(
      candidate
    );

  if (
    days !== null &&
    days <= 30
  ) {
    signals.push(
      `Profile updated within the last ${days} day(s)`
    );
  } else if (
    days !== null &&
    days <= 90
  ) {
    signals.push(
      `Profile updated ${days} day(s) ago`
    );
  }

  const updatedSkills =
    safeArray(
      candidate?.recent_skills ||
      candidate?.recentSkills ||
      candidate?.new_skills ||
      candidate?.newSkills
    )
      .map(normalizeSkill)
      .filter(
        skill =>
          skill &&
          skill.name
      );

  if (
    updatedSkills.length
  ) {
    signals.push(
      `Recently supplied skills: ${updatedSkills
        .map(
          skill =>
            skill.name
        )
        .join(", ")}`
    );
  }

  const updatedProjects =
    safeArray(
      candidate?.recent_projects ||
      candidate?.recentProjects ||
      candidate?.new_projects ||
      candidate?.newProjects
    )
      .map(normalizeProject)
      .filter(
        project =>
          project &&
          project.title
      );

  if (
    updatedProjects.length
  ) {
    signals.push(
      `Recently supplied projects: ${updatedProjects
        .map(
          project =>
            project.title
        )
        .join(", ")}`
    );
  }

  const currentProjects =
    extractProjects(
      candidate
    );

  const currentSkills =
    extractSkills(
      candidate
    );

  if (
    currentProjects.length
  ) {
    signals.push(
      `${currentProjects.length} project record(s) currently supplied`
    );
  }

  if (
    currentSkills.length
  ) {
    signals.push(
      `${currentSkills.length} skill record(s) currently supplied`
    );
  }

  return signals;
}

function evaluateReengagementCandidate(
  candidate,
  job,
  windowDays
) {
  const profile =
    getCandidateProfile(
      candidate
    );

  const recentlyUpdated =
    isRecentlyUpdated(
      candidate,
      windowDays
    );

  const jobRelevance =
    calculateJobRelevance(
      profile,
      job
    );

  const updateSignals =
    detectUpdateSignals(
      candidate
    );

  let relevance =
    "LOW";

  if (
    job &&
    jobRelevance.requiredCoverage !==
      null &&
    jobRelevance.requiredCoverage >=
      80 &&
    recentlyUpdated
  ) {
    relevance =
      "HIGH";
  } else if (
    job &&
    jobRelevance.requiredCoverage !==
      null &&
    jobRelevance.requiredCoverage >=
      50 &&
    recentlyUpdated
  ) {
    relevance =
      "MEDIUM";
  } else if (
    !job &&
    recentlyUpdated
  ) {
    relevance =
      "MEDIUM";
  } else if (
    !job &&
    jobRelevance.requiredCoverage ===
      null &&
    updateSignals.length
  ) {
    relevance =
      "INFORMATION_UNAVAILABLE";
  }

  const reasons = [];

  if (
    recentlyUpdated
  ) {
    reasons.push(
      profile.daysSinceUpdate ===
        0
        ? "Profile update date is today."
        : `Profile was updated ${profile.daysSinceUpdate} day(s) ago.`
    );
  }

  if (
    job &&
    jobRelevance.matchedRequiredSkills.length
  ) {
    reasons.push(
      `Supplied profile evidence matches ${jobRelevance.matchedRequiredSkills.length} stated required skill(s).`
    );
  }

  if (
    job &&
    jobRelevance.matchedPreferredSkills.length
  ) {
    reasons.push(
      `Supplied profile evidence matches ${jobRelevance.matchedPreferredSkills.length} preferred skill(s).`
    );
  }

  if (
    !reasons.length
  ) {
    reasons.push(
      "There is insufficient supplied evidence to establish a strong re-engagement reason."
    );
  }

  return {
    candidateId:
      profile.id,

    candidateName:
      profile.name,

    relevance,

    recentlyUpdated,

    updatedAt:
      profile.updatedAt,

    daysSinceUpdate:
      profile.daysSinceUpdate,

    reasons,

    updateSignals,

    matchedRequiredSkills:
      jobRelevance.matchedRequiredSkills,

    missingRequiredSkills:
      jobRelevance.missingRequiredSkills,

    matchedPreferredSkills:
      jobRelevance.matchedPreferredSkills,

    requiredCoverage:
      jobRelevance.requiredCoverage,

    preferredCoverage:
      jobRelevance.preferredCoverage,

    availableEvidence: {
      skills:
        profile.skills.map(
          skill =>
            skill.name
        ),

      projects:
        profile.projects.map(
          project => ({
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
          experience => ({
            role:
              experience.role,
            company:
              experience.company,
            technologies:
              experience.technologies
          })
        )
    }
  };
}

function buildLocalReengagementAnalysis(
  candidates,
  job,
  windowDays
) {
  const evaluations =
    candidates.map(
      candidate =>
        evaluateReengagementCandidate(
          candidate,
          job,
          windowDays
        )
    );

  const relevant =
    evaluations.filter(
      evaluation =>
        evaluation.recentlyUpdated
    );

  relevant.sort(
    (a, b) => {
      const relevanceWeight = {
        HIGH: 3,
        MEDIUM: 2,
        LOW: 1,
        INFORMATION_UNAVAILABLE: 0
      };

      const aWeight =
        relevanceWeight[
          a.relevance
        ] || 0;

      const bWeight =
        relevanceWeight[
          b.relevance
        ] || 0;

      if (
        bWeight !==
        aWeight
      ) {
        return (
          bWeight -
          aWeight
        );
      }

      const aDays =
        a.daysSinceUpdate ??
        Number.MAX_SAFE_INTEGER;

      const bDays =
        b.daysSinceUpdate ??
        Number.MAX_SAFE_INTEGER;

      return (
        aDays -
        bDays
      );
    }
  );

  return {
    totalCandidates:
      candidates.length,

    recentlyUpdatedCount:
      relevant.length,

    windowDays,

    job:
      job
        ? {
            id: job.id,
            title: job.title
          }
        : null,

    candidates:
      relevant.slice(0, 20),

    allEvaluations:
      evaluations
  };
}

function buildSystemPrompt() {
  return `
You are the Candidate Re-engagement Agent for HireVision AI.

Your responsibility is to identify candidates who may warrant recruiter review for re-engagement based on recent, supplied profile activity and relevant job requirements.

This is a recruiter decision-support workflow.

You MUST:

1. Use only candidate data supplied in the input.
2. Use actual supplied update timestamps when available.
3. Never claim that a profile is recently updated when no usable timestamp or explicit recent-update evidence exists.
4. Never invent commit activity.
5. Never invent GitHub activity.
6. Never invent new skills or projects.
7. Never invent candidate interests or intentions.
8. Never invent a target job.
9. If a job is supplied, compare against its explicit requirements.
10. If no job is supplied, do not invent job fit.
11. Missing update data must be reported as unavailable.
12. Missing activity is not evidence that a candidate is inactive.
13. Never fabricate engagement scores.
14. Never fabricate ATS scores.
15. Never automatically contact candidates.
16. Never send emails, messages, invitations, or outreach.
17. Every outreach recommendation must require explicit human recruiter approval.
18. Provide suggested next actions, but never execute them.

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

Return valid JSON only:

{
  "summary": "short re-engagement summary",
  "jobContext": {
    "jobId": "string or null",
    "jobTitle": "string or null"
  },
  "candidates": [
    {
      "candidateId": "string",
      "candidateName": "string",
      "relevance": "HIGH|MEDIUM|LOW|INFORMATION_UNAVAILABLE",
      "reason": "evidence-grounded reason",
      "recentActivityEvidence": [],
      "matchedRequirements": [],
      "missingOrUnverifiedRequirements": [],
      "nextAction": "string",
      "outreachStatus": "REQUIRES_RECRUITER_APPROVAL",
      "confidence": 0-1
    }
  ],
  "outreachPolicy": {
    "automaticContactAllowed": false,
    "approvalRequired": true,
    "action": "REQUIRES_RECRUITER_APPROVAL"
  },
  "dataLimitations": [],
  "fairnessGuardrails": []
}

Never claim that outreach was sent.
Never create a contact action.
Never imply candidate consent or interest unless explicitly supplied.
`;
}

function buildUserPrompt(
  query,
  candidates,
  job,
  localAnalysis,
  windowDays
) {
  return `
User Query:
${
  normalizeText(query) ||
  "Identify candidates who may warrant recruiter review for re-engagement."
}

Re-engagement activity window:
${windowDays} days

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

Rules:
- Use only supplied candidate data.
- Do not invent profile updates, GitHub commits, skills, projects, jobs, or candidate intentions.
- Do not create ATS scores.
- Do not contact candidates.
- Outreach must always remain pending explicit recruiter approval.
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

function sanitizeCandidateRecommendations(
  candidates,
  candidateMap
) {
  return safeArray(
    candidates
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
          "Candidate may warrant recruiter review based on supplied profile evidence.",

        recentActivityEvidence:
          safeArray(
            item?.recentActivityEvidence ||
            item?.recent_activity_evidence
          )
            .map(
              normalizeText
            )
            .filter(Boolean),

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

        nextAction:
          normalizeText(
            item?.nextAction ||
            item?.next_action
          ) ||
          "Review the candidate profile before considering any outreach.",

        outreachStatus:
          "REQUIRES_RECRUITER_APPROVAL",

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
  job,
  windowDays
) {
  return candidates
    .map(candidate =>
      evaluateReengagementCandidate(
        candidate,
        job,
        windowDays
      )
    )
    .filter(
      evaluation =>
        evaluation.recentlyUpdated
    )
    .slice(0, 20)
    .map(evaluation => ({
      candidateId:
        evaluation.candidateId,

      candidateName:
        evaluation.candidateName,

      relevance:
        evaluation.relevance,

      reason:
        evaluation.reasons.join(
          " "
        ),

      recentActivityEvidence:
        evaluation.updateSignals,

      matchedRequirements:
        evaluation.matchedRequiredSkills,

      missingOrUnverifiedRequirements:
        evaluation.missingRequiredSkills,

      nextAction:
        "Recruiter should review the candidate profile and decide whether personalized outreach is appropriate.",

      outreachStatus:
        "REQUIRES_RECRUITER_APPROVAL",

      confidence:
        evaluation.recentlyUpdated
          ? 0.7
          : 0.2
    }));
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
      "candidateReengagementAgent",

    response:
      analysis.summary ||
      "Candidate re-engagement analysis completed using supplied profile activity.",

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

      candidates:
        analysis.candidates,

      outreachPolicy: {
        automaticContactAllowed:
          false,

        approvalRequired:
          true,

        action:
          "REQUIRES_RECRUITER_APPROVAL"
      },

      dataLimitations:
        analysis.dataLimitations,

      fairnessGuardrails:
        analysis.fairnessGuardrails,

      integrity: {
        groundedInSuppliedData: true,
        fabricatedCandidates: false,
        fabricatedActivity: false,
        fabricatedGitHubActivity: false,
        fabricatedATSScore: false,
        sensitiveAttributesUsed: false,
        outreachSent: false,
        automaticContactTriggered: false
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
      "candidateReengagementAgent",
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

  const parsedWindow =
    Number(
      context?.reengagementWindowDays ||
      context?.windowDays ||
      90
    );

  const windowDays =
    Number.isFinite(
      parsedWindow
    ) &&
    parsedWindow > 0
      ? Math.min(
          Math.floor(
            parsedWindow
          ),
          3650
        )
      : 90;

  const poolCandidates =
    candidates.slice(
      0,
      100
    );

  const localAnalysis =
    buildLocalReengagementAnalysis(
      poolCandidates,
      job,
      windowDays
    );

  const candidateMap =
    new Map(
      poolCandidates.map(
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
          poolCandidates,
          job,
          localAnalysis,
          windowDays
        ),
        true
      );

    const parsed =
      parseLLMResult(
        llmResult
      );

    const recommendations =
      sanitizeCandidateRecommendations(
        parsed?.candidates,
        candidateMap
      );

    if (
      !recommendations.length
    ) {
      return buildAgentResponse(
        query,
        job,
        {
          summary:
            job
              ? `No reliable LLM re-engagement recommendations were returned for ${job.title}; deterministic evidence matching was used.`
              : "No reliable LLM re-engagement recommendations were returned; deterministic profile-activity analysis was used.",

          candidates:
            buildLocalRecommendations(
              poolCandidates,
              job,
              windowDays
            ),

          dataLimitations: [
            "LLM output did not contain valid candidate recommendations.",
            "Only supplied profile activity and job data were evaluated.",
            "Candidates without usable update evidence cannot be classified as recently updated.",
            "External activity was not independently verified."
          ],

          fairnessGuardrails: [
            "Sensitive and protected characteristics are excluded.",
            "Missing activity data is not treated as negative evidence.",
            "Outreach always requires explicit recruiter approval."
          ]
        },
        "local-grounded-fallback"
      );
    }

    const policy =
      parsed?.outreachPolicy ||
      {};

    return buildAgentResponse(
      query,
      job,
      {
        summary:
          normalizeText(
            parsed?.summary
          ) ||
          "Candidate re-engagement analysis completed using supplied profile evidence.",

        candidates:
          recommendations,

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
      "llm+candidate-reengagement"
    );
  } catch (error) {
    console.error(
      "[CandidateReengagementAgent] LLM analysis failed:",
      error.message
    );

    return buildAgentResponse(
      query,
      job,
      {
        summary:
          job
            ? `Candidate re-engagement analysis completed for ${job.title} using deterministic profile-activity evidence.`
            : "Candidate re-engagement analysis completed using deterministic profile-activity evidence.",

        candidates:
          buildLocalRecommendations(
            poolCandidates,
            job,
            windowDays
          ),

        dataLimitations: [
          "LLM analysis was unavailable, so deterministic evidence matching was used.",
          "Only supplied candidate activity and job requirements were considered.",
          "A profile update timestamp alone does not prove candidate interest in a specific opportunity.",
          "External GitHub or social activity was not independently verified.",
          "No outreach was sent or automatically triggered."
        ],

        fairnessGuardrails: [
          "Sensitive and protected characteristics are excluded.",
          "Missing information is not treated as a negative signal.",
          "All outreach requires explicit human recruiter approval."
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
  evaluateReengagementCandidate,
  buildLocalReengagementAnalysis
};