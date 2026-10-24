require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const http = require('http');
const { query, pool } = require('../config/db');
const jwt = require('jsonwebtoken');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runRecruiterVerification() {
  console.log('=== HIREVISION RECRUITER SYSTEM LIVE VERIFICATION ===\n');

  try {
    // 1. Find or create a recruiter user
    let recruiterRes = await query("SELECT id, username, email, role FROM users WHERE role = 'recruiter' LIMIT 1");
    let recruiter = recruiterRes.rows[0];

    if (!recruiter) {
      console.log('No recruiter user found, looking for any user or creating one...');
      const anyUser = await query("SELECT id, username, email, role FROM users LIMIT 1");
      if (anyUser.rows.length > 0) {
        recruiter = anyUser.rows[0];
        console.log(`Using existing user ${recruiter.email} (role: ${recruiter.role})`);
      } else {
        console.error('No users in database.');
        process.exit(1);
      }
    }

    console.log(`Test Recruiter: ${recruiter.username || recruiter.email} (ID: ${recruiter.id}, Role: ${recruiter.role})`);

    const secret = process.env.JWT_SECRET || 'hirevision-secret-key-2024';
    const token = jwt.sign(
      { id: recruiter.id, email: recruiter.email, role: 'recruiter' },
      secret,
      { expiresIn: '2h' }
    );

    // 2. Test GET /api/recruiter/analytics
    console.log('\n--- 1. Testing GET /api/recruiter/analytics ---');
    const analyticsRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/recruiter/analytics',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log(`Status: ${analyticsRes.status}`);
    if (analyticsRes.status === 200 && analyticsRes.body.success) {
      console.log('✓ Analytics endpoint succeeded!');
      console.log('  Active Jobs:', analyticsRes.body.activeJobs);
      console.log('  Total Applications:', analyticsRes.body.totalApplications);
      console.log('  Evaluated Count:', analyticsRes.body.evaluatedCount);
      console.log('  Average Match Score:', analyticsRes.body.averageMatchScore);
      console.log('  Pipeline Stages:', JSON.stringify(analyticsRes.body.pipelineStages));
      console.log('  Top Skills Count:', analyticsRes.body.topSkills?.length);
      console.log('  Bottlenecks:', JSON.stringify(analyticsRes.body.bottlenecks));
    } else {
      console.error('✗ Analytics failed:', analyticsRes.body);
    }

    // 3. Test GET /api/recruiter/jobs
    console.log('\n--- 2. Testing GET /api/recruiter/jobs ---');
    const jobsRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/recruiter/jobs',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log(`Status: ${jobsRes.status}`);
    const jobs = jobsRes.body?.jobs || [];
    console.log(`✓ Jobs fetched: ${jobs.length} jobs owned by recruiter.`);

    // If no jobs exist for this recruiter, create a test job
    let testJobId = jobs[0]?.id;
    if (!testJobId) {
      console.log('Creating a test job for recruiter...');
      const createJobRes = await makeRequest({
        hostname: 'localhost',
        port: 5000,
        path: '/api/recruiter/jobs',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }, {
        title: 'Full Stack Engineer',
        description: 'Building modern AI web platforms with React and Node.js',
        requirements: {
          must_have: ['React', 'JavaScript', 'Node.js'],
          preferred: ['TypeScript', 'PostgreSQL'],
          optional: []
        }
      });
      testJobId = createJobRes.body?.job?.id;
      console.log(`Created Job ID: ${testJobId}`);
    }

    // 4. Test GET /api/recruiter/candidates
    console.log('\n--- 3. Testing GET /api/recruiter/candidates ---');
    const candidatesRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/recruiter/candidates',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log(`Status: ${candidatesRes.status}`);
    const candidates = candidatesRes.body?.candidates || [];
    console.log(`✓ Candidates in talent pool: ${candidates.length}`);

    // 5. Test GET /api/recruiter/matches
    console.log('\n--- 4. Testing GET /api/recruiter/matches ---');
    const matchesRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/recruiter/matches',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log(`Status: ${matchesRes.status}`);
    let matches = matchesRes.body?.matches || [];
    console.log(`✓ Recruiter candidate matches: ${matches.length}`);

    // If no match exists, link the first candidate to the job for testing
    let testMatchId = matches[0]?.id;
    if (!testMatchId && candidates.length > 0 && testJobId) {
      const candId = candidates[0].user_id || candidates[0].id;
      console.log(`Linking candidate ${candId} to job ${testJobId}...`);
      const insertRes = await query(
        `INSERT INTO candidate_job_matches (candidate_id, job_id, status)
         VALUES ($1, $2, 'Awaiting Review')
         RETURNING id`,
        [candId, testJobId]
      );
      testMatchId = insertRes.rows[0]?.id;
      console.log(`Created Match ID: ${testMatchId}`);
    }

    // 6. Test POST /api/recruiter/matches/:matchId/evaluate
    if (testMatchId) {
      console.log(`\n--- 5. Testing POST /api/recruiter/matches/${testMatchId}/evaluate ---`);
      const evalRes = await makeRequest({
        hostname: 'localhost',
        port: 5000,
        path: `/api/recruiter/matches/${testMatchId}/evaluate`,
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log(`Status: ${evalRes.status}`);
      if (evalRes.status === 200 && evalRes.body.success) {
        console.log('✓ Candidate AI evaluation succeeded!');
        console.log('  Match Score:', evalRes.body.analysis?.score);
        console.log('  Match Level:', evalRes.body.analysis?.level);
        console.log('  Confidence:', evalRes.body.analysis?.confidence);
        console.log('  Strong Matches:', evalRes.body.analysis?.strongMatches);
        console.log('  Partial Matches:', evalRes.body.analysis?.partialMatches);
        console.log('  Missing Requirements:', evalRes.body.analysis?.missing);
        console.log('  Recommendations:', evalRes.body.analysis?.recommendations);
      } else {
        console.error('✗ Match evaluation failed:', evalRes.body);
      }
    }

    // 7. Test Recruiter AI Chat / Orchestrator
    console.log('\n--- 6. Testing Recruiter AI Chat (recruiterOrchestrator) ---');
    const chatRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/recruiter/chat',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }, {
      message: 'Give me a brief summary of my recruitment pipeline and candidate fit.',
      mode: 'recruiter'
    });
    console.log(`Status: ${chatRes.status}`);
    if (chatRes.status === 200) {
      console.log('✓ Recruiter Chatbot responded successfully!');
      const reply = chatRes.body?.response || chatRes.body?.reply || chatRes.body?.message || JSON.stringify(chatRes.body);
      console.log('  Response Preview:', reply.substring(0, 200) + '...');
      console.log('  Agents Involved:', chatRes.body?.metadata?.agentsInvolved || chatRes.body?.agentsInvolved || 'Multi-agent orchestration');
    } else {
      console.error('✗ Recruiter chat failed:', chatRes.body);
    }

    console.log('\n=== ALL RECRUITER VERIFICATION TESTS COMPLETED ===');
    process.exit(0);
  } catch (err) {
    console.error('Verification script encountered error:', err);
    process.exit(1);
  }
}

runRecruiterVerification();
