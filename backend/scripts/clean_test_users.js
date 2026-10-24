const db = require('../config/db');

async function cleanTestUsers() {
  try {
    const testUsers = await db.query(`
      SELECT id, username, email FROM users
      WHERE username LIKE 'alex_%'
         OR username LIKE 'cand_%'
         OR username LIKE 'dev_candidate_%'
         OR username LIKE 'test%'
         OR username LIKE 'sarah_recruiter_%'
         OR username LIKE 'rec_%'
         OR username LIKE 'talent_recruiter_%'
         OR email LIKE '%@example.com'
         OR email LIKE '%@test.com'
         OR email LIKE '%hirevision.test'
         OR email LIKE '%recruiter.com'
    `);

    console.log(`Found ${testUsers.rows.length} test users to remove:`);
    testUsers.rows.forEach(u => console.log(`  [x] ID: ${u.id}, Username: ${u.username}, Email: ${u.email}`));

    const testIds = testUsers.rows.map(u => u.id);
    if (testIds.length > 0) {
      // CASCADE will delete their profiles, candidate_job_matches, ai_chats, etc.
      const del = await db.query(`DELETE FROM users WHERE id = ANY($1::int[])`, [testIds]);
      console.log(`\nSuccessfully deleted ${del.rowCount} test accounts from PostgreSQL.`);
    }

    const remaining = await db.query(`SELECT id, username, email, role FROM users ORDER BY id ASC`);
    console.log(`\nRemaining REAL users in database (${remaining.rows.length}):`);
    remaining.rows.forEach(u => console.log(`  [✓] ID: ${u.id}, Username: ${u.username}, Email: ${u.email} (${u.role})`));

    process.exit(0);
  } catch (err) {
    console.error('Error cleaning test users:', err);
    process.exit(1);
  }
}

cleanTestUsers();
