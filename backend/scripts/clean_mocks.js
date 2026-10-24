const db = require('../config/db');

async function cleanMocks() {
  try {
    const res1 = await db.query(`
      DELETE FROM candidate_job_matches 
      WHERE explanation LIKE '%Strong React experience%' 
         OR explanation LIKE '%Competent frontend developer%'
    `);
    const res2 = await db.query(`
      DELETE FROM jobs 
      WHERE description LIKE 'Join our dynamic team%' 
         OR description LIKE 'Looking for a Senior React Developer%' 
         OR description LIKE 'Help automate and deploy%'
    `);
    console.log(`Cleaned ${res1.rowCount} fake matches and ${res2.rowCount} fake jobs.`);
    process.exit(0);
  } catch (err) {
    console.error('Error cleaning mocks:', err);
    process.exit(1);
  }
}

setTimeout(cleanMocks, 1500);
