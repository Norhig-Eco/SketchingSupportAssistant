import express from 'express';
import fetch from 'node-fetch';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';

dotenv.config();

const app = express();
app.use(cors()); // dev: allow all origins; tighten in production
app.use(bodyParser.json({ limit: '100mb' }));

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  console.warn('Warning: API_KEY not set in environment. Set API_KEY in .env before using the proxy.');
}

const GENERATIVE_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// Serve frontend static files from the parent directory so the proxy and front-end
// share the same origin. This removes CORS issues when developing locally.
const staticRoot = path.resolve(process.cwd(), '..');

// Serve the main HTML explicitly at root in case the file isn't named index.html
app.get('/', (req, res) => {
  const indexPath = path.join(staticRoot, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error sending index.html:', err);
      res.status(404).send('Index file not found');
    }
  });
});

// Then serve other static assets from the project root
app.use(express.static(staticRoot));

// Health route
app.get('/health', (req, res) => res.json({ ok: true, note: 'AI proxy running' }));

// Optional: forward GET models for testing
app.get('/api/models', async (req, res) => {
  try {
  const url = `${GENERATIVE_BASE}/models?key=${API_KEY}`;
    const resp = await fetch(url);
    const text = await resp.text();
    res.status(resp.status).set('content-type', resp.headers.get('content-type') || 'application/json').send(text);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/generate -> proxies to the generateContent endpoint
app.post('/api/generate', async (req, res) => {
  try {
    if (!API_KEY) return res.status(500).json({ error: 'Server is missing API_KEY. Set it in environment.' });
    const url = `${GENERATIVE_BASE}/models/gemini-2.5-flash-image-preview:generateContent?key=${API_KEY}`;

    // Log incoming request summary for debugging
    try {
      const bodySize = req.headers['content-length'] || JSON.stringify(req.body).length;
      console.log(`[proxy] POST /api/generate - payload size: ${bodySize} bytes`);
    } catch (e) { /* ignore */ }

    const fetchResp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      // keep it simple; add timeouts as needed
    });

    const text = await fetchResp.text();
    console.log(`[proxy] Google response status: ${fetchResp.status}; length: ${text.length}`);
    // Also attempt to pretty-print JSON error if present (helpful for 400s)
    try {
      const parsed = JSON.parse(text);
      if (parsed.error) console.error('[proxy] Google error:', parsed.error);
    } catch (e) { /* not JSON */ }

    res.status(fetchResp.status).set('content-type', fetchResp.headers.get('content-type') || 'application/json').send(text);
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`AI proxy listening on http://localhost:${port} (serving static from ${staticRoot})`));
