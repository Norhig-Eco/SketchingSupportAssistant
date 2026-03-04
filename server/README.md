# AI Proxy

This is a tiny Node.js Express proxy that forwards requests to Google's Generative Language API while keeping the API key server-side.

Usage (development):

1. Copy `.env.example` to `.env` and set `API_KEY` to your Google API key.
2. Install dependencies:

```bash
cd server
npm install
```

3. Start the server:

```bash
API_KEY=your_key npm start
# or: node server.js
```

4. The proxy exposes:

- `GET /api/models` - forwards to the models list (useful for testing)
- `POST /api/generate` - forwards to the image generation endpoint. Body is proxied to the Google endpoint.

Important: this example sets CORS to allow all origins (for local development). Restrict origins before deploying.
