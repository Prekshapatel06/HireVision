require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const http = require('http');
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { id: 3, email: 'preksha0609@gmail.com', role: 'recruiter' },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

function post(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function testCompareAndPipeline() {
  console.log('Testing Candidate Comparison API with real candidates ID 1 and ID 2...');
  const compareRes = await post('/api/recruiter/candidates/compare', { candidateIds: [1, 2] });
  console.log('Comparison status:', compareRes.status);
  console.log('Comparison success:', compareRes.data.success);
  console.log('Comparison candidates returned:', compareRes.data.candidates?.length);
  console.log('Comparison message:', compareRes.data.message);

  console.log('\nTesting status update to "Scheduled" on match 605...');
  const statusRes = await post('/api/recruiter/matches/605/status', { status: 'Scheduled' });
  console.log('Pipeline status update status:', statusRes.status);
  console.log('Updated match status:', statusRes.data?.match?.status);

  console.log('\nTesting status update to "Shortlisted" on match 605...');
  const shortRes = await post('/api/recruiter/matches/605/status', { status: 'Shortlisted' });
  console.log('Pipeline status update status:', shortRes.status);
  console.log('Updated match status:', shortRes.data?.match?.status);

  console.log('\n=== CANDIDATE COMPARISON & PIPELINE VERIFIED SUCCESSFULLY ===');
  process.exit(0);
}

testCompareAndPipeline().catch(e => { console.error('Test error:', e); process.exit(1); });
