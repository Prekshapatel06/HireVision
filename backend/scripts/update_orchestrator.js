const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "../services/ai/recruiterOrchestrator.js");
let content = fs.readFileSync(file, "utf8");

if (!content.includes("REAL_CANDIDATE_SQL_FILTER")) {
  content = content.replace(
    'const db = require("../../config/db");',
    'const db = require("../../config/db");\nconst { REAL_CANDIDATE_SQL_FILTER } = require("../../utils/candidateValidation");'
  );
}

// Replace candidates query
content = content.replace(
  /WHERE u\.role = 'candidate'\s+OR u\.role = 'user'/,
  "WHERE ${REAL_CANDIDATE_SQL_FILTER}"
);

// Replace matches query
content = content.replace(
  /LEFT JOIN profiles p ON u\.id = p\.user_id\s+WHERE j\.recruiter_id = \$1/,
  "JOIN profiles p ON u.id = p.user_id\n        WHERE j.recruiter_id = $1\n          AND ${REAL_CANDIDATE_SQL_FILTER}"
);

fs.writeFileSync(file, content, "utf8");
console.log("Successfully updated services/ai/recruiterOrchestrator.js");
