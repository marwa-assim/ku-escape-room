/* =====================================================================
   login-screen.js — VISUAL EFFECTS ONLY
   ---------------------------------------------------------------------
   This file contains no login logic. It never reads or changes the form,
   the fields, the submit or the error message; login.php handles all of
   that. Appearance lives in login-style.css.

   It only seeds the decorative falling wrapped candies behind the card,
   the same ones the player screen uses.
   ===================================================================== */
(function () {
    'use strict';

    const rain = document.getElementById('candy-rain');
    const reduceMotion = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!rain || reduceMotion) return;

    const palettes = [
        ['#ff6fa5', '#ffd6e6'], // strawberry
        ['#8a4b2c', '#e0b48b'], // chocolate
        ['#ffd42e', '#fff6bf'], // lemon
        ['#f5a623', '#ffe2a8'], // honey
        ['#ffb3d1', '#ffffff'], // sugar
        ['#ffe9c7', '#ffffff'], // milk
        ['#d7263d', '#ffb9c2'], // cherry
        ['#3ecfa1', '#d9fff2'], // mint
        ['#ff8c42', '#ffdcbd'], // orange
        ['#b07cff', '#e6d6ff']  // lilac
    ];

    function rand(min, max) {
        return min + Math.random() * (max - min);
    }

    function seed() {
        rain.innerHTML = '';

        const width = window.innerWidth || 1024;
        const count = Math.max(8, Math.min(20, Math.round(width / 80)));
        const frag = document.createDocumentFragment();

        for (let i = 0; i < count; i++) {
            const candy = document.createElement('span');
            const palette = palettes[Math.floor(Math.random() * palettes.length)];
            const duration = rand(14, 27);

            candy.className = 'wrapped-candy';
            candy.style.setProperty('--s', rand(22, 44).toFixed(0) + 'px');
            candy.style.setProperty('--c1', palette[0]);
            candy.style.setProperty('--c2', palette[1]);
            candy.style.setProperty('--x', rand(-2, 98).toFixed(1) + '%');
            candy.style.setProperty('--dur', duration.toFixed(1) + 's');
            candy.style.setProperty('--delay', (-rand(0, duration)).toFixed(1) + 's'); // start mid-fall
            candy.style.setProperty('--rot', rand(-60, 60).toFixed(0) + 'deg');
            candy.style.setProperty('--op', rand(0.40, 0.85).toFixed(2));
            candy.style.setProperty('--spin', Math.random() < 0.5 ? '-1' : '1');

            const body = document.createElement('span');
            body.className = 'wc-body';
            candy.appendChild(body);
            frag.appendChild(candy);
        }

        rain.appendChild(frag);
    }

    seed();

    // Re-seed only on real width changes so the density keeps fitting.
    let lastWidth = window.innerWidth;
    let resizeTimer = null;

    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (Math.abs(window.innerWidth - lastWidth) > 160) {
                lastWidth = window.innerWidth;
                seed();
            }
        }, 250);
    });
})();
