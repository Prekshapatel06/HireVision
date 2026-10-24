const express = require("express");
const router = express.Router();

const db = require("../config/db");
const authMiddleware = require("../middleware/auth");
const requireRecruiterRole = require("../middleware/requireRecruiterRole");
const aiController = require("../controllers/aiController");
const candidateJobMatchingAgent = require("../services/ai/candidateJobMatchingAgent");
const candidateComparisonAgent = require("../services/ai/candidateComparisonAgent");
const jobRequirementAgent = require("../services/ai/jobRequirementAgent");
const candidateRankingAgent = require("../services/ai/candidateRankingAgent");
const { REAL_CANDIDATE_SQL_FILTER } = require("../utils/candidateValidation");

router.use(authMiddleware);
router.use(requireRecruiterRole);

const DEFAULT_REQUIREMENTS = {
  must_have: [],
  preferred: [],
  optional: []
};

const ALLOWED_MATCH_STATUSES = [
  "Awaiting Review",
  "Shortlisted",
  "Rejected",
  "Interview",
  "Scheduled",
  "Selected",
  "Hired",
  "On Hold"
];

const normalizeText = (value, maxLength = 10000) => {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim().slice(0, maxLength);
};

const normalizeRequirements = (requirements) => {
  if (!requirements || typeof requirements !== "object" || Array.isArray(requirements)) {
    return DEFAULT_REQUIREMENTS;
  }

  return {
    must_have: Array.isArray(requirements.must_have)
      ? requirements.must_have.filter(Boolean).map(String)
      : [],
    preferred: Array.isArray(requirements.preferred)
      ? requirements.preferred.filter(Boolean).map(String)
      : [],
    optional: Array.isArray(requirements.optional)
      ? requirements.optional.filter(Boolean).map(String)
      : []
  };
};

const isValidId = (value) => {
  return value !== undefined &&
    value !== null &&
    String(value).trim() !== "";
};

/**
 * GET /api/recruiter/jobs
 */
router.get("/jobs", async (req, res) => {
  try {
    const jobs = await db.query(
      `SELECT *
       FROM jobs
       WHERE recruiter_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    return res.status(200).json({
      jobs: jobs.rows
    });
  } catch (err) {
    console.error("Error fetching jobs:", err);

    return res.status(500).json({
      message: "Error fetching jobs list."
    });
  }
});

/**
 * POST /api/recruiter/jobs
 */
router.post("/jobs", async (req, res) => {
  const title = normalizeText(req.body?.title, 250);
  const description = normalizeText(req.body?.description, 20000);
  const requirements = normalizeRequirements(req.body?.requirements);

  if (!title) {
    return res.status(400).json({
      message: "Job title is required."
    });
  }

  try {
    const newJob = await db.query(
      `INSERT INTO jobs (
         recruiter_id,
         title,
         description,
         requirements
       )
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING *`,
      [
        req.user.id,
        title,
        description,
        JSON.stringify(requirements)
      ]
    );

    const job = newJob.rows[0];

    const candidates = await db.query(
      `SELECT u.id
       FROM users u
       JOIN profiles p
         ON u.id = p.user_id
       WHERE ${REAL_CANDIDATE_SQL_FILTER}`
    );

    for (const candidate of candidates.rows) {
      await db.query(
        `INSERT INTO candidate_job_matches (
           candidate_id,
           job_id,
           match_score,
           status,
           explanation
         )
         VALUES (
           $1,
           $2,
           NULL,
           'Awaiting Review',
           'Candidate-job match is pending AI evaluation.'
         )
         ON CONFLICT DO NOTHING`,
        [candidate.id, job.id]
      );
    }

    return res.status(201).json({
      message: "Job listing posted successfully.",
      job
    });
  } catch (err) {
    console.error("Error creating job:", err);

    return res.status(500).json({
      message: "Error creating job posting."
    });
  }
});

/**
 * PUT /api/recruiter/jobs/:jobId
 * Edit an existing job posting owned by authenticated recruiter
 */
router.put("/jobs/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const title = normalizeText(req.body?.title, 250);
  const description = normalizeText(req.body?.description, 20000);
  const requirements = normalizeRequirements(req.body?.requirements);
  const status = normalizeText(req.body?.status, 50) || "Active";

  if (!isValidId(jobId)) {
    return res.status(400).json({
      message: "Valid job ID is required."
    });
  }

  if (!title) {
    return res.status(400).json({
      message: "Job title is required."
    });
  }

  try {
    const jobCheck = await db.query(
      `SELECT id FROM jobs WHERE id = $1 AND recruiter_id = $2`,
      [jobId, req.user.id]
    );

    if (jobCheck.rowCount === 0) {
      return res.status(404).json({
        message: "Job not found or you do not have permission to modify it."
      });
    }

    const updatedJob = await db.query(
      `UPDATE jobs
       SET
         title = $1,
         description = $2,
         requirements = $3::jsonb,
         status = $4
       WHERE id = $5 AND recruiter_id = $6
       RETURNING *`,
      [
        title,
        description,
        JSON.stringify(requirements),
        status,
        jobId,
        req.user.id
      ]
    );

    return res.status(200).json({
      message: "Job updated successfully.",
      job: updatedJob.rows[0]
    });
  } catch (err) {
    console.error("Error updating job:", err);
    return res.status(500).json({
      message: "Failed to update job posting."
    });
  }
});

/**
 * DELETE /api/recruiter/jobs/:jobId
 * Delete an existing job posting and related matches/pipeline records
 */
router.delete("/jobs/:jobId", async (req, res) => {
  const { jobId } = req.params;

  if (!isValidId(jobId)) {
    return res.status(400).json({
      message: "Valid job ID is required."
    });
  }

  try {
    const jobCheck = await db.query(
      `SELECT id FROM jobs WHERE id = $1 AND recruiter_id = $2`,
      [jobId, req.user.id]
    );

    if (jobCheck.rowCount === 0) {
      return res.status(404).json({
        message: "Job not found or you do not have permission to delete it."
      });
    }

    // 1. Delete pipeline stage logs for matches belonging to this job
    await db.query(
      `DELETE FROM hiring_pipeline_stages
       WHERE match_id IN (
         SELECT id FROM candidate_job_matches WHERE job_id = $1
       )`,
      [jobId]
    );

    // 2. Delete candidate_job_matches
    await db.query(
      `DELETE FROM candidate_job_matches WHERE job_id = $1`,
      [jobId]
    );

    // 3. Delete the job record
    await db.query(
      `DELETE FROM jobs WHERE id = $1 AND recruiter_id = $2`,
      [jobId, req.user.id]
    );

    return res.status(200).json({
      message: "Job posting deleted successfully."
    });
  } catch (err) {
    console.error("Error deleting job:", err);
    return res.status(500).json({
      message: "Failed to delete job posting."
    });
  }
});

/**
 * GET /api/recruiter/candidates
 */
router.get("/candidates", async (req, res) => {
  try {
    const candidates = await db.query(
      `SELECT DISTINCT ON (u.id)
         u.id,
         u.id AS user_id,
         u.username,
         u.email,
         u.last_login_at,
         p.full_name,
         p.phone,
         p.dob,
         p.gender,
         p.address,
         p.city,
         p.state,
         p.country,
         p.profile_photo,
         p.career_objective,
         p.skills,
         p.projects,
         p.internships,
         p.experience,
         p.education,
         p.certifications,
         p.achievements,
         p.languages,
         p.social_profiles,
         p.resume_url,
         p.created_at AS profile_created_at,
         p.updated_at AS profile_updated_at,
         (
           (lr.id IS NOT NULL AND lr.content IS NOT NULL AND TRIM(lr.content) != '')
           OR (p.skills IS NOT NULL AND p.skills::text != '[]' AND p.skills::text != '{}')
           OR (p.projects IS NOT NULL AND p.projects::text != '[]')
           OR (p.education IS NOT NULL AND p.education::text != '[]')
         ) AS has_live_resume
       FROM users u
       JOIN profiles p
         ON u.id = p.user_id
       LEFT JOIN live_resumes lr
         ON u.id = lr.user_id
       WHERE ${REAL_CANDIDATE_SQL_FILTER}
       ORDER BY u.id, COALESCE(p.full_name, u.username) ASC`
    );

    // In-memory Map deduplication by unique database user ID
    const candidateMap = new Map();
    for (const row of candidates.rows) {
      if (!candidateMap.has(row.id)) {
        candidateMap.set(row.id, row);
      }
    }

    return res.status(200).json({
      candidates: Array.from(candidateMap.values())
    });
  } catch (err) {
    console.error("Error fetching candidates:", err);

    return res.status(500).json({
      message: "Error fetching candidates list."
    });
  }
});

/**
 * GET /api/recruiter/candidates/:candidateId
 * Fetch verified candidate profile directly from database
 */
router.get("/candidates/:candidateId", async (req, res) => {
  const { candidateId } = req.params;

  if (!isValidId(candidateId)) {
    return res.status(400).json({
      message: "Candidate ID is required."
    });
  }

  try {
    const candidateQuery = await db.query(
      `SELECT DISTINCT ON (u.id)
         u.id,
         u.id AS user_id,
         u.username,
         u.email,
         u.last_login_at,
         p.full_name,
         p.phone,
         p.dob,
         p.gender,
         p.address,
         p.city,
         p.state,
         p.country,
         p.profile_photo,
         p.career_objective,
         p.skills,
         p.projects,
         p.internships,
         p.experience,
         p.education,
         p.certifications,
         p.achievements,
         p.languages,
         p.social_profiles,
         p.resume_url,
         p.created_at AS profile_created_at,
         p.updated_at AS profile_updated_at,
         (lr.id IS NOT NULL AND lr.content IS NOT NULL AND TRIM(lr.content) != '') AS has_live_resume
       FROM users u
       JOIN profiles p
         ON u.id = p.user_id
       LEFT JOIN live_resumes lr
         ON u.id = lr.user_id
       WHERE u.id = $1
         AND ${REAL_CANDIDATE_SQL_FILTER}
       LIMIT 1`,
      [candidateId]
    );

    if (candidateQuery.rowCount === 0) {
      return res.status(404).json({
        message: "Candidate not found in verified database records."
      });
    }

    return res.status(200).json({
      candidate: candidateQuery.rows[0]
    });
  } catch (err) {
    console.error("Error fetching candidate profile:", err);
    return res.status(500).json({
      message: "Failed to fetch candidate profile."
    });
  }
});

/**
 * GET /api/recruiter/candidates/:candidateId/live-resume
 * Fetches the EXACT same Live Resume generated by the candidate on the candidate side.
 * Single source of truth. No mock values. No fake fallback generation.
 */
router.get("/candidates/:candidateId/live-resume", async (req, res) => {
  const { candidateId } = req.params;

  if (!isValidId(candidateId)) {
    return res.status(400).json({
      message: "Valid candidate ID is required."
    });
  }

  try {
    // 1. Verify candidate exists in database
    const candidateRes = await db.query(
      `SELECT
         u.id,
         u.id AS user_id,
         u.username,
         u.email,
         p.full_name,
         p.phone,
         p.city,
         p.country,
         p.career_objective,
         p.skills,
         p.projects,
         p.internships,
         p.experience,
         p.education,
         p.certifications,
         p.social_profiles,
         p.profile_photo,
         p.updated_at AS profile_updated_at
       FROM users u
       JOIN profiles p
         ON u.id = p.user_id
       WHERE u.id = $1
         AND ${REAL_CANDIDATE_SQL_FILTER}
       LIMIT 1`,
      [candidateId]
    );

    if (candidateRes.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Candidate not found in verified database records."
      });
    }

    const candidate = candidateRes.rows[0];

    // 2. Fetch candidate's stored Live Resume from live_resumes table
    let resumeRes = await db.query(
      `SELECT *
       FROM live_resumes
       WHERE user_id = $1
       LIMIT 1`,
      [candidateId]
    );

    let liveResume = resumeRes.rows[0];

    const isResumeMissing = !liveResume || !liveResume.content || !liveResume.content.trim();
    const isProfileNewer = Boolean(
      liveResume &&
      candidate.profile_updated_at &&
      liveResume.updated_at &&
      new Date(candidate.profile_updated_at).getTime() > new Date(liveResume.updated_at).getTime()
    );

    // If candidate has profile data but no live_resumes row or profile was updated, generate & store real live resume
    if (isResumeMissing || isProfileNewer) {
      const hasProfileEvidence = Boolean(
        candidate.full_name ||
        (Array.isArray(candidate.skills) ? candidate.skills.length > 0 : candidate.skills && Object.keys(candidate.skills).length > 0) ||
        (Array.isArray(candidate.projects) && candidate.projects.length > 0) ||
        (Array.isArray(candidate.education) && candidate.education.length > 0)
      );

      if (hasProfileEvidence) {
        try {
          const liveResumeAgent = require("../services/ai/liveResumeAgent");
          await liveResumeAgent.generateAndStore(candidateId, candidate);
          const freshResumeRes = await db.query(
            `SELECT * FROM live_resumes WHERE user_id = $1 LIMIT 1`,
            [candidateId]
          );
          if (freshResumeRes.rowCount > 0 && freshResumeRes.rows[0].content && freshResumeRes.rows[0].content.trim()) {
            liveResume = freshResumeRes.rows[0];
          }
        } catch (genErr) {
          console.warn("[HireVision Live Resume] Dynamic generation notice:", genErr.message);
        }
      }
    }

    if (!liveResume || !liveResume.content || !liveResume.content.trim()) {
      return res.status(200).json({
        success: true,
        hasLiveResume: false,
        message: "Live Resume is not available.",
        candidate: {
          id: candidate.id,
          user_id: candidate.id,
          name: candidate.full_name || candidate.username
        }
      });
    }

    return res.status(200).json({
      success: true,
      hasLiveResume: true,
      liveResume,
      candidate: {
        id: candidate.id,
        user_id: candidate.id,
        full_name: candidate.full_name || candidate.username,
        email: candidate.email,
        phone: candidate.phone,
        city: candidate.city,
        country: candidate.country,
        career_objective: candidate.career_objective,
        skills: candidate.skills,
        projects: candidate.projects,
        experience: candidate.experience,
        internships: candidate.internships,
        education: candidate.education,
        certifications: candidate.certifications,
        social_profiles: candidate.social_profiles,
        profile_photo: candidate.profile_photo
      }
    });
  } catch (err) {
    console.error("Error fetching candidate live resume:", err);
    return res.status(500).json({
      message: "Failed to retrieve candidate Live Resume."
    });
  }
});

/**
 * GET /api/recruiter/matches
 */
router.get("/matches", async (req, res) => {
  try {
    // Ensure all real candidates have match records for active jobs of this recruiter
    await db.query(
      `INSERT INTO candidate_job_matches (candidate_id, job_id, match_score, status, explanation)
       SELECT u.id, j.id, NULL, 'Awaiting Review', 'Candidate-job match is pending AI evaluation.'
       FROM users u
       CROSS JOIN jobs j
       WHERE j.recruiter_id = $1
         AND ${REAL_CANDIDATE_SQL_FILTER}
       ON CONFLICT (candidate_id, job_id) DO NOTHING`,
      [req.user.id]
    );

    const matches = await db.query(
      `SELECT DISTINCT ON (m.id)
         m.*,
         u.username,
         u.email,
         u.last_login_at,
         p.full_name,
         p.skills,
         j.title AS job_title,
         j.description AS job_description,
         j.requirements AS job_requirements
       FROM candidate_job_matches m
       JOIN users u
         ON m.candidate_id = u.id
       JOIN profiles p
         ON u.id = p.user_id
       JOIN jobs j
         ON m.job_id = j.id
       WHERE j.recruiter_id = $1
         AND ${REAL_CANDIDATE_SQL_FILTER}
       ORDER BY
         m.id,
         CASE
           WHEN m.match_score IS NULL THEN 1
           ELSE 0
         END,
         m.match_score DESC`,
      [req.user.id]
    );

    // In-memory deduplication by candidate_id and job_id
    const matchMap = new Map();
    for (const row of matches.rows) {
      const key = `${row.candidate_id}_${row.job_id}`;
      if (!matchMap.has(key)) {
        matchMap.set(key, row);
      }
    }

    const uniqueMatches = Array.from(matchMap.values()).sort((a, b) => {
      if (a.match_score === null && b.match_score !== null) return 1;
      if (a.match_score !== null && b.match_score === null) return -1;
      return (b.match_score || 0) - (a.match_score || 0);
    });

    return res.status(200).json({
      matches: uniqueMatches
    });
  } catch (err) {
    console.error("Error fetching matches:", err);

    return res.status(500).json({
      message: "Error fetching candidate screenings."
    });
  }
});

/**
 * POST /api/recruiter/matches/:matchId/status
 */
router.post("/matches/:matchId/status", async (req, res) => {
  const { matchId } = req.params;
  const status = normalizeText(req.body?.status, 100);

  if (!isValidId(matchId)) {
    return res.status(400).json({
      message: "Match ID is required."
    });
  }

  if (!status) {
    return res.status(400).json({
      message: "Status is required."
    });
  }

  if (!ALLOWED_MATCH_STATUSES.includes(status)) {
    return res.status(400).json({
      message: "Invalid match status.",
      allowedStatuses: ALLOWED_MATCH_STATUSES
    });
  }

  try {
    const result = await db.query(
      `UPDATE candidate_job_matches m
       SET status = $1
       FROM jobs j
       WHERE m.id = $2
         AND m.job_id = j.id
         AND j.recruiter_id = $3
       RETURNING m.*`,
      [
        status,
        matchId,
        req.user.id
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Match not found or you do not have access to this match."
      });
    }

    try {
      await db.query(
        `INSERT INTO hiring_pipeline_stages (match_id, stage, notes)
         VALUES ($1, $2, $3)`,
        [matchId, status, `Stage updated to ${status}`]
      );
    } catch (stageErr) {
      console.warn("[HireVision Pipeline] Non-fatal stage log notice:", stageErr.message);
    }

    return res.status(200).json({
      message: "Status updated successfully.",
      match: result.rows[0]
    });
  } catch (err) {
    console.error("Error updating match status:", err);

    return res.status(500).json({
      message: "Error updating screening status."
    });
  }
});

/**
 * GET /api/recruiter/settings
 */
router.get("/settings", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT *
       FROM recruiter_profiles
       WHERE user_id = $1`,
      [req.user.id]
    );

    if (result.rowCount === 0) {
      const newProfile = await db.query(
        `INSERT INTO recruiter_profiles (user_id)
         VALUES ($1)
         RETURNING *`,
        [req.user.id]
      );

      return res.status(200).json(newProfile.rows[0]);
    }

    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching recruiter settings:", err);

    return res.status(500).json({
      message: "Error fetching recruiter settings."
    });
  }
});

/**
 * PUT /api/recruiter/settings
 */
router.put("/settings", async (req, res) => {
  const companyName = normalizeText(req.body?.company_name, 250);
  const industry = normalizeText(req.body?.industry, 250);

  try {
    const existing = await db.query(
      `SELECT id
       FROM recruiter_profiles
       WHERE user_id = $1`,
      [req.user.id]
    );

    if (existing.rowCount === 0) {
      const created = await db.query(
        `INSERT INTO recruiter_profiles (
           user_id,
           company_name,
           industry
         )
         VALUES ($1, $2, $3)
         RETURNING *`,
        [
          req.user.id,
          companyName || "HireVision Corp",
          industry || "Technology"
        ]
      );

      return res.status(200).json({
        message: "Settings updated successfully.",
        profile: created.rows[0]
      });
    }

    const result = await db.query(
      `UPDATE recruiter_profiles
       SET
         company_name = $1,
         industry = $2,
         updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $3
       RETURNING *`,
      [
        companyName || "HireVision Corp",
        industry || "Technology",
        req.user.id
      ]
    );

    return res.status(200).json({
      message: "Settings updated successfully.",
      profile: result.rows[0]
    });
  } catch (err) {
    console.error("Error updating recruiter settings:", err);

    return res.status(500).json({
      message: "Error updating settings."
    });
  }
});

/**
 * POST /api/recruiter/matches/:matchId/evaluate
 * Evaluates candidate-job match using candidateJobMatchingAgent with real profile data and job requirements.
 */
router.post("/matches/:matchId/evaluate", async (req, res) => {
  const { matchId } = req.params;

  if (!isValidId(matchId)) {
    return res.status(400).json({
      message: "Match ID is required."
    });
  }

  try {
    const matchQuery = await db.query(
      `SELECT
         m.*,
         j.title AS job_title,
         j.description AS job_description,
         j.requirements AS job_requirements,
         u.id AS candidate_user_id,
         u.username,
         u.email,
         p.full_name,
         p.career_objective,
         p.skills,
         p.projects,
         p.experience,
         p.education
       FROM candidate_job_matches m
       JOIN jobs j ON m.job_id = j.id
       JOIN users u ON m.candidate_id = u.id
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE m.id = $1
         AND j.recruiter_id = $2
       LIMIT 1`,
      [matchId, req.user.id]
    );

    if (matchQuery.rowCount === 0) {
      return res.status(404).json({
        message: "Match not found or you do not have permission to evaluate this candidate."
      });
    }

    const row = matchQuery.rows[0];

    const candidateProfile = {
      full_name: row.full_name || row.username,
      username: row.username,
      career_objective: row.career_objective,
      skills: row.skills,
      projects: row.projects,
      experience: row.experience,
      education: row.education
    };

    const jobData = {
      id: row.job_id,
      title: row.job_title,
      description: row.job_description,
      requirements: row.job_requirements || DEFAULT_REQUIREMENTS
    };

    const analysis = candidateJobMatchingAgent.buildLocalMatchingAnalysis(
      jobData,
      candidateProfile
    );

    const calculatedScore = analysis.matchScore ?? analysis.score?.score ?? null;
    const strongList = (analysis.classifications || [])
      .filter(c => c.classification === "STRONG_MATCH")
      .map(c => c.requirement);
    const partialList = (analysis.classifications || [])
      .filter(c => c.classification === "PARTIAL_MATCH")
      .map(c => c.requirement);
    const missingList = (analysis.classifications || [])
      .filter(c => c.classification === "MISSING_NOT_EVIDENCED")
      .map(c => c.requirement);

    const totalReqs = (analysis.classifications || []).length;
    const unavailableReqs = (analysis.classifications || []).filter(c => c.classification === "INFORMATION_UNAVAILABLE").length;
    const dynamicConfidence = totalReqs > 0 ? Math.round(((totalReqs - unavailableReqs) / totalReqs) * 100) / 100 : 0;

    let explanation = "";
    if (calculatedScore !== null) {
      const parts = [`Match Score: ${calculatedScore}%`];
      const evidenceParts = [];
      if (strongList.length > 0) evidenceParts.push(`${strongList.length} skill(s) strongly matched (${strongList.slice(0, 3).join(", ")})`);
      if (partialList.length > 0) evidenceParts.push(`${partialList.length} partial competencies (${partialList.slice(0, 3).join(", ")})`);
      if (candidateProfile.projects && candidateProfile.projects.length > 0) {
        evidenceParts.push(`${candidateProfile.projects.length} relevant project(s)`);
      }
      if (candidateProfile.experience && candidateProfile.experience.length > 0) {
        evidenceParts.push(`${candidateProfile.experience.length} experience role(s)`);
      }
      if (missingList.length > 0) {
        evidenceParts.push(`Missing / unevidenced: ${missingList.slice(0, 3).join(", ")}`);
      }
      explanation = parts[0] + (evidenceParts.length > 0 ? " — Evidence: " + evidenceParts.join("; ") : "");
    } else {
      explanation = "Insufficient candidate or job data to calculate this score.";
    }

    const updatedMatch = await db.query(
      `UPDATE candidate_job_matches
       SET
         match_score = $1,
         explanation = $2,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [calculatedScore, explanation, matchId]
    );

    return res.status(200).json({
      success: true,
      message: "Candidate evaluated successfully.",
      match: updatedMatch.rows[0],
      analysis: {
        score: calculatedScore,
        level: calculatedScore !== null ? (calculatedScore >= 75 ? "Strong Match" : calculatedScore >= 45 ? "Partial Match" : "Insufficient Evidence") : "Insufficient Evidence",
        strongMatches: strongList,
        partialMatches: partialList,
        missing: missingList,
        unavailable: (analysis.classifications || []).filter(c => c.classification === "INFORMATION_UNAVAILABLE").map(c => c.requirement),
        recommendations: analysis.recommendations || [],
        confidence: dynamicConfidence
      }
    });
  } catch (err) {
    console.error("Error evaluating match:", err);
    return res.status(500).json({
      message: "Failed to evaluate candidate match.",
      error: err.message
    });
  }
});

/**
 * POST /api/recruiter/jobs/:jobId/evaluate-matches
 * POST /api/recruiter/jobs/:jobId/batch-evaluate
 * Batch evaluates all candidate matches for a specific recruiter job.
 */
router.post(["/jobs/:jobId/evaluate-matches", "/jobs/:jobId/batch-evaluate"], async (req, res) => {
  const { jobId } = req.params;

  if (!isValidId(jobId)) {
    return res.status(400).json({
      message: "Job ID is required."
    });
  }

  try {
    const jobRes = await db.query(
      `SELECT * FROM jobs WHERE id = $1 AND recruiter_id = $2`,
      [jobId, req.user.id]
    );

    if (jobRes.rowCount === 0) {
      return res.status(404).json({
        message: "Job not found or access denied."
      });
    }

    const job = jobRes.rows[0];

    // Synchronize all real registered candidates into candidate_job_matches for this job
    await db.query(
      `INSERT INTO candidate_job_matches (candidate_id, job_id, status, explanation)
       SELECT u.id, $1, 'Awaiting Review', 'Candidate-job match is pending AI evaluation.'
       FROM users u
       JOIN profiles p ON u.id = p.user_id
       WHERE ${REAL_CANDIDATE_SQL_FILTER}
         AND NOT EXISTS (
           SELECT 1 FROM candidate_job_matches m2
           WHERE m2.candidate_id = u.id AND m2.job_id = $1
         )`,
      [jobId]
    );

    const matchesRes = await db.query(
      `SELECT
         m.id AS match_id,
         u.id AS user_id,
         u.username,
         p.full_name,
         p.career_objective,
         p.skills,
         p.projects,
         p.experience,
         p.education
       FROM candidate_job_matches m
       JOIN users u ON m.candidate_id = u.id
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE m.job_id = $1
         AND ${REAL_CANDIDATE_SQL_FILTER}`,
      [jobId]
    );

    if (matchesRes.rowCount === 0) {
      return res.status(200).json({
        success: true,
        message: "No candidates available for screening.",
        evaluatedCount: 0,
        results: []
      });
    }

    // 1. Job Requirement Agent: extract and structure job requirements from actual job
    const jobAnalysis = jobRequirementAgent.buildLocalAnalysis(job);
    const structuredReqs = jobAnalysis?.requirements || jobRequirementAgent.extractJobRequirements(job);
    const enrichedJob = {
      ...job,
      requirements: structuredReqs && structuredReqs.length > 0
        ? {
            must_have: structuredReqs.filter(r => r.type === "MUST_HAVE").map(r => r.name),
            preferred: structuredReqs.filter(r => r.type === "PREFERRED").map(r => r.name),
            optional: structuredReqs.filter(r => r.type === "OPTIONAL").map(r => r.name)
          }
        : (job.requirements || DEFAULT_REQUIREMENTS)
    };

    let evaluatedCount = 0;
    const results = [];

    for (const row of matchesRes.rows) {
      const candidateProfile = {
        full_name: row.full_name || row.username,
        username: row.username,
        career_objective: row.career_objective,
        skills: row.skills,
        projects: row.projects,
        experience: row.experience,
        education: row.education
      };

      // 2. Candidate Job Matching Agent: calculate explainable match analysis
      const matchingAnalysis = candidateJobMatchingAgent.buildLocalMatchingAnalysis(
        enrichedJob,
        candidateProfile
      );

      // 3. Candidate Ranking Agent: multi-dimensional scoring
      const rankingScoreObj = candidateRankingAgent.calculateCandidateScore(
        enrichedJob,
        candidateProfile
      );

      const calculatedScore = matchingAnalysis.matchScore ?? rankingScoreObj?.score ?? null;
      const strongList = (matchingAnalysis.classifications || [])
        .filter(c => c.classification === "STRONG_MATCH")
        .map(c => c.requirement);
      const partialList = (matchingAnalysis.classifications || [])
        .filter(c => c.classification === "PARTIAL_MATCH")
        .map(c => c.requirement);
      const missingList = (matchingAnalysis.classifications || [])
        .filter(c => c.classification === "MISSING_NOT_EVIDENCED")
        .map(c => c.requirement);

      let explanation = "";
      if (calculatedScore !== null) {
        const parts = [`Match Score: ${calculatedScore}%`];
        const evidenceParts = [];
        if (strongList.length > 0) evidenceParts.push(`${strongList.length} skill(s) strongly matched (${strongList.slice(0, 3).join(", ")})`);
        if (partialList.length > 0) evidenceParts.push(`${partialList.length} partial competencies (${partialList.slice(0, 3).join(", ")})`);
        if (candidateProfile.projects && candidateProfile.projects.length > 0) {
          evidenceParts.push(`${candidateProfile.projects.length} relevant project(s)`);
        }
        if (candidateProfile.experience && candidateProfile.experience.length > 0) {
          evidenceParts.push(`${candidateProfile.experience.length} experience role(s)`);
        }
        if (missingList.length > 0) {
          evidenceParts.push(`Missing / unevidenced: ${missingList.slice(0, 3).join(", ")}`);
        }
        explanation = parts[0] + (evidenceParts.length > 0 ? " — Evidence: " + evidenceParts.join("; ") : "");
      } else {
        explanation = "Insufficient candidate or job data to calculate this score.";
      }

      await db.query(
        `UPDATE candidate_job_matches
         SET
           match_score = $1,
           explanation = $2,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [calculatedScore, explanation, row.match_id]
      );

      evaluatedCount++;
      results.push({
        matchId: row.match_id,
        candidateName: row.full_name || row.username,
        score: calculatedScore
      });
    }

    return res.status(200).json({
      success: true,
      message: `Evaluated ${evaluatedCount} candidate matches for job "${job.title}".`,
      evaluatedCount,
      results
    });
  } catch (err) {
    console.error("Error batch evaluating matches:", err);
    return res.status(500).json({
      message: "AI screening is temporarily unavailable. Please try again.",
      error: err.message
    });
  }
});

/**
 * POST /api/recruiter/candidates/compare
 * Multi-candidate side-by-side comparison using candidateComparisonAgent.
 * Zero fake data. Strictly real PostgreSQL records.
 */
router.post("/candidates/compare", async (req, res) => {
  const candidateIds = req.body?.candidateIds || req.body?.candidate_ids;
  const jobId = req.body?.jobId || req.body?.job_id;
  const userQuery = req.body?.query;

  if (!Array.isArray(candidateIds) || candidateIds.length < 2) {
    return res.status(400).json({
      success: false,
      message: "Please select at least two candidates to compare."
    });
  }

  try {
    const cleanIds = candidateIds
      .map(id => parseInt(id, 10))
      .filter(id => Number.isFinite(id) && id > 0);

    if (cleanIds.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Please select at least two valid registered candidates to compare."
      });
    }

    // 1. Fetch real registered candidates from PostgreSQL
    const candidatesRes = await db.query(
      `SELECT DISTINCT ON (u.id)
         u.id,
         u.id AS user_id,
         u.username,
         u.email,
         p.full_name,
         p.phone,
         p.city,
         p.country,
         p.profile_photo,
         p.career_objective,
         p.skills,
         p.projects,
         p.internships,
         p.experience,
         p.education,
         p.certifications,
         p.achievements,
         p.social_profiles,
         p.resume_url,
         p.created_at AS profile_created_at,
         p.updated_at AS profile_updated_at,
         (lr.id IS NOT NULL AND lr.content IS NOT NULL AND TRIM(lr.content) != '') AS has_live_resume,
         lr.content AS live_resume_content
       FROM users u
       JOIN profiles p ON u.id = p.user_id
       LEFT JOIN live_resumes lr ON u.id = lr.user_id
       WHERE u.id = ANY($1::int[])
         AND ${REAL_CANDIDATE_SQL_FILTER}
       ORDER BY u.id ASC`,
      [cleanIds]
    );

    if (candidatesRes.rowCount < 2) {
      return res.status(400).json({
        success: false,
        message: "At least two verified registered candidates are required for comparison."
      });
    }

    // 2. Fetch job context if specified
    let job = null;
    if (jobId && isValidId(jobId)) {
      const jobRes = await db.query(
        `SELECT * FROM jobs WHERE id = $1 AND recruiter_id = $2 LIMIT 1`,
        [jobId, req.user.id]
      );
      if (jobRes.rowCount > 0) {
        job = jobRes.rows[0];
      }
    }

    const comparisonCandidates = candidatesRes.rows;

    // 3. Execute Candidate Comparison Agent
    const agentContext = {
      candidates: comparisonCandidates,
      targetCandidates: comparisonCandidates,
      job,
      recruiterId: req.user.id
    };

    const comparisonQuery =
      normalizeText(userQuery) ||
      `Compare ${comparisonCandidates.length} candidates objectively on technical skills, project evidence, and relevant experience.`;

    const [agentResult, localAnalysis] = await Promise.all([
      candidateComparisonAgent.execute(comparisonQuery, agentContext),
      Promise.resolve(
        candidateComparisonAgent.buildLocalAnalysis(
          comparisonCandidates,
          comparisonQuery
        )
      )
    ]);

    return res.status(200).json({
      success: true,
      message: `Compared ${comparisonCandidates.length} candidate profiles using HireVision Candidate Comparison Agent.`,
      comparison: agentResult?.data || agentResult,
      analysis: localAnalysis,
      candidates: comparisonCandidates
    });
  } catch (err) {
    console.error("Error comparing candidates:", err);
    return res.status(500).json({
      success: false,
      message: "Candidate comparison failed. Please try again.",
      error: err.message
    });
  }
});

/**
 * GET /api/recruiter/analytics
 * Returns authenticated recruiter metrics computed from real database data.
 */
router.get("/analytics", async (req, res) => {
  try {
    const recruiterId = req.user.id;

    // 1. Jobs count
    const jobsRes = await db.query(
      `SELECT
         COUNT(*) AS total_jobs,
         COUNT(CASE WHEN status != 'closed' AND status != 'archived' THEN 1 END) AS active_jobs
       FROM jobs
       WHERE recruiter_id = $1`,
      [recruiterId]
    );
    const totalJobs = Number(jobsRes.rows[0]?.total_jobs || 0);
    const activeJobs = Number(jobsRes.rows[0]?.active_jobs || 0);

    // 2. Matches & pipeline breakdown
    const matchesRes = await db.query(
      `SELECT
         m.status,
         m.match_score,
         m.id,
         m.updated_at,
         u.username,
         p.full_name,
         j.title AS job_title
       FROM candidate_job_matches m
       JOIN jobs j ON m.job_id = j.id
       JOIN users u ON m.candidate_id = u.id
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE j.recruiter_id = $1
       ORDER BY m.updated_at DESC`,
      [recruiterId]
    );

    const matches = matchesRes.rows || [];
    const totalApplications = matches.length;

    const pipelineStages = {
      "Awaiting Review": 0,
      "Shortlisted": 0,
      "Interview": 0,
      "Scheduled": 0,
      "Hired": 0,
      "Rejected": 0
    };

    let totalScoreSum = 0;
    let scoredCount = 0;

    matches.forEach(m => {
      const st = m.status || "Awaiting Review";
      if (pipelineStages[st] !== undefined) {
        pipelineStages[st]++;
      } else {
        pipelineStages[st] = 1;
      }

      if (m.match_score !== null && m.match_score !== undefined) {
        const val = Number(m.match_score);
        if (!isNaN(val)) {
          totalScoreSum += val;
          scoredCount++;
        }
      }
    });

    const averageMatchScore = scoredCount > 0
      ? Math.round(totalScoreSum / scoredCount)
      : null;

    // 3. Top skills in talent pool
    const candidatesRes = await db.query(
      `SELECT p.skills
       FROM users u
       JOIN profiles p ON u.id = p.user_id
       WHERE ${REAL_CANDIDATE_SQL_FILTER}
       LIMIT 100`
    );

    const skillCounts = {};
    candidatesRes.rows.forEach(row => {
      let s = row.skills;
      if (Array.isArray(s)) {
        s.forEach(item => {
          const name = typeof item === 'object' ? (item.name || item.skill) : item;
          if (name && typeof name === 'string') {
            const clean = name.trim();
            if (clean) skillCounts[clean] = (skillCounts[clean] || 0) + 1;
          }
        });
      }
    });

    const topSkills = Object.entries(skillCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }));

    // 4. Automated Bottleneck Detection
    const bottlenecks = [];
    const awaitingReview = pipelineStages["Awaiting Review"] || 0;
    const shortlisted = pipelineStages["Shortlisted"] || 0;
    const interviews = (pipelineStages["Interview"] || 0) + (pipelineStages["Scheduled"] || 0);

    if (totalApplications > 0 && awaitingReview / totalApplications >= 0.5) {
      bottlenecks.push({
        type: "SCREENING_BACKLOG",
        severity: "medium",
        message: `${awaitingReview} applicant(s) are awaiting initial review. Running AI Screening will expedite shortlisting.`
      });
    }

    if (shortlisted > 2 && interviews === 0) {
      bottlenecks.push({
        type: "INTERVIEW_SCHEDULING_GAP",
        severity: "low",
        message: `${shortlisted} candidate(s) are shortlisted but none have been scheduled for an interview.`
      });
    }

    if (activeJobs > 0 && totalApplications === 0) {
      bottlenecks.push({
        type: "TALENT_ATTRACTION",
        severity: "high",
        message: "Active job postings currently have zero candidate matches. Ensure job requirements are well-defined."
      });
    }

    return res.status(200).json({
      success: true,
      recruiterId,
      totalJobs,
      activeJobs,
      totalApplications,
      evaluatedCount: scoredCount,
      averageMatchScore,
      pipelineStages,
      topSkills,
      bottlenecks,
      recentMatches: matches.slice(0, 5).map(m => ({
        id: m.id,
        candidateName: m.full_name || m.username,
        jobTitle: m.job_title,
        status: m.status,
        score: m.match_score
      }))
    });
  } catch (err) {
    console.error("Error fetching recruiter analytics:", err);
    return res.status(500).json({
      message: "Failed to compute recruiter analytics.",
      error: err.message
    });
  }
});

router.post("/chat", aiController.chat);
router.get("/chats", aiController.getChats);
router.post("/chats", aiController.createChat);
router.get("/chats/:chatId", aiController.getChat);
router.delete("/chats/:chatId", aiController.deleteChat);
router.post("/chats/:chatId/restore", aiController.restoreChat);
router.post("/chats/:chatId/reset", aiController.resetChat);

module.exports = router;