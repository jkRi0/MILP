<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

// Simple CRUD for orders.
// - GET:    list orders (optional ?month=YYYY-MM)
// - POST:   create order (expects JSON body)
// - PUT:    update order by id (expects JSON body)
// - DELETE: delete order by id (expects JSON body or ?id=)

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$conn = db();

require_auth();

$me = $_SESSION['user'] ?? null;
$me_username = is_array($me) ? (string)($me['username'] ?? '') : '';

if ($method === 'GET') {
    $month = isset($_GET['month']) ? trim((string)$_GET['month']) : '';

    if ($month !== '') {
        $stmt = $conn->prepare('SELECT id, order_id, part_code, quantity, month, priority, created_by, created_at, updated_at FROM orders WHERE month = ? ORDER BY created_at DESC');
        $stmt->bind_param('s', $month);
    } else {
        $stmt = $conn->prepare('SELECT id, order_id, part_code, quantity, month, priority, created_by, created_at, updated_at FROM orders ORDER BY created_at DESC');
    }

    $stmt->execute();
    $res = $stmt->get_result();
    $rows = [];
    while ($r = $res->fetch_assoc()) {
        $r['id'] = (int)$r['id'];
        $r['quantity'] = (float)$r['quantity'];
        $rows[] = $r;
    }
    json_out(['orders' => $rows]);
}

$body = read_json_body();

if ($method === 'POST') {
    $id = isset($body['id']) ? (int)$body['id'] : 0;
    $order_id = trim((string)($body['order_id'] ?? ''));
    $part_code = trim((string)($body['part_code'] ?? ''));
    $quantity = (float)($body['quantity'] ?? 0);
    $month = trim((string)($body['month'] ?? ''));
    $priority = trim((string)($body['priority'] ?? 'normal'));
    $created_at = trim((string)($body['created_at'] ?? ''));

    if ($id <= 0 || $order_id === '' || $part_code === '' || $quantity <= 0 || $month === '') {
        json_out(['error' => 'Invalid payload'], 400);
    }

    $created = $created_at !== '' ? $created_at : date('Y-m-d H:i:s');
    $updated = date('Y-m-d H:i:s');

    $created_by = $me_username !== '' ? $me_username : 'unknown';

    $stmt = $conn->prepare('INSERT INTO orders (id, order_id, part_code, quantity, month, priority, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->bind_param('issdsssss', $id, $order_id, $part_code, $quantity, $month, $priority, $created_by, $created, $updated);

    if (!$stmt->execute()) {
        json_out(['error' => 'Insert failed', 'details' => $stmt->error], 500);
    }

    json_out(['ok' => true, 'id' => $id], 201);
}

if ($method === 'PUT') {
    $id = isset($body['id']) ? (int)$body['id'] : 0;
    if ($id <= 0) json_out(['error' => 'Missing id'], 400);

    $order_id = trim((string)($body['order_id'] ?? ''));
    $part_code = trim((string)($body['part_code'] ?? ''));
    $quantity = (float)($body['quantity'] ?? 0);
    $month = trim((string)($body['month'] ?? ''));
    $priority = trim((string)($body['priority'] ?? 'normal'));

    if ($order_id === '' || $part_code === '' || $quantity <= 0 || $month === '') {
        json_out(['error' => 'Invalid payload'], 400);
    }

    $updated = date('Y-m-d H:i:s');
    $stmt = $conn->prepare('UPDATE orders SET order_id = ?, part_code = ?, quantity = ?, month = ?, priority = ?, updated_at = ? WHERE id = ?');
    $stmt->bind_param('ssdsssi', $order_id, $part_code, $quantity, $month, $priority, $updated, $id);

    if (!$stmt->execute()) {
        json_out(['error' => 'Update failed', 'details' => $stmt->error], 500);
    }

    json_out(['ok' => true]);
}

if ($method === 'DELETE') {
    $id = 0;
    if (isset($_GET['id'])) {
        $id = (int)$_GET['id'];
    } elseif (isset($body['id'])) {
        $id = (int)$body['id'];
    }

    if ($id <= 0) json_out(['error' => 'Missing id'], 400);

    $stmt = $conn->prepare('DELETE FROM orders WHERE id = ?');
    $stmt->bind_param('i', $id);

    if (!$stmt->execute()) {
        json_out(['error' => 'Delete failed', 'details' => $stmt->error], 500);
    }

    json_out(['ok' => true]);
}

json_out(['error' => 'Method not allowed'], 405);
