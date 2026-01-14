const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

const pastes = new Map(); // In-memory storage (use Redis in production)

// Generate short unique ID
function generateId() {
  return crypto.randomBytes(4).toString('hex');
}

// Create new paste
app.post('/api/paste', (req, res) => {
  try {
    const { content, language = 'plaintext', title = '' } = req.body;
    
    if (!content || content.length > 50000) {
      return res.status(400).json({ error: 'Content too large or missing' });
    }

    const id = generateId();
    const paste = {
      id,
      content,
      language,
      title: title.slice(0, 100),
      createdAt: new Date().toISOString(),
      views: 0
    };

    pastes.set(id, paste);
    res.json({ id, url: `/${id}` });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get paste
app.get('/api/paste/:id', (req, res) => {
  try {
    const paste = pastes.get(req.params.id);
    if (!paste) {
      return res.status(404).json({ error: 'Paste not found' });
    }

    // Increment views
    paste.views = (paste.views || 0) + 1;
    pastes.set(req.params.id, paste);

    res.json(paste);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Raw paste content
app.get('/api/raw/:id', (req, res) => {
  try {
    const paste = pastes.get(req.params.id);
    if (!paste) {
      return res.status(404).send('Paste not found');
    }
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(paste.content);
  } catch (error) {
    res.status(500).send('Server error');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
