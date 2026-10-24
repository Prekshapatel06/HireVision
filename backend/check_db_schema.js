const db = require('./config/db');

setTimeout(async () => {
  try {
    const tables = ['users', 'candidate_profiles', 'resumes', 'educations'];
    for (const table of tables) {
      console.log(`\nColumns in table "${table}":`);
      const res = await db.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = $1
      `, [table]);
      console.log(res.rows);
    }
    process.exit(0);
  } catch (err) {
    console.error("Error running query:", err);
    process.exit(1);
  }
}, 2000);
