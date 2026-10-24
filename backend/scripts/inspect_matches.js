const db = require("../config/db");

async function checkMatches() {
  const res = await db.query(`
    SELECT m.id, m.candidate_id, u.username, u.email,
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
    FROM candidate_job_matches m
    JOIN users u ON m.candidate_id = u.id
    LEFT JOIN profiles p ON u.id = p.user_id
    ORDER BY m.id ASC
  `);

  console.log(`Total matches in DB: ${res.rows.length}`);
  const valid = res.rows.filter((r) => r.has_stored_data);
  const invalid = res.rows.filter((r) => !r.has_stored_data);
  console.log(`Matches with REAL stored candidate data: ${valid.length}`);
  console.log(`Matches with empty profiles: ${invalid.length}`);
  if (invalid.length > 0) {
    console.log("Empty profile matches:", invalid.map((r) => `Match ${r.id}: user ${r.candidate_id} (${r.username})`));
  }

  process.exit(0);
}

checkMatches().catch((err) => {
  console.error(err);
  process.exit(1);
});
