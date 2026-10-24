const { callLLM } = require("./openaiService");
const {
  normalizeAgentResponse,
  failedAgentResponse
} = require("./agentResponseSchema");

const REQUIREMENT_TYPES = [
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

function normalizeRequirement(value) {
  if (typeof value === "string") {
    return {
      name: value.trim(),
      description: "",
      type: null
    };
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  return {
    name: normalizeText(
      value.name ||
      value.skill ||
      value.title ||
      value.requirement ||
      value.technology
    ),
    description: normalizeText(
      value.description ||
      value.details ||
      value.reason ||
      value.explanation
    ),
    type: normalizeText(
      value.type ||
      value.category ||
      value.classification
    ).toUpperCase()
  };
}

function normalizeRequirementList(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map(normalizeRequirement)
      .filter(item => item && item.name);
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
            description: String(value),
            type: null
          };
        }

        return normalizeRequirement({
          ...(value || {}),
          name: value?.name || name
        });
      })
      .filter(item => item && item.name);
  }

  return [];
}

function getRequirementContainer(job) {
  return (
    job?.requirements ||
    job?.required_skills ||
    job?.requiredSkills ||
    job?.skills ||
    {}
  );
}

function extractJobRequirements(job) {
  const requirements =
    getRequirementContainer(job);

  const mustHave = normalizeRequirementList(
    requirements?.must_have ||
    requirements?.mustHave ||
    requirements?.required ||
    requirements?.mandatory
  );

  const preferred = normalizeRequirementList(
    requirements?.preferred ||
    requirements?.preferences ||
    requirements?.preferred_skills ||
    requirements?.preferredSkills
  );

  const optional = normalizeRequirementList(
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

function getTargetJob(context) {
  const jobs = safeArray(
    context?.jobs ||
    context?.jobList ||
    context?.data?.jobs
  );

  const targetJobId =
    context?.targetJobId ||
    context?.jobId ||
    context?.target_job_id;

  if (!jobs.length) {
    return null;
  }

  if (targetJobId !== undefined && targetJobId !== null) {
    const exactJob = jobs.find(
      job =>
        normalizeId(
          job?.id ||
          job?.job_id ||
          job?._id
        ) === normalizeId(targetJobId)
    );

    if (exactJob) {
      return exactJob;
    }
  }

  return jobs[0];
}

function extractTextRequirements(job) {
  const description = normalizeText(
    job?.description ||
    job?.job_description ||
    job?.jobDescription
  );

  const responsibilities = safeArray(
    job?.responsibilities
  )
    .map(normalizeText)
    .filter(Boolean);

  const qualifications = safeArray(
    job?.qualifications ||
    job?.education_requirements ||
    job?.educationRequirements
  )
    .map(normalizeText)
    .filter(Boolean);

  const experience = normalizeText(
    job?.experience ||
    job?.experience_required ||
    job?.experienceRequired
  );

  return {
    description,
    responsibilities,
    qualifications,
    experience
  };
}

function deduplicateRequirements(
  requirements
) {
  const seen = new Set();
  const result = [];

  requirements.forEach(requirement => {
    if (!requirement?.name) {
      return;
    }

    const key =
      requirement.name
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(requirement);
  });

  return result;
}

function buildRequirementInventory(job) {
  const structured =
    extractJobRequirements(job);

  const text =
    extractTextRequirements(job);

  const mustHave = deduplicateRequirements(
    structured.mustHave
  );

  const preferred = deduplicateRequirements(
    structured.preferred
  );

  const optional = deduplicateRequirements(
    structured.optional
  );

  const general = deduplicateRequirements(
    structured.general
  );

  const assignedNames = new Set([
    ...mustHave,
    ...preferred,
    ...optional
  ].map(
    item =>
      item.name
        .toLowerCase()
        .trim()
  ));

  const unclassified = general.filter(
    item =>
      !assignedNames.has(
        item.name
          .toLowerCase()
          .trim()
      )
  );

  return {
    mustHave,
    preferred,
    optional,
    unclassified,
    textContext: text
  };
}

function classifyRequirementHeuristically(
  requirement,
  sourceType
) {
  const explicitType =
    normalizeText(
      requirement?.type
    ).toUpperCase();

  if (
    REQUIREMENT_TYPES.includes(
      explicitType
    )
  ) {
    return explicitType;
  }

  if (
    sourceType === "must_have" ||
    sourceType === "required" ||
    sourceType === "mandatory"
  ) {
    return "MUST_HAVE";
  }

  if (
    sourceType === "preferred" ||
    sourceType === "preferred_skills"
  ) {
    return "PREFERRED";
  }

  if (
    sourceType === "optional" ||
    sourceType === "nice_to_have"
  ) {
    return "OPTIONAL";
  }

  return "UNCLEAR";
}

function buildLocalClassification(
  inventory
) {
  const result = [];

  inventory.mustHave.forEach(
    requirement => {
      result.push({
        requirement: requirement.name,
        classification: classifyRequirementHeuristically(
          requirement,
          "must_have"
        ),
        reason:
          requirement.description ||
          "Requirement is explicitly present in the job's mandatory requirement data.",
        assessmentMethod:
          "Use a role-relevant technical assessment, structured interview, portfolio evidence, or another objective screening method."
      });
    }
  );

  inventory.preferred.forEach(
    requirement => {
      result.push({
        requirement: requirement.name,
        classification: classifyRequirementHeuristically(
          requirement,
          "preferred"
        ),
        reason:
          requirement.description ||
          "Requirement is explicitly listed as preferred.",
        assessmentMethod:
          "Validate through relevant project evidence, technical discussion, portfolio review, or practical assessment."
      });
    }
  );

  inventory.optional.forEach(
    requirement => {
      result.push({
        requirement: requirement.name,
        classification: classifyRequirementHeuristically(
          requirement,
          "optional"
        ),
        reason:
          requirement.description ||
          "Requirement is explicitly listed as optional or nice-to-have.",
        assessmentMethod:
          "Use as a differentiator after core requirements have been evaluated."
      });
    }
  );

  inventory.unclassified.forEach(
    requirement => {
      result.push({
        requirement: requirement.name,
        classification: "UNCLEAR",
        reason:
          requirement.description ||
          "Requirement exists in the supplied job data but its priority is not explicitly defined.",
        assessmentMethod:
          "Clarify its priority, expected proficiency, and screening criteria with the hiring team."
      });
    }
  );

  return result;
}

function buildLocalAnalysis(
  job,
  query
) {
  const inventory =
    buildRequirementInventory(job);

  const classifications =
    buildLocalClassification(
      inventory
    );

  const mustHaveCount =
    classifications.filter(
      item =>
        item.classification ===
        "MUST_HAVE"
    ).length;

  const preferredCount =
    classifications.filter(
      item =>
        item.classification ===
        "PREFERRED"
    ).length;

  const optionalCount =
    classifications.filter(
      item =>
        item.classification ===
        "OPTIONAL"
    ).length;

  const unclearCount =
    classifications.filter(
      item =>
        item.classification ===
        "UNCLEAR"
    ).length;

  const missingAreas = [];

  if (mustHaveCount === 0) {
    missingAreas.push(
      "No explicitly defined must-have requirements were found."
    );
  }

  if (unclearCount > 0) {
    missingAreas.push(
      `${unclearCount} requirement(s) have no explicit priority classification.`
    );
  }

  if (
    !inventory.textContext.description &&
    classifications.length === 0
  ) {
    missingAreas.push(
      "The job description does not contain enough requirement information for a meaningful classification."
    );
  }

  return {
    query:
      normalizeText(query),

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
        ) || "Untitled Job"
    },

    summary: {
      totalRequirements:
        classifications.length,
      mustHave: mustHaveCount,
      preferred: preferredCount,
      optional: optionalCount,
      unclear: unclearCount
    },

    requirements:
      classifications,

    jobContext:
      inventory.textContext,

    missingAreas,

    recommendations: [
      "Define objective screening criteria for every must-have requirement.",
      "Specify expected proficiency or minimum experience where possible.",
      "Separate mandatory requirements from preferred qualifications.",
      "Clarify ambiguous requirements before using them for candidate ranking.",
      "Use consistent assessment criteria across candidates for the same role."
    ]
  };
}

function buildSystemPrompt() {
  return `
You are the Job Requirement Agent for HireVision AI.

Your responsibility is to analyze an actual job posting and classify its requirements for recruiter screening.

Classify each requirement into exactly one of:

MUST_HAVE:
Essential for performing the core responsibilities of the role.

PREFERRED:
Valuable qualification that improves candidate fit but is not necessarily essential.

OPTIONAL:
Useful nice-to-have capability that should not materially disqualify a candidate when absent.

UNCLEAR:
The requirement exists, but the supplied job data does not clearly establish its priority, expected proficiency, or meaning.

CRITICAL RULES:

1. Use ONLY information supplied in the job data.
2. NEVER invent requirements.
3. NEVER assume React, JavaScript, TypeScript, Python, Docker, AWS, or any other technology unless it appears in the supplied job data.
4. NEVER replace missing requirements with generic technology defaults.
5. Do not treat a technology as MUST_HAVE simply because it is common in the industry.
6. Do not claim a certification, degree, years of experience, or technology is mandatory unless the job data supports that conclusion.
7. Preserve the actual wording and intent of supplied requirements.
8. If a requirement is ambiguous, classify it as UNCLEAR rather than guessing.
9. Explain why each classification was chosen.
10. Provide practical, objective assessment methods.
11. Assessment methods must be suggestions, not claims that an assessment has already happened.
12. Do not fabricate recruiter metrics or candidate data.
13. Be professional and concise.
14. Return valid JSON only.

Required JSON structure:

{
  "summary": "short recruiter-friendly summary",
  "requirements": [
    {
      "requirement": "string",
      "classification": "MUST_HAVE|PREFERRED|OPTIONAL|UNCLEAR",
      "reason": "string",
      "assessmentMethod": "string",
      "confidence": 0-1
    }
  ],
  "roleObservations": [],
  "ambiguities": [],
  "missingInformation": [],
  "recommendations": []
}

Confidence must reflect the clarity of the supplied job data, not general industry knowledge.
`;
}

function buildUserPrompt(
  job,
  query,
  localAnalysis,
  context
) {
  return `
Analyze the following actual job data.

Job:
${JSON.stringify(
  job,
  null,
  2
)}

Locally extracted requirement analysis:
${JSON.stringify(
  localAnalysis,
  null,
  2
)}

User query:
${
  normalizeText(query) ||
  "Analyze and classify the requirements for this job."
}

Additional context:
${JSON.stringify(
  {
    targetJobId:
      context?.targetJobId ||
      context?.jobId ||
      null,
    recruiterId:
      context?.recruiterId ||
      context?.recruiter_id ||
      null
  },
  null,
  2
)}

Important:
- Do not add requirements that are absent from the job data.
- Do not assume industry-standard requirements.
- Do not invent experience requirements.
- Do not invent screening results.
- If the job data is incomplete, explicitly report what is missing.
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
      requirements: [],
      roleObservations: [],
      ambiguities: [],
      missingInformation: [],
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

  return REQUIREMENT_TYPES.includes(
    normalized
  )
    ? normalized
    : "UNCLEAR";
}

function sanitizeRequirements(
  requirements
) {
  return safeArray(
    requirements
  ).map(item => {
    if (
      typeof item === "string"
    ) {
      return {
        requirement: item,
        classification: "UNCLEAR",
        reason:
          "The requirement was returned without enough classification context.",
        assessmentMethod:
          "Clarify the requirement with the hiring team.",
        confidence: 0
      };
    }

    const confidence =
      typeof item?.confidence ===
        "number"
        ? Math.max(
            0,
            Math.min(
              1,
              item.confidence
            )
          )
        : 0.5;

    return {
      requirement:
        normalizeText(
          item?.requirement ||
          item?.name ||
          item?.skill
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
        "Classification based on the supplied job information.",

      assessmentMethod:
        normalizeText(
          item?.assessmentMethod ||
          item?.assessment_method
        ) ||
        "Use an objective role-relevant assessment.",

      confidence
    };
  }).filter(
    item => item.requirement
  );
}

function sanitizeAnalysis(
  analysis
) {
  let summaryText = "";
  if (typeof analysis?.summary === "string") {
    summaryText = analysis.summary.trim();
  } else if (analysis?.summary && typeof analysis.summary === "object") {
    const s = analysis.summary;
    summaryText = `Identified ${s.totalRequirements || 0} requirement(s) (${s.mustHave || 0} must-have, ${s.preferred || 0} preferred, ${s.optional || 0} optional).`;
  }

  return {
    summary:
      summaryText ||
      "Job requirements were analyzed using the supplied job data.",

    requirements:
      sanitizeRequirements(
        analysis?.requirements
      ),

    roleObservations:
      safeArray(
        analysis?.roleObservations
      )
        .map(normalizeText)
        .filter(Boolean),

    ambiguities:
      safeArray(
        analysis?.ambiguities
      )
        .map(normalizeText)
        .filter(Boolean),

    missingInformation:
      safeArray(
        analysis?.missingInformation
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

function mergeMissingInformation(
  analysis,
  localAnalysis
) {
  const existing = new Set(
    analysis.missingInformation.map(
      item =>
        item.toLowerCase()
    )
  );

  localAnalysis.missingAreas.forEach(
    item => {
      const key =
        item.toLowerCase();

      if (!existing.has(key)) {
        analysis.missingInformation.push(
          item
        );
      }
    }
  );

  return analysis;
}

function buildAgentResponse(
  job,
  query,
  analysis,
  source
) {
  const sanitized =
    sanitizeAnalysis(
      analysis
    );

  const counts = {
    MUST_HAVE: 0,
    PREFERRED: 0,
    OPTIONAL: 0,
    UNCLEAR: 0
  };

  sanitized.requirements.forEach(
    item => {
      counts[
        item.classification
      ] += 1;
    }
  );

  return normalizeAgentResponse({
    success: true,
    status: "completed",
    agent: "jobRequirementAgent",

    response:
      sanitized.summary,

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
          ) || "Untitled Job"
      },

      query:
        normalizeText(query),

      classificationCounts:
        counts,

      ...sanitized,

      integrity: {
        groundedInJobData: true,
        fabricatedRequirements: false,
        externalDataUsed: false,
        candidateEvaluationPerformed: false
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
  const targetJob =
    getTargetJob(
      context
    );

  if (!targetJob) {
    return failedAgentResponse(
      "jobRequirementAgent",
      "No job data is currently available. Please provide a registered job before analyzing its requirements."
    );
  }

  const localAnalysis =
    buildLocalAnalysis(
      targetJob,
      query
    );

  try {
    const llmResult =
      await callLLM(
        buildSystemPrompt(),
        buildUserPrompt(
          targetJob,
          query,
          localAnalysis,
          context
        ),
        true
      );

    let analysis =
      sanitizeAnalysis(
        parseLLMResult(
          llmResult
        )
      );

    analysis =
      mergeMissingInformation(
        analysis,
        localAnalysis
      );

    if (
      analysis.requirements
        .length === 0 &&
      localAnalysis.requirements
        .length > 0
    ) {
      analysis =
        sanitizeAnalysis(
          localAnalysis
        );
    }

    return buildAgentResponse(
      targetJob,
      query,
      analysis,
      "llm+job-data"
    );
  } catch (error) {
    console.error(
      "[JobRequirementAgent] LLM analysis failed:",
      error.message
    );

    return buildAgentResponse(
      targetJob,
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
  extractJobRequirements,
  buildRequirementInventory,
  buildLocalAnalysis
};