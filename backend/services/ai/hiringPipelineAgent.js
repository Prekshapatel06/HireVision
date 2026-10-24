const { callLLM } = require("./openaiService");
const {
  normalizeAgentResponse,
  failedAgentResponse
} = require("./agentResponseSchema");

const PIPELINE_STAGES = [
  "APPLIED",
  "SCREENED",
  "SHORTLISTED",
  "ASSESSMENT",
  "INTERVIEW",
  "HIRED",
  "REJECTED",
  "WITHDRAWN"
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

function normalizeStage(value) {
  const raw = normalizeText(value);

  if (!raw) {
    return null;
  }

  const normalized =
    raw
      .toUpperCase()
      .replace(/[\s-]+/g, "_");

  const aliases = {
    APPLICATION: "APPLIED",
    APPLIED: "APPLIED",
    APPLY: "APPLIED",
    SCREEN: "SCREENED",
    SCREENING: "SCREENED",
    SCREENED: "SCREENED",
    SHORTLIST: "SHORTLISTED",
    SHORTLISTED: "SHORTLISTED",
    ASSESSMENT: "ASSESSMENT",
    TEST: "ASSESSMENT",
    TECHNICAL_ASSESSMENT: "ASSESSMENT",
    INTERVIEW: "INTERVIEW",
    INTERVIEWING: "INTERVIEW",
    HIRED: "HIRED",
    HIRE: "HIRED",
    REJECTED: "REJECTED",
    REJECT: "REJECTED",
    WITHDRAWN: "WITHDRAWN",
    WITHDRAW: "WITHDRAWN"
  };

  return aliases[normalized] || null;
}

function getCandidateId(candidate) {
  return (
    candidate?.user_id ||
    candidate?.candidate_id ||
    candidate?.candidateId ||
    candidate?.id ||
    candidate?._id ||
    null
  );
}

function getCandidateName(candidate) {
  return (
    normalizeText(
      candidate?.full_name ||
      candidate?.name
    ) || "Candidate"
  );
}

function getStatusValue(candidate) {
  return (
    candidate?.pipeline_stage ||
    candidate?.pipelineStage ||
    candidate?.application_stage ||
    candidate?.applicationStage ||
    candidate?.application_status ||
    candidate?.applicationStatus ||
    candidate?.status ||
    candidate?.stage ||
    null
  );
}

function getApplicationRecords(candidate) {
  const records = [];

  const collections = [
    candidate?.applications,
    candidate?.job_applications,
    candidate?.jobApplications,
    candidate?.application_records,
    candidate?.applicationRecords
  ];

  collections.forEach(collection => {
    safeArray(collection).forEach(record => {
      if (record && typeof record === "object") {
        records.push(record);
      }
    });
  });

  return records;
}

function extractPipelineRecords(
  candidates,
  context
) {
  const records = [];

  safeArray(
    context?.applications ||
    context?.jobApplications ||
    context?.applicationRecords ||
    context?.data?.applications
  ).forEach(application => {
    if (
      application &&
      typeof application === "object"
    ) {
      records.push({
        ...application,
        _source: "application"
      });
    }
  });

  candidates.forEach(candidate => {
    const applications =
      getApplicationRecords(
        candidate
      );

    if (applications.length) {
      applications.forEach(application => {
        records.push({
          ...application,
          candidate_id:
            application.candidate_id ||
            application.candidateId ||
            getCandidateId(candidate),
          candidate_name:
            application.candidate_name ||
            application.candidateName ||
            getCandidateName(candidate),
          _source: "candidate.application"
        });
      });

      return;
    }

    const stage =
      normalizeStage(
        getStatusValue(
          candidate
        )
      );

    if (stage) {
      records.push({
        candidate_id:
          getCandidateId(
            candidate
          ),

        candidate_name:
          getCandidateName(
            candidate
          ),

        stage,

        status:
          getStatusValue(
            candidate
          ),

        job_id:
          candidate?.job_id ||
          candidate?.jobId ||
          null,

        job_title:
          candidate?.job_title ||
          candidate?.jobTitle ||
          null,

        created_at:
          candidate?.created_at ||
          candidate?.createdAt ||
          null,

        updated_at:
          candidate?.updated_at ||
          candidate?.updatedAt ||
          null,

        _source:
          "candidate"
      });
    }
  });

  return records;
}

function getRecordStage(record) {
  return normalizeStage(
    record?.stage ||
    record?.pipeline_stage ||
    record?.pipelineStage ||
    record?.application_stage ||
    record?.applicationStage ||
    record?.status ||
    record?.application_status ||
    record?.applicationStatus
  );
}

function getRecordCandidateId(record) {
  return (
    record?.candidate_id ||
    record?.candidateId ||
    record?.user_id ||
    record?.userId ||
    record?.id ||
    null
  );
}

function getRecordCandidateName(record) {
  return (
    normalizeText(
      record?.candidate_name ||
      record?.candidateName ||
      record?.full_name ||
      record?.name
    ) || "Candidate"
  );
}

function getRecordJobId(record) {
  return (
    record?.job_id ||
    record?.jobId ||
    null
  );
}

function getRecordJobTitle(record) {
  return normalizeText(
    record?.job_title ||
    record?.jobTitle ||
    ""
  );
}

function filterRecords(
  records,
  context
) {
  const targetJobId =
    context?.targetJobId ||
    context?.jobId ||
    null;

  if (!targetJobId) {
    return records;
  }

  const filtered =
    records.filter(record => {
      const recordJobId =
        getRecordJobId(
          record
        );

      return (
        !recordJobId ||
        normalizeId(
          recordJobId
        ) ===
        normalizeId(
          targetJobId
        )
      );
    });

  return filtered.length
    ? filtered
    : records;
}

function countStages(records) {
  const counts = {};

  PIPELINE_STAGES.forEach(
    stage => {
      counts[stage] = 0;
    }
  );

  records.forEach(record => {
    const stage =
      getRecordStage(
        record
      );

    if (
      stage &&
      Object.prototype.hasOwnProperty.call(
        counts,
        stage
      )
    ) {
      counts[stage] += 1;
    }
  });

  return counts;
}

function calculateConversion(
  fromCount,
  toCount
) {
  if (
    typeof fromCount !== "number" ||
    typeof toCount !== "number" ||
    fromCount <= 0
  ) {
    return null;
  }

  return Math.round(
    (toCount /
      fromCount) *
      100
  );
}

function buildFunnel(
  counts
) {
  const stages = [
    "APPLIED",
    "SCREENED",
    "SHORTLISTED",
    "ASSESSMENT",
    "INTERVIEW",
    "HIRED"
  ];

  return stages.map(
    (stage, index) => {
      const count =
        counts[stage] || 0;

      const previousStage =
        index > 0
          ? stages[index - 1]
          : null;

      const previousCount =
        previousStage
          ? counts[
              previousStage
            ] || 0
          : null;

      return {
        stage,
        count,
        previousStage,
        conversionFromPrevious:
          previousStage
            ? calculateConversion(
                previousCount,
                count
              )
            : null
      };
    }
  );
}

function detectBottlenecks(
  counts
) {
  const bottlenecks = [];

  const applied =
    counts.APPLIED || 0;

  const screened =
    counts.SCREENED || 0;

  const shortlisted =
    counts.SHORTLISTED || 0;

  const assessment =
    counts.ASSESSMENT || 0;

  const interview =
    counts.INTERVIEW || 0;

  if (
    applied > 0 &&
    screened === 0
  ) {
    bottlenecks.push({
      stage: "SCREENED",
      severity: "HIGH",
      reason:
        "Candidates exist in the applied stage but no screened records are present in the supplied pipeline data."
    });
  } else if (
    applied > screened &&
    applied > 0
  ) {
    bottlenecks.push({
      stage: "SCREENED",
      severity: "MEDIUM",
      reason:
        `${applied - screened} more candidate record(s) are in APPLIED than SCREENED based on the supplied data.`
    });
  }

  if (
    screened > 0 &&
    shortlisted === 0
  ) {
    bottlenecks.push({
      stage: "SHORTLISTED",
      severity: "MEDIUM",
      reason:
        "Screened candidates are present, but no shortlisted records are present in the supplied data."
    });
  } else if (
    screened > shortlisted &&
    screened > 0
  ) {
    bottlenecks.push({
      stage: "SHORTLISTED",
      severity: "LOW",
      reason:
        "The supplied data contains more screened than shortlisted candidates."
    });
  }

  if (
    shortlisted > 0 &&
    assessment === 0
  ) {
    bottlenecks.push({
      stage: "ASSESSMENT",
      severity: "LOW",
      reason:
        "Shortlisted candidates are present, but no assessment records are present in the supplied data."
    });
  }

  if (
    assessment > 0 &&
    interview === 0
  ) {
    bottlenecks.push({
      stage: "INTERVIEW",
      severity: "LOW",
      reason:
        "Assessment records exist, but no interview records are present in the supplied data."
    });
  }

  return bottlenecks;
}

function calculatePipelineMetrics(
  records
) {
  const counts =
    countStages(
      records
    );

  const funnel =
    buildFunnel(
      counts
    );

  const totalActive =
    counts.APPLIED +
    counts.SCREENED +
    counts.SHORTLISTED +
    counts.ASSESSMENT +
    counts.INTERVIEW;

  return {
    counts,

    totalRecords:
      records.length,

    totalActive,

    hired:
      counts.HIRED,

    rejected:
      counts.REJECTED,

    withdrawn:
      counts.WITHDRAWN,

    funnel,

    conversionRates: {
      appliedToScreened:
        calculateConversion(
          counts.APPLIED,
          counts.SCREENED
        ),

      screenedToShortlisted:
        calculateConversion(
          counts.SCREENED,
          counts.SHORTLISTED
        ),

      shortlistedToAssessment:
        calculateConversion(
          counts.SHORTLISTED,
          counts.ASSESSMENT
        ),

      assessmentToInterview:
        calculateConversion(
          counts.ASSESSMENT,
          counts.INTERVIEW
        ),

      interviewToHired:
        calculateConversion(
          counts.INTERVIEW,
          counts.HIRED
        ),

      appliedToHired:
        calculateConversion(
          counts.APPLIED,
          counts.HIRED
        )
    },

    bottlenecks:
      detectBottlenecks(
        counts
      )
  };
}

function calculateAverageDaysBetween(
  records,
  fromStage,
  toStage
) {
  const byCandidate =
    new Map();

  records.forEach(record => {
    const candidateId =
      normalizeId(
        getRecordCandidateId(
          record
        )
      );

    if (!candidateId) {
      return;
    }

    const stage =
      getRecordStage(
        record
      );

    if (!stage) {
      return;
    }

    const rawDate =
      record?.updated_at ||
      record?.updatedAt ||
      record?.created_at ||
      record?.createdAt ||
      null;

    if (!rawDate) {
      return;
    }

    const timestamp =
      new Date(
        rawDate
      ).getTime();

    if (
      Number.isNaN(
        timestamp
      )
    ) {
      return;
    }

    if (
      !byCandidate.has(
        candidateId
      )
    ) {
      byCandidate.set(
        candidateId,
        {}
      );
    }

    const candidateStages =
      byCandidate.get(
        candidateId
      );

    candidateStages[stage] =
      timestamp;
  });

  const durations = [];

  byCandidate.forEach(
    stages => {
      if (
        stages[fromStage] !==
          undefined &&
        stages[toStage] !==
          undefined &&
        stages[toStage] >=
          stages[fromStage]
      ) {
        durations.push(
          (
            stages[toStage] -
            stages[fromStage]
          ) /
            (1000 *
              60 *
              60 *
              24)
        );
      }
    }
  );

  if (!durations.length) {
    return null;
  }

  const total =
    durations.reduce(
      (sum, value) =>
        sum + value,
      0
    );

  return Math.round(
    (total /
      durations.length) *
      10
  ) / 10;
}

function calculateTimeMetrics(
  records
) {
  return {
    appliedToScreenedDays:
      calculateAverageDaysBetween(
        records,
        "APPLIED",
        "SCREENED"
      ),

    screenedToShortlistedDays:
      calculateAverageDaysBetween(
        records,
        "SCREENED",
        "SHORTLISTED"
      ),

    shortlistedToAssessmentDays:
      calculateAverageDaysBetween(
        records,
        "SHORTLISTED",
        "ASSESSMENT"
      ),

    assessmentToInterviewDays:
      calculateAverageDaysBetween(
        records,
        "ASSESSMENT",
        "INTERVIEW"
      ),

    interviewToHiredDays:
      calculateAverageDaysBetween(
        records,
        "INTERVIEW",
        "HIRED"
      )
  };
}

function getJobBreakdown(
  records
) {
  const jobs =
    new Map();

  records.forEach(record => {
    const jobId =
      getRecordJobId(
        record
      );

    const jobTitle =
      getRecordJobTitle(
        record
      );

    const key =
      normalizeId(
        jobId ||
        jobTitle
      );

    if (!key) {
      return;
    }

    if (!jobs.has(key)) {
      jobs.set(key, {
        jobId:
          jobId || null,

        jobTitle:
          jobTitle ||
          "Untitled Job",

        counts:
          countStages([])
      });
    }

    const item =
      jobs.get(key);

    const stage =
      getRecordStage(
        record
      );

    if (
      stage &&
      Object.prototype.hasOwnProperty.call(
        item.counts,
        stage
      )
    ) {
      item.counts[stage] += 1;
    }
  });

  return [
    ...jobs.values()
  ];
}

function buildLocalPipelineAnalysis(
  records
) {
  const metrics =
    calculatePipelineMetrics(
      records
    );

  const timeMetrics =
    calculateTimeMetrics(
      records
    );

  const jobBreakdown =
    getJobBreakdown(
      records
    );

  const optimizationRecommendations =
    metrics.bottlenecks.map(
      bottleneck => {
        if (
          bottleneck.stage ===
          "SCREENED"
        ) {
          return {
            priority:
              bottleneck.severity,

            area:
              "Screening",

            recommendation:
              "Review the pending applied candidates and use recruiter-approved screening criteria to process the backlog."
          };
        }

        if (
          bottleneck.stage ===
          "SHORTLISTED"
        ) {
          return {
            priority:
              bottleneck.severity,

            area:
              "Shortlisting",

            recommendation:
              "Review screened candidates against the explicit job requirements and document recruiter decisions."
          };
        }

        if (
          bottleneck.stage ===
          "ASSESSMENT"
        ) {
          return {
            priority:
              bottleneck.severity,

            area:
              "Assessment",

            recommendation:
              "Review whether shortlisted candidates have the required assessment workflow configured."
          };
        }

        return {
          priority:
            bottleneck.severity,

          area:
            bottleneck.stage,

          recommendation:
            `Review the ${bottleneck.stage.toLowerCase()} stage for pending recruiter actions.`
        };
      }
    );

  return {
    metrics,

    timeMetrics,

    jobBreakdown,

    optimizationRecommendations,

    dataQuality: {
      recordsWithCandidateId:
        records.filter(
          record =>
            Boolean(
              getRecordCandidateId(
                record
              )
            )
        ).length,

      recordsWithStage:
        records.filter(
          record =>
            Boolean(
              getRecordStage(
                record
              )
            )
        ).length,

      recordsWithoutStage:
        records.filter(
          record =>
            !getRecordStage(
              record
            )
        ).length,

      recordsWithJob:
        records.filter(
          record =>
            Boolean(
              getRecordJobId(
                record
              ) ||
              getRecordJobTitle(
                record
              )
            )
        ).length
    }
  };
}

function buildSystemPrompt() {
  return `
You are the Hiring Pipeline Agent for HireVision AI.

Analyze recruitment pipeline data supplied by the HireVision system.

Your job is to:
- Summarize actual pipeline stages.
- Identify bottlenecks supported by the data.
- Calculate or interpret conversion rates only when the underlying counts are supplied.
- Identify data-quality limitations.
- Recommend recruiter workflow improvements.
- Never invent pipeline counts.
- Never invent candidates.
- Never invent jobs.
- Never invent time-to-hire values.
- Never invent conversion percentages.
- Never claim a stage has candidates when the supplied data does not show them.
- Never fabricate industry benchmarks.
- Never fabricate historical trends or month-over-month changes.
- Never fabricate ATS scores.
- Never make hiring or rejection decisions.

IMPORTANT:
The pipeline data may be incomplete. Missing stages may mean the application data is incomplete; do not automatically interpret missing records as candidate failure.

FAIRNESS:
Do not use or infer sensitive/protected attributes for pipeline analysis, including gender, age, religion, caste, race, ethnicity, political views, disability, health information, sexual orientation, marital status, family status, or similar characteristics.

Return valid JSON only:

{
  "summary": "short evidence-grounded pipeline summary",
  "stageMetrics": [
    {
      "stage": "APPLIED",
      "count": 0,
      "conversionFromPrevious": null,
      "observation": "string"
    }
  ],
  "bottlenecks": [
    {
      "stage": "string",
      "severity": "HIGH|MEDIUM|LOW",
      "reason": "string",
      "evidence": "string"
    }
  ],
  "optimizationRecommendations": [
    {
      "priority": "HIGH|MEDIUM|LOW",
      "area": "string",
      "recommendation": "string"
    }
  ],
  "timeMetrics": {},
  "dataQuality": [],
  "dataLimitations": [],
  "fairnessGuardrails": []
}

All numeric values must be derived from supplied data.
If there is insufficient data, use null or explain the limitation.
`;
}

function buildUserPrompt(
  query,
  records,
  localAnalysis,
  context
) {
  return `
User Query:
${
  normalizeText(query) ||
  "Analyze the current hiring pipeline."
}

Pipeline Records:
${JSON.stringify(
  records,
  null,
  2
)}

Local Pipeline Analysis:
${JSON.stringify(
  localAnalysis,
  null,
  2
)}

Target Job:
${JSON.stringify(
  {
    targetJobId:
      context?.targetJobId ||
      context?.jobId ||
      null,
    targetJob:
      context?.job ||
      null
  },
  null,
  2
)}

Use only the supplied pipeline records.
Do not invent missing counts, stages, candidates, jobs, conversion rates, or time metrics.
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

function sanitizeSeverity(value) {
  const normalized =
    normalizeText(value)
      .toUpperCase();

  return [
    "HIGH",
    "MEDIUM",
    "LOW"
  ].includes(normalized)
    ? normalized
    : "LOW";
}

function sanitizeStageMetrics(
  metrics
) {
  return safeArray(
    metrics
  )
    .map(item => {
      const stage =
        normalizeStage(
          item?.stage
        );

      if (!stage) {
        return null;
      }

      return {
        stage,

        count:
          typeof item?.count ===
          "number"
            ? Math.max(
                0,
                Math.floor(
                  item.count
                )
              )
            : null,

        conversionFromPrevious:
          typeof item?.conversionFromPrevious ===
          "number"
            ? Math.max(
                0,
                Math.min(
                  100,
                  item.conversionFromPrevious
                )
              )
            : null,

        observation:
          normalizeText(
            item?.observation
          ) ||
          "No additional observation supplied."
      };
    })
    .filter(Boolean);
}

function sanitizeBottlenecks(
  bottlenecks
) {
  return safeArray(
    bottlenecks
  )
    .map(item => ({
      stage:
        normalizeStage(
          item?.stage
        ) ||
        normalizeText(
          item?.stage
        ),

      severity:
        sanitizeSeverity(
          item?.severity
        ),

      reason:
        normalizeText(
          item?.reason
        ),

      evidence:
        normalizeText(
          item?.evidence
        )
    }))
    .filter(
      item =>
        item.stage &&
        item.reason
    );
}

function sanitizeOptimizationRecommendations(
  recommendations
) {
  return safeArray(
    recommendations
  )
    .map(item => ({
      priority:
        sanitizeSeverity(
          item?.priority
        ),

      area:
        normalizeText(
          item?.area
        ) ||
        "Pipeline",

      recommendation:
        normalizeText(
          item?.recommendation
        )
    }))
    .filter(
      item =>
        item.recommendation
    );
}

function buildAgentResponse(
  query,
  analysis,
  source
) {
  return normalizeAgentResponse({
    success: true,
    status: "completed",
    agent:
      "hiringPipelineAgent",

    response:
      analysis.summary ||
      "Hiring pipeline analysis completed using supplied pipeline data.",

    data: {
      query:
        normalizeText(query),

      stageMetrics:
        analysis.stageMetrics,

      bottlenecks:
        analysis.bottlenecks,

      optimizationRecommendations:
        analysis.optimizationRecommendations,

      timeMetrics:
        analysis.timeMetrics,

      dataQuality:
        analysis.dataQuality,

      dataLimitations:
        analysis.dataLimitations,

      fairnessGuardrails:
        analysis.fairnessGuardrails,

      integrity: {
        groundedInSuppliedData: true,
        fabricatedCounts: false,
        fabricatedCandidates: false,
        fabricatedJobs: false,
        fabricatedMetrics: false,
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

function localAnalysisToResponse(
  localAnalysis
) {
  const metrics =
    localAnalysis.metrics;

  return {
    summary:
      `The supplied hiring pipeline contains ${metrics.totalRecords} pipeline record(s), including ${metrics.hired} hired record(s) and ${metrics.rejected} rejected record(s).`,

    stageMetrics:
      metrics.funnel.map(
        item => ({
          stage:
            item.stage,

          count:
            item.count,

          conversionFromPrevious:
            item.conversionFromPrevious,

          observation:
            item.count === 0
              ? "No records are currently available for this stage in the supplied data."
              : `${item.count} record(s) are currently represented at this stage.`
        })
      ),

    bottlenecks:
      metrics.bottlenecks.map(
        item => ({
          stage:
            item.stage,

          severity:
            item.severity,

          reason:
            item.reason,

          evidence:
            "Derived directly from supplied pipeline stage counts."
        })
      ),

    optimizationRecommendations:
      localAnalysis.optimizationRecommendations,

    timeMetrics:
      localAnalysis.timeMetrics,

    dataQuality:
      [
        `Records with candidate ID: ${localAnalysis.dataQuality.recordsWithCandidateId}/${metrics.totalRecords}.`,
        `Records with recognized pipeline stage: ${localAnalysis.dataQuality.recordsWithStage}/${metrics.totalRecords}.`,
        `Records without recognized pipeline stage: ${localAnalysis.dataQuality.recordsWithoutStage}/${metrics.totalRecords}.`,
        `Records with job information: ${localAnalysis.dataQuality.recordsWithJob}/${metrics.totalRecords}.`
      ],

    dataLimitations: [
      "Metrics are calculated only from supplied pipeline records.",
      "A missing stage does not prove that no activity occurred.",
      "If the database stores pipeline history elsewhere, these metrics may not represent the complete recruitment lifecycle.",
      "Time metrics require valid timestamps for the same candidate across the relevant stages.",
      "No industry benchmark or fabricated historical comparison is included."
    ],

    fairnessGuardrails: [
      "Pipeline analysis does not use sensitive or protected candidate attributes.",
      "Recommendations are workflow recommendations, not hiring or rejection decisions."
    ]
  };
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

  const records =
    filterRecords(
      extractPipelineRecords(
        candidates,
        context
      ),
      context
    );

  if (!records.length) {
    return failedAgentResponse(
      "hiringPipelineAgent",
      "No usable hiring pipeline records were found in the supplied system data."
    );
  }

  const localAnalysis =
    buildLocalPipelineAnalysis(
      records
    );

  try {
    const llmResult =
      await callLLM(
        buildSystemPrompt(),
        buildUserPrompt(
          query,
          records,
          localAnalysis,
          context
        ),
        true
      );

    const parsed =
      parseLLMResult(
        llmResult
      );

    const stageMetrics =
      sanitizeStageMetrics(
        parsed?.stageMetrics
      );

    const bottlenecks =
      sanitizeBottlenecks(
        parsed?.bottlenecks
      );

    const optimizationRecommendations =
      sanitizeOptimizationRecommendations(
        parsed?.optimizationRecommendations
      );

    if (
      !stageMetrics.length
    ) {
      return buildAgentResponse(
        query,
        localAnalysisToResponse(
          localAnalysis
        ),
        "local-grounded-fallback"
      );
    }

    return buildAgentResponse(
      query,
      {
        summary:
          normalizeText(
            parsed?.summary
          ) ||
          "Hiring pipeline analysis completed using supplied pipeline data.",

        stageMetrics,

        bottlenecks,

        optimizationRecommendations,

        timeMetrics:
          parsed?.timeMetrics &&
          typeof parsed.timeMetrics ===
            "object"
            ? parsed.timeMetrics
            : localAnalysis.timeMetrics,

        dataQuality:
          safeArray(
            parsed?.dataQuality
          )
            .map(
              normalizeText
            )
            .filter(Boolean),

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
      "llm+hiring-pipeline"
    );
  } catch (error) {
    console.error(
      "[HiringPipelineAgent] LLM analysis failed:",
      error.message
    );

    return buildAgentResponse(
      query,
      localAnalysisToResponse(
        localAnalysis
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
  normalizeStage,
  extractPipelineRecords,
  calculatePipelineMetrics,
  buildLocalPipelineAnalysis
};