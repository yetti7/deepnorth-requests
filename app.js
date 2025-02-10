const express = require('express');
const sqlite3 = require('sqlite3').verbose();
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

// Initialize SQLite database
const db = new sqlite3.Database('./requests.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// ✅ API: Submit a new request
app.post('/api/requests', (req, res) => {
  const { name, media, title, author, mediaLink, image } = req.body;

  if (!name || !media || !title || !mediaLink) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  db.run(
    `INSERT INTO requests (name, media, title, author, mediaLink, image, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name, media, title, author || null, mediaLink, image || null, new Date().toISOString()],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to add request.' });
      }
      res.json({
        id: this.lastID,
        name,
        media,
        title,
        author,
        mediaLink,
        image,
        created_at: new Date(),
      });
    }
  );
});

// ✅ API: Get all open requests
app.get('/api/requests', (req, res) => {
  db.all(`SELECT * FROM requests ORDER BY created_at DESC`, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to retrieve requests.' });
    }
    res.json(rows);
  });
});

// ✅ API: Get all closed requests
app.get('/api/closed-requests', (req, res) => {
  db.all(`SELECT * FROM closed_requests ORDER BY closed_at DESC`, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to retrieve closed requests.' });
    }
    res.json(rows);
  });
});

// ✅ API: Move a request to closed_requests
app.delete('/api/requests/:id', (req, res) => {
  const requestId = req.params.id;

  // First, retrieve the request details
  db.get(`SELECT * FROM requests WHERE id = ?`, [requestId], (err, row) => {
    if (err) {
      console.error("Error finding request:", err);
      return res.status(500).json({ error: "Failed to find request." });
    }
    if (!row) {
      return res.status(404).json({ error: "Request not found." });
    }

    // Insert the request into closed_requests
    db.run(
      `INSERT INTO closed_requests (name, media, title, author, mediaLink, image, closed_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [row.name, row.media, row.title, row.author, row.mediaLink, row.image, new Date().toISOString()],
      function (insertErr) {
        if (insertErr) {
          console.error("Error moving request to closed:", insertErr);
          return res.status(500).json({ error: "Failed to move request to closed." });
        }

        // Delete from open requests only if insertion was successful
        db.run(`DELETE FROM requests WHERE id = ?`, [requestId], function (deleteErr) {
          if (deleteErr) {
            console.error("Error deleting request:", deleteErr);
            return res.status(500).json({ error: "Failed to delete request from open requests." });
          }

          res.json({ message: "Request moved to closed successfully." });
        });
      }
    );
  });
});

// ✅ API: Reopen a closed request
app.post('/api/reopen-request/:id', (req, res) => {
  const requestId = req.params.id;

  // First, retrieve the request details
  db.get(`SELECT * FROM closed_requests WHERE id = ?`, [requestId], (err, row) => {
    if (err) {
      console.error("Error finding closed request:", err);
      return res.status(500).json({ error: "Failed to find closed request." });
    }
    if (!row) {
      return res.status(404).json({ error: "Closed request not found." });
    }

    // Insert back into open requests
    db.run(
      `INSERT INTO requests (name, media, title, author, mediaLink, image, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [row.name, row.media, row.title, row.author, row.mediaLink, row.image, new Date().toISOString()],
      function (insertErr) {
        if (insertErr) {
          console.error("Error reopening request:", insertErr);
          return res.status(500).json({ error: "Failed to reopen request." });
        }

        // Delete from closed requests only if insertion was successful
        db.run(`DELETE FROM closed_requests WHERE id = ?`, [requestId], function (deleteErr) {
          if (deleteErr) {
            console.error("Error deleting from closed requests:", deleteErr);
            return res.status(500).json({ error: "Failed to remove from closed requests." });
          }

          res.json({ message: "Request reopened successfully." });
        });
      }
    );
  });
});

// ✅ API: Delete a closed request
app.delete('/api/closed-requests/:id', (req, res) => {
  const requestId = req.params.id;
  db.run(`DELETE FROM closed_requests WHERE id = ?`, [requestId], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete closed request.' });
    }
    res.json({ message: 'Closed request deleted successfully.' });
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});