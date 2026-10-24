const db = require("../config/db");
const jwt = require("jsonwebtoken");
const { processRecruiterQuery } = require("../services/ai/recruiterOrchestrator");

async function testFollowUps() {
  console.log("=== TESTING RECRUITER MULTI-TURN FOLLOW-UPS ===");

  const recruiterRes = await db.query(
    "SELECT id, username, email, role FROM users WHERE role = 'recruiter' LIMIT 1"
  );
  if (recruiterRes.rowCount === 0) {
    console.error("No recruiter found.");
    process.exit(1);
  }
  const recruiter = recruiterRes.rows[0];
  console.log(`Recruiter: ${recruiter.username} (ID: ${recruiter.id})`);

  let conversation = [];

  // Turn 1: Initial query
  console.log("\n--- Turn 1: Show me candidates for my job ---");
  const turn1 = await processRecruiterQuery(
    recruiter.id,
    "Show me the best candidates for my active job.",
    conversation
  );
  console.log("Turn 1 Agent Routed:", turn1.agentRouted);
  console.log("Turn 1 Target Job:", turn1.targetJobId);
  console.log("Turn 1 Preview:", turn1.response.slice(0, 180).replace(/\n/g, " "));

  conversation.push({ role: "user", content: "Show me the best candidates for my active job." });
  conversation.push({ role: "assistant", content: turn1.response });

  // Turn 2: Follow-up "Which one is strongest?"
  console.log("\n--- Turn 2 Follow-up: Which one is strongest? ---");
  const turn2 = await processRecruiterQuery(
    recruiter.id,
    "Which one is strongest?",
    conversation
  );
  console.log("Turn 2 Agent Routed:", turn2.agentRouted);
  console.log("Turn 2 Preview:", turn2.response.slice(0, 180).replace(/\n/g, " "));

  conversation.push({ role: "user", content: "Which one is strongest?" });
  conversation.push({ role: "assistant", content: turn2.response });

  // Turn 3: Follow-up "Why?"
  console.log("\n--- Turn 3 Follow-up: Why? ---");
  const turn3 = await processRecruiterQuery(
    recruiter.id,
    "Why is this candidate recommended?",
    conversation
  );
  console.log("Turn 3 Agent Routed:", turn3.agentRouted);
  console.log("Turn 3 Target Candidate:", turn3.targetCandidateId);
  console.log("Turn 3 Preview:", turn3.response.slice(0, 180).replace(/\n/g, " "));

  conversation.push({ role: "user", content: "Why is this candidate recommended?" });
  conversation.push({ role: "assistant", content: turn3.response });

  // Turn 4: Follow-up "Compare the top two"
  console.log("\n--- Turn 4 Follow-up: Compare the top two ---");
  const turn4 = await processRecruiterQuery(
    recruiter.id,
    "Compare the top two candidates.",
    conversation
  );
  console.log("Turn 4 Agent Routed:", turn4.agentRouted);
  console.log("Turn 4 Preview:", turn4.response.slice(0, 180).replace(/\n/g, " "));

  console.log("\n=== ALL MULTI-TURN FOLLOW-UP TESTS PASSED ===");
  process.exit(0);
}

testFollowUps().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
