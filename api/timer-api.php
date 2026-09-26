<?php
/*
 * Timer API (timer-api.php)
 *
 * The single source of truth for the game timer shared by the Player
 * Screen and the Support Panel. Both pages ask this file for the current
 * time about once a second; the Support Panel's Start / Stop / Refresh
 * buttons send their commands here.
 *
 *   GET                  -> current state
 *   POST action=start    -> start the countdown, or resume it after Stop
 *   POST action=stop     -> pause it where it is
 *   POST action=reset    -> back to the full duration, stopped (Refresh)
 *
 * Every response is JSON:
 *   {"status": "running" | "stopped" | "finished",
 *    "remaining": <seconds left>, "duration": <total seconds>}
 *
 * The state is saved in timer-state.json next to this file, so it
 * survives page reloads and is the same for every device.
 */

// Change this value to set the game duration in seconds (used by both screens).
// Examples: 45 * 60 = 45 minutes, 60 * 60 = 1 hour, 90 * 60 = 90 minutes.
const GAME_DURATION = 50 * 60; // 60 minutes

$stateDir = getenv('STATE_DIR') ?: __DIR__;
if (!is_dir($stateDir)) { @mkdir($stateDir, 0775, true); }
define('STATE_FILE', rtrim($stateDir, '/\\') . DIRECTORY_SEPARATOR . 'timer-state.json');

header('Content-Type: application/json');
header('Cache-Control: no-store');

// A stopped timer with the full duration left.
function freshState()
{
    return ['status' => 'stopped', 'remaining' => GAME_DURATION, 'updatedAt' => microtime(true)];
}

// Seconds left right now. A running timer stores how much was left when it
// was started, and when; the rest is worked out from the clock.
function remainingNow(array $state)
{
    if ($state['status'] !== 'running') {
        return max(0, $state['remaining']);
    }

    return max(0, $state['remaining'] - (microtime(true) - $state['updatedAt']));
}

$handle = fopen(STATE_FILE, 'c+');

if ($handle === false) {
    http_response_code(500);
    echo json_encode(['error' => 'The timer state file could not be opened.']);
    exit;
}

// Lock the file so two requests can never overwrite each other.
$isCommand = $_SERVER['REQUEST_METHOD'] === 'POST';
flock($handle, LOCK_EX);

$stored = json_decode(stream_get_contents($handle), true);
$isStored = is_array($stored) && isset($stored['status'], $stored['remaining'], $stored['updatedAt']);
$state = $isStored ? $stored : freshState();

// First ever run: save the starting state right away. Without this every
// read would invent a new updatedAt, and pages watching that value would
// think the Refresh button had just been pressed.
if (!$isStored) {
    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, json_encode($state));
    fflush($handle);
}

if ($isCommand) {
    $action = isset($_POST['action']) ? $_POST['action'] : '';
    $left = remainingNow($state);

    switch ($action) {
        case 'start':
            // Nothing to start once the time has run out; Refresh first.
            if ($state['status'] !== 'running' && $left > 0) {
                $state = ['status' => 'running', 'remaining' => $left, 'updatedAt' => microtime(true)];
            }
            break;

        case 'stop':
            if ($state['status'] === 'running') {
                $state = ['status' => 'stopped', 'remaining' => $left, 'updatedAt' => microtime(true)];
            }
            break;

        case 'reset':
            $state = freshState();
            break;

        default:
            flock($handle, LOCK_UN);
            fclose($handle);
            http_response_code(400);
            echo json_encode(['error' => 'Unknown action.']);
            exit;
    }

    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, json_encode($state));
    fflush($handle);
}

flock($handle, LOCK_UN);
fclose($handle);

$left = remainingNow($state);

echo json_encode([
    'status'    => $left <= 0 ? 'finished' : $state['status'],
    'remaining' => round($left, 3),
    'duration'  => GAME_DURATION,
    // When the timer was last started / stopped / refreshed. The puzzle
    // page uses this to notice a fresh Refresh press.
    'updatedAt' => round($state['updatedAt'], 3),
]);
