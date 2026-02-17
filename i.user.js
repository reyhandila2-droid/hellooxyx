// ==UserScript==
// @name         Canvas Dice REAL FORCE ENGINE (TOTAL FROM FIREBASE) FIX
// @namespace    https://force.dice.real.engine/
// @version      10.4-CHARLES-NO-FALLBACK
// @description  Dice total from Firebase rules/pola ONLY - NO FALLBACK VALUES
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    /* ================= CONFIG ================= */
    const DICE_COUNT = 9;
    const TOTAL_DELAY = 1500;
    const DEBUG = true;

    let TARGET_TOTAL = null;
    let rollDetected = false;
    let diceRenderCount = 0;
    let forcedDice = [];
    let diceIndex = 0;
    let seed = Date.now();
    const originalRandom = Math.random;
    let firebaseInitialized = false;
    let pendingRolls = []; // Queue rolls while waiting for Firebase

    const log = (...a) => DEBUG && console.log('[FORCE]', ...a);

    /* ================= RNG ================= */
    function seededRandom() {
        seed ^= seed << 13;
        seed ^= seed >> 17;
        seed ^= seed << 5;
        return (seed >>> 0) / 4294967296;
    }

    /* ================= SPLIT TOTAL ================= */
    function generateDice(total, count, lockedDice = []) {
        const dice = Array(count).fill(1);

        // isi angka yang sudah dikunci
        for (let i = 0; i < count; i++) {
            if (lockedDice[i]) dice[i] = lockedDice[i];
        }

        let remain = total - dice.reduce((a, b) => a + b, 0);
        
        // Validasi remain tidak negatif
        if (remain < 0) {
            log('[FORCE] ⚠️ Total terlalu kecil dari dice terkunci');
            return dice;
        }

        let attempts = 0;
        const maxAttempts = 1000; // Prevent infinite loop
        
        while (remain > 0 && attempts < maxAttempts) {
            const i = Math.floor(originalRandom() * count);
            if (!lockedDice[i] && dice[i] < 6) {
                dice[i]++;
                remain--;
            }
            attempts++;
        }

        if (remain > 0) {
            log('[FORCE] ❌ Gagal generate dice, remain:', remain);
        }

        // shuffle dice
        for (let i = dice.length - 1; i > 0; i--) {
            const j = Math.floor(seededRandom() * (i + 1));
            [dice[i], dice[j]] = [dice[j], dice[i]];
        }
        return dice;
    }

    /* ================= FORCE RANDOM ================= */
    Math.random = function() {
        if (rollDetected && forcedDice.length) {
            const value = forcedDice[diceIndex % forcedDice.length];
            diceIndex++;
            const noise = (seededRandom() - 0.5) * 0.08;
            return Math.min(0.999, Math.max(0, (value - 0.5) / 6 + noise));
        }
        return originalRandom();
    };

    /* ================= DICE SELECTORS ================= */
    function getDiceNodes() {
        // Coba beberapa selector umum untuk dice
        const selectors = [
            '.dice',
            '[class*="dice"]',
            '.die',
            '[class*="die"]',
            '.dice-canvas',
            '.dice-value',
            '[data-dice]',
            '.roll-dice'
        ];

        for (const selector of selectors) {
            const nodes = document.querySelectorAll(selector);
            if (nodes.length > 0) return nodes;
        }
        return [];
    }

    function getLockedDiceValues() {
        let lockedDice = [];
        const diceNodes = getDiceNodes();

        diceNodes.forEach((el, idx) => {
            // Coba berbagai cara mendapatkan nilai dice
            let val = 0;
            
            if (el.dataset.value) {
                val = parseInt(el.dataset.value);
            } else if (el.dataset.dice) {
                val = parseInt(el.dataset.dice);
            } else if (el.textContent) {
                val = parseInt(el.textContent.trim());
            } else if (el.getAttribute('value')) {
                val = parseInt(el.getAttribute('value'));
            }

            lockedDice[idx] = !isNaN(val) && val > 0 ? val : 0;
        });

        return lockedDice;
    }

    /* ================= ROLL DETECT ================= */
    function setupRollDetection() {
        // Detect click on roll button
        document.addEventListener('click', (e) => {
            // Cari elemen yang mungkin menjadi tombol roll
            const isRollButton = e.target.matches(
                'button, [class*="roll"], [class*="Roll"], .btn-roll, [data-action="roll"]'
            ) || e.target.closest('button, [class*="roll"], .btn-roll');

            if (isRollButton) {
                handleRollDetection();
            }
        }, true);

        // Detect via keyboard (space/enter on roll button)
        document.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
                const active = document.activeElement;
                if (active && active.matches('button, [class*="roll"], .btn-roll')) {
                    handleRollDetection();
                }
            }
        });
    }

    function handleRollDetection() {
        if (!firebaseInitialized || TARGET_TOTAL === null) {
            log('[FORCE] ⏳ Firebase belum siap, roll ditunda');
            // Queue roll for when Firebase is ready
            pendingRolls.push({
                timestamp: Date.now(),
                lockedDice: getLockedDiceValues()
            });
            return;
        }

        executeRoll();
    }

    function executeRoll() {
        if (TARGET_TOTAL === null) {
            log('[FORCE] ❌ TARGET_TOTAL masih null, roll dibatalkan');
            return;
        }

        // Ambil dice yang sudah dikunci
        let lockedDice = getLockedDiceValues();

        rollDetected = true;
        diceRenderCount = 0;
        diceIndex = Math.floor(originalRandom() * 999);
        seed = Date.now() ^ Math.floor(originalRandom() * 1e9);
        forcedDice = generateDice(TARGET_TOTAL, DICE_COUNT, lockedDice);

        log('[FORCE] 🎯 ROLL DETECTED with TOTAL =', TARGET_TOTAL);
        log('[FORCE] 🔒 Locked dice:', lockedDice);
        log('[FORCE] 🧩 FORCED DICE:', forcedDice, 'TOTAL =', forcedDice.reduce((a, b) => a + b, 0));

        setTimeout(applyTotal, TOTAL_DELAY);
    }

    function findTotalNode() {
        if (!rollDetected) return null;

        // Cari elemen yang menampilkan total
        const candidates = [];
        
        // Cari berdasarkan selector umum untuk total
        const selectors = [
            '.total',
            '[class*="total"]',
            '.sum',
            '[class*="sum"]',
            '.result',
            '.score',
            '#total',
            '.dice-total'
        ];

        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => candidates.push(el));
        }

        // Cari elemen dengan angka 2 digit (kemungkinan total)
        const allElements = document.querySelectorAll('div, span, p, h1, h2, h3, td, strong');
        allElements.forEach(el => {
            const text = el.textContent.trim();
            if (/^\d{1,3}$/.test(text) && parseInt(text) >= 9 && parseInt(text) <= 54) {
                candidates.push(el);
            }
        });

        // Kembalikan kandidat terakhir yang paling mungkin
        return candidates.length ? candidates[candidates.length - 1] : null;
    }

    function applyTotal() {
        if (!rollDetected || TARGET_TOTAL === null) return;

        log('[FORCE] 🎲 Applying total:', TARGET_TOTAL);

        const node = findTotalNode();
        if (node) {
            node.textContent = String(TARGET_TOTAL);
            node.style.fontWeight = 'bold';
            node.style.color = '#ff0000';
            log('[FORCE] ✅ Total applied to:', node);
        } else {
            log('[FORCE] ⚠️ Total node not found');
        }

        setTimeout(() => {
            rollDetected = false;
            diceRenderCount = 0;
            diceIndex = 0;
            forcedDice = [];
            log('[FORCE] 🔓 RESET');
        }, 900);
    }

    /* ================= FIREBASE ================= */
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            // Cek apakah script sudah ada
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async function initFirebase() {
        try {
            log('[FORCE] 🔥 Initializing Firebase...');
            
            // Load Firebase dengan timeout
            const loadTimeout = setTimeout(() => {
                log('[FORCE] ❌ Firebase load timeout - no fallback, will retry');
                // Retry loading after 2 seconds
                setTimeout(initFirebase, 2000);
            }, 8000);

            await loadScript("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js");
            
            clearTimeout(loadTimeout);

            // Inisialisasi Firebase
            firebase.initializeApp({
                apiKey: "AIzaSyB_4ChbALJGdWXGW8LcwTT9-1RBcNCFWK4",
                authDomain: "reyhan-dila.firebaseapp.com",
                databaseURL: "https://reyhan-dila-default-rtdb.asia-southeast1.firebasedatabase.app",
                projectId: "reyhan-dila",
                storageBucket: "reyhan-dila.firebasestorage.app",
                messagingSenderId: "316170579618",
                appId: "1:316170579618:web:c7e26e48dd88ae289ff1fb"
            });

            const db = firebase.database();

            // Ambil pola rules dengan timeout
            const dbTimeout = setTimeout(() => {
                log('[FORCE] ❌ Firebase database timeout - no fallback');
                // Will retry connection
                firebaseInitialized = false;
                setTimeout(initFirebase, 3000);
            }, 10000);

            db.ref("rules/pola").once("value").then(snap => {
                clearTimeout(dbTimeout);

                if (!snap.exists()) {
                    log('[FORCE] ❌ No rules found in Firebase');
                    firebaseInitialized = false;
                    return;
                }

                const rules = String(snap.val())
                    .split('-')
                    .map(n => parseInt(n, 10))
                    .filter(n => !isNaN(n) && n >= 9 && n <= 54);

                if (!rules.length) {
                    log('[FORCE] ❌ Invalid rules format in Firebase');
                    firebaseInitialized = false;
                    return;
                }

                // Ambil index rotasi dari localStorage
                let index = parseInt(localStorage.getItem('dicePolaIndex') || '0', 10);
                if (index >= rules.length) index = 0;

                TARGET_TOTAL = rules[index];
                localStorage.setItem('dicePolaIndex', (index + 1) % rules.length);

                log('[FORCE] 🔹 TARGET_TOTAL dari Firebase:', TARGET_TOTAL, 'index:', index);
                firebaseInitialized = true;

                // Process any pending rolls
                if (pendingRolls.length > 0) {
                    log('[FORCE] 📦 Processing', pendingRolls.length, 'pending rolls');
                    pendingRolls.forEach(roll => {
                        executeRoll();
                    });
                    pendingRolls = [];
                }
            }).catch(err => {
                clearTimeout(dbTimeout);
                log('[FORCE] ❌ Firebase error:', err);
                firebaseInitialized = false;
                
                // Retry connection after 3 seconds
                setTimeout(initFirebase, 3000);
            });

        } catch (err) {
            log('[FORCE] ❌ Firebase init error:', err);
            firebaseInitialized = false;
            
            // Retry connection after 3 seconds
            setTimeout(initFirebase, 3000);
        }
    }

    /* ================= CANVAS HOOK ================= */
    function hookCanvas() {
        // Monitor canvas rendering
        const observer = new MutationObserver((mutations) => {
            if (rollDetected) {
                mutations.forEach(m => {
                    if (m.type === 'childList' || m.type === 'characterData') {
                        diceRenderCount++;
                    }
                });
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });

        log('[FORCE] 👀 Canvas observer active');
    }

    /* ================= INIT ================= */
    async function initialize() {
        log('[FORCE] 🚀 Starting - NO FALLBACK VALUES, Firebase ONLY');
        
        // Initialize Firebase
        await initFirebase();

        // Setup detection
        setupRollDetection();
        hookCanvas();

        // Monitor Firebase status
        setInterval(() => {
            if (!firebaseInitialized) {
                log('[FORCE] ⏳ Waiting for Firebase...');
            } else {
                log('[FORCE] ✅ Firebase active, TARGET_TOTAL =', TARGET_TOTAL);
            }
        }, 5000);

        log('[FORCE] ✅ Initialized for Charles Proxy - No Fallbacks');
    }

    // Start
    initialize();

})();
