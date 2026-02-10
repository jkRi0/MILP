<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

require_auth();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$conn = db();

$me = $_SESSION['user'] ?? null;
if (!$me) {
    json_out(['error' => 'Unauthorized'], 401);
}

$is_admin = (($me['username'] ?? '') === 'admin');

if ($method === 'GET') {
    if (!$is_admin) {
        json_out(['user' => $me]);
    }

    $res = $conn->query('SELECT id, username, created_at FROM users ORDER BY id ASC');
    $rows = [];
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $rows[] = [
                'id' => (int)$row['id'],
                'username' => (string)$row['username'],
                'created_at' => (string)$row['created_at']
            ];
        }
    }
    json_out(['users' => $rows]);
}

if ($method !== 'POST') {
    json_out(['error' => 'Method not allowed'], 405);
}

$body = read_json_body();
$action = trim((string)($body['action'] ?? ''));

if ($action === 'change_password') {
    $current = (string)($body['current_password'] ?? '');
    $next = (string)($body['new_password'] ?? '');

    if ($current === '' || $next === '') {
        json_out(['error' => 'Missing current_password or new_password'], 400);
    }

    if (strlen($next) < 6) {
        json_out(['error' => 'New password must be at least 6 characters'], 400);
    }

    $stmt = $conn->prepare('SELECT password_hash FROM users WHERE id = ? LIMIT 1');
    $stmt->bind_param('i', $me['id']);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res->fetch_assoc();

    if (!$row || !password_verify($current, (string)$row['password_hash'])) {
        json_out(['error' => 'Current password is incorrect'], 401);
    }

    $hash = password_hash($next, PASSWORD_DEFAULT);
    $stmt2 = $conn->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
    $stmt2->bind_param('si', $hash, $me['id']);
    $stmt2->execute();

    json_out(['ok' => true]);
}

if ($action === 'change_username') {
    if ($is_admin) {
        json_out(['error' => 'Admin username cannot be changed'], 400);
    }

    $new_username = trim((string)($body['new_username'] ?? ''));

    if ($new_username === '') {
        json_out(['error' => 'Missing new_username'], 400);
    }

    if (!preg_match('/^[A-Za-z0-9_.-]{3,64}$/', $new_username)) {
        json_out(['error' => 'Username must be 3-64 chars (letters, numbers, _ . -)'], 400);
    }

    if (($me['username'] ?? '') === $new_username) {
        json_out(['ok' => true, 'user' => $me]);
    }

    $stmt = $conn->prepare('UPDATE users SET username = ? WHERE id = ?');
    $stmt->bind_param('si', $new_username, $me['id']);

    if (!$stmt->execute()) {
        if (($conn->errno ?? 0) === 1062) {
            json_out(['error' => 'Username already exists'], 409);
        }
        json_out(['error' => 'Failed to update username'], 500);
    }

    $_SESSION['user']['username'] = $new_username;
    $me['username'] = $new_username;

    json_out(['ok' => true, 'user' => $me]);
}

if ($action === 'create_user') {
    if (!$is_admin) {
        json_out(['error' => 'Forbidden'], 403);
    }

    $username = trim((string)($body['username'] ?? ''));
    $password = (string)($body['password'] ?? '');

    if ($username === '' || $password === '') {
        json_out(['error' => 'Missing username or password'], 400);
    }

    if (!preg_match('/^[A-Za-z0-9_.-]{3,64}$/', $username)) {
        json_out(['error' => 'Username must be 3-64 chars (letters, numbers, _ . -)'], 400);
    }

    if (strlen($password) < 6) {
        json_out(['error' => 'Password must be at least 6 characters'], 400);
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $created_at = (new DateTimeImmutable('now'))->format('Y-m-d H:i:s');

    $stmt = $conn->prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)');
    $stmt->bind_param('sss', $username, $hash, $created_at);

    if (!$stmt->execute()) {
        if (($conn->errno ?? 0) === 1062) {
            json_out(['error' => 'Username already exists'], 409);
        }
        json_out(['error' => 'Failed to create user'], 500);
    }

    json_out(['ok' => true, 'id' => (int)$conn->insert_id]);
}

json_out(['error' => 'Unknown action'], 400);
