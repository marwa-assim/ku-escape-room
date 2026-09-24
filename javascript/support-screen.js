/* =====================================================================
   support-screen.js — SHARED TIMER CONTROLS
   ---------------------------------------------------------------------
   Shows the shared game timer on the Support Panel and drives it with
   the Start / Stop / Refresh buttons. The timer itself lives on the
   server (timer-api.php), so the Player Screen always shows exactly the
   same time. Appearance lives in support-style.css.

     Start   -> starts the countdown, or resumes it after Stop
     Stop    -> pauses it where it is
     Refresh -> back to the full duration, waiting for Start

   Sections:
     1. Configuration
     2. Elements
     3. Timer display
     4. Server sync
     5. Buttons
     6. Start-up
     7. Sending hints to the Player Screen
   ===================================================================== */
(function () {
    'use strict';

    /* ------------------------------------------------------------------
       1. Configuration
       ------------------------------------------------------------------ */

    // The game duration is set in ONE place: GAME_DURATION in timer-api.php.
    // It is shared by this panel and the Player Screen.

    // Where the shared timer lives, and how often to ask it (milliseconds).
    const TIMER_API = 'api/timer-api.php';
    const SYNC_EVERY = 1000;

    /* ------------------------------------------------------------------
       2. Elements
       ------------------------------------------------------------------ */
    const timerDisplay = document.getElementById('timer-display');
    const controls = document.querySelector('.timer-controls');
    const startButton = document.getElementById('timer-start-btn');
    const stopButton = document.getElementById('timer-stop-btn');
    const refreshButton = document.getElementById('timer-refresh-btn');
    const buttons = [startButton, stopButton, refreshButton].filter(Boolean);

    if (!timerDisplay) return;

    // Last answer from the server and when it arrived.
    let serverState = null;
    let receivedAt = 0;

    // True while a button press is on its way to the server.
    let busy = false;

    /* ------------------------------------------------------------------
       3. Timer display
       ------------------------------------------------------------------ */

    function pad(value) {
        return value.toString().padStart(2, '0');
    }

    // Seconds -> "HH:MM:SS"
    function formatTime(totalSeconds) {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);

        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }

    // Seconds left right now: the server's answer, minus the time that has
    // passed since it arrived (only while the timer is running).
    function remainingNow() {
        if (serverState.status !== 'running') return serverState.remaining;

        return Math.max(0, serverState.remaining - (performance.now() - receivedAt) / 1000);
    }

    function render() {
        if (!serverState) return;

        const remaining = remainingNow();
        const finished = remaining <= 0;
        const running = !finished && serverState.status === 'running';
        const text = formatTime(Math.ceil(remaining));

        if (timerDisplay.textContent !== text) timerDisplay.textContent = text;

        // Only offer the buttons that make sense right now
        if (startButton) startButton.disabled = busy || running || finished;
        if (stopButton) stopButton.disabled = busy || !running;
        if (refreshButton) refreshButton.disabled = busy;

        if (controls) controls.dataset.state = finished ? 'finished' : serverState.status;
    }

    /* ------------------------------------------------------------------
       4. Server sync
       ------------------------------------------------------------------ */

    // force = true for the answer to a button press, which is always taken
    function applyState(state, force) {
        if (!state || typeof state.remaining !== 'number' || typeof state.duration !== 'number') return;

        // While running, ignore answers that only differ by network delay,
        // so the countdown never jumps back and forth by a second.
        const inStep = !force && serverState &&
            state.status === 'running' &&
            serverState.status === 'running' &&
            state.duration === serverState.duration &&
            Math.abs(state.remaining - remainingNow()) < 0.5;

        if (!inStep) {
            serverState = state;
            receivedAt = performance.now();
        }

        render();
    }

    function readJson(response) {
        return response.ok ? response.json() : Promise.reject(response.status);
    }

    function sync() {
        fetch(TIMER_API, { cache: 'no-store' })
            .then(readJson)
            .then((state) => applyState(state, false))
            .catch(() => {
                // Server unreachable: keep counting from the last known
                // state and try again on the next round.
            })
            .finally(() => setTimeout(sync, SYNC_EVERY));
    }

    /* ------------------------------------------------------------------
       5. Buttons
       ------------------------------------------------------------------ */
    function send(action) {
        busy = true;
        render();

        fetch(TIMER_API, {
            method: 'POST',
            body: new URLSearchParams({ action: action }),
            cache: 'no-store'
        })
            .then(readJson)
            .then((state) => applyState(state, true))
            .catch(() => {
                // The next sync shows whatever the server really has.
            })
            .finally(() => {
                busy = false;
                render();
            });
    }

    /* Action buttons: play a sound on the Player Screen.
       The sound itself is made in the browser by player-screen.js; this
       only tells the server which one to play. */
    const SOUND_API = 'api/sound-api.php';

    function playOnPlayerScreen(sound, label) {
        fetch(SOUND_API, {
            method: 'POST',
            body: new URLSearchParams({ action: 'play', sound: sound }),
            cache: 'no-store'
        })
            .then(readJson)
            .then(() => showToast(label + ' sound sent to the players', false))
            .catch(() => showToast('Could not play the sound', true));
    }

    const congratsButton = document.getElementById('sound-congrats-btn');
    const warningButton = document.getElementById('sound-warning-btn');

    if (congratsButton) {
        congratsButton.addEventListener('click', () => playOnPlayerScreen('congratulation', 'Congratulation'));
    }

    if (warningButton) {
        warningButton.addEventListener('click', () => playOnPlayerScreen('warning', 'Warning'));
    }

    const failedButton = document.getElementById('sound-failed-btn');

    if (failedButton) {
        failedButton.addEventListener('click', () => playOnPlayerScreen('failed', 'Failed'));
    }

    if (startButton) startButton.addEventListener('click', () => send('start'));
    if (stopButton) stopButton.addEventListener('click', () => send('stop'));
    if (refreshButton) refreshButton.addEventListener('click', () => send('reset'));

    /* ------------------------------------------------------------------
       6. Start-up — buttons stay disabled until the server has answered
       ------------------------------------------------------------------ */
    buttons.forEach((button) => { button.disabled = true; });

    sync();

    // Redraw four times a second from the local clock, so the digits keep
    // moving smoothly between server answers.
    setInterval(render, 250);

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) render();
    });

    /* ------------------------------------------------------------------
       7. Sending hints to the Player Screen

       The preset buttons and the "Send Custom Hint" box are the existing
       forms from support-screen.phtml; the template is untouched. Instead
       of reloading the page they hand the hint to hint-api.php, which
       shows it on the Player Screen for the time set in that file.
       ------------------------------------------------------------------ */
    const HINT_API = 'api/hint-api.php';

    // Preview of "Get Answer" from the puzzle, polled into the custom hint box
    const DRAFT_POLL_EVERY = 1000;
    const customHintInput = document.getElementById('custom-hint-input');

    function pollDraft() {
        fetch(HINT_API, { cache: 'no-store' })
            .then(readJson)
            .then((state) => {
                if (!customHintInput) return;
                if (document.activeElement === customHintInput) return;

                const draft = state.draft || '';
                if (customHintInput.value !== draft) {
                    customHintInput.value = draft;
                }
            })
            .catch(() => {})
            .finally(() => setTimeout(pollDraft, DRAFT_POLL_EVERY));
    }

    pollDraft();

    // Every form that says action=send_hint (presets + the custom box)
    const hintForms = [...document.querySelectorAll('form')].filter((form) => {
        const action = form.querySelector('input[name="action"]');
        return action && action.value === 'send_hint';
    });

    /* ---- Hint status bar ----
       Goes green when a hint is sent from this panel and falls back to grey
       a few seconds later. This is only a confirmation for the operator:
       the hint itself keeps showing to the players for the full
       HINT_DURATION set in hint-api.php (2 minutes). */

    // Change this to set how long the bar stays green, in seconds.
    const HINT_STATUS_SECONDS = 8;

    const hintStatus = document.getElementById('hint-status');
    const hintStatusText = document.getElementById('hint-status-text');
    let hintStatusTimer = null;

    function showHintStatus(isLive) {
        if (!hintStatus) return;

        hintStatus.classList.toggle('is-live', isLive);
        if (hintStatusText) {
            hintStatusText.textContent = isLive ? 'Hint is sent' : 'No hint sent';
        }
    }

    // Green now, grey again after HINT_STATUS_SECONDS
    function flashHintStatus() {
        showHintStatus(true);

        clearTimeout(hintStatusTimer);
        hintStatusTimer = setTimeout(() => showHintStatus(false), HINT_STATUS_SECONDS * 1000);
    }

    let toast = null;
    let toastTimer = null;

    // Small confirmation, created here so the template needs no markup
    function showToast(message, isError) {
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'hint-toast';
            toast.setAttribute('role', 'status');
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.classList.toggle('is-error', !!isError);
        toast.classList.add('is-visible');

        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
    }

    hintForms.forEach((form) => {
        form.addEventListener('submit', (event) => {
            const field = form.querySelector('[name="hint_text"]');
            const text = field ? field.value.trim() : '';

            // Let the form post normally if there is nothing to work with
            if (!field) return;

            event.preventDefault();

            if (text === '') {
                showToast('Type a hint first', true);
                field.focus();
                return;
            }

            fetch(HINT_API, {
                method: 'POST',
                body: new URLSearchParams({ action: 'send', hint_text: text }),
                cache: 'no-store'
            })
                .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
                .then(() => {
                    showToast('Hint sent to the players', false);
                    flashHintStatus();
                    // Clear the custom box, but keep the preset buttons intact
                    if (field.type === 'text') field.value = '';
                })
                .catch(() => showToast('Could not send the hint', true));
        });
    });
})();
