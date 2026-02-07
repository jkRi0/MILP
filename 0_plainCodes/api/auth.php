<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$conn = db();

if ($method === 'GET') {
    if (isset($_SESSION['user'])) {
        json_out(['user' => $_SESSION['user']]);
    }
    json_out(['user' => null]);
}

$body = read_json_body();

if ($method === 'POST') {
    $action = trim((string)($body['action'] ?? 'login'));

    if ($action === 'logout') {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
        }
        session_destroy();
        json_out(['ok' => true]);
    }

    $username = trim((string)($body['username'] ?? ''));
    $password = (string)($body['password'] ?? '');

    if ($username === '' || $password === '') {
        json_out(['error' => 'Missing username or password'], 400);
    }

    $stmt = $conn->prepare('SELECT id, username, password_hash FROM users WHERE username = ? LIMIT 1');
    $stmt->bind_param('s', $username);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res->fetch_assoc();

    if (!$row) {
        json_out(['error' => 'Invalid credentials'], 401);
    }

    if (!password_verify($password, (string)$row['password_hash'])) {
        json_out(['error' => 'Invalid credentials'], 401);
    }

    $_SESSION['user'] = [
        'id' => (int)$row['id'],
        'username' => (string)$row['username']
    ];

    json_out(['ok' => true, 'user' => $_SESSION['user']]);
}

json_out(['error' => 'Method not allowed'], 405);
