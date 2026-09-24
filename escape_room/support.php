<?php

// support.php
$pageTitle = 'Support Panel';

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