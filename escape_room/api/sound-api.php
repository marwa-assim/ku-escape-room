<?php
/*
 * Sound API (sound-api.php)
 *
 * Lets the Support Panel play a sound on the Player Screen, the same way
 * hint-api.php carries a hint.
 *
 *   GET                       -> the last sound that was triggered
 *   POST action=play
 *        sound=congratulation -> cheering and applause
 *        sound=warning        -> warning siren
 *        sound=failed         -> sad trombone
 *
 * Every response is JSON:
 *   {"sound": "congratulation" | "warning" | "failed" | null, "sentAt": <id>}
 *
 * "sentAt" is the id: the Player Screen remembers the last one it saw and
 * plays the sound only when a newer one appears, so a sound is never
 * repeated by the once-a-second polling.
 *
 * The state is saved in sound-state.json next to this file.
 */

// Sounds the Player Screen knows how to play
const ALLOWED_SOUNDS = ['congratulation', 'warning', 'failed'];

const SOUND_STATE_FILE = __DIR__ . '/sound-state.json';

header('Content-Type: application/json');
header('Cache-Control: no-store');

// Nothing has been triggered yet
function noSound()
{
    return ['sound' => '', 'sentAt' => 0.0];
}

$handle = fopen(SOUND_STATE_FILE, 'c+');

if ($handle === false) {
    http_response_code(500);
    echo json_encode(['error' => 'The sound state file could not be opened.']);
    exit;
}

$isCommand = $_SERVER['REQUEST_METHOD'] === 'POST';
flock($handle, LOCK_EX);

$stored = json_decode(stream_get_contents($handle), true);
$isStored = is_array($stored) && isset($stored['sound'], $stored['sentAt']);
$state = $isStored ? $stored : noSound();

// First ever run: save the empty state so the file is never left blank
if (!$isStored) {
    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, json_encode($state));
    fflush($handle);
}

if ($isCommand) {
    $action = isset($_POST['action']) ? $_POST['action'] : '';
    $sound = isset($_POST['sound']) ? $_POST['sound'] : '';

    if ($action !== 'play' || !in_array($sound, ALLOWED_SOUNDS, true)) {
        flock($handle, LOCK_UN);
        fclose($handle);
        http_response_code(400);
        echo json_encode(['error' => 'Unknown action or sound.']);
        exit;
    }

    $state = ['sound' => $sound, 'sentAt' => microtime(true)];

    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, json_encode($state));
    fflush($handle);
}

flock($handle, LOCK_UN);
fclose($handle);

echo json_encode([
    'sound'  => $state['sound'] !== '' ? $state['sound'] : null,
    'sentAt' => $state['sentAt'],
]);
