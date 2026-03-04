/*
 * firebase-init.js
 * Responsible for initializing Firebase services (App, Firestore, Auth)
 * and handling anonymous/custom-token authentication. This module is
 * imported in index.html with `type="module"` before the main app logic.
 */

// Firebase initialization and authentication helper
// This module is loaded as a <script type="module"> from index.html

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Firebase/App Initialization and Auth Setup ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let db, auth, app;

// Initialize App
if (Object.keys(firebaseConfig).length > 0) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    setLogLevel('Debug'); // Enable Firestore logging

    // Handle Authentication
    async function authenticate() {
        try {
            await new Promise((resolve) => {
                onAuthStateChanged(auth, async (user) => {
                    if (!user) {
                        if (initialAuthToken) {
                            await signInWithCustomToken(auth, initialAuthToken);
                        } else {
                            await signInAnonymously(auth);
                        }
                    }
                    const userId = auth.currentUser?.uid || crypto.randomUUID();
                    document.getElementById('user-id-display').textContent = `User ID: ${userId}`;
                    resolve();
                });
            });
        } catch (error) {
            console.error("Firebase Auth Error:", error);
        }
    }
    authenticate();
} else {
    console.warn("Firebase configuration not found. Persistence disabled.");
    document.getElementById('user-id-display').textContent = `User ID: (Local)`;
}
