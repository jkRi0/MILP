<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

$conn = db();

try {
    $conn->query('CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_username (username)
) ENGINE=InnoDB');

    $conn->query('CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED NOT NULL,
  order_id VARCHAR(32) NOT NULL,
  part_code VARCHAR(32) NOT NULL,
  quantity DOUBLE NOT NULL,
  month CHAR(7) NOT NULL,
  priority ENUM(\'low\',\'normal\',\'high\') NOT NULL DEFAULT \'normal\',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_month (month),
  KEY idx_part_code (part_code)
) ENGINE=InnoDB');
} catch (mysqli_sql_exception $e) {
    json_out(['error' => 'Setup failed', 'details' => $e->getMessage()], 500);
}

// Seed default admin if missing.
$username = 'admin';
$defaultPass = 'admin123';

$stmt = $conn->prepare('SELECT id FROM users WHERE username = ? LIMIT 1');
$stmt->bind_param('s', $username);
$stmt->execute();
$res = $stmt->get_result();
$exists = $res->fetch_assoc();

if (!$exists) {
    $hash = password_hash($defaultPass, PASSWORD_DEFAULT);
    $created = date('Y-m-d H:i:s');

    $stmt2 = $conn->prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)');
    $stmt2->bind_param('sss', $username, $hash, $created);
    if (!$stmt2->execute()) {
        json_out(['error' => 'Failed to seed admin', 'details' => $stmt2->error], 500);
    }
}

json_out([
    'ok' => true,
    'message' => 'Setup complete. You can now login.',
    'db' => 'milp_scheduler'
]);
