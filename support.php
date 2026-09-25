<?php
// support.php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Support panel is authenticated. Do this before processing any POST request,
// because Hints::addPreset() needs the logged-in user's user_id.
if (empty($_SESSION['user_id'])) {
    header('Location: login.php');
    exit;
}

require_once('models/Database.php');
require_once('models/Hints.php');

$pageTitle = 'Support Panel';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'add_preset') {
    $text = trim($_POST['new_preset_text'] ?? '');

    if ($text !== '') {
        Hints::addPreset($text);
    }

    header('Location: support.php');
    exit;
}

$presetHints = Hints::getAllPresets();
require('views/support-screen.phtml');
