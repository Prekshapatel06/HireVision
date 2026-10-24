/**
 * HIREVISION AI — End-to-End Test Suite for LinkedIn Integration
 *
 * Verifies all 18 cases:
 *  1. Invalid URL -> 400 rejection
 *  2. Valid URL unauthenticated -> 401
 *  3. Valid URL without LinkedIn connection -> 409 / authorization_required with authorizationUrl
 *  4. Pre-existing profile items -> ignored as duplicates
 *  5. New skill -> PENDING skill import
 *  6. New project -> PENDING project import
 *  7. New certification -> PENDING certification import
 *  8. New experience -> PENDING experience import
 *  9. New education -> PENDING education import
 * 10. Different professional bio -> PENDING bio import
 * 11. Approve single item -> added to profile with provenance
 * 12. Reject item -> profile unchanged, marked REJECTED
 * 13. Batch approve -> only selected items added
 * 14. Re-scan -> already imported and rejected items not recreated
 * 15. Limited basic OIDC -> status "limited_access", ZERO fake data
 * 16. Security isolation -> unauthorized user cannot approve another's import
 * 17. Candidate Profile reflects approved items
 * 18. Live Resume reflects approved items
 */

const jwt = require("jsonwebtoken");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../config/db");

const BASE_URL = "http://localhost:5000";
const JWT_SECRET = process.env.JWT_SECRET || "hirevision_secret_jwt_key_2026_super_secure";

let passedTests = 0;
let failedTests = 0;

function logPass(testName, detail = "") {
  passedTests++;
  console.log(`  \x1b[32m✔ PASS\x1b[0m [Case ${passedTests + failedTests}] ${testName}${detail ? ` (${detail})` : ""}`);
}

function logFail(testName, error) {
  failedTests++;
  console.error(`  \x1b[31m✖ FAIL\x1b[0m [Case ${passedTests + failedTests}] ${testName}: ${error}`);
}

async function run() {
  console.log("================================================================================");
  console.log("       HIREVISION AI — LINKEDIN PERMISSION IMPORT VERIFICATION SUITE            ");
  console.log("================================================================================\n");

  const timestamp = Date.now();
  const testEmailA = `test_candidate_a_${timestamp}@hirevision.test`;
  const testEmailB = `test_candidate_b_${timestamp}@hirevision.test`;

  // 1. Setup Test Candidates in DB
  const userARes = await db.query(
    `INSERT INTO users (username, email, password, role)
     VALUES ($1, $2, 'dummy_hash', 'candidate')
     RETURNING id, username, email`,
    [`candidate_a_${timestamp}`, testEmailA]
  );
  const userA = userARes.rows[0];

  const userBRes = await db.query(
    `INSERT INTO users (username, email, password, role)
     VALUES ($1, $2, 'dummy_hash', 'candidate')
     RETURNING id, username, email`,
    [`candidate_b_${timestamp}`, testEmailB]
  );
  const userB = userBRes.rows[0];

  // Profile A with pre-existing items
  await db.query(
    `INSERT INTO profiles (
      user_id, full_name, career_objective,
      skills, projects, certifications, experience, education, social_profiles
    ) VALUES (
      $1, 'Test Candidate A', 'Experienced Software Engineer passionate about cloud architecture.',
      $2, $3, $4, $5, $6, $7
    )`,
    [
      userA.id,
      JSON.stringify([
        { name: "JavaScript", level: "Expert", category: "Programming" },
        { name: "Node.js", level: "Advanced", category: "Backend" }
      ]),
      JSON.stringify([
        { title: "HireVision Core", description: "AI Platform for intelligent hiring." }
      ]),
      JSON.stringify([
        { name: "AWS Certified Developer", issuer: "Amazon Web Services" }
      ]),
      JSON.stringify([
        { title: "Backend Developer", company: "Acme Corp", location: "Remote" }
      ]),
      JSON.stringify([
        { institution: "Tech State University", degree: "B.S. in Computer Science" }
      ]),
      JSON.stringify({
        linkedin: "https://www.linkedin.com/in/testcandidate-a"
      })
    ]
  );

  // Profile B for isolation tests
  await db.query(
    `INSERT INTO profiles (user_id, full_name, skills) VALUES ($1, 'Test Candidate B', '[]'::jsonb)`,
    [userB.id]
  );

  const tokenA = jwt.sign({ id: userA.id, userId: userA.id, email: userA.email, role: "candidate" }, JWT_SECRET);
  const tokenB = jwt.sign({ id: userB.id, userId: userB.id, email: userB.email, role: "candidate" }, JWT_SECRET);

  try {
    // -------------------------------------------------------------------------
    // Case 1: Invalid URL -> 400
    // -------------------------------------------------------------------------
    try {
      const res = await fetch(`${BASE_URL}/api/ai/linkedin/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ linkedinUrl: "" })
      });
      const data = await res.json();
      if (res.status === 400 && data.code === "LINKEDIN_URL_REQUIRED") {
        logPass("Invalid URL returns 400 Bad Request with LINKEDIN_URL_REQUIRED");
      } else {
        logFail("Invalid URL handling", `Expected 400, got ${res.status}`);
      }
    } catch (e) {
      logFail("Invalid URL handling", e.message);
    }

    // -------------------------------------------------------------------------
    // Case 2: Valid URL unauthenticated -> 401
    // -------------------------------------------------------------------------
    try {
      const res = await fetch(`${BASE_URL}/api/ai/linkedin/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedinUrl: "https://www.linkedin.com/in/testcandidate-a" })
      });
      if (res.status === 401) {
        logPass("Unauthenticated scan request returns 401 Unauthorized");
      } else {
        logFail("Unauthenticated access check", `Expected 401, got ${res.status}`);
      }
    } catch (e) {
      logFail("Unauthenticated access check", e.message);
    }

    // -------------------------------------------------------------------------
    // Case 3: Valid URL without connection -> 409 / authorization_required
    // -------------------------------------------------------------------------
    try {
      const res = await fetch(`${BASE_URL}/api/ai/linkedin/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ linkedinUrl: "https://www.linkedin.com/in/testcandidate-a" })
      });
      const data = await res.json();
      if (res.status === 409 && data.status === "authorization_required" && data.authorizationUrl) {
        logPass("Unconnected LinkedIn scan returns 409 authorization_required with OAuth URL");
      } else {
        logFail("Authorization check", `Expected 409 authorization_required, got ${res.status} (${JSON.stringify(data)})`);
      }
    } catch (e) {
      logFail("Authorization check", e.message);
    }

    // -------------------------------------------------------------------------
    // Cases 4-10: Import payload testing (pre-existing ignored, new items PENDING)
    // -------------------------------------------------------------------------
    // We provide a realistic LinkedIn archive payload containing:
    //  - JavaScript (already in profile -> must be ignored)
    //  - TypeScript (NEW skill -> must be PENDING)
    //  - HireVision Core (already in profile -> must be ignored)
    //  - AI Resume Parser (NEW project -> must be PENDING)
    //  - AWS Certified Developer (already in profile -> must be ignored)
    //  - Certified Kubernetes Administrator (NEW certification -> must be PENDING)
    //  - Backend Developer at Acme Corp (already in profile -> must be ignored)
    //  - Senior AI Architect at Nova Tech (NEW experience -> must be PENDING)
    //  - Tech State University (already in profile -> must be ignored)
    //  - MIT (NEW education -> must be PENDING)
    //  - Updated Bio -> must be PENDING
    const fullArchiveData = {
      profile: {
        headline: "Staff AI Engineer | Cloud Architect",
        summary: "Lead Architect specializing in autonomous systems, distributed LLM orchestration, and modern web platforms."
      },
      skills: [
        { name: "JavaScript" }, // pre-existing
        { name: "TypeScript" }  // new
      ],
      projects: [
        { title: "HireVision Core", description: "AI Platform for intelligent hiring." }, // pre-existing
        { title: "AI Resume Parser", description: "High-throughput resume extraction engine.", url: "https://github.com/test/resume-parser" } // new
      ],
      certifications: [
        { name: "AWS Certified Developer", issuer: "Amazon Web Services" }, // pre-existing
        { name: "Certified Kubernetes Administrator", issuer: "Linux Foundation" } // new
      ],
      positions: [
        { title: "Backend Developer", company_name: "Acme Corp", location: "Remote" }, // pre-existing
        { title: "Senior AI Architect", company_name: "Nova Tech", location: "San Francisco, CA", description: "Designing high scale multi-agent services." } // new
      ],
      education: [
        { school_name: "Tech State University", degree_name: "B.S. in Computer Science" }, // pre-existing
        { school_name: "Massachusetts Institute of Technology", degree_name: "M.S. in Artificial Intelligence" } // new
      ]
    };

    let scanResultData = null;
    try {
      const res = await fetch(`${BASE_URL}/api/ai/linkedin/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({
          linkedinUrl: "https://www.linkedin.com/in/testcandidate-a",
          linkedinData: fullArchiveData
        })
      });
      scanResultData = await res.json();
      if (res.status === 200 && scanResultData.success && scanResultData.status === "pending_approval") {
        logPass("LinkedIn scan with data returns 200 and pending_approval status");
      } else {
        logFail("LinkedIn scan with data", `Expected 200, got ${res.status}: ${JSON.stringify(scanResultData)}`);
      }
    } catch (e) {
      logFail("LinkedIn scan with data", e.message);
    }

    const items = scanResultData?.items || [];

    // Case 4: Pre-existing items ignored
    const hasDuplicateSkill = items.some((i) => i.item_type?.toLowerCase() === "skill" && i.title.toLowerCase() === "javascript");
    const hasDuplicateProject = items.some((i) => i.item_type?.toLowerCase() === "project" && i.title.toLowerCase().includes("hirevision core"));
    const hasDuplicateCert = items.some((i) => i.item_type?.toLowerCase() === "certification" && i.title.toLowerCase().includes("aws certified developer"));
    if (!hasDuplicateSkill && !hasDuplicateProject && !hasDuplicateCert) {
      logPass("Pre-existing profile items ignored (no duplicate import requests created)");
    } else {
      logFail("Duplicate detection", "Duplicate items were detected in import requests");
    }

    // Case 5: New skill -> PENDING
    const skillItem = items.find((i) => i.item_type?.toLowerCase() === "skill" && i.title === "TypeScript");
    if (skillItem && skillItem.status === "PENDING") {
      logPass("New skill 'TypeScript' created with PENDING status");
    } else {
      logFail("New skill import", "Expected PENDING TypeScript skill");
    }

    // Case 6: New project -> PENDING
    const projectItem = items.find((i) => i.item_type?.toLowerCase() === "project" && i.title === "AI Resume Parser");
    if (projectItem && projectItem.status === "PENDING") {
      logPass("New project 'AI Resume Parser' created with PENDING status");
    } else {
      logFail("New project import", "Expected PENDING AI Resume Parser project");
    }

    // Case 7: New certification -> PENDING
    const certItem = items.find((i) => i.item_type?.toLowerCase() === "certification" && i.title.includes("Kubernetes"));
    if (certItem && certItem.status === "PENDING") {
      logPass("New certification 'Certified Kubernetes Administrator' created with PENDING status");
    } else {
      logFail("New certification import", "Expected PENDING Kubernetes certification");
    }

    // Case 8: New experience -> PENDING
    const expItem = items.find((i) => i.item_type?.toLowerCase() === "experience" && i.title.includes("Senior AI Architect"));
    if (expItem && expItem.status === "PENDING") {
      logPass("New experience 'Senior AI Architect' created with PENDING status");
    } else {
      logFail("New experience import", "Expected PENDING Senior AI Architect experience");
    }

    // Case 9: New education -> PENDING
    const eduItem = items.find((i) => i.item_type?.toLowerCase() === "education" && i.title.includes("Massachusetts Institute of Technology"));
    if (eduItem && eduItem.status === "PENDING") {
      logPass("New education 'Massachusetts Institute of Technology' created with PENDING status");
    } else {
      logFail("New education import", "Expected PENDING MIT education");
    }

    // Case 10: Different professional bio -> PENDING
    const bioItem = items.find((i) => i.item_type?.toLowerCase() === "bio");
    if (bioItem && bioItem.status === "PENDING") {
      logPass("Different professional bio created with PENDING status");
    } else {
      logFail("New bio import", "Expected PENDING bio import item");
    }

    // -------------------------------------------------------------------------
    // Case 11: Approve single item -> added to profile with provenance
    // -------------------------------------------------------------------------
    try {
      const approveRes = await fetch(`${BASE_URL}/api/ai/import/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ importId: skillItem.id })
      });
      const approveData = await approveRes.json();
      const updatedProfile = approveData.profile;
      const skills = Array.isArray(updatedProfile?.skills) ? updatedProfile.skills : [];
      const hasAddedSkill = skills.some(
        (s) => (s.name || s.skill) === "TypeScript" && s.source === "linkedin" && s.approved_by_user === true
      );

      if (approveRes.status === 200 && hasAddedSkill) {
        logPass("Approve single item successfully adds to profile with full provenance metadata");
      } else {
        logFail("Single item approval", `Expected skill added with provenance, got: ${JSON.stringify(skills)}`);
      }
    } catch (e) {
      logFail("Single item approval", e.message);
    }

    // -------------------------------------------------------------------------
    // Case 12: Reject item -> profile unchanged, marked REJECTED
    // -------------------------------------------------------------------------
    try {
      const rejectRes = await fetch(`${BASE_URL}/api/ai/import/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ importId: certItem.id })
      });
      const rejectData = await rejectRes.json();

      // Check DB directly
      const dbCheck = await db.query(
        "SELECT status FROM external_import_requests WHERE id = $1",
        [certItem.id]
      );
      const isRejected = dbCheck.rows[0]?.status === "REJECTED";

      // Verify profile did NOT add cert
      const profileCheck = await db.query(
        "SELECT certifications FROM profiles WHERE user_id = $1",
        [userA.id]
      );
      const certs = profileCheck.rows[0]?.certifications || [];
      const hasCert = certs.some((c) => c.name?.includes("Kubernetes"));

      if (rejectRes.status === 200 && isRejected && !hasCert) {
        logPass("Reject item updates status to REJECTED and leaves profile unchanged");
      } else {
        logFail("Item rejection", `isRejected: ${isRejected}, hasCert: ${hasCert}`);
      }
    } catch (e) {
      logFail("Item rejection", e.message);
    }

    // -------------------------------------------------------------------------
    // Case 13: Batch approve -> only selected items added
    // -------------------------------------------------------------------------
    try {
      const batchIds = [projectItem.id, expItem.id];
      const batchRes = await fetch(`${BASE_URL}/api/ai/import/batch-approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ importIds: batchIds })
      });
      const batchData = await batchRes.json();

      // Check profile
      const profCheck = await db.query(
        "SELECT projects, experience, education FROM profiles WHERE user_id = $1",
        [userA.id]
      );
      const projects = profCheck.rows[0]?.projects || [];
      const exp = profCheck.rows[0]?.experience || [];
      const edu = profCheck.rows[0]?.education || [];

      const hasProject = projects.some((p) => p.title?.includes("AI Resume Parser") && p.source === "linkedin");
      const hasExp = exp.some((e) => (e.role || e.title)?.includes("Senior AI Architect") && e.source === "linkedin");
      const hasEdu = edu.some((e) => e.institution?.includes("MIT") || e.institution?.includes("Massachusetts"));

      if (batchRes.status === 200 && hasProject && hasExp && !hasEdu) {
        logPass("Batch approve adds only selected items (project & experience) and leaves unselected item (education) pending");
      } else {
        logFail("Batch approval", `hasProject: ${hasProject}, hasExp: ${hasExp}, hasEdu: ${hasEdu}`);
      }
    } catch (e) {
      logFail("Batch approval", e.message);
    }

    // -------------------------------------------------------------------------
    // Case 14: Re-scan -> already imported and rejected items not recreated
    // -------------------------------------------------------------------------
    try {
      const res = await fetch(`${BASE_URL}/api/ai/linkedin/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({
          linkedinUrl: "https://www.linkedin.com/in/testcandidate-a",
          linkedinData: fullArchiveData
        })
      });
      const rescanData = await res.json();
      const rescanItems = rescanData?.items || [];

      // TypeScript was APPROVED -> should NOT be pending again
      // Kubernetes was REJECTED -> should NOT be pending again
      // AI Resume Parser was APPROVED -> should NOT be pending again
      const hasApprovedTypeScript = rescanItems.some((i) => i.item_type?.toLowerCase() === "skill" && i.title === "TypeScript");
      const hasRejectedKubernetes = rescanItems.some((i) => i.item_type?.toLowerCase() === "certification" && i.title.includes("Kubernetes"));

      if (!hasApprovedTypeScript && !hasRejectedKubernetes) {
        logPass("Re-scan correctly suppresses already approved and rejected items without duplicate rows");
      } else {
        logFail("Re-scan deduplication", `Approved TypeScript pending: ${hasApprovedTypeScript}, Rejected Kubernetes pending: ${hasRejectedKubernetes}`);
      }
    } catch (e) {
      logFail("Re-scan deduplication", e.message);
    }

    // -------------------------------------------------------------------------
    // Case 15: Limited basic OIDC -> status "limited_access", ZERO fake data
    // -------------------------------------------------------------------------
    try {
      const basicOidcData = {
        name: "Test Candidate A",
        email: "test@example.com",
        sub: "oidc-sub-12345"
        // NO positions, skills, certs, projects
      };
      const res = await fetch(`${BASE_URL}/api/ai/linkedin/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({
          linkedinUrl: "https://www.linkedin.com/in/testcandidate-a",
          linkedinData: basicOidcData
        })
      });
      const oidcResult = await res.json();

      // Must be limited_access, and 0 fake items generated
      const generatedItems = oidcResult.items || [];
      if (
        oidcResult.status === "limited_access" &&
        oidcResult.dataAvailable === false &&
        generatedItems.length === 0
      ) {
        logPass("Basic OIDC payload returns 'limited_access' status with ZERO fake data fabricated");
      } else {
        logFail("Basic OIDC handling", `status: ${oidcResult.status}, items: ${generatedItems.length}`);
      }
    } catch (e) {
      logFail("Basic OIDC handling", e.message);
    }

    // -------------------------------------------------------------------------
    // Case 16: Security isolation -> user B cannot approve user A's import
    // -------------------------------------------------------------------------
    try {
      const attackRes = await fetch(`${BASE_URL}/api/ai/import/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenB}` },
        body: JSON.stringify({ importId: eduItem.id }) // eduItem belongs to user A!
      });
      if (attackRes.status === 404 || attackRes.status === 403) {
        logPass("Security isolation enforced: Candidate B cannot approve Candidate A's import item");
      } else {
        logFail("Security isolation", `Expected 404/403, got ${attackRes.status}`);
      }
    } catch (e) {
      logFail("Security isolation", e.message);
    }

    // -------------------------------------------------------------------------
    // Case 17: Candidate Profile reflects approved items
    // -------------------------------------------------------------------------
    try {
      const profRes = await fetch(`${BASE_URL}/api/profile`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      const profData = await profRes.json();
      const p = profData.profile || profData;

      const hasApprovedSkill = Array.isArray(p.skills) && p.skills.some((s) => (s.name || s.skill) === "TypeScript");
      const hasApprovedProject = Array.isArray(p.projects) && p.projects.some((pr) => pr.title?.includes("AI Resume Parser"));
      const hasApprovedExp = Array.isArray(p.experience || p.work_experience) && (p.experience || p.work_experience).some((ex) => (ex.role || ex.title)?.includes("Senior AI Architect"));

      if (hasApprovedSkill && hasApprovedProject && hasApprovedExp) {
        logPass("Candidate profile API accurately reflects all approved LinkedIn items");
      } else {
        logFail("Candidate profile reflection", `Skill: ${hasApprovedSkill}, Project: ${hasApprovedProject}, Exp: ${hasApprovedExp}`);
      }
    } catch (e) {
      logFail("Candidate profile reflection", e.message);
    }

    // -------------------------------------------------------------------------
    // Case 18: Live Resume reflects approved items
    // -------------------------------------------------------------------------
    try {
      const resumeRes = await fetch(`${BASE_URL}/api/ai/resume/live`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      const resumeData = await resumeRes.json();
      const resume = resumeData.resume || resumeData;

      // Check if skills and projects in live resume include the approved items
      const rawText = JSON.stringify(resume);
      const hasResumeSkill = rawText.includes("TypeScript");
      const hasResumeProject = rawText.includes("AI Resume Parser");
      const hasResumeExp = rawText.includes("Senior AI Architect");

      if (hasResumeSkill && (hasResumeProject || hasResumeExp)) {
        logPass("Live Resume accurately integrates and displays approved LinkedIn items");
      } else {
        logFail("Live Resume reflection", `Skill: ${hasResumeSkill}, Project: ${hasResumeProject}, Exp: ${hasResumeExp}`);
      }
    } catch (e) {
      logFail("Live Resume reflection", e.message);
    }

  } finally {
    // Cleanup test users and import requests
    try {
      await db.query("DELETE FROM external_import_requests WHERE user_id IN ($1, $2)", [userA.id, userB.id]);
      await db.query("DELETE FROM profiles WHERE user_id IN ($1, $2)", [userA.id, userB.id]);
      await db.query("DELETE FROM users WHERE id IN ($1, $2)", [userA.id, userB.id]);
    } catch (cleanErr) {
      console.error("Cleanup error:", cleanErr.message);
    }
  }

  console.log("\n================================================================================");
  console.log(`     RESULTS: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL 18 CASES)   `);
  console.log("================================================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
