/*
 * app.js
 * Frontend application logic for Assistive Sketching Canvas
 * - Handles drawing operations (canvas stack, tools, undo/redo)
 * - Manages UI panels and user interactions
 * - Integrates with AI generation API via proxy
 * - Coordinates Firebase initialization (see firebase-init.js)
 */

        // Initialize Lucide icons
        lucide.createIcons();

        // --- Global Constants & State ---
        // (legacy constants; canvas sizing now computed dynamically)
        // const DEFAULT_WIDTH = 1024;
        // const DEFAULT_HEIGHT = 768;
        
    // *************************************************************************
    // Preferred: run the API call server-side via a small proxy so your API key
    // stays secret. For local dev, set the proxy URL below and leave apiKey
    // empty in the client. The proxy will attach the real key server-side.
    // *************************************************************************
    const apiKey = ""; // keep empty when using the local proxy
    const proxyUrl = 'http://localhost:3000/api/generate'; // local proxy endpoint
        
        // Base API URL for Google's Generative Language Service
        const baseApiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent';
        
    // CORS proxy (legacy option). When using the server proxy above you don't
    // need this. Kept here for reference.
    // const corsProxyUrl = 'https://corsproxy.io/?'; 

        let currentTool = 'pen';
        let isDrawing = false;
        let lastX = 0;
        let lastY = 0;

        // --- UI Panel Management ---
        const rightSidebar = document.getElementById('right-sidebar');
        const layersContent = document.getElementById('layers-content');
        const aiContent = document.getElementById('ai-content');
        const sidebarTitle = document.getElementById('sidebar-title');
        const layersToggle = document.getElementById('layers-panel-toggle');
        const aiToggle = document.getElementById('ai-panel-toggle');

        let isSidebarOpen = false;
        let activePanel = 'layers'; 

        function openSidebar(panelName) {
            activePanel = panelName;
            isSidebarOpen = true;
            rightSidebar.style.transform = 'translateX(0)';
            layersToggle.classList.remove('active');
            aiToggle.classList.remove('active');

            if (panelName === 'layers') {
                sidebarTitle.textContent = 'Layers Panel';
                layersContent.classList.remove('hidden');
                aiContent.classList.add('hidden');
                layersToggle.classList.add('active');
            } else if (panelName === 'ai') {
                sidebarTitle.textContent = 'AI Generation';
                layersContent.classList.add('hidden');
                aiContent.classList.remove('hidden');
                aiToggle.classList.add('active');
            }
        }

        function toggleSidebar(panelName) {
            if (isSidebarOpen && activePanel === panelName) {
                rightSidebar.style.transform = 'translateX(100%)';
                isSidebarOpen = false;
                layersToggle.classList.remove('active');
                aiToggle.classList.remove('active');
            } else {
                openSidebar(panelName);
            }
        }

        layersToggle.addEventListener('click', () => toggleSidebar('layers'));
        aiToggle.addEventListener('click', () => toggleSidebar('ai'));

        // --- Custom Alert Modal ---
        function alertUser(title, message) {
            const modal = document.getElementById('custom-alert-modal');
            if (modal) {
                document.getElementById('alert-title').textContent = title;
                document.getElementById('alert-message').textContent = message;
                modal.classList.remove('hidden');
            } else {
                console.log(`MODAL: ${title} - ${message}`);
            }
        }

        // --- AI API Utility Functions ---

        // Converts Base64 dataURL to raw Base64 string for API payload
        function dataURLToRawBase64(dataURL) {
            // Checks for the standard PNG data URL prefix and removes it.
            const prefix = 'data:image/png;base64,';
            if (dataURL.startsWith(prefix)) {
                return dataURL.substring(prefix.length);
            }
            return dataURL; // Return original if prefix not found (unexpected)
        }

        // Retries fetch request with exponential backoff
        async function fetchWithRetry(url, options, retries = 3) {
            for (let i = 0; i < retries; i++) {
                try {
                    const response = await fetch(url, options);
                    if (!response.ok) {
                        // Check if the error is a 400 series error (e.g., bad key, bad request)
                        if (response.status >= 400 && response.status < 500) {
                            const errorBody = await response.json();
                            console.error(`API Error Response (Attempt ${i + 1}):`, errorBody);
                            
                            let errorMessage = errorBody.error?.message || 'Unknown API error.';
                            
                            // Specific check for key errors
                            if (errorMessage.includes('API key not valid')) {
                                throw new Error(`Authentication Error: The provided API key is invalid or missing.`);
                            }
                            
                            // Throw immediately for client-side errors that retries won't fix
                            throw new Error(`Client Error: ${response.status} - ${errorMessage}`);
                        }
                        
                        // For 500 series errors (server issues), proceed with retry
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response;
                } catch (error) {
                    console.error(`Attempt ${i + 1} failed: ${error.message}`);
                    if (i === retries - 1) throw error;
                    const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        // --- AI Generation Logic ---
        async function generateImageFromSketch(prompt, sketchDataUrl) {
            // Stronger check for API Key before proceeding. If a proxy is set up
            // (proxyUrl) we allow the client to proceed without a client-side key.
            if (!apiKey && typeof __initial_auth_token === 'undefined' && typeof proxyUrl === 'undefined') {
                alertUser("API Key Required", "You must provide your private API key in the 'apiKey' variable to run this locally or configure a proxyUrl.");
                return null;
            }
            if (!prompt) {
                alertUser("Missing Prompt", "Please enter a detailed description for the AI to generate an image.");
                return null;
            }

            // CRITICAL: Validate the sketch data. An empty canvas is often rejected with a 400.
            const rawBase64 = dataURLToRawBase64(sketchDataUrl);
            const emptyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAoAAAAKAAQMAAAA1p+9PAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAUSURBVHiczdgBBAAACAMgwQY+0FwQYpAAoAAeJgA4dE0j5wAAAABJRU5ErkJggg=='; 

            if (rawBase64.length < 500 || rawBase64 === emptyPngBase64) { 
                alertUser("Empty Sketch", "Please draw something on the canvas before generating an image from your sketch.");
                return null;
            }

            const loadingIndicator = document.getElementById('loading-indicator');
            const generateBtn = document.getElementById('generate-ai-btn');
            
            loadingIndicator.classList.remove('hidden');
            generateBtn.disabled = true;

            // When running with a local server proxy we always send the request to
            // the proxy endpoint; the proxy will attach the API key server-side.
            const finalUrl = (typeof proxyUrl !== 'undefined' && proxyUrl) ? proxyUrl : `${baseApiUrl}?key=${apiKey}`;

            // Extract raw base64 data for the image input
            const userPrompt = `Product: ${document.getElementById('product-name').value}. Description: ${prompt}`;

            // NOTE: Google Generative API expects snake_case field names in the
            // JSON payload. Using camelCase caused a 400 with "Unknown name
            // 'imageGenerationConfig' at 'generation_config'". Build the
            // payload using snake_case keys to match the API schema.
            const payload = {
                contents: [{
                    parts: [
                        { text: userPrompt },
                        {
                            inline_data: {
                                mime_type: "image/png",
                                data: rawBase64 // Use the validated and stripped raw Base64 data
                            }
                        }
                    ]
                }],
                generation_config: {
                    response_modalities: ['TEXT', 'IMAGE'],
                }
            };

            // --- DEBUGGING STEP: Print the payload before sending ---
            console.log("--- DEBUG: API Payload ---");
            // IMPORTANT: We only print the first 100 characters of the raw image data 
            // because the full string is too long to copy/paste reliably.
            const debugPayload = { ...payload };
            // Ensure deep clone for modification
            debugPayload.contents = JSON.parse(JSON.stringify(payload.contents)); 
            const inlinePart = debugPayload.contents[0].parts[1];
            if (inlinePart.inlineData) {
                inlinePart.inlineData.data = inlinePart.inlineData.data.substring(0, 100) + '...[TRUNCATED]';
            } else if (inlinePart.inline_data) {
                inlinePart.inline_data.data = inlinePart.inline_data.data.substring(0, 100) + '...[TRUNCATED]';
            }
            console.log(JSON.stringify(debugPayload, null, 2));
            console.log("----------------------------");
            // --- END DEBUGGING STEP ---
            
            try {
                const options = {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                };

                const response = await fetchWithRetry(finalUrl, options);

                const result = await response.json();

                // Be tolerant in parsing the response: accept either camelCase
                // or snake_case keys (some SDKs/clients may return either).
                const parts = result?.candidates?.[0]?.content?.parts || [];
                const partWithInline = parts.find(p => p.inlineData || p.inline_data);
                const base64Data = partWithInline?.inlineData?.data || partWithInline?.inline_data?.data;

                if (base64Data) {
                    return `data:image/png;base64,${base64Data}`;
                } else {
                    console.error("AI Generation failed:", result);
                    alertUser("AI Error", result.error?.message || "Image generation failed. Please try a different prompt.");
                    return null;
                }
            } catch (error) {
                console.error("Final AI Error:", error);
                
                let userMessage = "Could not connect to the AI model. This is likely a CORS issue, which the proxy should fix. If this persists, please ensure your API key is correct.";

                if (error.message.includes("Authentication Error")) {
                    userMessage = "Authentication Failed: Your provided API key is invalid or missing. Please double-check the key in the code.";
                } else if (error.message.includes("Client Error: 400")) {
                    userMessage = "Bad Request (400): The prompt or image data format was likely rejected by the server. Try drawing a clear, simple sketch and using a very specific prompt.";
                }
                
                alertUser("Connection Error", userMessage);
                return null;
            } finally {
                loadingIndicator.classList.add('hidden');
                generateBtn.disabled = false;
            }
        }


        // --- Main Application Setup ---
        window.onload = () => {
            // Get all canvas elements
            const canvasStack = document.getElementById('canvas-stack');
            const backgroundCanvas = document.getElementById('background-canvas');
            const aiCanvas = document.getElementById('ai-canvas');
            const mainCanvas = document.getElementById('main-canvas'); // Sketch canvas

            const ctx = mainCanvas.getContext('2d');
            const aiCtx = aiCanvas.getContext('2d');
            const bgCtx = backgroundCanvas.getContext('2d');
            
            // High-DPI aware canvas sizing: size canvases to the displayed
            // CSS size of the canvas stack and scale contexts by devicePixelRatio
            const DPR = window.devicePixelRatio || 1;
            function resizeCanvases() {
                const rect = canvasStack.getBoundingClientRect();
                const cssW = Math.max(32, Math.floor(rect.width));
                const cssH = Math.max(32, Math.floor(rect.height));
                [backgroundCanvas, aiCanvas, mainCanvas].forEach((canvas) => {
                    // Set display size (CSS pixels)
                    canvas.style.width = cssW + 'px';
                    canvas.style.height = cssH + 'px';
                    // Set actual drawing buffer size (device pixels)
                    canvas.width = Math.round(cssW * DPR);
                    canvas.height = Math.round(cssH * DPR);
                    const c = canvas.getContext('2d');
                    // Reset transform and scale so drawing ops use CSS pixels
                    c.setTransform(DPR, 0, 0, DPR, 0, 0);
                });
            }
            // Initial sizing and on window resize
            resizeCanvases();
            window.addEventListener('resize', () => {
                resizeCanvases();
            });
            
            // --- Drawing history for undo/redo ---
            const undoStack = [];
            const redoStack = [];
            const MAX_HISTORY = 50;

            function pushState() {
                try {
                    if (undoStack.length >= MAX_HISTORY) undoStack.shift();
                    undoStack.push(mainCanvas.toDataURL());
                    // clear redo on new action
                    redoStack.length = 0;
                } catch (e) {
                    console.warn('pushState error', e);
                }
            }

            function restoreState(dataUrl) {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        const rect = canvasStack.getBoundingClientRect();
                        const cssW = Math.floor(rect.width);
                        const cssH = Math.floor(rect.height);
                        ctx.clearRect(0, 0, cssW, cssH);
                        ctx.drawImage(img, 0, 0, cssW, cssH);
                        resolve();
                    };
                    img.src = dataUrl;
                });
            }

            // Wire undo/redo UI
            document.getElementById('undo-btn').addEventListener('click', async () => {
                if (undoStack.length === 0) return;
                redoStack.push(mainCanvas.toDataURL());
                const last = undoStack.pop();
                await restoreState(last);
            });
            document.getElementById('redo-btn').addEventListener('click', async () => {
                if (redoStack.length === 0) return;
                undoStack.push(mainCanvas.toDataURL());
                const next = redoStack.pop();
                await restoreState(next);
            });

            // Fill the background canvas with white (use the actual CSS size)
            bgCtx.fillStyle = '#ffffff';
            {
                const rect = canvasStack.getBoundingClientRect();
                const cssW = Math.floor(rect.width);
                const cssH = Math.floor(rect.height);
                bgCtx.clearRect(0, 0, cssW, cssH);
                bgCtx.fillRect(0, 0, cssW, cssH);
            }

            // AI Opacity Slider
            const aiOpacitySlider = document.getElementById('ai-opacity-slider');
            const aiOpacityValue = document.getElementById('ai-opacity-value');
            aiOpacitySlider.addEventListener('input', (e) => {
                const opacity = e.target.value;
                aiCanvas.style.opacity = opacity; // Use style.opacity for the canvas element
                aiOpacityValue.textContent = `${Math.round(opacity * 100)}%`;
            });

            // --- Top-left Color Palette Button ---
            const colorPaletteBtn = document.getElementById('color-palette-btn');
            const brushColorInput = document.getElementById('brush-color');
            if (colorPaletteBtn && brushColorInput) {
                colorPaletteBtn.addEventListener('click', () => {
                    try { brushColorInput.click(); } catch (e) { brushColorInput.focus(); }
                });
            }

            // --- Custom canvas cursor indicator ---
            const cursorEl = document.getElementById('canvas-cursor');
            function showCursor(visible) {
                if (!cursorEl) return;
                cursorEl.style.display = visible ? 'block' : 'none';
                mainCanvas.style.cursor = visible ? 'none' : '';
            }

            // Update cursor position and size on mouse move
            mainCanvas.addEventListener('mouseenter', () => showCursor(true));
            mainCanvas.addEventListener('mouseleave', () => showCursor(false));
            mainCanvas.addEventListener('mousemove', (e) => {
                if (!cursorEl) return;
                const rect = mainCanvas.getBoundingClientRect();
                const left = e.clientX - rect.left;
                const top = e.clientY - rect.top;
                // Brush size in CSS pixels (slider already represents pixels)
                const brushSize = parseFloat(document.getElementById('brush-size').value) || 10;
                const displaySize = Math.max(8, brushSize);
                cursorEl.style.width = `${displaySize}px`;
                cursorEl.style.height = `${displaySize}px`;
                cursorEl.style.left = `${left}px`;
                cursorEl.style.top = `${top}px`;
                // Change color for eraser tool
                if (currentTool === 'eraser') {
                    cursorEl.style.borderColor = 'rgba(239,68,68,0.95)';
                    cursorEl.style.background = 'rgba(255,255,255,0.02)';
                } else {
                    cursorEl.style.borderColor = 'rgba(99,102,241,0.95)';
                    cursorEl.style.background = 'rgba(255,255,255,0.02)';
                }
            });

            // --- Original Drawing Logic ---
            // Helper: map mouse event to canvas internal pixel coordinates.
            // This handles cases where the canvas CSS size differs from its
            // internal width/height (common when the canvas is responsive or
            // when devicePixelRatio scaling is applied).
            function getCanvasCoords(event, canvas) {
                // Return coordinates in CSS pixels (not device pixels). The
                // contexts are scaled by DPR so drawing commands should use
                // CSS pixel coordinates.
                const rect = canvas.getBoundingClientRect();
                const clientX = event.clientX;
                const clientY = event.clientY;
                const x = clientX - rect.left;
                const y = clientY - rect.top;
                return { x, y };
            }

            function draw(e) {
                if (!isDrawing) return;

                const color = document.getElementById('brush-color').value;
                const size = document.getElementById('brush-size').value;
                const opacity = document.getElementById('brush-opacity').value;

                // Compute scaled coordinates for accurate placement
                const pos = getCanvasCoords(e, mainCanvas);

                // Prepare drawing state
                ctx.beginPath();
                if (currentTool === 'pen') {
                    ctx.strokeStyle = color;
                    ctx.lineWidth = size;
                    ctx.lineCap = 'round';
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.globalAlpha = parseFloat(opacity);
                } else if (currentTool === 'eraser') {
                    ctx.globalCompositeOperation = 'destination-out';
                    ctx.lineWidth = size;
                    ctx.lineCap = 'round';
                    ctx.globalAlpha = 1;
                }

                ctx.moveTo(lastX, lastY);
                ctx.lineTo(pos.x, pos.y);
                ctx.stroke();
                [lastX, lastY] = [pos.x, pos.y];
            }

            mainCanvas.addEventListener('mousedown', (e) => {
                // Save a snapshot for undo before starting a new stroke
                pushState();
                isDrawing = true;
                const pos = getCanvasCoords(e, mainCanvas);
                [lastX, lastY] = [pos.x, pos.y];
            });
            mainCanvas.addEventListener('mousemove', draw);
            mainCanvas.addEventListener('mouseup', () => isDrawing = false);
            mainCanvas.addEventListener('mouseout', () => isDrawing = false);


            // --- Tool Selection Logic ---
            document.getElementById('tool-pen').addEventListener('click', () => {
                currentTool = 'pen';
                document.getElementById('tool-pen').classList.add('active');
                document.getElementById('tool-eraser').classList.remove('active');
            });
            document.getElementById('tool-eraser').addEventListener('click', () => {
                currentTool = 'eraser';
                document.getElementById('tool-pen').classList.remove('active');
                document.getElementById('tool-eraser').classList.add('active');
            });
            
            // Brush value display updates
            document.getElementById('brush-size').addEventListener('input', (e) => {
                document.getElementById('brush-size-value').textContent = e.target.value;
            });
            document.getElementById('brush-opacity').addEventListener('input', (e) => {
                document.getElementById('brush-opacity-value').textContent = `${Math.round(e.target.value * 100)}%`;
            });

            // Export user's sketch (only the sketch layer)
            document.getElementById('export-btn').addEventListener('click', () => {
                try {
                    const dataUrl = mainCanvas.toDataURL('image/png');
                    const link = document.createElement('a');
                    link.href = dataUrl;
                    const filename = (document.getElementById('product-name').value || 'sketch').replace(/\s+/g, '_');
                    link.download = `${filename}.png`;
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                } catch (err) {
                    console.error('Export failed', err);
                    alertUser('Export Error', 'Could not export the sketch.');
                }
            });


            // --- AI Generation Button Handler ---
            document.getElementById('generate-ai-btn').addEventListener('click', async () => {
                const prompt = document.getElementById('ai-prompt').value;
                // Get the sketch data (transparent PNG)
                const sketchDataUrl = mainCanvas.toDataURL('image/png'); 
                
                const resultDataUrl = await generateImageFromSketch(prompt, sketchDataUrl);

                if (resultDataUrl) {
                    // We have a result! Load it into the ai-canvas
                    const img = new Image();
                    img.onload = () => {
                        // Clear any previous AI image using CSS pixels
                        const rect = canvasStack.getBoundingClientRect();
                        const cssW = Math.floor(rect.width);
                        const cssH = Math.floor(rect.height);
                        aiCtx.clearRect(0, 0, cssW, cssH);
                        // Draw the new image scaled to canvas CSS size
                        aiCtx.drawImage(img, 0, 0, cssW, cssH);
                        alertUser("Success!", "AI image generated and placed on the layer below your sketch.");
                    };
                    img.src = resultDataUrl;
                }
            });


            // 2. Initial UI state
            openSidebar('layers');
            document.getElementById('alert-close-btn').onclick = () => {
                 document.getElementById('custom-alert-modal').classList.add('hidden');
            }
        };

    