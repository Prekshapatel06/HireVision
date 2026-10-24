const jwt = require('jsonwebtoken');

async function testChatbots() {
  const candidateToken = jwt.sign(
    { id: 2, email: 'preksha@gmail.com', role: 'candidate' },
    'hirevision_secret_jwt_key_2026_super_secure',
    { expiresIn: '1h' }
  );

  // Find or create recruiter token for testing
  const recruiterToken = jwt.sign(
    { id: 1, email: 'recruiter@hirevision.com', role: 'recruiter' },
    'hirevision_secret_jwt_key_2026_super_secure',
    { expiresIn: '1h' }
  );

  const candidateQuestions = [
    "Hello",
    "What are my skills?",
    "What is my readiness score?",
    "What is the difference between React and Angular?",
    "Explain closures in JavaScript with an example",
    "How can I improve my resume for a Full Stack Developer role?"
  ];

  console.log('=== TESTING CANDIDATE CHATBOT ===\n');
  for (const q of candidateQuestions) {
    console.log(`Candidate Question: "${q}"`);
    try {
      const res = await fetch('http://localhost:5000/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${candidateToken}`
        },
        body: JSON.stringify({ message: q })
      });
      const data = await res.json();
      console.log(`Status: ${res.status}`);
      const reply = data.reply || data.response || data.message;
      console.log(`Reply preview (first 150 chars): ${reply ? reply.slice(0, 150).replace(/\n/g, ' ') : 'NO REPLY'}...\n`);
    } catch (err) {
      console.error('Candidate chat error:', err.message);
    }
  }

  const recruiterQuestions = [
    "Hello",
    "What is HireVision AI?",
    "Show active jobs",
    "Find candidates with React",
    "How do I shortlist candidates effectively?"
  ];

  console.log('\n=== TESTING RECRUITER CHATBOT ===\n');
  for (const q of recruiterQuestions) {
    console.log(`Recruiter Question: "${q}"`);
    try {
      const res = await fetch('http://localhost:5000/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${recruiterToken}`
        },
        body: JSON.stringify({ message: q })
      });
      const data = await res.json();
      console.log(`Status: ${res.status}`);
      const reply = data.reply || data.response || data.message;
      console.log(`Reply preview (first 150 chars): ${reply ? reply.slice(0, 150).replace(/\n/g, ' ') : 'NO REPLY'}...\n`);
    } catch (err) {
      console.error('Recruiter chat error:', err.message);
    }
  }
}

testChatbots().catch(console.error);
