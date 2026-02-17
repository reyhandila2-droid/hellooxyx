// ==UserScript==
// @name         Canvas Dice REAL FORCE ENGINE (TOTAL FROM FIREBASE) FIX
// @namespace    https://force.dice.real.engine/
// @version      10.2-FIREBASE
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
        while (remain > 0) {
            const i = Math.floor(originalRandom() * count);
            if (!lockedDice[i] && dice[i] < 6) {
                dice[i]++;
                remain--;
            }
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

    /* ================= ROLL DETECT ================= */
    function hookRoll() {
        document.addEventListener('click', () => {
            if (TARGET_TOTAL == null) {
                log('[FORCE] ⚠️ TARGET_TOTAL belum siap dari Firebase');
                return;
            }

            // ambil dice yang sudah dikunci/terpilih sebelum roll
            let lockedDice = [];
            const diceNodes = document.querySelectorAll('.dice'); // sesuaikan selector canvas dice
            diceNodes.forEach((el, idx) => {
                const val = parseInt(el.dataset.value);
                lockedDice[idx] = val > 0 ? val : 0;
            });

            rollDetected = true;
            diceRenderCount = 0;
            diceIndex = Math.floor(originalRandom() * 999);
            seed = Date.now() ^ Math.floor(originalRandom() * 1e9);
            forcedDice = generateDice(TARGET_TOTAL, DICE_COUNT, lockedDice);

            log('[FORCE] 🎯 ROLL DETECTED');
            log('[FORCE] 🧩 FORCED DICE:', forcedDice, 'TOTAL =', forcedDice.reduce((a,b)=>a+b,0));

            setTimeout(applyTotal, TOTAL_DELAY);
        }, true);
    }

 function findTotalNode() {
    if (!rollDetected) return null;
    // Ambil node angka terakhir di body (biasanya total default Google)
    const nodes = [...document.body.querySelectorAll('*')]
        .filter(el => /^\d{1,3}$/.test(el.textContent.trim()));
    return nodes.length ? nodes[nodes.length - 1] : null;
}


    function applyTotal() {
    if (!rollDetected) return; // pastikan hanya saat roll

    log('[FORCE] 🎲 CANVAS RENDER COUNT:', diceRenderCount);

    const node = findTotalNode();
    if (node) {
        node.textContent = String(TARGET_TOTAL);
        node.style.fontWeight = 'bold';
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
    async function loadScript(src) {
        return new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = res;
            s.onerror = rej;
            document.head.appendChild(s);
        });
    }

    async function initFirebase() {
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
            if (!snap.exists()) return;
            const rules = String(snap.val())
                .split('-')
                .map(n => parseInt(n, 10))
                .filter(n => !isNaN(n));

            if (!rules.length) return;

            // Ambil index rotasi dari localStorage
            let index = parseInt(localStorage.getItem('dicePolaIndex')||0,10);
            if (index >= rules.length) index = 0;

            TARGET_TOTAL = rules[index];
            localStorage.setItem('dicePolaIndex', index + 1);

            log('[FORCE] 🔹 TARGET_TOTAL dari Firebase:', TARGET_TOTAL, 'index:', index);
        });
    }

    /* ================= INIT ================= */
    await initFirebase();
    hookRoll();
    hookCanvas();

})();
