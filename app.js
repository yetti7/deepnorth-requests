const express = require('express');
const Database = require('better-sqlite3'); // ✅ Use better-sqlite3
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3001;

// ✅ Enable CORS to allow requests from deepnorth-js (localhost:3000)
app.use(
  cors({
    origin: 'http://localhost:3000', // Allow frontend
    methods: 'GET, POST, PUT, DELETE',
    allowedHeaders: 'Content-Type, Authorization',
  })
);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Initialize SQLite database
const db = new Database('./requests.db');

// ✅ API: Submit a new request
app.post('/api/requests', (req, res) => {
  const { name, media, title, author, mediaLink } = req.body;

  if (!name || !media || !title || !mediaLink) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    const stmt = db.prepare(
      `INSERT INTO requests (name, media, title, author, mediaLink, created_at) 
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const info = stmt.run(name, media, title, author || null, mediaLink, new Date().toISOString());

    res.json({
      id: info.lastInsertRowid,
      name,
      media,
      title,
      author,
      mediaLink,
      created_at: new Date(),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add request.' });
  }
});

// ✅ API: Get all open requests
app.get('/api/requests', (req, res) => {
  try {
    const rows = db.prepare(`SELECT * FROM requests ORDER BY created_at DESC`).all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve requests.' });
  }
});

// ✅ API: Get all closed requests
app.get('/api/closed-requests', (req, res) => {
  try {
    const rows = db.prepare(`SELECT * FROM closed_requests ORDER BY closed_at DESC`).all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve closed requests.' });
  }
});

// ✅ API: Move a request to closed_requests
app.delete('/api/requests/:id', (req, res) => {
  const requestId = req.params.id;

  try {
    const row = db.prepare(`SELECT * FROM requests WHERE id = ?`).get(requestId);
    if (!row) return res.status(404).json({ error: 'Request not found.' });

    const insertStmt = db.prepare(
      `INSERT INTO closed_requests (name, media, title, author, mediaLink, closed_at) 
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    insertStmt.run(row.name, row.media, row.title, row.author, row.mediaLink, new Date().toISOString());

    db.prepare(`DELETE FROM requests WHERE id = ?`).run(requestId);
    res.json({ message: 'Request moved to closed successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to move request to closed.' });
  }
});

// ✅ API: Reopen a closed request
app.post('/api/reopen-request/:id', (req, res) => {
  const requestId = req.params.id;

  try {
    const row = db.prepare(`SELECT * FROM closed_requests WHERE id = ?`).get(requestId);
    if (!row) return res.status(404).json({ error: 'Closed request not found.' });

    const insertStmt = db.prepare(
      `INSERT INTO requests (name, media, title, author, mediaLink, created_at) 
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    insertStmt.run(row.name, row.media, row.title, row.author, row.mediaLink, new Date().toISOString());

    db.prepare(`DELETE FROM closed_requests WHERE id = ?`).run(requestId);
    res.json({ message: 'Request reopened successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reopen request.' });
  }
});

// ✅ API: Delete a closed request
app.delete('/api/closed-requests/:id', (req, res) => {
  const requestId = req.params.id;

  try {
    db.prepare(`DELETE FROM closed_requests WHERE id = ?`).run(requestId);
    res.json({ message: 'Closed request deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete closed request.' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
