# Assistive Sketching Canvas

This repository houses a web-based multimodal AI-assisted sketching application. Users can draw on a canvas, submit prompts and sketches to a generative AI model (Google Gemini 2.5 Flash) and receive image suggestions. The application also features a layered canvas design, Firebase persistence, and an Express-based proxy server for secure API key handling.

## Project Structure

```
Thesis Drawing Project Code/
├── public/
│   ├── css/
│   │   └── style.css      # Project-wide stylesheet
│   └── js/
│       └── app.js         # Frontend application logic (drawing, AI calls)
├── server/                # Node/Express proxy for AI API
│   ├── server.js          # Proxy server entry point
│   ├── package.json
│   └── README.md          # Server-specific notes
├── index.html             # Main frontend entrypoint (renamed from Index2.html)
├── TECHNICAL_REPORT.md    # Detailed internal documentation and architecture
└── Canvas/                # (Empty placeholder; can be removed)
```

## Installation

1. **Clone the repository**
   ```bash
   git clone <repo-url> "Thesis Drawing Project Code"
   cd "Thesis Drawing Project Code"
   ```

2. **Setup backend dependencies**
   ```bash
   cd server
   npm install
   ```

3. **Configure environment variables**
   - Create a `.env` file in the `server` directory with:
     ```env
     API_KEY=your_google_api_key_here
     PORT=3000        # optional
     ```

   - For Firebase features, supply `__firebase_config` and `__initial_auth_token` globals
     via `<script>` tags or by building a small server-side templating wrapper.

## Running the Project

1. **Start the proxy server** (runs on http://localhost:3000 by default):
   ```bash
   cd server
   npm run start
   ```
   or
   ```bash
   node server.js
   ```

2. **Open the frontend**
   - Navigate to `http://localhost:3000/` in a browser. The `index.html` file is served by
     the Express static middleware.

3. **Development Notes**
   - The frontend is a single-page application; editing `public/js/app.js` and
     `public/css/style.css` will reload when the page is refreshed.
   - You can run a simple HTTP server from the root (e.g. `npx serve`) if you don't
     want to run the Node proxy and are comfortable exposing your API key
     directly (not recommended).

## Key Features

- **Multi-layer canvas stack** (background, AI, sketch) with undo/redo
- **AI generation** via prototype prompts + sketch submission
- **Dynamic UI controls** using Tailwind CSS and Lucide icons
- **Firebase integration** for user session persistence (optional)
- **Express proxy** to protect the Google API key

## Maintenance Tips

- Consolidated CSS and JavaScript into the `public/` directory; inline styles and scripts were removed from `index.html` for clarity.
- Removed obsolete `Canvas/` directory and renamed frontend entrypoint to `index.html`.


- Remove the empty `Canvas/` directory to declutter the workspace.
- Consolidate inline CSS/JS from `index.html` into the `public/` folder.
- Regularly audit and rotate any API keys; avoid hardcoding them in source files.
- Refer to `TECHNICAL_REPORT.md` for design decisions and architectural details.

---

Any substantial refactor should be accompanied by updating this README and the
technical report to keep documentation in sync.