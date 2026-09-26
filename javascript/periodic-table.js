/* =====================================================================
   periodic-table.js — THE PERIODIC TABLE ON THE WINNER LETTER
   ---------------------------------------------------------------------
   Builds the 118-element table inside #periodic-table once, when the page
   loads. It stays hidden with the rest of the winner overlay until the
   puzzle is solved; puzzle-win.js is what opens the overlay.

   The boxes are blank on purpose: no symbols, numbers, names or masses.
   Only their shape and position show, so the players have to work out
   which elements the two highlighted boxes are. The highlighted boxes are
   glossy candy colours; every other box stays frosted grey.

   Appearance lives in puzzle-style.css (section 4). Visual only: no game
   logic, and the game's own files in escape_room/ are untouched.
   ===================================================================== */
(function () {
    'use strict';

    // Atomic numbers of the boxes to highlight. Change them to pick others.
    const HIGHLIGHTED = [11, 17];

    // Highlighted boxes take a candy flavour in the order listed above:
    // strawberry, mint, lemon, lilac (flavour-0 .. flavour-3 in the CSS)
    const FLAVOUR_COUNT = 4;

    // One box per element
    const ELEMENT_COUNT = 118;

    const grid = document.getElementById('periodic-table');
    if (!grid) return;

    // Where each element sits as [column, row]. Rows 9 and 10 are the two
    // lanthanide / actinide strips under the main table.
    function position(z) {
        if (z === 1) return [1, 1];
        if (z === 2) return [18, 1];
        if (z <= 4) return [z - 2, 2];
        if (z <= 10) return [z + 8, 2];
        if (z <= 12) return [z - 10, 3];
        if (z <= 18) return [z, 3];
        if (z <= 36) return [z - 18, 4];
        if (z <= 54) return [z - 36, 5];
        if (z <= 56) return [z - 54, 6];
        if (z <= 71) return [z - 54, 9];
        if (z <= 86) return [z - 68, 6];
        if (z <= 88) return [z - 86, 7];
        if (z <= 103) return [z - 86, 10];
        return [z - 100, 7];
    }

    function part(className, text) {
        const span = document.createElement('span');
        span.className = className;
        if (text !== undefined) span.textContent = text;
        return span;
    }

    const boxes = document.createDocumentFragment();

    for (let z = 1; z <= ELEMENT_COUNT; z++) {
        const [column, row] = position(z);
        const hot = HIGHLIGHTED.indexOf(z);

        const cell = document.createElement('div');
        cell.className = 'pt-cell';
        cell.style.gridColumn = column;
        cell.style.gridRow = row;

        if (hot >= 0) {
            cell.classList.add('is-hot', 'flavour-' + (hot % FLAVOUR_COUNT));
            // The highlighted boxes bob gently, one after the other
            cell.style.animationDelay = (hot * 0.5) + 's';
        }

        // Only the gloss highlight: no symbol, number, name or mass
        cell.appendChild(part('pt-gloss'));

        boxes.appendChild(cell);
    }

    // Empty dashed boxes where the lanthanides and actinides are pulled out
    [6, 7].forEach((row) => {
        const marker = document.createElement('div');
        marker.className = 'pt-marker';
        marker.style.gridColumn = 3;
        marker.style.gridRow = row;
        boxes.appendChild(marker);
    });

    grid.appendChild(boxes);

    /* ------------------------------------------------------------------
       A few wrapped candies drifting down behind the table, using the
       game's own .wrapped-candy style from escape_room/game_css.css.
       ------------------------------------------------------------------ */
    const candyLayer = document.getElementById('sheet-candies');
    const reduceMotion = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!candyLayer || reduceMotion) return;

    const flavours = [
        ['#ff6fa5', '#ffd6e6'], // strawberry
        ['#6fe3c2', '#d9fff2'], // mint
        ['#ffe27a', '#fff6bf'], // lemon
        ['#ffb58a', '#ffdcbd'], // peach
        ['#c8b6ff', '#e6d6ff']  // lilac
    ];

    for (let i = 0; i < 12; i++) {
        const candy = document.createElement('span');
        const flavour = flavours[i % flavours.length];
        const duration = 12 + (i * 5) % 10;

        candy.className = 'wrapped-candy';
        candy.style.setProperty('--s', (22 + (i * 7) % 18) + 'px');
        candy.style.setProperty('--c1', flavour[0]);
        candy.style.setProperty('--c2', flavour[1]);
        candy.style.setProperty('--x', ((i * 37 + 11) % 100) + '%');
        candy.style.setProperty('--dur', duration + 's');
        candy.style.setProperty('--delay', (-((i * 3.1) % duration)).toFixed(1) + 's');
        candy.style.setProperty('--rot', ((i * 47) % 120 - 60) + 'deg');
        candy.style.setProperty('--op', '0.55');
        candy.style.setProperty('--spin', i % 2 ? '1' : '-1');

        candy.appendChild(part('wc-body'));
        candyLayer.appendChild(candy);
    }
})();
