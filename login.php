<?php
// login.php

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once('models/Database.php');

$pageTitle = 'Login';
$error = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';

    if (empty($username) || empty($password)) {
        $error = 'Please enter both username and password.';
    } else {
        $pdo = Database::getConnection();

        $stmt = $pdo->prepare('SELECT user_id, username, password FROM users WHERE LOWER(username) = LOWER(:username)');
        $stmt->execute(['username' => $username]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($user && password_verify($password, $user['password'])) {
            session_regenerate_id(true);
            $_SESSION['user_id'] = $user['user_id'];
            $_SESSION['username'] = $user['username'];

            header('Location: support.php');
            exit;
        } else {
            $error = 'Invalid username or password.';
        }
    }
}

// Handle logout
if (isset($_GET['action']) && $_GET['action'] === 'logout') {
    session_unset();
    session_destroy();
    header('Location: login.php');
    exit;
}

require('views/login.phtml');