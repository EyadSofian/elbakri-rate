<?php
/** PDO database singleton */

function config(?string $key = null)
{
    static $cfg = null;
    if ($cfg === null) {
        $path = __DIR__ . '/../config.php';
        if (!file_exists($path)) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'error' => 'config_missing',
                'message' => 'انسخ config.example.php إلى config.php واملأ بيانات قاعدة البيانات.'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $cfg = require $path;
    }
    if ($key === null) return $cfg;
    return $cfg[$key] ?? null;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=%s',
            config('DB_HOST'),
            (int)(config('DB_PORT') ?: 3306),
            config('DB_NAME'),
            config('DB_CHARSET') ?: 'utf8mb4'
        );
        try {
            $pdo = new PDO($dsn, config('DB_USER'), config('DB_PASS'), [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
            $dev = config('APP_ENV') === 'development';
            echo json_encode([
                'error' => 'db_connection_failed',
                'message' => 'تعذّر الاتصال بقاعدة البيانات.',
                'detail' => $dev ? $e->getMessage() : null,
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }
    return $pdo;
}

/** Convenience helpers ------------------------------------------------ */

function q(string $sql, array $params = []): PDOStatement
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt;
}

function fetch_one(string $sql, array $params = []): ?array
{
    $row = q($sql, $params)->fetch();
    return $row === false ? null : $row;
}

function fetch_all(string $sql, array $params = []): array
{
    return q($sql, $params)->fetchAll();
}

function insert_id(): int
{
    return (int) db()->lastInsertId();
}

function db_column_exists(string $table, string $column): bool
{
    $row = fetch_one(
        'SELECT COUNT(*) c
           FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
        [$table, $column]
    );
    return (int)($row['c'] ?? 0) > 0;
}

function ensure_user_nav_tabs_column(): void
{
    static $done = false;
    if ($done) return;
    $done = true;
    if (!db_column_exists('users', 'nav_tabs')) {
        q('ALTER TABLE users ADD COLUMN nav_tabs TEXT NULL AFTER is_active');
    }
}
