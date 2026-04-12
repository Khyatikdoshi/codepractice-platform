const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const PROBLEMS_FILE = './data/problems.json';
const SCORES_FILE = './data/scores.json';

const readJSON = (file) => JSON.parse(fs.readFileSync(file, 'utf-8'));
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// GET all problems
app.get('/api/problems', (req, res) => {
  const problems = readJSON(PROBLEMS_FILE);
  res.json(problems.map(({ id, title, difficulty }) => ({ id, title, difficulty })));
});

// GET single problem
app.get('/api/problems/:id', (req, res) => {
  const problems = readJSON(PROBLEMS_FILE);
  const problem = problems.find(p => p.id === parseInt(req.params.id));
  if (!problem) return res.status(404).json({ error: 'Problem not found' });
  res.json(problem);
});

// POST run code (uses Judge0 public API)
app.post('/api/run', async (req, res) => {
  const { code, language } = req.body;

  const langMap = { javascript: 63, python: 71, cpp: 54, java: 62 };
  const langId = langMap[language] || 63;

  try {
    const fetch = (await import('node-fetch')).default;

    // Submit to Judge0
    const submitRes = await fetch('https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-RapidAPI-Key': process.env.JUDGE0_API_KEY || 'YOUR_RAPIDAPI_KEY',
        'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
      },
      body: JSON.stringify({ source_code: code, language_id: langId })
    });

    const result = await submitRes.json();
    res.json({
      stdout: result.stdout || '',
      stderr: result.stderr || result.compile_output || '',
      status: result.status?.description || 'Unknown'
    });
  } catch (err) {
    res.status(500).json({ error: 'Code execution failed', details: err.message });
  }
});

// POST submit solution
app.post('/api/submit', (req, res) => {
  const { username, problemId, passed, time } = req.body;
  const scores = readJSON(SCORES_FILE);

  const existing = scores.find(s => s.username === username && s.problemId === problemId);
  if (!existing) {
    scores.push({ username, problemId, passed, time, date: new Date().toISOString() });
  } else {
    existing.passed = passed;
    existing.time = time;
    existing.date = new Date().toISOString();
  }

  writeJSON(SCORES_FILE, scores);
  res.json({ success: true });
});

// GET leaderboard
app.get('/api/leaderboard', (req, res) => {
  const scores = readJSON(SCORES_FILE);
  const problems = readJSON(PROBLEMS_FILE);

  const board = {};
  scores.filter(s => s.passed).forEach(s => {
    if (!board[s.username]) board[s.username] = { username: s.username, solved: 0, problems: [] };
    if (!board[s.username].problems.includes(s.problemId)) {
      board[s.username].solved++;
      board[s.username].problems.push(s.problemId);
    }
  });

  const result = Object.values(board).sort((a, b) => b.solved - a.solved);
  res.json(result);
});

app.listen(3000, () => console.log('CodePractice running on http://localhost:3000'));