<?php
/*
 * Hint API (hint-api.php)
 *
 * Carries a hint from the Support Panel to the Player Screen, the same
 * way timer-api.php carries the timer.
 *
 *   GET                       -> the hint that is showing right now
 *   POST action=send
 *        hint_text=...        -> send a hint to the Player Screen
 *   POST action=clear         -> take the hint off the screen early
 *
 * A hint stays on the Player Screen for HINT_DURATION seconds and then
 * disappears by itself.
 *
 * Every response is JSON:
 *   {"text": "<hint>" | null, "sentAt": <id>, "remaining": <seconds>,
 *    "duration": <seconds>}
 *
 * "sentAt" doubles as the hint's id: when the Player Screen sees a new
 * one it knows this is a fresh hint and plays the notification sound.
 *
 * The state is saved in hint-state.json next to this file.
 */

// Change this value to set how long a hint stays on the Player Screen.
const HINT_DURATION = 2 * 60; // 2 minutes

// Longest hint accepted, in characters.
const HINT_MAX_LENGTH = 300;

const HINT_STATE_FILE = __DIR__ . '/hint-state.json';

header('Content-Type: application/json');
header('Cache-Control: no-store');

// No hint on screen.
function emptyHint()
{
    return ['text' => '', 'sentAt' => 0.0, 'draft' => ''];
}

// Seconds this hint still has to run.
function hintRemaining(array $state)
{
    if ($state['text'] === '' || $state['sentAt'] <= 0) {
        return 0;
    }

    return max(0, HINT_DURATION - (microtime(true) - $state['sentAt']));
}

$handle = fopen(HINT_STATE_FILE, 'c+');

if ($handle === false) {
    http_response_code(500);
    echo json_encode(['error' => 'The hint state file could not be opened.']);
    exit;
}

// Lock the file so two hints sent at once cannot overwrite each other.
$isCommand = $_SERVER['REQUEST_METHOD'] === 'POST';
flock($handle, $isCommand ? LOCK_EX : LOCK_SH);

$stored = json_decode(stream_get_contents($handle), true);
$state = (is_array($stored) && isset($stored['text'], $stored['sentAt']))
    ? $stored
    : emptyHint();

if (!isset($state['draft'])) {
    $state['draft'] = '';
}

if ($isCommand) {
    $action = isset($_POST['action']) ? $_POST['action'] : '';

    switch ($action) {
        case 'send':
            $text = isset($_POST['hint_text']) ? trim($_POST['hint_text']) : '';

            // Plain text only: the Player Screen prints it as text, never as markup.
            $text = strip_tags($text);

            if (function_exists('mb_substr')) {
                $text = mb_substr($text, 0, HINT_MAX_LENGTH);
            } else {
                $text = substr($text, 0, HINT_MAX_LENGTH);
            }

            if ($text === '') {
                flock($handle, LOCK_UN);
                fclose($handle);
                http_response_code(400);
                echo json_encode(['error' => 'The hint was empty.']);
                exit;
            }

            $state = ['text' => $text, 'sentAt' => microtime(true)];
            $state['draft'] = '';   // <-- new line
            break;

        case 'clear':
            $state = emptyHint();
            break;

        case 'draft':
            $draftText = isset($_POST['hint_text']) ? trim($_POST['hint_text']) : '';
            $draftText = strip_tags($draftText);
            $draftText = function_exists('mb_substr')
                ? mb_substr($draftText, 0, HINT_MAX_LENGTH)
                : substr($draftText, 0, HINT_MAX_LENGTH);

            $state['draft'] = $draftText; // empty string is allowed here — that's how it gets cleared
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

$left = hintRemaining($state);

echo json_encode([
    'text'      => $left > 0 ? $state['text'] : null,
    'sentAt'    => $left > 0 ? $state['sentAt'] : 0,
    'remaining' => round($left, 3),
    'duration'  => HINT_DURATION,
    'draft'     => $state['draft'],
]);
