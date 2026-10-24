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

function normalizeSkill(skill) {
  if (typeof skill === "string") {
    return skill.trim();
  }

  if (!skill || typeof skill !== "object") {
    return "";
  }

  return normalizeText(
    skill.name ||
    skill.skill ||
    skill.title ||
    skill.label
  );
}

function getSkills(candidate) {
  if (Array.isArray(candidate?.skills)) {
    return candidate.skills
      .map(normalizeSkill)
      .filter(Boolean);
  }

  if (
    candidate?.skills &&
    typeof candidate.skills === "object"
  ) {
    return Object.keys(
      candidate.skills
    ).filter(Boolean);
  }

  return [];
}

function getProjects(candidate) {
  return safeArray(
    candidate?.projects
  );
}

function getExperience(candidate) {
  return safeArray(
    candidate?.experience ||
    candidate?.work_experience ||
    candidate?.workExperience
  );
}

function getEducation(candidate) {
  return safeArray(
    candidate?.education
  );
}

function getProjectText(project) {
  if (typeof project === "string") {
    return project;
  }

  if (!project || typeof project !== "object") {
    return "";
  }

  return [
    project.title,
    project.name,
    project.project_name,
    project.description,
    project.summary,
    project.technologies,
    project.tech_stack,
    project.skills,
    project.github_link,
    project.live_link
  ]
    .flat()
    .map(normalizeText)
    .filter(Boolean)
    .join(" ");
}

function getExperienceText(experience) {
  if (typeof experience === "string") {
    return experience;
  }

  if (
    !experience ||
    typeof experience !== "object"
  ) {
    return "";
  }

  return [
    experience.role,
    experience.title,
    experience.position,
    experience.company,
    experience.organization,
    experience.description,
    experience.summary,
    experience.technologies,
    experience.skills
  ]
    .flat()
    .map(normalizeText)
    .filter(Boolean)
    .join(" ");
}

function getEducationText(education) {
  if (typeof education === "string") {
    return education;
  }

  if (
    !education ||
    typeof education !== "object"
  ) {
    return "";
  }

  return [
    education.degree,
    education.course,
    education.program,
    education.field,
    education.institution,
    education.university,
    education.description
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join(" ");
}

function buildCandidateSearchDocument(
  candidate
) {
  const skills =
    getSkills(candidate);

  const projects =
    getProjects(candidate);

  const experience =
    getExperience(candidate);

  const education =
    getEducation(candidate);

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
      ) || "Unnamed Candidate",

    skills,

    projects: projects.map(
      getProjectText
    ),

    experience: experience.map(
      getExperienceText
    ),

    education: education.map(
      getEducationText
    ),

    careerObjective:
      normalizeText(
        candidate?.career_objective ||
        candidate?.careerObjective ||
        candidate?.objective ||
        candidate?.summary ||
        candidate?.bio
      ),

    location:
      normalizeText(
        candidate?.location ||
        candidate?.city ||
        candidate?.address
      ),

    source:
      normalizeText(
        candidate?.source ||
        candidate?.source_channel ||
        candidate?.sourceChannel
      )
  };
}

function tokenizeQuery(query) {
  return normalizeText(query)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+#.\- ]/gu, " ")
    .split(/\s+/)
    .map(token => token.trim())
    .filter(token => token.length >= 2);
}

function calculateCandidateMatch(
  candidate,
  query
) {
  const document =
    buildCandidateSearchDocument(
      candidate
    );

  const queryTokens =
    tokenizeQuery(query);

  if (!queryTokens.length) {
    return {
      score: 0,
      matchedTerms: [],
      matchedSkills: [],
      matchedProjects: [],
      matchedExperience: []
    };
  }

  const searchableFields = {
    name: document.name.toLowerCase(),
    skills: document.skills
      .join(" ")
      .toLowerCase(),
    projects: document.projects
      .join(" ")
      .toLowerCase(),
    experience: document.experience
      .join(" ")
      .toLowerCase(),
    education: document.education
      .join(" ")
      .toLowerCase(),
    careerObjective:
      document.careerObjective.toLowerCase(),
    location:
      document.location.toLowerCase()
  };

  const matchedTerms = [];

  queryTokens.forEach(token => {
    const found =
      Object.values(
        searchableFields
      ).some(field =>
        field.includes(token)
      );

    if (found) {
      matchedTerms.push(token);
    }
  });

  const matchedSkills =
    document.skills.filter(skill =>
      queryTokens.some(token =>
        skill
          .toLowerCase()
          .includes(token)
      )
    );

  const matchedProjects =
    document.projects.filter(project =>
      queryTokens.some(token =>
        project
          .toLowerCase()
          .includes(token)
      )
    );

  const matchedExperience =
    document.experience.filter(experience =>
      queryTokens.some(token =>
        experience
          .toLowerCase()
          .includes(token)
      )
    );

  let score = 0;

  queryTokens.forEach(token => {
    if (
      document.skills.some(skill =>
        skill
          .toLowerCase()
          .includes(token)
      )
    ) {
      score += 5;
    }

    if (
      document.projects.some(project =>
        project
          .toLowerCase()
          .includes(token)
      )
    ) {
      score += 4;
    }

    if (
      document.experience.some(experience =>
        experience
          .toLowerCase()
          .includes(token)
      )
    ) {
      score += 4;
    }

    if (
      document.careerObjective
        .toLowerCase()
        .includes(token)
    ) {
      score += 2;
    }

    if (
      document.education.some(education =>
        education
          .toLowerCase()
          .includes(token)
      )
    ) {
      score += 1;
    }

    if (
      document.name
        .toLowerCase()
        .includes(token)
    ) {
      score += 1;
    }

    if (
      document.location
        .toLowerCase()
        .includes(token)
    ) {
      score += 1;
    }
  });

  const maximumPossibleScore =
    queryTokens.length * 5;

  const normalizedScore =
    maximumPossibleScore > 0
      ? Math.min(
          100,
          Math.round(
            (score /
              maximumPossibleScore) *
              100
          )
        )
      : 0;

  return {
    score: normalizedScore,
    matchedTerms,
    matchedSkills,
    matchedProjects,
    matchedExperience
  };
}

function rankCandidates(
  candidates,
  query
) {
  return candidates
    .map(candidate => {
      const match =
        calculateCandidateMatch(
          candidate,
          query
        );

      return {
        candidate,
        ...match
      };
    })
    .filter(
      item =>
        item.score > 0
    )
    .sort(
      (a, b) =>
        b.score -
        a.score
    );
}

function normalizeCandidateForLLM(
  candidate,
  match
) {
  const document =
    buildCandidateSearchDocument(
      candidate
    );

  return {
    id: document.id,
    full_name: document.name,
    skills: document.skills,
    projects: safeArray(
      candidate?.projects
    ),
    experience: safeArray(
      candidate?.experience ||
      candidate?.work_experience ||
      candidate?.workExperience
    ),
    education: safeArray(
      candidate?.education
    ),
    career_objective:
      document.careerObjective,
    location:
      document.location,
    source:
      document.source,
    localMatch: {
      score: match.score,
      matchedTerms:
        match.matchedTerms,
      matchedSkills:
        match.matchedSkills,
      matchedProjects:
        match.matchedProjects.length,
      matchedExperience:
        match.matchedExperience.length
    }
  };
}

function buildSystemPrompt() {
  return `
You are the Candidate Discovery Agent for HireVision AI.

Your responsibility is to discover candidates from the candidate records supplied to you and determine which candidates are relevant to the recruiter's search query.

IMPORTANT:
The candidate records are the source of truth.

Rules:
1. Only mention candidates that exist in the supplied data.
2. Never invent candidate names, IDs, skills, projects, companies, education, experience, scores, URLs, or achievements.
3. Never fabricate an ATS score.
4. Never claim a candidate is verified unless verification evidence is explicitly supplied.
5. Do not treat a keyword match as proof of expertise.
6. Distinguish between direct matches and broader/partial matches.
7. A missing skill is not evidence that the candidate lacks the skill.
8. Do not reject candidates solely because some information is missing.
9. Use the local match information as a signal, but independently reason over the supplied candidate data.
10. If no candidate is relevant, clearly say so.
11. If the query is broad, return the most relevant candidates based on the supplied data.
12. Keep the output recruiter-friendly and concise.
13. Do not create links unless an actual URL is present in the candidate data.
14. Do not claim that external profiles were inspected unless their actual evidence is supplied.
15. Return valid JSON only.

Required JSON structure:

{
  "summary": "short recruiter-friendly discovery summary",
  "results": [
    {
      "candidateId": "string",
      "candidateName": "string",
      "matchType": "DIRECT|PARTIAL|RELATED",
      "relevanceScore": 0-100,
      "matchedSkills": [],
      "matchedEvidence": [],
      "reason": "why the candidate matches",
      "missingInformation": []
    }
  ],
  "searchInterpretation": "how the query was interpreted",
  "recommendations": []
}

relevanceScore is an AI relevance estimate based ONLY on the supplied candidate data. It is not an ATS score, hiring probability, or employment prediction.
`;
}

function buildUserPrompt(
  query,
  rankedCandidates,
  context
) {
  const candidates =
    rankedCandidates.map(item =>
      normalizeCandidateForLLM(
        item.candidate,
        item
      )
    );

  return `
Recruiter Search Query:
${normalizeText(query)}

Candidate Records:
${JSON.stringify(
  candidates,
  null,
  2
)}

Additional Search Context:
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
    filters:
      context?.filters ||
      null
  },
  null,
  2
)}

Analyze only these candidate records.
Do not add candidates that are not present.
Do not invent missing details.
`;
}

function parseLLMResult(result) {
  if (typeof result !== "string") {
    return result;
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
    return JSON.parse(cleaned);
  } catch {
    return {
      summary: cleaned,
      results: [],
      searchInterpretation: "",
      recommendations: []
    };
  }
}

function sanitizeResults(
  results,
  candidateMap
) {
  return safeArray(results)
    .map(item => {
      const candidateId =
        item?.candidateId ||
        item?.candidate_id ||
        item?.id;

      const candidate =
        candidateMap.get(
          normalizeId(candidateId)
        );

      if (!candidate) {
        return null;
      }

      const relevanceScore =
        typeof item?.relevanceScore ===
          "number"
          ? Math.max(
              0,
              Math.min(
                100,
                item.relevanceScore
              )
            )
          : null;

      return {
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
          ) || "Unnamed Candidate",

        matchType:
          [
            "DIRECT",
            "PARTIAL",
            "RELATED"
          ].includes(
            normalizeText(
              item?.matchType
            ).toUpperCase()
          )
            ? normalizeText(
                item.matchType
              ).toUpperCase()
            : "RELATED",

        relevanceScore,

        matchedSkills:
          safeArray(
            item?.matchedSkills
          )
            .map(normalizeText)
            .filter(Boolean),

        matchedEvidence:
          safeArray(
            item?.matchedEvidence
          )
            .map(normalizeText)
            .filter(Boolean),

        reason:
          normalizeText(
            item?.reason
          ) ||
          "Candidate information is relevant to the supplied search query.",

        missingInformation:
          safeArray(
            item?.missingInformation
          )
            .map(normalizeText)
            .filter(Boolean)
      };
    })
    .filter(Boolean);
}

function ensureCandidateIntegrity(
  results,
  rankedCandidates
) {
  const rankedMap = new Map(
    rankedCandidates.map(item => [
      normalizeId(
        item.candidate?.user_id ||
        item.candidate?.id ||
        item.candidate?._id
      ),
      item
    ])
  );

  return results.filter(
    result =>
      rankedMap.has(
        normalizeId(
          result.candidateId
        )
      )
  );
}

function buildLocalAnalysis(
  query,
  candidates
) {
  const ranked =
    rankCandidates(
      candidates,
      query
    );

  const results =
    ranked.map(item => ({
      candidateId:
        item.candidate?.user_id ||
        item.candidate?.id ||
        item.candidate?._id ||
        null,

      candidateName:
        normalizeText(
          item.candidate?.full_name ||
          item.candidate?.name
        ) || "Unnamed Candidate",

      matchType:
        item.score >= 70
          ? "DIRECT"
          : item.score >= 35
            ? "PARTIAL"
            : "RELATED",

      relevanceScore:
        item.score,

      matchedSkills:
        item.matchedSkills,

      matchedEvidence: [
        ...item.matchedSkills.map(
          skill =>
            `Skill match: ${skill}`
        ),
        ...item.matchedProjects
          .slice(0, 3)
          .map(
            project =>
              `Project evidence: ${project}`
          ),
        ...item.matchedExperience
          .slice(0, 3)
          .map(
            experience =>
              `Experience evidence: ${experience}`
          )
      ],

      reason:
        item.score > 0
          ? `Candidate data contains terms relevant to the search query, with stronger matches in the areas identified above.`
          : "No relevant supplied candidate data was found.",

      missingInformation: []
    }));

  return {
    query:
      normalizeText(query),

    totalCandidates:
      candidates.length,

    matchedCandidates:
      results.length,

    results,

    searchInterpretation:
      normalizeText(query)
        ? `Search was performed against candidate names, skills, projects, experience, education, career objectives, and available profile information.`
        : "No specific search query was supplied.",

    recommendations: [
      "Review the matched evidence rather than relying only on the relevance score.",
      "Use role-specific screening criteria before making hiring decisions.",
      "Request additional evidence when an important requirement is only partially supported."
    ]
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
    agent: "candidateDiscoveryAgent",

    response:
      analysis.summary ||
      `Found ${safeArray(
        analysis.results
      ).length} candidate(s) relevant to the search.`,

    data: {
      query:
        normalizeText(query),

      totalCandidates:
        analysis.totalCandidates,

      matchedCandidates:
        analysis.matchedCandidates,

      results:
        analysis.results,

      searchInterpretation:
        analysis.searchInterpretation,

      recommendations:
        analysis.recommendations,

      integrity: {
        groundedInCandidateData: true,
        fabricatedCandidates: false,
        fabricatedATSScore: false,
        externalDataUsed: false
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

function buildNoMatchResponse(
  query,
  candidates
) {
  const localAnalysis =
    buildLocalAnalysis(
      query,
      candidates
    );

  return buildAgentResponse(
    query,
    {
      ...localAnalysis,
      summary:
        `No candidate profile in the supplied database matched the search query "${normalizeText(query)}" strongly enough to return as a relevant result.`,
      recommendations: [
        "Try broader or alternative skill names.",
        "Search by a specific role, technology, project, or experience keyword.",
        "Add more candidate profile evidence if the database is incomplete."
      ]
    },
    "local-grounded"
  );
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
      "candidateDiscoveryAgent",
      "No candidates are currently registered in the supplied system data."
    );
  }

  const normalizedQuery =
    normalizeText(query);

  if (!normalizedQuery) {
    return buildAgentResponse(
      query,
      {
        summary:
          "No specific search query was supplied.",
        totalCandidates:
          candidates.length,
        matchedCandidates: 0,
        results: [],
        searchInterpretation:
          "A candidate search requires a role, skill, technology, project, experience, or other search criterion.",
        recommendations: [
          "Specify the target role or skill.",
          "You can search by technologies, projects, experience, education, or career objective."
        ]
      },
      "local-grounded"
    );
  }

  const rankedCandidates =
    rankCandidates(
      candidates,
      normalizedQuery
    );

  if (!rankedCandidates.length) {
    return buildNoMatchResponse(
      normalizedQuery,
      candidates
    );
  }

  const candidateMap =
    new Map(
      candidates.map(candidate => [
        normalizeId(
          candidate?.user_id ||
          candidate?.id ||
          candidate?._id
        ),
        candidate
      ])
    );

  try {
    const llmResult =
      await callLLM(
        buildSystemPrompt(),
        buildUserPrompt(
          normalizedQuery,
          rankedCandidates,
          context
        ),
        true
      );

    const parsed =
      parseLLMResult(
        llmResult
      );

    const sanitizedResults =
      sanitizeResults(
        parsed?.results,
        candidateMap
      );

    const verifiedResults =
      ensureCandidateIntegrity(
        sanitizedResults,
        rankedCandidates
      );

    const localMap =
      new Map(
        rankedCandidates.map(item => [
          normalizeId(
            item.candidate?.user_id ||
            item.candidate?.id ||
            item.candidate?._id
          ),
          item
        ])
      );

    const enrichedResults =
      verifiedResults.map(
        result => {
          const local =
            localMap.get(
              normalizeId(
                result.candidateId
              )
            );

          return {
            ...result,
            relevanceScore:
              result.relevanceScore !==
                null
                ? result.relevanceScore
                : local?.score || 0
          };
        }
      );

    if (
      enrichedResults.length === 0
    ) {
      const localAnalysis =
        buildLocalAnalysis(
          normalizedQuery,
          candidates
        );

      return buildAgentResponse(
        normalizedQuery,
        {
          ...localAnalysis,
          summary:
            "The supplied candidate records were searched, but the AI analysis did not return a usable candidate result. The local evidence-based search is provided instead."
        },
        "local-grounded-fallback"
      );
    }

    return buildAgentResponse(
      normalizedQuery,
      {
        summary:
          normalizeText(
            parsed?.summary
          ) ||
          `Found ${enrichedResults.length} relevant candidate(s).`,

        totalCandidates:
          candidates.length,

        matchedCandidates:
          enrichedResults.length,

        results:
          enrichedResults,

        searchInterpretation:
          normalizeText(
            parsed?.searchInterpretation
          ) ||
          "Candidates were evaluated against the supplied search query and candidate profile data.",

        recommendations:
          safeArray(
            parsed?.recommendations
          )
            .map(normalizeText)
            .filter(Boolean)
      },
      "llm+local-search"
    );
  } catch (error) {
    console.error(
      "[CandidateDiscoveryAgent] LLM analysis failed:",
      error.message
    );

    const localAnalysis =
      buildLocalAnalysis(
        normalizedQuery,
        candidates
      );

    return buildAgentResponse(
      normalizedQuery,
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
  rankCandidates,
  calculateCandidateMatch,
  buildCandidateSearchDocument,
  buildLocalAnalysis
};