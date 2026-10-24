const { callLLM } = require("./openaiService");
const {
  normalizeAgentResponse,
  failedAgentResponse
} = require("./agentResponseSchema");

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeStatus(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function parseDate(value) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function calculatePercentage(numerator, denominator) {
  if (!denominator) return 0;

  return Number(
    ((numerator / denominator) * 100).toFixed(2)
  );
}

function calculateAverage(values) {
  const validValues = values.filter(
    value =>
      typeof value === "number" &&
      Number.isFinite(value)
  );

  if (!validValues.length) {
    return null;
  }

  return Number(
    (
      validValues.reduce(
        (sum, value) => sum + value,
        0
      ) / validValues.length
    ).toFixed(2)
  );
}

function getCandidates(context) {
  return safeArray(
    context?.candidates ||
    context?.candidateList ||
    context?.data?.candidates
  );
}

function getJobs(context) {
  return safeArray(
    context?.jobs ||
    context?.jobList ||
    context?.data?.jobs
  );
}

function getApplications(context, candidates, jobs) {
  const directApplications = safeArray(
    context?.applications ||
    context?.applicationList ||
    context?.data?.applications
  );

  if (directApplications.length) {
    return directApplications;
  }

  const applications = [];

  candidates.forEach(candidate => {
    const candidateApplications = safeArray(
      candidate?.applications ||
      candidate?.job_applications ||
      candidate?.jobApplications
    );

    candidateApplications.forEach(application => {
      applications.push({
        ...application,
        candidate_id:
          application?.candidate_id ||
          application?.candidateId ||
          application?.user_id ||
          application?.userId ||
          candidate?.user_id ||
          candidate?.id
      });
    });
  });

  jobs.forEach(job => {
    const jobApplications = safeArray(
      job?.applications ||
      job?.applicants
    );

    jobApplications.forEach(application => {
      applications.push({
        ...application,
        job_id:
          application?.job_id ||
          application?.jobId ||
          job?.id ||
          job?.job_id
      });
    });
  });

  return applications;
}

function getApplicationStatus(application) {
  return normalizeStatus(
    application?.status ||
    application?.stage ||
    application?.application_status ||
    application?.applicationStatus
  );
}

function getApplicationSource(application, candidate) {
  return normalizeText(
    application?.source ||
    application?.source_channel ||
    application?.sourceChannel ||
    application?.channel ||
    candidate?.source ||
    candidate?.source_channel ||
    candidate?.sourceChannel
  );
}

function getCreatedDate(item) {
  return parseDate(
    item?.created_at ||
    item?.createdAt ||
    item?.applied_at ||
    item?.appliedAt ||
    item?.application_date ||
    item?.applicationDate ||
    item?.submitted_at ||
    item?.submittedAt ||
    item?.date
  );
}

function getHireDate(application, candidate) {
  return parseDate(
    application?.hired_at ||
    application?.hiredAt ||
    application?.offer_accepted_at ||
    application?.offerAcceptedAt ||
    candidate?.hired_at ||
    candidate?.hiredAt
  );
}

function getCandidatesById(candidates) {
  const map = new Map();

  candidates.forEach(candidate => {
    const id =
      candidate?.user_id ||
      candidate?.id ||
      candidate?._id;

    if (id !== undefined && id !== null) {
      map.set(String(id), candidate);
    }
  });

  return map;
}

function getJobsById(jobs) {
  const map = new Map();

  jobs.forEach(job => {
    const id =
      job?.id ||
      job?.job_id ||
      job?._id;

    if (id !== undefined && id !== null) {
      map.set(String(id), job);
    }
  });

  return map;
}

function getDateRange(context, applications) {
  const explicitStart = parseDate(
    context?.startDate ||
    context?.start_date ||
    context?.dateRange?.start ||
    context?.filters?.startDate
  );

  const explicitEnd = parseDate(
    context?.endDate ||
    context?.end_date ||
    context?.dateRange?.end ||
    context?.filters?.endDate
  );

  if (explicitStart || explicitEnd) {
    return {
      start: explicitStart,
      end: explicitEnd || new Date()
    };
  }

  const now = new Date();

  const hasRecentDates = applications.some(
    application => getCreatedDate(application)
  );

  if (!hasRecentDates) {
    return {
      start: null,
      end: now
    };
  }

  const start = new Date(now);

  start.setDate(
    start.getDate() - 30
  );

  return {
    start,
    end: now
  };
}

function filterApplicationsByDate(
  applications,
  range
) {
  if (!range.start) {
    return applications;
  }

  return applications.filter(application => {
    const date = getCreatedDate(application);

    if (!date) {
      return false;
    }

    return (
      date >= range.start &&
      date <= range.end
    );
  });
}

function calculateTimeToHire(
  applications,
  candidateMap
) {
  const durations = [];

  applications.forEach(application => {
    const applicationDate =
      getCreatedDate(application);

    if (!applicationDate) {
      return;
    }

    const candidateId =
      application?.candidate_id ||
      application?.candidateId ||
      application?.user_id ||
      application?.userId;

    const candidate = candidateMap.get(
      String(candidateId)
    );

    const hireDate = getHireDate(
      application,
      candidate
    );

    if (!hireDate || hireDate < applicationDate) {
      return;
    }

    const days =
      (
        hireDate.getTime() -
        applicationDate.getTime()
      ) /
      (1000 * 60 * 60 * 24);

    if (days >= 0) {
      durations.push(
        Number(days.toFixed(2))
      );
    }
  });

  return calculateAverage(durations);
}

function calculateSourcePerformance(
  applications,
  candidateMap
) {
  const sourceMap = new Map();

  applications.forEach(application => {
    const candidateId =
      application?.candidate_id ||
      application?.candidateId ||
      application?.user_id ||
      application?.userId;

    const candidate = candidateMap.get(
      String(candidateId)
    );

    const source =
      getApplicationSource(
        application,
        candidate
      ) || "Unknown";

    const key = source.toLowerCase();

    if (!sourceMap.has(key)) {
      sourceMap.set(key, {
        source,
        applications: 0,
        shortlisted: 0,
        interviewed: 0,
        hired: 0
      });
    }

    const entry = sourceMap.get(key);

    entry.applications += 1;

    const status =
      getApplicationStatus(application);

    if (
      [
        "shortlisted",
        "shortlist",
        "screening_passed",
        "screened",
        "selected"
      ].includes(status)
    ) {
      entry.shortlisted += 1;
    }

    if (
      [
        "interview",
        "interviewed",
        "interview_scheduled",
        "interview_completed"
      ].includes(status)
    ) {
      entry.interviewed += 1;
    }

    if (
      [
        "hired",
        "offer_accepted",
        "joined",
        "placed"
      ].includes(status)
    ) {
      entry.hired += 1;
    }
  });

  return Array.from(sourceMap.values())
    .map(entry => ({
      source: entry.source,
      applications: entry.applications,
      shortlisted: entry.shortlisted,
      interviewed: entry.interviewed,
      hired: entry.hired,
      shortlistRate: calculatePercentage(
        entry.shortlisted,
        entry.applications
      ),
      interviewRate: calculatePercentage(
        entry.interviewed,
        entry.applications
      ),
      hireRate: calculatePercentage(
        entry.hired,
        entry.applications
      )
    }))
    .sort(
      (a, b) =>
        b.applications -
        a.applications
    );
}

function calculateFunnel(applications) {
  const total = applications.length;

  const shortlisted = applications.filter(
    application =>
      [
        "shortlisted",
        "shortlist",
        "screening_passed",
        "screened",
        "selected",
        "interview",
        "interviewed",
        "interview_scheduled",
        "interview_completed",
        "offer",
        "offer_sent",
        "offer_accepted",
        "hired",
        "joined",
        "placed"
      ].includes(
        getApplicationStatus(application)
      )
  ).length;

  const interviewed = applications.filter(
    application =>
      [
        "interview",
        "interviewed",
        "interview_scheduled",
        "interview_completed",
        "offer",
        "offer_sent",
        "offer_accepted",
        "hired",
        "joined",
        "placed"
      ].includes(
        getApplicationStatus(application)
      )
  ).length;

  const hired = applications.filter(
    application =>
      [
        "hired",
        "offer_accepted",
        "joined",
        "placed"
      ].includes(
        getApplicationStatus(application)
      )
  ).length;

  return {
    applications: total,
    shortlisted,
    interviewed,
    hired,
    shortlistRate:
      calculatePercentage(
        shortlisted,
        total
      ),
    interviewConversion:
      calculatePercentage(
        interviewed,
        total
      ),
    hireConversion:
      calculatePercentage(
        hired,
        total
      )
  };
}

function calculateJobMetrics(
  jobs,
  applications
) {
  const jobMap = new Map();

  jobs.forEach(job => {
    const id =
      job?.id ||
      job?.job_id ||
      job?._id;

    if (id === undefined || id === null) {
      return;
    }

    jobMap.set(String(id), {
      id,
      title:
        normalizeText(
          job?.title ||
          job?.job_title ||
          job?.name
        ) || "Untitled Job",
      applications: 0,
      hired: 0,
      open: Boolean(
        job?.is_active ??
        job?.active ??
        job?.open
      )
    });
  });

  applications.forEach(application => {
    const jobId =
      application?.job_id ||
      application?.jobId;

    if (!jobId) {
      return;
    }

    const job = jobMap.get(
      String(jobId)
    );

    if (!job) {
      return;
    }

    job.applications += 1;

    if (
      [
        "hired",
        "offer_accepted",
        "joined",
        "placed"
      ].includes(
        getApplicationStatus(application)
      )
    ) {
      job.hired += 1;
    }
  });

  return Array.from(jobMap.values())
    .map(job => ({
      ...job,
      hireRate:
        calculatePercentage(
          job.hired,
          job.applications
        )
    }))
    .sort(
      (a, b) =>
        b.applications -
        a.applications
    );
}

function calculateStatusDistribution(
  applications
) {
  const distribution = {};

  applications.forEach(application => {
    const status =
      getApplicationStatus(application) ||
      "unknown";

    distribution[status] =
      (distribution[status] || 0) + 1;
  });

  return Object.entries(distribution)
    .sort((a, b) => b[1] - a[1])
    .map(([status, count]) => ({
      status,
      count,
      percentage:
        calculatePercentage(
          count,
          applications.length
        )
    }));
}

function buildLocalAnalytics(
  context,
  query
) {
  const candidates =
    getCandidates(context);

  const jobs =
    getJobs(context);

  const applications =
    getApplications(
      context,
      candidates,
      jobs
    );

  const candidateMap =
    getCandidatesById(candidates);

  const range =
    getDateRange(
      context,
      applications
    );

  const filteredApplications =
    filterApplicationsByDate(
      applications,
      range
    );

  const funnel =
    calculateFunnel(
      filteredApplications
    );

  const sourcePerformance =
    calculateSourcePerformance(
      filteredApplications,
      candidateMap
    );

  const timeToHire =
    calculateTimeToHire(
      filteredApplications,
      candidateMap
    );

  const jobMetrics =
    calculateJobMetrics(
      jobs,
      filteredApplications
    );

  const statusDistribution =
    calculateStatusDistribution(
      filteredApplications
    );

  const hiredCount =
    filteredApplications.filter(
      application =>
        [
          "hired",
          "offer_accepted",
          "joined",
          "placed"
        ].includes(
          getApplicationStatus(application)
        )
    ).length;

  return {
    query:
      normalizeText(query) ||
      "Recruiter analytics overview",

    period: {
      start: range.start
        ? range.start.toISOString()
        : null,
      end: range.end
        ? range.end.toISOString()
        : null
    },

    dataAvailability: {
      candidates: candidates.length > 0,
      jobs: jobs.length > 0,
      applications:
        applications.length > 0,
      applicationDates:
        applications.some(
          application =>
            getCreatedDate(application)
        ),
      hireDates:
        filteredApplications.some(
          application =>
            getHireDate(
              application,
              candidateMap.get(
                String(
                  application?.candidate_id ||
                  application?.candidateId ||
                  application?.user_id ||
                  application?.userId
                )
              )
            )
        )
    },

    totals: {
      candidates: candidates.length,
      jobs: jobs.length,
      applications:
        filteredApplications.length,
      hires: hiredCount
    },

    funnel,

    timeToHire: {
      averageDays: timeToHire,
      available:
        timeToHire !== null
    },

    sourcePerformance,

    jobPerformance: jobMetrics,

    statusDistribution,

    limitations: [
      "Metrics are calculated only from data supplied to the agent.",
      "Missing application dates are excluded from date-scoped analytics.",
      "A time-to-hire value is reported only when both application and hire dates are available.",
      "No industry benchmark or external performance claim is inferred unless explicitly supplied.",
      "No candidate, job, conversion rate, or hiring metric is fabricated."
    ]
  };
}

function buildSystemPrompt() {
  return `
You are the Recruiter Analytics Agent for HireVision AI.

Your job is to analyze recruiter hiring data and answer analytics questions using ONLY the data supplied in the user message.

You may analyze:
- Application volume
- Hiring funnel
- Shortlisting conversion
- Interview conversion
- Hire conversion
- Time-to-hire
- Candidate source performance
- Job-level application performance
- Application status distribution
- Hiring trends when enough dated data exists
- Recruiter operational bottlenecks
- Data quality and missing metrics

CRITICAL DATA INTEGRITY RULES:

1. NEVER invent numbers.
2. NEVER use fictional fallback metrics.
3. NEVER claim a percentage unless it can be calculated from supplied data.
4. NEVER claim month-over-month growth unless data from both periods is supplied.
5. NEVER claim an industry benchmark unless an explicit benchmark is supplied.
6. NEVER claim a source performs better unless the supplied data supports that conclusion.
7. NEVER invent candidate names, job names, applications, hires, sources, dates, or metrics.
8. If data is missing, explicitly state that the metric cannot be determined.
9. Missing data is NOT zero.
10. Do not confuse candidate count with application count.
11. Do not treat a profile status as a hiring event unless the supplied data clearly indicates it.
12. Remain objective and recruiter-friendly.
13. Clearly distinguish calculated metrics from observations.
14. When useful, explain the calculation basis in plain language.

Return structured JSON only.

Required structure:
{
  "summary": "short recruiter-friendly summary",
  "keyMetrics": [
    {
      "metric": "string",
      "value": "string or number",
      "basis": "how the metric was derived"
    }
  ],
  "funnel": {},
  "sourcePerformance": [],
  "jobPerformance": [],
  "trends": [],
  "insights": [],
  "dataQuality": [],
  "recommendations": []
}

Do not create values merely to make the report look complete.
`;
}

function buildUserPrompt(
  query,
  analytics,
  context
) {
  return `
Recruiter analytics query:

${normalizeText(query) || "Provide a complete hiring analytics overview."}

Calculated analytics from supplied data:

${JSON.stringify(
  analytics,
  null,
  2
)}

Additional recruiter context:

${JSON.stringify(
  {
    recruiterId:
      context?.recruiterId ||
      context?.recruiter_id ||
      null,
    organizationId:
      context?.organizationId ||
      context?.organization_id ||
      null,
    filters:
      context?.filters ||
      null
  },
  null,
  2
)}

Use only the supplied data.
If a requested metric cannot be calculated, return it as unavailable and explain why.
`;
}

function cleanLLMJson(value) {
  if (typeof value !== "string") {
    return value;
  }

  const cleaned = value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    return {
      summary: cleaned,
      keyMetrics: [],
      funnel: {},
      sourcePerformance: [],
      jobPerformance: [],
      trends: [],
      insights: [],
      dataQuality: [],
      recommendations: []
    };
  }
}

function normalizeLLMAnalytics(
  result,
  localAnalytics
) {
  const parsed =
    cleanLLMJson(result);

  if (
    !parsed ||
    typeof parsed !== "object"
  ) {
    return {
      summary:
        "Analytics analysis could not be structured.",
      keyMetrics: [],
      funnel: {},
      sourcePerformance: [],
      jobPerformance: [],
      trends: [],
      insights: [],
      dataQuality: [],
      recommendations: []
    };
  }

  return {
    summary:
      normalizeText(
        parsed.summary
      ) ||
      "Analytics analysis completed using supplied recruiter data.",

    keyMetrics:
      safeArray(
        parsed.keyMetrics
      ),

    funnel:
      parsed.funnel &&
      typeof parsed.funnel === "object"
        ? parsed.funnel
        : localAnalytics.funnel,

    sourcePerformance:
      safeArray(
        parsed.sourcePerformance
      ),

    jobPerformance:
      safeArray(
        parsed.jobPerformance
      ),

    trends:
      safeArray(
        parsed.trends
      ),

    insights:
      safeArray(
        parsed.insights
      ),

    dataQuality:
      safeArray(
        parsed.dataQuality
      ),

    recommendations:
      safeArray(
        parsed.recommendations
      )
  };
}

function buildFallbackAnalysis(
  analytics
) {
  const keyMetrics = [
    {
      metric: "Applications",
      value:
        analytics.totals.applications,
      basis:
        "Count of supplied applications within the available analytics period."
    },
    {
      metric: "Hires",
      value:
        analytics.totals.hires,
      basis:
        "Count of supplied applications whose status indicates a completed hire."
    },
    {
      metric: "Shortlist Rate",
      value:
        `${analytics.funnel.shortlistRate}%`,
      basis:
        "Shortlisted applications divided by total applications."
    },
    {
      metric: "Interview Conversion",
      value:
        `${analytics.funnel.interviewConversion}%`,
      basis:
        "Interview-stage applications divided by total applications."
    },
    {
      metric: "Hire Conversion",
      value:
        `${analytics.funnel.hireConversion}%`,
      basis:
        "Hired applications divided by total applications."
    }
  ];

  if (
    analytics.timeToHire.averageDays !==
    null
  ) {
    keyMetrics.push({
      metric: "Average Time to Hire",
      value:
        `${analytics.timeToHire.averageDays} days`,
      basis:
        "Average difference between supplied application and hire dates."
    });
  }

  const insights = [];

  if (
    analytics.totals.applications === 0
  ) {
    insights.push(
      "No applications are available for the selected analytics period."
    );
  }

  if (
    analytics.sourcePerformance.length > 0
  ) {
    const bestByHireRate =
      [...analytics.sourcePerformance]
        .filter(
          item =>
            item.applications > 0
        )
        .sort(
          (a, b) =>
            b.hireRate -
            a.hireRate
        )[0];

    if (bestByHireRate) {
      insights.push(
        `${bestByHireRate.source} has the highest observed hire rate among supplied sources at ${bestByHireRate.hireRate}%. This is an observation from the supplied data, not a general quality claim.`
      );
    }
  }

  if (
    analytics.funnel.applications > 0 &&
    analytics.funnel.hired === 0
  ) {
    insights.push(
      "No completed hires are represented in the supplied application data for this period."
    );
  }

  const recommendations = [];

  if (
    !analytics.dataAvailability.applicationDates
  ) {
    recommendations.push(
      "Capture application timestamps to enable reliable period-over-period trend analysis."
    );
  }

  if (
    !analytics.dataAvailability.hireDates
  ) {
    recommendations.push(
      "Capture both application and hire timestamps to measure time-to-hire accurately."
    );
  }

  if (
    analytics.sourcePerformance.length === 0
  ) {
    recommendations.push(
      "Capture a normalized application source for each application to compare sourcing channels."
    );
  }

  if (
    analytics.jobPerformance.length === 0
  ) {
    recommendations.push(
      "Associate applications with job IDs to enable job-level funnel analysis."
    );
  }

  return {
    summary:
      analytics.totals.applications > 0
        ? "Recruiter analytics were calculated from the supplied application, candidate, and job data."
        : "Insufficient application data is available to produce meaningful hiring analytics.",

    keyMetrics,

    funnel:
      analytics.funnel,

    sourcePerformance:
      analytics.sourcePerformance,

    jobPerformance:
      analytics.jobPerformance,

    trends: [],

    insights,

    dataQuality:
      analytics.limitations,

    recommendations
  };
}

function buildAgentResponse(
  query,
  analytics,
  analysis,
  source
) {
  return normalizeAgentResponse({
    success: true,
    status: "completed",
    agent: "recruiterAnalyticsAgent",

    response:
      analysis.summary,

    data: {
      query:
        normalizeText(query),

      analytics,

      analysis,

      integrity: {
        groundedInSuppliedData: true,
        fabricatedMetrics: false,
        externalBenchmarksUsed: false,
        externalDataFetched: false
      }
    },

    metadata: {
      source,
      grounded: true,
      generatedAt:
        new Date().toISOString()
    }
  });
}

async function execute(
  query,
  context = {}
) {
  try {
    const analytics =
      buildLocalAnalytics(
        context,
        query
      );

    const hasUsableData =
      analytics.totals.applications > 0 ||
      analytics.totals.candidates > 0 ||
      analytics.totals.jobs > 0;

    if (!hasUsableData) {
      return buildAgentResponse(
        query,
        analytics,
        buildFallbackAnalysis(
          analytics
        ),
        "local-grounded"
      );
    }

    try {
      const llmResult =
        await callLLM(
          buildSystemPrompt(),
          buildUserPrompt(
            query,
            analytics,
            context
          ),
          true
        );

      const analysis =
        normalizeLLMAnalytics(
          llmResult,
          analytics
        );

      return buildAgentResponse(
        query,
        analytics,
        analysis,
        "llm+local-analytics"
      );
    } catch (llmError) {
      console.error(
        "[RecruiterAnalyticsAgent] LLM analysis failed:",
        llmError.message
      );

      return buildAgentResponse(
        query,
        analytics,
        buildFallbackAnalysis(
          analytics
        ),
        "local-grounded-fallback"
      );
    }
  } catch (error) {
    console.error(
      "[RecruiterAnalyticsAgent] Execution failed:",
      error.message
    );

    return failedAgentResponse(
      "recruiterAnalyticsAgent",
      "Unable to calculate recruiter analytics from the supplied data.",
      {
        error:
          process.env.NODE_ENV === "production"
            ? undefined
            : error.message
      }
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
  buildLocalAnalytics,
  calculateFunnel,
  calculateSourcePerformance,
  calculateTimeToHire,
  calculateJobMetrics
};