/* =====================================================================
   candy_fx.js — VISUAL EFFECTS ONLY
   ---------------------------------------------------------------------
   This file contains no game logic. It never toggles the "active" class,
   never touches move counts, timers, answers or the restart routine.
   It only:
     1. Plays a "pop" animation on any piece whose active/inactive state
        was changed by script.js (observed via MutationObserver).
     2. Adds a sparkle ring on the piece the user actually clicked.
     3. Gives the grid a small wobble when Restart is pressed.
     4. Seeds the decorative falling wrapped candies in the background.
   ===================================================================== */
(function () {
    'use strict';

    var reduceMotion = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ------------------------------------------------------------------
       1. Pop animation whenever a piece's state changes
       ------------------------------------------------------------------ */
    var pieces = document.querySelectorAll('.circle');

    function hasActive(classString) {
        return (' ' + (classString || '') + ' ').indexOf(' active ') !== -1;
    }

    function playPop(piece) {
        piece.classList.remove('pop');
        // Force a reflow so re-adding the class restarts the animation.
        void piece.offsetWidth;
        piece.classList.add('pop');
    }

    if (window.MutationObserver) {
        var observer = new MutationObserver(function (records) {
            // Several records can arrive for the same element in one batch
            // (e.g. Restart). Compare the FIRST old value with the final state.
            var firstOld = new Map();
            records.forEach(function (rec) {
                if (rec.type !== 'attributes' || rec.attributeName !== 'class') return;
                if (!firstOld.has(rec.target)) {
                    firstOld.set(rec.target, hasActive(rec.oldValue));
                }
            });
            firstOld.forEach(function (wasActive, el) {
                var isActive = el.classList.contains('active');
                if (wasActive !== isActive) playPop(el);
            });
        });

        pieces.forEach(function (piece) {
            observer.observe(piece, {
                attributes: true,
                attributeFilter: ['class'],
                attributeOldValue: true
            });
            piece.addEventListener('animationend', function (e) {
                if (e.animationName === 'candyPop') piece.classList.remove('pop');
            });
        });
    }

    /* ------------------------------------------------------------------
       2. Sparkle ring on the clicked piece
       ------------------------------------------------------------------ */
    pieces.forEach(function (piece) {
        piece.addEventListener('click', function () {
            if (reduceMotion) return;
            var ring = document.createElement('span');
            ring.className = 'burst-ring';
            ring.setAttribute('aria-hidden', 'true');
            piece.appendChild(ring);
            ring.addEventListener('animationend', function () {
                if (ring.parentNode) ring.parentNode.removeChild(ring);
            });
        });
    });

    /* ------------------------------------------------------------------
       3. Grid wobble on Restart (purely cosmetic; script.js still does the reset)
       ------------------------------------------------------------------ */
    var grid = document.getElementById('circle-grid');
    var resetBtn = document.getElementById('reset-btn');
    if (grid && resetBtn) {
        resetBtn.addEventListener('click', function () {
            if (reduceMotion) return;
            grid.classList.remove('reshuffle');
            void grid.offsetWidth;
            grid.classList.add('reshuffle');
        });
        grid.addEventListener('animationend', function (e) {
            if (e.animationName === 'gridShake') grid.classList.remove('reshuffle');
        });
    }

    /* ------------------------------------------------------------------
       4. Falling wrapped candies (CSS-animated; JS only seeds them once
          and re-seeds on large resizes so density fits the viewport)
       ------------------------------------------------------------------ */
    var rain = document.getElementById('candy-rain');
    if (!rain || reduceMotion) return;

    var palettes = [
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

    function rand(min, max) { return min + Math.random() * (max - min); }

    function seed() {
        rain.innerHTML = '';
        var width = window.innerWidth || 1024;
        var count = Math.max(8, Math.min(22, Math.round(width / 70)));
        var frag = document.createDocumentFragment();

        for (var i = 0; i < count; i++) {
            var c = document.createElement('span');
            c.className = 'wrapped-candy';
            var p = palettes[Math.floor(Math.random() * palettes.length)];
            var dur = rand(13, 26);
            c.style.setProperty('--s', rand(24, 48).toFixed(0) + 'px');
            c.style.setProperty('--c1', p[0]);
            c.style.setProperty('--c2', p[1]);
            c.style.setProperty('--x', rand(-2, 98).toFixed(1) + '%');
            c.style.setProperty('--dur', dur.toFixed(1) + 's');
            c.style.setProperty('--delay', (-rand(0, dur)).toFixed(1) + 's'); // start mid-fall
            c.style.setProperty('--rot', rand(-60, 60).toFixed(0) + 'deg');
            c.style.setProperty('--op', rand(0.45, 0.9).toFixed(2));
            c.style.setProperty('--spin', Math.random() < 0.5 ? '-1' : '1');

            var body = document.createElement('span');
            body.className = 'wc-body';
            c.appendChild(body);
            frag.appendChild(c);
        }
        rain.appendChild(frag);
    }

    seed();

    var lastWidth = window.innerWidth;
    var resizeTimer = null;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            if (Math.abs(window.innerWidth - lastWidth) > 160) {
                lastWidth = window.innerWidth;
                seed();
            }
        }, 250);
    });
})();
