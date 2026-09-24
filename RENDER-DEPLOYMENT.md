# KU Escape Room — Render deployment

This package preserves the existing application screens and game logic. The deployment additions are Docker/Render configuration, environment-based database credentials, persistent storage for the existing timer/hint/sound JSON state, and browser-side kiosk hardening on player pages.

## Deploy
1. Create a **private GitHub repository** and upload the contents of this folder (the files themselves should be at the repository root).
2. In Render, choose **New > Blueprint** and connect that repository.
3. Render detects `render.yaml`. Review the two services: `ku-escape-mysql` and `ku-escape-room`.
4. Deploy the Blueprint. Keep both services in the same Render region/workspace.
5. Wait for MySQL to finish its first initialization, then wait for the web service to become healthy.
6. Open the web service URL. Render supplies an HTTPS `*.onrender.com` address.

## URLs
- Home: `https://YOUR-SERVICE.onrender.com/`
- Support login: `https://YOUR-SERVICE.onrender.com/login.php`
- Player timer/hints: `https://YOUR-SERVICE.onrender.com/player.php`
- Puzzle: `https://YOUR-SERVICE.onrender.com/puzzle.php`

## Important
- Use an always-on paid service for the live event; do not rely on a sleeping/free instance for a timed escape-room session.
- The Render disks in `render.yaml` preserve MySQL data and the existing timer/hint/sound state across restarts.
- Do not scale the PHP web service beyond one instance while the timer/hint/sound state remains file-based. One instance preserves the original behaviour exactly.

## Player laptop: real kiosk mode
JavaScript cannot block Windows shortcuts such as Ctrl+Alt+Delete or reliably prevent Alt+Tab/Alt+F4. Configure Microsoft Edge/Windows kiosk mode on the player laptop.

Recommended Edge command for a dedicated Windows event account:

`msedge.exe --kiosk "https://YOUR-SERVICE.onrender.com/player.php" --edge-kiosk-type=fullscreen --no-first-run`

For the puzzle machine/page use:

`msedge.exe --kiosk "https://YOUR-SERVICE.onrender.com/puzzle.php" --edge-kiosk-type=fullscreen --no-first-run`

For stronger restriction, configure **Windows Settings > Accounts > Other users > Kiosk (Assigned Access)** and assign Microsoft Edge to the event account. Test the exact Windows edition and keyboard before event day.

The included `javascript/kiosk-hardening.js` additionally blocks right-click, drag, F1–F12 and common browser Ctrl/Alt shortcuts inside the player/puzzle pages. It intentionally does not block mouse/touch interaction with the game.

## Pre-event test
Run a complete 60-minute rehearsal from the same laptops/network that will be used at the event. Verify Start, Stop, Refresh, hint send/clear/draft, all three sound actions, puzzle Answer timer, puzzle win overlay, automatic puzzle reset after Support Refresh, login/logout, and reconnection after temporarily disconnecting a player laptop from Wi-Fi.
