<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$conn = db();

require_auth();

function now_str(): string {
    return date('Y-m-d H:i:s');
}

function json_decode_assoc(string $raw) {
    $v = json_decode($raw, true);
    return is_array($v) ? $v : null;
}

if ($method === 'GET') {
    if (isset($_GET['id'])) {
        $id = (int)$_GET['id'];
        if ($id <= 0) json_out(['error' => 'Missing id'], 400);

        $stmt = $conn->prepare('SELECT id, user_id, note, base_year, before_orders_json, after_orders_json, before_util_json, after_util_json, created_at FROM optimize_history WHERE id = ?');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $res = $stmt->get_result();
        $row = $res->fetch_assoc();
        if (!$row) json_out(['error' => 'Not found'], 404);

        $row['id'] = (int)$row['id'];
        $row['user_id'] = $row['user_id'] !== null ? (int)$row['user_id'] : null;
        $row['base_year'] = (int)$row['base_year'];
        json_out(['history' => $row]);
    }

    $limit = 50;
    if (isset($_GET['limit'])) {
        $limit = (int)$_GET['limit'];
        if ($limit <= 0) $limit = 50;
        if ($limit > 200) $limit = 200;
    }

    $stmt = $conn->prepare('SELECT id, user_id, note, base_year, created_at FROM optimize_history ORDER BY created_at DESC LIMIT ?');
    $stmt->bind_param('i', $limit);
    $stmt->execute();
    $res = $stmt->get_result();

    $rows = [];
    while ($r = $res->fetch_assoc()) {
        $r['id'] = (int)$r['id'];
        $r['user_id'] = $r['user_id'] !== null ? (int)$r['user_id'] : null;
        $r['base_year'] = (int)$r['base_year'];
        $rows[] = $r;
    }

    json_out(['history' => $rows]);
}

$body = read_json_body();

if ($method === 'POST') {
    $action = trim((string)($body['action'] ?? 'create'));

    if ($action === 'create') {
        $note = trim((string)($body['note'] ?? ''));
        $base_year = isset($body['base_year']) ? (int)$body['base_year'] : 0;
        $before_orders_json = (string)($body['before_orders_json'] ?? '');
        $after_orders_json = (string)($body['after_orders_json'] ?? '');
        $before_util_json = (string)($body['before_util_json'] ?? '');
        $after_util_json = (string)($body['after_util_json'] ?? '');

        if ($base_year <= 0 || $before_orders_json === '' || $after_orders_json === '') {
            json_out(['error' => 'Invalid payload'], 400);
        }

        $user_id = isset($_SESSION['user']['id']) ? (int)$_SESSION['user']['id'] : null;
        $created_at = now_str();

        $stmt = $conn->prepare('INSERT INTO optimize_history (user_id, note, base_year, before_orders_json, after_orders_json, before_util_json, after_util_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->bind_param(
            'isisssss',
            $user_id,
            $note,
            $base_year,
            $before_orders_json,
            $after_orders_json,
            $before_util_json,
            $after_util_json,
            $created_at
        );

        if (!$stmt->execute()) {
            json_out(['error' => 'Insert failed', 'details' => $stmt->error], 500);
        }

        json_out(['ok' => true, 'id' => (int)$stmt->insert_id], 201);
    }

    if ($action === 'restore') {
        $id = isset($body['id']) ? (int)$body['id'] : 0;
        $version = trim((string)($body['version'] ?? 'after'));
        if ($id <= 0) json_out(['error' => 'Missing id'], 400);
        if ($version !== 'before' && $version !== 'after') json_out(['error' => 'Invalid version'], 400);

        $stmt = $conn->prepare('SELECT before_orders_json, after_orders_json FROM optimize_history WHERE id = ?');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $res = $stmt->get_result();
        $row = $res->fetch_assoc();
        if (!$row) json_out(['error' => 'Not found'], 404);

        $raw = (string)($version === 'before' ? $row['before_orders_json'] : $row['after_orders_json']);
        $orders = json_decode_assoc($raw);
        if (!is_array($orders)) json_out(['error' => 'Invalid snapshot JSON'], 500);

        $ids = [];
        foreach ($orders as $o) {
            if (!is_array($o)) continue;
            $oid = isset($o['id']) ? (int)$o['id'] : 0;
            if ($oid > 0) $ids[] = $oid;
        }
        $ids = array_values(array_unique($ids));
        if (count($ids) === 0) json_out(['error' => 'Snapshot empty'], 500);

        $conn->begin_transaction();
        try {
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $types = str_repeat('i', count($ids));
            $stmtDel = $conn->prepare("DELETE FROM orders WHERE id NOT IN ($placeholders)");
            $stmtDel->bind_param($types, ...$ids);
            if (!$stmtDel->execute()) {
                throw new Exception('Delete failed: ' . $stmtDel->error);
            }

            $stmtUp = $conn->prepare('INSERT INTO orders (id, order_id, part_code, quantity, month, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE order_id = VALUES(order_id), part_code = VALUES(part_code), quantity = VALUES(quantity), month = VALUES(month), priority = VALUES(priority), created_at = VALUES(created_at), updated_at = VALUES(updated_at)');

            $updated_at = now_str();
            foreach ($orders as $o) {
                if (!is_array($o)) continue;
                $oid = isset($o['id']) ? (int)$o['id'] : 0;
                if ($oid <= 0) continue;

                $order_id = trim((string)($o['order_id'] ?? ''));
                $part_code = trim((string)($o['part_code'] ?? ''));
                $quantity = (float)($o['quantity'] ?? 0);
                $month = trim((string)($o['month'] ?? ''));
                $priority = trim((string)($o['priority'] ?? 'normal'));
                $created_at = trim((string)($o['created_at'] ?? ($o['createdAt'] ?? '')));
                if ($created_at === '') $created_at = $updated_at;

                if ($order_id === '' || $part_code === '' || $quantity <= 0 || $month === '') {
                    continue;
                }

                $stmtUp->bind_param('issdssss', $oid, $order_id, $part_code, $quantity, $month, $priority, $created_at, $updated_at);
                if (!$stmtUp->execute()) {
                    throw new Exception('Upsert failed: ' . $stmtUp->error);
                }
            }

            $conn->commit();
        } catch (Throwable $e) {
            $conn->rollback();
            json_out(['error' => 'Restore failed', 'details' => $e->getMessage()], 500);
        }

        json_out(['ok' => true]);
    }

    json_out(['error' => 'Unknown action'], 400);
}

json_out(['error' => 'Method not allowed'], 405);
