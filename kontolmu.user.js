// ==UserScript==
// @name         Canvas Dice REAL FORCE ENGINE (TOTAL FROM FIREBASE) FIX
// @namespace    https://force.dice.real.engine/
// @version      10.5-ROLL-BUTTON-FIX
// @description  Dice total from Firebase rules/pola, visual random, animation-safe
// @match        *://*/*
// @grant        none
// ==/UserScript==

(async function () {
    'use strict';

    /* ================= CONFIG ================= */
    const DICE_COUNT = 9;
    const TOTAL_DELAY = 1500;
    const DEBUG = true;

    let TARGET_TOTAL;          // dari Firebase
    let rollDetected = false;
    let diceRenderCount = 0;
    let forcedDice = [];
    let diceIndex = 0;
    let seed = Date.now();
    const originalRandom = Math.random;
    let rollButtonDetected = false;

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

        let remain = total - dice.reduce((a,b)=>a+b,0);
        
        // Validasi remain tidak negatif
        if (remain < 0) {
            log('[FORCE] ⚠️ Total terlalu kecil dari dice terkunci');
            return dice;
        }

        let attempts = 0;
        const maxAttempts = 1000;
        
        while (remain > 0 && attempts < maxAttempts) {
            const i = Math.floor(originalRandom() * count);
            if (!lockedDice[i] && dice[i] < 6) {
                dice[i]++;
                remain--;
            }
            attempts++;
        }

        // shuffle dice
        for (let i = dice.length - 1; i > 0; i--) {
            const j = Math.floor(seededRandom() * (i + 1));
            [dice[i], dice[j]] = [dice[j], dice[i]];
        }
        return dice;
    }

    /* ================= FORCE RANDOM ================= */
    Math.random = function () {
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
        // Coba berbagai selector untuk dadu
        const selectors = [
            '.dice',
            '[class*="dice"]',
            '[class*="Dice"]',
            '.die',
            '[class*="die"]',
            '.dice-canvas',
            '.dice-value',
            '[data-dice]',
            '.roll-dice',
            '.dice-item',
            '.dice-box',
            'canvas' // Mungkin digambar dengan canvas
        ];

        for (const selector of selectors) {
            const nodes = document.querySelectorAll(selector);
            if (nodes.length > 0) {
                log('[FORCE] Found dice nodes with selector:', selector, nodes.length);
                return nodes;
            }
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
            } else if (el.innerText) {
                val = parseInt(el.innerText.trim());
            }

            lockedDice[idx] = !isNaN(val) && val > 0 ? val : 0;
        });

        return lockedDice;
    }

    /* ================= ROLL BUTTON DETECTION ================= */
    function findRollButton() {
        // Kata kunci yang mungkin ada di tombol roll
        const rollKeywords = [
            'lempar', 'roll', 'dadu', 'kocok', 'acak',
            'lempar dadu', 'roll dice', 'throw', 'shake',
            'play', 'start', 'go', 'lempar'
        ];
        
        // Selector umum untuk tombol
        const buttonSelectors = [
            'button',
            '[role="button"]',
            '.btn',
            '.button',
            'input[type="button"]',
            'input[type="submit"]'
        ];

        // Cari berdasarkan selector
        for (const selector of buttonSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
                const text = (el.textContent || el.value || '').toLowerCase().trim();
                const className = (el.className || '').toLowerCase();
                const id = (el.id || '').toLowerCase();
                
                // Cek apakah mengandung kata kunci roll
                for (const keyword of rollKeywords) {
                    if (text.includes(keyword) || className.includes(keyword) || id.includes(keyword)) {
                        log('[FORCE] Found roll button:', text, 'using', selector);
                        return el;
                    }
                }
            }
        }

        // Cari elemen dengan teks yang mengandung angka (mungkin total)
        const allElements = document.querySelectorAll('div, span, p, h1, h2, h3');
        for (const el of allElements) {
            const text = (el.textContent || '').toLowerCase().trim();
            if (text.includes('total') || text.includes('hasil') || text.includes('result')) {
                log('[FORCE] Found potential result element:', text);
                // Kembalikan elemen terdekat yang mungkin tombol
                const parentButton = el.closest('button, [role="button"], .btn');
                if (parentButton) return parentButton;
            }
        }

        return null;
    }

    /* ================= ROLL DETECT ================= */
    function hookRoll() {
        // Deteksi klik pada tombol roll
        document.addEventListener('click', (e) => {
            // Cari tombol roll
            const rollButton = findRollButton();
            
            // Cek apakah yang diklik adalah tombol roll atau turunannya
            const isRollButton = rollButton && (e.target === rollButton || rollButton.contains(e.target));
            
            // Atau cek berdasarkan kelas/teks umum
            const isLikelyRollButton = e.target.matches(
                'button, [class*="roll"], [class*="Roll"], [class*="lempar"], [class*="Lempar"], ' +
                '.btn-roll, .btn-play, [data-action="roll"], [data-action="lempar"]'
            ) || e.target.closest('button, [class*="roll"], [class*="lempar"], .btn-roll');

            if (isRollButton || isLikelyRollButton) {
                log('[FORCE] 👆 Roll button clicked');
                setTimeout(() => handleRoll(), 100); // Delay kecil untuk menangkap state sebelum roll
            }
        }, true);

        // Deteksi via keyboard (enter/space pada tombol)
        document.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
                const active = document.activeElement;
                const rollButton = findRollButton();
                
                if (active && (active === rollButton || rollButton?.contains(active) || 
                    active.matches('button, [class*="roll"], [class*="lempar"]'))) {
                    log('[FORCE] ⌨️ Roll button activated via keyboard');
                    setTimeout(() => handleRoll(), 100);
                }
            }
        });

        // Observasi perubahan DOM untuk mendeteksi tombol yang muncul kemudian
        const observer = new MutationObserver((mutations) => {
            if (!rollButtonDetected) {
                const button = findRollButton();
                if (button) {
                    rollButtonDetected = true;
                    log('[FORCE] 🎯 Roll button detected:', button);
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        log('[FORCE] 👀 Roll detection active');
    }

    function handleRoll() {
        if (TARGET_TOTAL == null) {
            log('[FORCE] ⚠️ TARGET_TOTAL belum siap dari Firebase');
            return;
        }

        // ambil dice yang sudah dikunci/terpilih sebelum roll
        let lockedDice = getLockedDiceValues();

        rollDetected = true;
        diceRenderCount = 0;
        diceIndex = Math.floor(originalRandom() * 999);
        seed = Date.now() ^ Math.floor(originalRandom() * 1e9);
        forcedDice = generateDice(TARGET_TOTAL, DICE_COUNT, lockedDice);

        log('[FORCE] 🎯 ROLL DETECTED with TOTAL =', TARGET_TOTAL);
        log('[FORCE] 🔒 Locked dice:', lockedDice);
        log('[FORCE] 🧩 FORCED DICE:', forcedDice, 'TOTAL =', forcedDice.reduce((a,b)=>a+b,0));

        setTimeout(applyTotal, TOTAL_DELAY);
    }

    function findTotalNode() {
        if (!rollDetected) return null;

        // Cari elemen yang menampilkan total
        const candidates = [];
        
        // Selector untuk elemen total
        const totalSelectors = [
            '.total',
            '[class*="total"]',
            '[class*="Total"]',
            '.sum',
            '[class*="sum"]',
            '.result',
            '[class*="result"]',
            '.score',
            '[class*="score"]',
            '#total',
            '#result',
            '.dice-total',
            '.game-total'
        ];

        for (const selector of totalSelectors) {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => candidates.push(el));
        }

        // Cari elemen dengan angka antara 9-54 (rentang total dadu)
        const allElements = document.querySelectorAll('div, span, p, h1, h2, h3, td, strong, .value, .number');
        allElements.forEach(el => {
            const text = el.textContent.trim();
            const num = parseInt(text);
            if (/^\d{1,3}$/.test(text) && num >= 9 && num <= 54) {
                candidates.push(el);
            }
        });

        // Kembalikan kandidat terakhir yang paling mungkin
        return candidates.length ? candidates[candidates.length - 1] : null;
    }

    function applyTotal() {
        if (!rollDetected) return;

        log('[FORCE] 🎲 Applying total:', TARGET_TOTAL);
        log('[FORCE] 📊 CANVAS RENDER COUNT:', diceRenderCount);

        const node = findTotalNode();
        if (node) {
            node.textContent = String(TARGET_TOTAL);
            node.style.fontWeight = 'bold';
            node.style.color = '#ff0000';
            node.style.fontSize = 'larger';
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

    /* ================= CANVAS HOOK ================= */
    function hookCanvas() {
        // Monitor perubahan pada canvas/element yang mungkin menampilkan dadu
        const observer = new MutationObserver((mutations) => {
            if (rollDetected) {
                mutations.forEach(m => {
                    if (m.type === 'childList' || m.type === 'characterData' || m.type === 'attributes') {
                        diceRenderCount++;
                    }
                });
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['src', 'style', 'class', 'data-value']
        });

        // Juga monitor canvas drawing
        const originalContextMethods = {};
        const canvasElements = document.querySelectorAll('canvas');
        canvasElements.forEach(canvas => {
            try {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    // Hook fillText method
                    const originalFillText = ctx.fillText;
                    ctx.fillText = function() {
                        if (rollDetected) diceRenderCount++;
                        return originalFillText.apply(this, arguments);
                    };
                }
            } catch (e) {
                // Ignore
            }
        });

        log('[FORCE] 👁️ Canvas observer active');
    }

    /* ================= FIREBASE ================= */
    async function loadScript(src) {
        return new Promise((res, rej) => {
            // Cek apakah script sudah ada
            if (document.querySelector(`script[src="${src}"]`)) {
                res();
                return;
            }

            const s = document.createElement('script');
            s.src = src;
            s.onload = res;
            s.onerror = rej;
            document.head.appendChild(s);
        });
    }

    async function initFirebase() {
        try {
            await loadScript("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js");

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

            // Ambil pola rules
            db.ref("rules/pola").once("value").then(snap => {
                if (!snap.exists()) {
                    log('[FORCE] ❌ No rules found in Firebase');
                    return;
                }

                const rules = String(snap.val())
                    .split('-')
                    .map(n => parseInt(n, 10))
                    .filter(n => !isNaN(n) && n >= 9 && n <= 54);

                if (!rules.length) {
                    log('[FORCE] ❌ Invalid rules format');
                    return;
                }

                // Ambil index rotasi dari localStorage
                let index = parseInt(localStorage.getItem('dicePolaIndex') || '0', 10);
                if (index >= rules.length) index = 0;

                TARGET_TOTAL = rules[index];
                localStorage.setItem('dicePolaIndex', index + 1);

                log('[FORCE] 🔹 TARGET_TOTAL dari Firebase:', TARGET_TOTAL, 'index:', index);
                log('[FORCE] 📋 All rules:', rules);
            }).catch(err => {
                log('[FORCE] ❌ Firebase read error:', err);
            });
        } catch (err) {
            log('[FORCE] ❌ Firebase init error:', err);
        }
    }

    /* ================= INIT ================= */
    async function initialize() {
        log('[FORCE] 🚀 Starting...');
        
        await initFirebase();
        hookRoll();
        hookCanvas();
        
        // Cek apakah halaman sudah siap
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                log('[FORCE] 📄 DOM loaded');
                rollButtonDetected = !!findRollButton();
            });
        } else {
            log('[FORCE] 📄 DOM already loaded');
            rollButtonDetected = !!findRollButton();
        }

        log('[FORCE] ✅ Initialized');
    }

    // Start
    initialize();
})();
