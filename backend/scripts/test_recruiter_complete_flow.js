const { query, pool } = require("../config/db");
const jwt = require("jsonwebtoken");

const BASE_URL = "http://localhost:5000";

async function runVerification() {
  console.log("=== HIREVISION RECRUITER SYSTEM AUTOMATED VERIFICATION ===");

  // 1. Recruiter Auth Token
  console.log("\n[Step 1] Resolving recruiter user and generating JWT token...");
  let recruiterToken = "";
  try {
    let recruiterRes = await query("SELECT id, username, email, role FROM users WHERE role = 'recruiter' LIMIT 1");
    let recruiter = recruiterRes.rows[0];
    if (!recruiter) {
      throw new Error("No recruiter found in database");
    }
    const secret = process.env.JWT_SECRET || "hirevision-secret-key-2024";
    recruiterToken = jwt.sign(
      { id: recruiter.id, email: recruiter.email, role: "recruiter" },
      secret,
      { expiresIn: "2h" }
    );
    console.log(`✓ Recruiter authenticated: ${recruiter.username || recruiter.email} (ID: ${recruiter.id}, Role: ${recruiter.role})`);
  } catch (err) {
    console.error("✗ Recruiter auth failed:", err.message);
    process.exit(1);
  }

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${recruiterToken}`
  };

  // 2. Fetch Candidates
  console.log("\n[Step 2] Fetching real PostgreSQL candidates...");
  let realCandidates = [];
  try {
    const candidatesRes = await fetch(`${BASE_URL}/api/recruiter/candidates`, {
      headers: authHeaders
    });
    const candidatesData = await candidatesRes.json();
    if (!candidatesRes.ok) throw new Error(candidatesData.message || "Failed to fetch candidates");
    realCandidates = candidatesData.candidates;
    console.log(`✓ Retrieved ${realCandidates.length} candidate(s).`);
    realCandidates.forEach((c) => {
      console.log(`  - ID: ${c.id}, Name: ${c.full_name}, Email: ${c.email}, LiveResume: ${c.has_live_resume}, Skills: ${c.skills?.length || Object.keys(c.skills || {}).length}`);
      // Verification: zero fake candidates rule
      if (c.full_name === "John Doe" || c.email === "john@example.com") {
        throw new Error("FAIL: Found fake candidate 'John Doe'!");
      }
    });
  } catch (err) {
    console.error("✗ Candidate retrieval failed:", err.message);
    process.exit(1);
  }

  // 3. Test Live Resume Fetch & Auto-generation
  if (realCandidates.length > 0) {
    const targetCandidate = realCandidates[0];
    const candidateId = targetCandidate.user_id || targetCandidate.id;
    console.log(`\n[Step 3] Fetching Live Resume for candidate #${candidateId} (${targetCandidate.full_name})...`);
    try {
      const lrRes = await fetch(`${BASE_URL}/api/recruiter/candidates/${candidateId}/live-resume`, {
        headers: authHeaders
      });
      const lrData = await lrRes.json();
      console.log("✓ Live Resume API response:", {
        hasLiveResume: lrData.hasLiveResume,
        source: lrData.source,
        message: lrData.message
      });
      if (lrData.hasLiveResume) {
        console.log("  Live resume summary length:", lrData.liveResume?.summary?.length || 0);
        console.log("  Verified Skills count:", lrData.liveResume?.skills?.length || 0);
      }
    } catch (err) {
      console.error("✗ Live Resume fetch failed:", err.message);
      process.exit(1);
    }
  }

  // 4. Job Creation
  console.log("\n[Step 4] Creating a new test job posting...");
  let createdJobId = null;
  try {
    const createJobRes = await fetch(`${BASE_URL}/api/recruiter/jobs`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        title: "Test Full Stack AI Engineer",
        description: "Looking for an engineer with React, Node.js, and PostgreSQL expertise.",
        requirements: {
          must_have: ["Node.js", "React", "PostgreSQL"],
          preferred: ["Docker", "Python", "TailwindCSS"],
          optional: []
        }
      })
    });
    const createJobData = await createJobRes.json();
    if (!createJobRes.ok) throw new Error(createJobData.message || "Failed to create job");
    createdJobId = createJobData.job.id;
    console.log(`✓ Job created with ID: ${createdJobId} (Title: ${createJobData.job.title})`);
  } catch (err) {
    console.error("✗ Job creation failed:", err.message);
    process.exit(1);
  }

  // 5. Job Edit (PUT /jobs/:jobId)
  console.log(`\n[Step 5] Editing job posting #${createdJobId}...`);
  try {
    const editJobRes = await fetch(`${BASE_URL}/api/recruiter/jobs/${createdJobId}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({
        title: "Senior Full Stack AI Engineer (Updated)",
        description: "Updated description: Requires high proficiency in Node.js, React, and PostgreSQL.",
        status: "Active",
        requirements: {
          must_have: ["Node.js", "React", "PostgreSQL", "Docker"],
          preferred: ["TypeScript", "GraphQL"],
          optional: []
        }
      })
    });
    const editJobData = await editJobRes.json();
    if (!editJobRes.ok) throw new Error(editJobData.message || "Failed to edit job");
    console.log("✓ Job updated successfully:", {
      title: editJobData.job.title,
      status: editJobData.job.status,
      must_have: editJobData.job.requirements.must_have
    });
  } catch (err) {
    console.error("✗ Job edit failed:", err.message);
    process.exit(1);
  }

  // 6. AI Batch Candidate Screening on the job
  console.log(`\n[Step 6] Running AI batch screening for job #${createdJobId}...`);
  try {
    const screenRes = await fetch(`${BASE_URL}/api/recruiter/jobs/${createdJobId}/batch-evaluate`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({})
    });
    const screenData = await screenRes.json();
    if (!screenRes.ok) throw new Error(screenData.message || "Failed batch screening");
    console.log(`✓ Batch screening completed for ${screenData.evaluatedCount || screenData.evaluated || 0} candidate(s).`);
    if (screenData.results && screenData.results.length > 0) {
      screenData.results.forEach((r) => {
        console.log(`  Candidate: ${r.candidateName}, Score=${r.score}%, MatchId=${r.matchId}`);
      });
    }
  } catch (err) {
    console.error("✗ AI batch screening failed:", err.message);
    process.exit(1);
  }

  // 7. Status Update / Pipeline Shortlisting
  console.log(`\n[Step 7] Testing candidate status transition to 'Shortlisted'...`);
  let testMatchId = null;
  try {
    const matchesRes = await fetch(`${BASE_URL}/api/recruiter/matches`, {
      headers: authHeaders
    });
    const matchesData = await matchesRes.json();
    const jobMatch = matchesData.matches.find((m) => String(m.job_id) === String(createdJobId));
    if (jobMatch) {
      testMatchId = jobMatch.id;
      const statusRes = await fetch(`${BASE_URL}/api/recruiter/matches/${testMatchId}/status`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ status: "Shortlisted" })
      });
      const statusData = await statusRes.json();
      if (!statusRes.ok) throw new Error(statusData.message || "Failed to update match status");
      console.log(`✓ Match #${testMatchId} status updated to: ${statusData.match.status}`);
    } else {
      console.log("  No match found for this job to update status.");
    }
  } catch (err) {
    console.error("✗ Match status update failed:", err.message);
    process.exit(1);
  }

  // 8. Candidate Comparison Agent
  if (realCandidates.length >= 1) {
    console.log("\n[Step 8] Testing Candidate Comparison Agent API...");
    try {
      const candidateIds = realCandidates.slice(0, 2).map((c) => c.user_id || c.id);
      const compareRes = await fetch(`${BASE_URL}/api/recruiter/candidates/compare`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          candidate_ids: candidateIds,
          job_id: createdJobId
        })
      });
      const compareData = await compareRes.json();
      if (!compareRes.ok) throw new Error(compareData.message || "Failed comparison");
      console.log("✓ Candidate comparison completed successfully:", {
        candidateCount: compareData.candidates?.length,
        hasSummary: Boolean(compareData.comparison?.summary),
        hasRecommendation: Boolean(compareData.comparison?.recommendation)
      });
    } catch (err) {
      console.error("✗ Candidate comparison failed:", err.message);
      process.exit(1);
    }
  }

  // 9. Job Deletion (DELETE /jobs/:jobId)
  console.log(`\n[Step 9] Deleting test job #${createdJobId}...`);
  try {
    const deleteRes = await fetch(`${BASE_URL}/api/recruiter/jobs/${createdJobId}`, {
      method: "DELETE",
      headers: authHeaders
    });
    const deleteData = await deleteRes.json();
    if (!deleteRes.ok) throw new Error(deleteData.message || "Failed to delete job");
    console.log(`✓ Job #${createdJobId} deleted successfully: ${deleteData.message}`);
  } catch (err) {
    console.error("✗ Job deletion failed:", err.message);
    process.exit(1);
  }

  console.log("\n=== ALL RECRUITER FLOWS VERIFIED SUCCESSFULLY WITH ZERO ERRORS ===");
  await pool.end();
  process.exit(0);
}

runVerification().catch(async (err) => {
  console.error("Verification script error:", err);
  try { await pool.end(); } catch (_) {}
  process.exit(1);
});
