/* =====================================================================
   player-screen.js — TIMER, PROGRESS AND CANDY ANIMATION
   ---------------------------------------------------------------------
   Behaviour for the player screen. Appearance lives in player-style.css
   and the page itself stays in PHP; this file only feeds the stylesheet
   the values that depend on the clock.

   The timer lives on the server (timer-api.php) and is controlled by the
   Start / Stop / Refresh buttons on the Support Panel. This page asks the
   server for the time about once a second and counts smoothly on its own
   in between, so it always shows the same time as the Support Panel.

   ONE SOURCE OF TRUTH
       remaining (from timer-api.php)
          |
          +--> the countdown text
          +--> --progress-ratio --> the bar fill width   (drawn by CSS)
          +--> --progress-ratio --> the candy position   (drawn by CSS)

   The bar and the candy are both drawn from the same variable, so they
   cannot drift out of step with the countdown.

   Sections:
     1. Configuration
     2. Elements
     3. Timer and progress
     4. Server sync
     5. Start-up
     6. Hints from the Support Panel
     7. Notification chime
     8. Background candies (decorative only)
   ===================================================================== */
(function () {
    'use strict';

    /* ------------------------------------------------------------------
       1. Configuration
       ------------------------------------------------------------------ */

    // The game duration is set in ONE place: GAME_DURATION in timer-api.php.
    // It is shared by this screen and the Support Panel.

    // Where the shared timer lives, and how often to ask it (milliseconds).
    const TIMER_API = 'api/timer-api.php';
    const SYNC_EVERY = 1000;

    // Hints sent from the Support Panel. How long a hint stays on screen
    // is set in ONE place: HINT_DURATION in hint-api.php (2 minutes).
    const HINT_API = 'api/hint-api.php';

    // Sounds the Support Panel can play here (its Action buttons)
    const SOUND_API = 'api/sound-api.php';

    // How many seconds are left when the countdown turns red and pulses.
    const ENDING_WARNING = 60;

    /* ------------------------------------------------------------------
       2. Elements
       ------------------------------------------------------------------ */
    const playerScreen = document.getElementById('player-screen');
    const timerDisplay = document.getElementById('timer-display');
    const progressTrack = document.getElementById('progress-track');
    const timerSegments = [...document.querySelectorAll('#timer-display .timer-seg')];

    // Without the panel and the clock there is nothing to drive.
    if (!playerScreen || !timerDisplay) return;

    // Last answer from the server and when it arrived. Until the first
    // answer the template's placeholder time stays on screen.
    let serverState = null;
    let receivedAt = 0;

    /* ------------------------------------------------------------------
       3. Timer and progress
       ------------------------------------------------------------------ */

    function pad(value) {
        return value.toString().padStart(2, '0');
    }

    // Seconds -> ["HH", "MM", "SS"]
    function splitTime(totalSeconds) {
        return [
            Math.floor(totalSeconds / 3600),
            Math.floor((totalSeconds % 3600) / 60),
            Math.floor(totalSeconds % 60)
        ].map(pad);
    }

    // Write the digits into the candy pills. The pills live in the template
    // and are dressed by the stylesheet; only the numbers come from here.
    // Falls back to plain text if the markup has no segments.
    function paintTime(totalSeconds) {
        const parts = splitTime(totalSeconds);

        if (!timerSegments.length) {
            timerDisplay.textContent = parts.join(' : ');
            return;
        }

        timerSegments.forEach((segment, index) => {
            if (segment.textContent !== parts[index]) {
                segment.textContent = parts[index];
            }
        });
    }

    // Seconds left right now: the server's answer, minus the time that has
    // passed since it arrived (only while the timer is running).
    function remainingNow() {
        if (serverState.status !== 'running') return serverState.remaining;

        return Math.max(0, serverState.remaining - (performance.now() - receivedAt) / 1000);
    }

    // The single place where the time is read. Everything the player sees
    // is derived from the value it produces.
    function render() {
        if (!serverState) return;

        const duration = serverState.duration;
        const remaining = remainingNow();
        const finished = remaining <= 0;
        const elapsed = Math.max(0, duration - remaining);
        const ratio = finished || duration <= 0 ? 1 : elapsed / duration;

        // Countdown — ceil() so it reads the full duration at the start and
        // only shows 00 : 00 : 00 when the time really is up. Never negative.
        paintTime(Math.ceil(remaining));

        // Bar fill and candy position (CSS turns this into width and left).
        playerScreen.style.setProperty('--progress-ratio', ratio.toFixed(5));

        if (progressTrack) {
            progressTrack.setAttribute('aria-valuenow', Math.round(ratio * 100));
        }

        playerScreen.classList.toggle('is-ending', !finished && remaining <= ENDING_WARNING);
        playerScreen.classList.toggle('is-finished', finished);

        // Stopped or waiting for Start: the candy holds still
        playerScreen.classList.toggle('is-paused', !finished && serverState.status !== 'running');
    }

    /* ------------------------------------------------------------------
       4. Server sync
       ------------------------------------------------------------------ */
    function applyState(state) {
        if (!state || typeof state.remaining !== 'number' || typeof state.duration !== 'number') return;

        // While running, ignore answers that only differ by network delay,
        // so the countdown never jumps back and forth by a second.
        const inStep = serverState &&
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

    function sync() {
        fetch(TIMER_API, { cache: 'no-store' })
            .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
            .then(applyState)
            .catch(() => {
                // Server unreachable: keep counting from the last known
                // state and try again on the next round.
            })
            .finally(() => setTimeout(sync, SYNC_EVERY));
    }

    /* ------------------------------------------------------------------
       5. Start-up — ask the server straight away, then keep in step.
       The countdown only moves once Start is pressed on the Support Panel.
       ------------------------------------------------------------------ */
    sync();

    // Redraw four times a second from the local clock, so the digits and
    // the candy move smoothly between server answers.
    setInterval(render, 250);

    // Background tabs throttle timers, so redraw the moment the screen is
    // looked at again.
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) render();
    });

    /* ------------------------------------------------------------------
       6. Hints from the Support Panel
       The panel is hidden until a hint arrives, shows it for the time set
       in hint-api.php, then hides itself again.
       ------------------------------------------------------------------ */
    const hintSection = document.getElementById('hint-section');
    const hintText = document.getElementById('hint-text');

    // id (sentAt) of the hint currently on screen, so the chime plays once
    let shownHintId = 0;

    function showHint(state) {
        const isNew = state.sentAt !== shownHintId;

        if (isNew) {
            shownHintId = state.sentAt;
            if (hintText) hintText.textContent = state.text;
            playHintChime();
        }

        if (hintSection) hintSection.classList.add('is-visible');
    }

    function hideHint() {
        shownHintId = 0;
        if (hintSection) hintSection.classList.remove('is-visible');
        if (hintText) hintText.textContent = '';
    }

    function syncHints() {
        fetch(HINT_API, { cache: 'no-store' })
            .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
            .then((state) => {
                if (state && state.text) {
                    showHint(state);
                } else {
                    // No hint, or the two minutes ran out
                    if (shownHintId !== 0) hideHint();
                }
            })
            .catch(() => {
                // Server unreachable: leave whatever is on screen alone.
            })
            .finally(() => setTimeout(syncHints, SYNC_EVERY));
    }

    /* ------------------------------------------------------------------
       7. Notification chime — a 5 second candy-shop music box
       Built with Web Audio so there is no sound file to load. Swap this
       for an <audio> element if you would rather use your own mp3.
       ------------------------------------------------------------------ */
    let audioContext = null;

    function getAudioContext() {
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtor) return null;

        if (!audioContext) audioContext = new AudioCtor();
        if (audioContext.state === 'suspended') audioContext.resume();

        return audioContext;
    }

    // One bell note: a soft music-box ping with a sparkle an octave up.
    function playBell(context, output, frequency, startAt, duration, level) {
        [
            { type: 'triangle', ratio: 1, gain: level },
            { type: 'sine', ratio: 2, gain: level * 0.35 }
        ].forEach((layer) => {
            const oscillator = context.createOscillator();
            const envelope = context.createGain();

            oscillator.type = layer.type;
            oscillator.frequency.value = frequency * layer.ratio;

            envelope.gain.setValueAtTime(0.0001, startAt);
            envelope.gain.exponentialRampToValueAtTime(layer.gain, startAt + 0.015);
            envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

            oscillator.connect(envelope).connect(output);
            oscillator.start(startAt);
            oscillator.stop(startAt + duration + 0.05);
        });
    }

    function playHintChime() {
        const context = getAudioContext();
        if (!context) return;

        const now = context.currentTime;

        // Gentle master level, rolled off so it stays soft and sweet
        const master = context.createGain();
        master.gain.value = 0.22;

        const softener = context.createBiquadFilter();
        softener.type = 'lowpass';
        softener.frequency.value = 5200;

        master.connect(softener).connect(context.destination);

        // C major sparkle: C6 E6 G6 C7 (rising), a held chord, then twinkles
        const C6 = 1046.5, D6 = 1174.7, E6 = 1318.5, G6 = 1568.0, A6 = 1760.0, C7 = 2093.0;

        const melody = [
            { at: 0.00, note: C6, dur: 0.9, level: 0.5 },
            { at: 0.16, note: E6, dur: 0.9, level: 0.5 },
            { at: 0.32, note: G6, dur: 1.0, level: 0.5 },
            { at: 0.48, note: C7, dur: 1.4, level: 0.55 },

            { at: 1.30, note: A6, dur: 1.1, level: 0.4 },
            { at: 1.46, note: G6, dur: 1.3, level: 0.4 },

            { at: 2.40, note: E6, dur: 0.8, level: 0.32 },
            { at: 2.62, note: G6, dur: 0.8, level: 0.32 },
            { at: 2.84, note: D6, dur: 0.9, level: 0.30 },

            { at: 3.40, note: C6, dur: 1.6, level: 0.42 },
            { at: 3.56, note: G6, dur: 1.5, level: 0.30 },
            { at: 3.72, note: C7, dur: 1.5, level: 0.26 }
        ];

        melody.forEach((step) => {
            playBell(context, master, step.note, now + step.at, step.dur, step.level);
        });

        // Everything has faded by ~5.2s; drop the chain so it can be freed.
        setTimeout(() => master.disconnect(), 5600);
    }

    /* ---- Congratulation: a crowd cheering and clapping ----
       Shaped from white noise: a cheering "roar" bed plus dozens of short
       claps spread left and right, densest at the start like real applause. */

    // One noise buffer per audio context, reused by every burst below
    function noiseBuffer(context) {
        if (!context.__noiseBuffer) {
            const length = Math.floor(context.sampleRate * 2);
            const buffer = context.createBuffer(1, length, context.sampleRate);
            const samples = buffer.getChannelData(0);

            for (let i = 0; i < length; i++) samples[i] = Math.random() * 2 - 1;

            context.__noiseBuffer = buffer;
        }

        return context.__noiseBuffer;
    }

    // A shaped burst of noise. With frequencyTo the filter sweeps, which is
    // what turns flat noise into a voice-like "whoo!".
    function noiseBurst(context, output, options) {
        const source = context.createBufferSource();
        source.buffer = noiseBuffer(context);
        source.loop = true;

        const filter = context.createBiquadFilter();
        filter.type = options.filter;
        filter.frequency.setValueAtTime(options.frequency, options.at);
        if (options.q) filter.Q.value = options.q;

        if (options.frequencyTo) {
            // up quickly, then falling away again
            filter.frequency.linearRampToValueAtTime(options.frequencyTo, options.at + options.duration * 0.35);
            filter.frequency.linearRampToValueAtTime(options.frequency * 0.85, options.at + options.duration);
        }

        const envelope = context.createGain();
        const attack = options.attack || 0.004;
        envelope.gain.setValueAtTime(0.0001, options.at);
        envelope.gain.exponentialRampToValueAtTime(options.level, options.at + attack);

        if (options.swell) {
            // A crowd rises and falls; step the level around a little
            const steps = 7;
            const from = options.at + attack;
            const span = (options.duration - attack) * 0.82;

            for (let i = 1; i <= steps; i++) {
                const level = options.level * (0.55 + Math.random() * 0.6);
                envelope.gain.linearRampToValueAtTime(level, from + (span / steps) * i);
            }
        }

        envelope.gain.exponentialRampToValueAtTime(0.0001, options.at + options.duration);

        let tail = envelope;

        // Spread the sound left and right where the browser supports it
        if (context.createStereoPanner && typeof options.pan === 'number') {
            const panner = context.createStereoPanner();
            panner.pan.value = options.pan;
            envelope.connect(panner);
            tail = panner;
        }

        source.connect(filter).connect(envelope);
        tail.connect(output);

        // Start at a random point so repeated bursts never sound identical
        source.start(options.at, Math.random() * 1.5);
        source.stop(options.at + options.duration + 0.05);
    }

    /* Drop a real recording at the path below and it will be used instead
       of the synthesised crowd. Any format the browser can play works
       (mp3, ogg, wav). If the file is not there, the built-in crowd below
       is played instead, so nothing breaks either way. */
    const CHEER_SOUND_FILE = 'sounds/cheer.mp3';

    let cheerRecording = null;
    let cheerFileMissing = false;

    function playCongratulations() {
        if (!cheerFileMissing) {
            if (!cheerRecording) {
                cheerRecording = new Audio(CHEER_SOUND_FILE);
                cheerRecording.preload = 'auto';
            }

            cheerRecording.currentTime = 0;

            const started = cheerRecording.play();

            if (started && started.catch) {
                started.catch(() => {
                    // No file (or it cannot be decoded): use the built-in crowd
                    cheerFileMissing = true;
                    playCrowdCheer();
                });
            }

            return;
        }

        playCrowdCheer();
    }

    // The built-in, synthesised crowd
    function playCrowdCheer() {
        const context = getAudioContext();
        if (!context) return;

        const now = context.currentTime;
        const random = (min, max) => min + Math.random() * (max - min);

        const master = context.createGain();
        master.gain.value = 0.5;
        master.connect(context.destination);

        const LENGTH = 5.0;

        /* 1. The roar of the crowd.
           Three bands roughly where human voices sit, so it reads as a room
           full of people rather than plain hiss. */
        [
            { frequency: 520, q: 1.6, level: 0.13, pan: -0.3 },   // chesty "aaah"
            { frequency: 1150, q: 2.2, level: 0.17, pan: 0.15 },  // the vowel
            { frequency: 2500, q: 1.8, level: 0.09, pan: 0.35 }   // bright edge
        ].forEach((layer) => {
            noiseBurst(context, master, {
                filter: 'bandpass',
                frequency: layer.frequency,
                q: layer.q,
                level: layer.level,
                pan: layer.pan,
                at: now,
                attack: 0.25,          // the crowd builds, never snaps on
                duration: LENGTH,
                // a crowd is never steady: let it surge and settle
                swell: true
            });
        });

        /* 2. Individual voices whooping over the top. Each one sweeps up and
           falls away, which is what makes it sound like a person shouting. */
        for (let i = 0; i < 26; i++) {
            const base = random(600, 1300);
            noiseBurst(context, master, {
                filter: 'bandpass',
                frequency: base,
                frequencyTo: base * random(1.7, 2.6),   // the "whoo!" rise
                q: random(7, 14),
                level: random(0.10, 0.22),
                pan: random(-0.9, 0.9),
                at: now + 0.1 + Math.random() * (LENGTH - 1.2),
                attack: random(0.04, 0.12),
                duration: random(0.35, 0.8)
            });
        }

        // Everything has faded by ~5s
        setTimeout(() => master.disconnect(), 5600);
    }

    // ---- Warning: a two-tone siren ----
    function playWarningSiren() {
        const context = getAudioContext();
        if (!context) return;

        const now = context.currentTime;

        const WAIL = 0.45;      // seconds for one sweep
        const CYCLES = 3;       // up-and-down sweeps
        const LOW = 520;
        const HIGH = 880;
        const total = CYCLES * WAIL * 2;

        const master = context.createGain();

        // Softened so it warns without being painful in the room
        const softener = context.createBiquadFilter();
        softener.type = 'lowpass';
        softener.frequency.value = 2200;

        master.connect(softener).connect(context.destination);

        const siren = context.createOscillator();
        siren.type = 'sawtooth';

        // A sine underneath gives it some body
        const body = context.createOscillator();
        body.type = 'sine';

        [siren, body].forEach((oscillator, index) => {
            const start = index === 0 ? LOW : LOW / 2;
            oscillator.frequency.setValueAtTime(start, now);

            for (let cycle = 0; cycle < CYCLES; cycle++) {
                const at = now + cycle * WAIL * 2;
                oscillator.frequency.linearRampToValueAtTime(index === 0 ? HIGH : HIGH / 2, at + WAIL);
                oscillator.frequency.linearRampToValueAtTime(start, at + WAIL * 2);
            }

            oscillator.connect(master);
            oscillator.start(now);
            oscillator.stop(now + total + 0.1);
        });

        master.gain.setValueAtTime(0.0001, now);
        master.gain.exponentialRampToValueAtTime(0.20, now + 0.06);
        master.gain.setValueAtTime(0.20, now + total - 0.25);
        master.gain.exponentialRampToValueAtTime(0.0001, now + total);

        setTimeout(() => master.disconnect(), (total + 0.5) * 1000);
    }

    /* ---- Failed: the sad trombone, "wah wah waaaah" ----
       Three short slides down, then one long falling note with a wobble.
       The "wah" comes from a filter opening and closing across each note,
       the way a trombone mute does. */
    function playSadTrombone() {
        const context = getAudioContext();
        if (!context) return;

        const now = context.currentTime;

        const master = context.createGain();
        master.gain.value = 0.32;
        master.connect(context.destination);

        function slideNote(at, fromHz, toHz, duration, isLast) {
            // Two voices so the brass sounds thick rather than thin
            const reed = context.createOscillator();
            const body = context.createOscillator();
            reed.type = 'sawtooth';
            body.type = 'triangle';
            body.detune.value = -7;

            // The mute: opens, then closes again = "wah"
            const mute = context.createBiquadFilter();
            mute.type = 'lowpass';
            mute.Q.value = 6;
            mute.frequency.setValueAtTime(500, at);
            mute.frequency.linearRampToValueAtTime(1800, at + duration * 0.3);
            mute.frequency.linearRampToValueAtTime(600, at + duration);

            const envelope = context.createGain();
            envelope.gain.setValueAtTime(0.0001, at);
            envelope.gain.exponentialRampToValueAtTime(0.5, at + 0.04);
            envelope.gain.setValueAtTime(0.5, at + duration * 0.7);
            envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);

            [reed, body].forEach((voice) => {
                voice.frequency.setValueAtTime(fromHz, at);
                voice.frequency.linearRampToValueAtTime(toHz, at + duration * 0.85);
                voice.connect(mute);
                voice.start(at);
                voice.stop(at + duration + 0.05);
            });

            mute.connect(envelope).connect(master);

            // The last note wobbles as it sinks
            if (isLast) {
                const wobble = context.createOscillator();
                const wobbleDepth = context.createGain();
                wobble.frequency.value = 5.5;
                wobbleDepth.gain.value = 7;
                wobble.connect(wobbleDepth);
                wobbleDepth.connect(reed.frequency);
                wobbleDepth.connect(body.frequency);
                wobble.start(at + duration * 0.35);
                wobble.stop(at + duration + 0.05);
            }
        }

        slideNote(now + 0.00, 349.2, 329.6, 0.34, false);   // wah
        slideNote(now + 0.38, 311.1, 293.7, 0.34, false);   // wah
        slideNote(now + 0.76, 277.2, 261.6, 0.36, false);   // wah
        slideNote(now + 1.18, 261.6, 155.6, 1.70, true);    // waaaaaah

        setTimeout(() => master.disconnect(), 3500);
    }

    // Which sound the Support Panel asked for
    function playActionSound(name) {
        if (name === 'congratulation') playCongratulations();
        if (name === 'warning') playWarningSiren();
        if (name === 'failed') playSadTrombone();
    }

    // id of the last sound already played here; on the first answer we only
    // take note of it, so opening the page never replays an old sound.
    let lastSoundId = null;

    function syncSounds() {
        fetch(SOUND_API, { cache: 'no-store' })
            .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
            .then((state) => {
                if (!state || typeof state.sentAt !== 'number') return;

                if (lastSoundId !== null && state.sentAt !== lastSoundId && state.sound) {
                    playActionSound(state.sound);
                }

                lastSoundId = state.sentAt;
            })
            .catch(() => {
                // Server unreachable: try again on the next round.
            })
            .finally(() => setTimeout(syncSounds, SYNC_EVERY));
    }

    // Browsers only allow sound after the person has interacted with the
    // page. Unlock the audio on the first touch, click or key press.
    ['pointerdown', 'keydown'].forEach((eventName) => {
        document.addEventListener(eventName, () => getAudioContext(), { once: true });
    });

    syncHints();
    syncSounds();

    /* ------------------------------------------------------------------
       8. Background candies — decoration only
       These never touch the timer, the progress bar or the hints.
       ------------------------------------------------------------------ */
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
