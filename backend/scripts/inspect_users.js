const db = require("../config/db");

async function checkCandidates() {
  const res = await db.query(`
    SELECT u.id, u.username, u.email, u.role,
      p.career_objective, p.skills, p.projects, p.experience, p.education, p.certifications, p.resume_url
    FROM users u
    JOIN profiles p ON u.id = p.user_id
    WHERE u.role IN ('candidate', 'user')
    ORDER BY u.id ASC
  `);

  console.log(`Total candidate profiles in DB: ${res.rows.length}`);
  const withData = [];
  const withoutData = [];

  res.rows.forEach((r) => {
    let hasSkills = false;
    if (Array.isArray(r.skills) && r.skills.length > 0) {
      hasSkills = true;
    } else if (r.skills && typeof r.skills === "object") {
      hasSkills = Object.values(r.skills).some((v) => Array.isArray(v) && v.length > 0);
    }
    const hasProj = Array.isArray(r.projects) && r.projects.length > 0;
    const hasExp = Array.isArray(r.experience) && r.experience.length > 0;
    const hasEdu = Array.isArray(r.education) && r.education.length > 0;
    const hasCert = Array.isArray(r.certifications) && r.certifications.length > 0;
    const hasObj = Boolean(r.career_objective && r.career_objective.trim());
    const hasResume = Boolean(r.resume_url && r.resume_url.trim());

    const hasStoredData = hasSkills || hasProj || hasExp || hasEdu || hasCert || hasObj || hasResume;
    if (hasStoredData) {
      withData.push({ id: r.id, username: r.username, email: r.email, details: { hasSkills, hasProj, hasExp, hasEdu, hasCert, hasObj, hasResume } });
    } else {
      withoutData.push({ id: r.id, username: r.username, email: r.email });
    }
  });

  console.log(`\nCandidates WITH real stored data (${withData.length}):`);
  withData.forEach((c) => console.log(`  [✓] ID ${c.id}: ${c.username} (${c.email}) - ${JSON.stringify(c.details)}`));

  console.log(`\nCandidates WITHOUT stored data (empty profile rows) (${withoutData.length}):`);
  withoutData.forEach((c) => console.log(`  [✗] ID ${c.id}: ${c.username} (${c.email})`));

  process.exit(0);
}

checkCandidates().catch((err) => {
  console.error(err);
  process.exit(1);
});
