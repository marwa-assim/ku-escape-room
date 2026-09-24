/* =====================================================================
   puzzle-win.js — WINNER ENVELOPE + RESTART ON REFRESH
   ---------------------------------------------------------------------
   Added by the project on top of the escape_room game. It does NOT touch
   the game's logic: escape_room/script.js and escape_room/game_css.css
   are exactly as they came from the original game.

   1. When the game announces a win (its own "Secret Recipe Unlocked"
      message appears), the envelope pops up from below and the letter
      slides out of it. Everything behind is blurred by the stylesheet.

   2. The envelope then stays on screen. It is cleared when the admin
      presses Refresh on the Support Panel: the puzzle restarts by
      pressing the game's own Restart button, so the reset is done by the
      game itself. This only happens once the player has finished.

   How the win is detected: a MutationObserver watches the class on the
   game's #success-message, the same technique candy_fx.js already uses.

   Sections:
     1. Configuration
     2. Elements
     3. Envelope
     4. Restart when Support presses Refresh
     5. Demo "Solve puzzle" button
   ===================================================================== */
(function () {
    'use strict';

    /* ------------------------------------------------------------------
       1. Configuration
       ------------------------------------------------------------------ */
    const TIMER_API = 'api/timer-api.php';
    const CHECK_EVERY = 2000; // how often to look for a Refresh press (ms)

    /* ------------------------------------------------------------------
       2. Elements
       ------------------------------------------------------------------ */
    const overlay = document.getElementById('win-overlay');
    const successMessage = document.getElementById('success-message');
    const restartButton = document.getElementById('reset-btn');

    if (!overlay || !successMessage) return;

    let hasWon = false;

    /* ------------------------------------------------------------------
       3. Envelope
       ------------------------------------------------------------------ */
    function openEnvelope() {
        if (hasWon) return;
        hasWon = true;

        // Re-add the class from scratch so the animations play again on a
        // second win in the same session.
        overlay.classList.remove('is-open');
        void overlay.offsetWidth;
        overlay.classList.add('is-open');
        overlay.setAttribute('aria-hidden', 'false');
    }

    function closeEnvelope() {
        hasWon = false;
        overlay.classList.remove('is-open');
        overlay.setAttribute('aria-hidden', 'true');
    }

    // The game adds .show to #success-message when the puzzle is solved,
    // and removes it on Restart.
    const winObserver = new MutationObserver(() => {
        if (successMessage.classList.contains('show')) {
            openEnvelope();
        } else {
            closeEnvelope();
        }
    });

    winObserver.observe(successMessage, { attributes: true, attributeFilter: ['class'] });

    // In case the message was already showing before this script ran
    if (successMessage.classList.contains('show')) openEnvelope();

    /* ------------------------------------------------------------------
       4. Restart when Support presses Refresh
       A Refresh leaves the shared timer stopped with the full duration
       left, and stamps a new updatedAt. Seeing a new stamp in that state
       means the button was just pressed.
       ------------------------------------------------------------------ */
    let lastUpdatedAt = null;

    function looksLikeRefresh(state) {
        return state.status === 'stopped' && state.remaining >= state.duration - 0.5;
    }

    function checkTimer() {
        fetch(TIMER_API, { cache: 'no-store' })
            .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
            .then((state) => {
                if (!state || typeof state.updatedAt !== 'number') return;

                const isNewPress = lastUpdatedAt !== null && state.updatedAt !== lastUpdatedAt;
                lastUpdatedAt = state.updatedAt;

                // Only restart once the player has actually finished
                if (isNewPress && hasWon && looksLikeRefresh(state)) {
                    closeEnvelope();

                    // Let the game reset itself through its own Restart button
                    if (restartButton) restartButton.click();
                }
            })
            .catch(() => {
                // Server unreachable: try again on the next round.
            })
            .finally(() => setTimeout(checkTimer, CHECK_EVERY));
    }

    checkTimer();
})();
