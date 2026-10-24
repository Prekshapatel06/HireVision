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

async function runTests() {
  console.log('=== HIREVISION LIVE API ENDPOINT VERIFICATION ===\n');

  // 1. Get a test candidate from database
  const userRes = await query('SELECT u.id, u.email, u.role, p.full_name FROM users u JOIN profiles p ON p.user_id = u.id LIMIT 1');
  if (userRes.rows.length === 0) {
    console.error('No candidate user found in database!');
    process.exit(1);
  }

  const candidate = userRes.rows[0];
  console.log(`Found Test Candidate: ${candidate.full_name} (${candidate.email}) [User ID: ${candidate.id}]`);

  // Generate JWT token
  const secret = process.env.JWT_SECRET || 'hirevision-secret-key-2024';
  const token = jwt.sign({ id: candidate.id, email: candidate.email, role: candidate.role || 'candidate' }, secret, { expiresIn: '1h' });

  // Test 1: GET /api/ai/verify-agents
  console.log('\n--- 1. Testing GET /api/ai/verify-agents ---');
  const verifyRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/ai/verify-agents',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  console.log(`Status: ${verifyRes.status}`);
  if (verifyRes.status === 200 && verifyRes.body.success) {
    console.log('✓ verify-agents succeeded!');
    console.log('Candidate:', verifyRes.body.candidate);
    console.log('Agents Verified:');
    for (const [name, data] of Object.entries(verifyRes.body.agents)) {
      console.log(`  - ${name}:`, JSON.stringify(data));
    }
  } else {
    console.error('✗ verify-agents failed:', verifyRes.body);
  }

  // Test 2: GET /api/ai/resume/suggestions
  console.log('\n--- 2. Testing GET /api/ai/resume/suggestions ---');
  const suggRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/ai/resume/suggestions',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  console.log(`Status: ${suggRes.status}`);
  if (suggRes.status === 200) {
    console.log('✓ resume/suggestions succeeded! Suggestions keys:', Object.keys(suggRes.body.suggestions || suggRes.body));
  } else {
    console.error('✗ resume/suggestions failed:', suggRes.body);
  }

  // Test 3: POST /api/ai/chat (Candidate Chat: "What is my readiness score?")
  console.log('\n--- 3. Testing POST /api/ai/chat (Query: "What is my readiness score?") ---');
  const chat1 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/ai/chat',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }, { message: 'What is my readiness score?' });
  console.log(`Status: ${chat1.status}`);
  if (chat1.status === 200) {
    const reply = chat1.body.reply || chat1.body.message || JSON.stringify(chat1.body);
    console.log('✓ Candidate Chatbot Reply:');
    console.log(reply);
  } else {
    console.error('✗ Candidate Chatbot failed:', chat1.body);
  }

  // Test 4: POST /api/ai/chat (Query: "What are my skill gaps for Full Stack Developer?")
  console.log('\n--- 4. Testing POST /api/ai/chat (Query: "What are my skill gaps for Full Stack Developer?") ---');
  const chat2 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/ai/chat',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }, { message: 'What are my skill gaps for Full Stack Developer?' });
  console.log(`Status: ${chat2.status}`);
  if (chat2.status === 200) {
    const reply = chat2.body.reply || chat2.body.message || JSON.stringify(chat2.body);
    console.log('✓ Candidate Chatbot Reply:');
    console.log(reply);
  } else {
    console.error('✗ Candidate Chatbot failed:', chat2.body);
  }

  // Test 5: POST /api/ai/chat (Recruiter Chat: "Find candidates with React")
  console.log('\n--- 5. Testing POST /api/ai/chat with Recruiter Role (Query: "Find candidates with React") ---');
  const recUser = await query("SELECT id, email, role FROM users WHERE role = 'recruiter' OR role = 'admin' LIMIT 1");
  let recToken = token;
  if (recUser.rows.length > 0) {
    recToken = jwt.sign({ id: recUser.rows[0].id, email: recUser.rows[0].email, role: 'recruiter' }, secret, { expiresIn: '1h' });
  } else {
    recToken = jwt.sign({ id: 999, email: 'recruiter@hirevision.com', role: 'recruiter' }, secret, { expiresIn: '1h' });
  }
  const chat3 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/ai/chat',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${recToken}`,
      'Content-Type': 'application/json'
    }
  }, { message: 'Find candidates with React' });
  console.log(`Status: ${chat3.status}`);
  if (chat3.status === 200) {
    const reply = chat3.body.reply || chat3.body.message || JSON.stringify(chat3.body);
    console.log('✓ Recruiter Chatbot Reply:');
    console.log(reply);
  } else {
    console.error('✗ Recruiter Chatbot failed:', chat3.body);
  }

  console.log('\n=== ALL ENDPOINT CHECKS COMPLETE ===');
  await pool.end();
  process.exit(0);
}

runTests().catch(err => {
  console.error('Error during testing:', err);
  process.exit(1);
});
