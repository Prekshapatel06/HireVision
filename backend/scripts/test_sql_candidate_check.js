const db = require("../config/db");

async function testSQL() {
  // Let's test a SQL WHERE clause that filters candidates who have real stored data
  const query = `
    SELECT u.id, u.username, u.email,
      (
        (p.career_objective IS NOT NULL AND TRIM(p.career_objective) != '')
        OR (p.resume_url IS NOT NULL AND TRIM(p.resume_url) != '')
        OR (jsonb_typeof(p.projects) = 'array' AND jsonb_array_length(p.projects) > 0)
        OR (jsonb_typeof(p.experience) = 'array' AND jsonb_array_length(p.experience) > 0)
        OR (jsonb_typeof(p.internships) = 'array' AND jsonb_array_length(p.internships) > 0)
        OR (jsonb_typeof(p.education) = 'array' AND jsonb_array_length(p.education) > 0)
        OR (jsonb_typeof(p.certifications) = 'array' AND jsonb_array_length(p.certifications) > 0)
        OR (jsonb_typeof(p.skills) = 'array' AND jsonb_array_length(p.skills) > 0)
        OR (
          jsonb_typeof(p.skills) = 'object'
          AND EXISTS (
            SELECT 1 FROM jsonb_each(p.skills) kv
            WHERE (jsonb_typeof(kv.value) = 'array' AND jsonb_array_length(kv.value) > 0)
               OR (jsonb_typeof(kv.value) = 'string' AND TRIM(kv.value::text, '"') != '')
          )
        )
      ) AS has_stored_data
    FROM users u
    JOIN profiles p ON u.id = p.user_id
    WHERE u.role IN ('candidate', 'user')
    ORDER BY u.id ASC
  `;

  const res = await db.query(query);
  console.log("SQL has_stored_data results:");
  res.rows.forEach((r) => {
    console.log(`ID ${r.id}: ${r.username} -> has_stored_data = ${r.has_stored_data}`);
  });

  const matchingCount = res.rows.filter((r) => r.has_stored_data).length;
  const nonMatchingCount = res.rows.filter((r) => !r.has_stored_data).length;
  console.log(`\nMatching with stored data: ${matchingCount}`);
  console.log(`Non-matching (empty default profiles): ${nonMatchingCount}`);

  process.exit(0);
}

testSQL().catch((err) => {
  console.error(err);
  process.exit(1);
});
