<?php
/** Authentication: login, token issue, current user resolution */

function issue_token(array $user): string
{
    $ttl = (int)(config('TOKEN_TTL_HOURS') ?: 12);
    return jwt_encode([
        'sub'   => (int)$user['id'],
        'email' => $user['email'],
        'role'  => $user['role'],
        'name'  => $user['full_name'],
        'iat'   => time(),
        'exp'   => time() + $ttl * 3600,
    ]);
}

function set_auth_cookie(string $token): void
{
    $ttl = (int)(config('TOKEN_TTL_HOURS') ?: 12);
    $params = [
        'expires'  => time() + $ttl * 3600,
        'path'     => '/',
        'httponly' => true,
        'secure'   => (bool) config('COOKIE_SECURE'),
        'samesite' => config('COOKIE_SAMESITE') ?: 'Lax',
    ];
    setcookie(config('COOKIE_NAME') ?: 'elbakri_token', $token, $params);
}

function clear_auth_cookie(): void
{
    setcookie(config('COOKIE_NAME') ?: 'elbakri_token', '', [
        'expires'  => time() - 3600,
        'path'     => '/',
        'httponly' => true,
        'secure'   => (bool) config('COOKIE_SECURE'),
        'samesite' => config('COOKIE_SAMESITE') ?: 'Lax',
    ]);
}

/** Extract bearer token from cookie or Authorization header. */
function bearer_token(): ?string
{
    $cookieName = config('COOKIE_NAME') ?: 'elbakri_token';
    if (!empty($_COOKIE[$cookieName])) return $_COOKIE[$cookieName];

    $auth = $_SERVER['HTTP_AUTHORIZATION']
        ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
        ?? ($_SERVER['HTTP_X_AUTH_TOKEN'] ?? null);
    if ($auth && preg_match('/Bearer\s+(.+)/i', $auth, $m)) return trim($m[1]);
    if ($auth) return trim($auth);
    return null;
}

/** Returns the authenticated user row, or null. Caches per request. */
function current_user(): ?array
{
    static $user = null;
    static $resolved = false;
    if ($resolved) return $user;
    $resolved = true;

    $token = bearer_token();
    if (!$token) return $user = null;
    $payload = jwt_decode($token);
    if (!$payload || empty($payload['sub'])) return $user = null;

    ensure_user_nav_tabs_column();
    $row = fetch_one('SELECT id,email,full_name,role,is_active,nav_tabs FROM users WHERE id = ?', [$payload['sub']]);
    if (!$row || (int)$row['is_active'] !== 1) return $user = null;

    $row['id'] = (int)$row['id'];
    return $user = $row;
}

/** Require an authenticated user or 401. */
function require_auth(): array
{
    $u = current_user();
    if (!$u) fail('يجب تسجيل الدخول.', 401, 'unauthenticated');
    return $u;
}

/** Require one of the given roles or 403. */
function require_role(array $roles): array
{
    $u = require_auth();
    if (!in_array($u['role'], $roles, true)) {
        fail('ليس لديك صلاحية لهذا الإجراء.', 403, 'forbidden');
    }
    return $u;
}

function do_login(string $email, string $password): array
{
    $row = fetch_one('SELECT * FROM users WHERE email = ?', [strtolower(trim($email))]);
    if (!$row || (int)$row['is_active'] !== 1 || !password_verify($password, $row['password_hash'])) {
        fail('بيانات الدخول غير صحيحة.', 401, 'invalid_credentials');
    }
    $token = issue_token($row);
    set_auth_cookie($token);
    return [
        'token' => $token,
        'user'  => [
            'id'        => (int)$row['id'],
            'email'     => $row['email'],
            'full_name' => $row['full_name'],
            'role'      => $row['role'],
        ],
    ];
}
