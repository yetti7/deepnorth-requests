const express = require('express');
const Database = require('better-sqlite3'); // ✅ Use better-sqlite3
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// ✅ Enable CORS to allow requests from deepnorth-js (localhost:3000)
app.use(
  cors({
    origin: ['http://localhost:3000', 'https://deepnorth.app', 'https://api.deepnorth.app'], // Allow localhost & Cloudflare domains
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
    const rows = db.prepare(`SELECT id, name, media, title, author, mediaLink, created_at, status FROM requests ORDER BY created_at DESC`).all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve requests.' });
  }
});

// ✅ API: Get all closed requests
app.get('/api/closed-requests', (req, res) => {
  try {
    const rows = db.prepare(`SELECT id, name, media, title, author, mediaLink, closed_at, status FROM closed_requests ORDER BY closed_at DESC`).all();
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
  const newStatus = req.body.status || "Pending"; // ✅ Preserve UI-selected status

  try {
    const row = db.prepare(`SELECT * FROM closed_requests WHERE id = ?`).get(requestId);
    if (!row) return res.status(404).json({ error: 'Closed request not found.' });

    console.log(`🔥 Moving request ID ${requestId} to open with status: ${newStatus}`);

    const insertStmt = db.prepare(
      `INSERT INTO requests (id, name, media, title, author, mediaLink, created_at, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    insertStmt.run(row.id, row.name, row.media, row.title, row.author, row.mediaLink, new Date().toISOString(), newStatus);

    db.prepare(`DELETE FROM closed_requests WHERE id = ?`).run(requestId);

    console.log(`✅ Request moved to open with status: ${newStatus}`);
    res.json({ message: `Request reopened with status: ${newStatus}` });
  } catch (err) {
    console.error(`❌ Error reopening request:`, err);
    res.status(500).json({ error: 'Failed to reopen request.' });
  }
});

// ✅ API: Move a request to closed_requests with the correct status
app.post('/api/move-to-closed', (req, res) => {
  const { id, status } = req.body;

  if (!id || !status) {
    return res.status(400).json({ error: "Missing request ID or status." });
  }

  try {
    const row = db.prepare(`SELECT * FROM requests WHERE id = ?`).get(id);
    if (!row) return res.status(404).json({ error: "Request not found." });

    console.log(`🔥 Moving request ID ${id} to closed_requests with status: ${status}`); // Debug log

    const insertStmt = db.prepare(
      `INSERT INTO closed_requests (id, name, media, title, author, mediaLink, closed_at, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    insertStmt.run(row.id, row.name, row.media, row.title, row.author, row.mediaLink, new Date().toISOString(), status);

    db.prepare(`DELETE FROM requests WHERE id = ?`).run(id);
    
    console.log(`✅ Request moved to closed with status: ${status}`);
    res.json({ message: `Request moved to closed with status: ${status}.` });
  } catch (err) {
    console.error(`❌ Error moving request to closed:`, err);
    res.status(500).json({ error: "Failed to move request to closed." });
  }
});

// ✅ API: Update request status (Without moving or deleting)
app.post('/api/update-status', (req, res) => {
  const { id, status } = req.body;

  if (!id || !status) return res.status(400).json({ error: "Missing request ID or status." });

  try {
    db.prepare(`UPDATE requests SET status = ? WHERE id = ?`).run(status, id);
    res.json({ message: "Request status updated successfully." });
  } catch (err) {
    res.status(500).json({ error: "Failed to update request status." });
  }
});

// ✅ API: Update status in the closed_requests table (No restrictions on status changes)
app.post('/api/update-closed-status', (req, res) => {
  const { id, status } = req.body;

  if (!id || !status) {
    return res.status(400).json({ error: "Missing request ID or status." });
  }

  try {
    const stmt = db.prepare(`UPDATE closed_requests SET status = ? WHERE id = ?`);
    stmt.run(status, id);

    res.json({ message: "Closed request status updated successfully." });
  } catch (err) {
    res.status(500).json({ error: "Failed to update closed request status." });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
