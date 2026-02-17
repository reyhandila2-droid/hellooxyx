// Simple test script for Charles Proxy
(function() {
    'use strict';

    // Create simple alert
    alert('🔧 HELLO EREN - Charles Proxy Test!');

    // Create simple div
    const div = document.createElement('div');
    div.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: red;
        color: white;
        padding: 10px;
        font-size: 16px;
        z-index: 999999;
        border-radius: 5px;
        font-family: Arial;
    `;
    div.innerHTML = '👋 HELLO EREN';
    document.body.appendChild(div);

    // Log to console
    console.log('✅ HELLO EREN - Charles Proxy Active');

})();
