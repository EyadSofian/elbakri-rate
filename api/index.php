<?php
/**
 * ELBAKRI Hotel Rate Hub — API front controller
 * All /api/* requests funnel through here (see .htaccess).
 */

declare(strict_types=1);

require __DIR__ . '/lib/db.php';
require __DIR__ . '/lib/response.php';
require __DIR__ . '/lib/jwt.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/permissions.php';
require __DIR__ . '/lib/validate.php';
require __DIR__ . '/lib/audit.php';

foreach (glob(__DIR__ . '/routes/*.php') as $routeFile) {
    require $routeFile;
}

// ---- Error display -------------------------------------------------
$dev = config('APP_ENV') === 'development';
ini_set('display_errors', $dev ? '1' : '0');
error_reporting($dev ? E_ALL : 0);

// ---- CORS ----------------------------------------------------------
$origin  = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = config('CORS_ALLOWED_ORIGINS') ?: [];
if ($origin && in_array($origin, $allowed, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token');
}
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ---- Resolve path relative to /api --------------------------------
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$uri = rawurldecode($uri);
$scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
if ($scriptDir !== '' && strpos($uri, $scriptDir) === 0) {
    $uri = substr($uri, strlen($scriptDir));
}
$path     = trim($uri, '/');
$segments = $path === '' ? [] : explode('/', $path);
$resource = $segments[0] ?? '';
$rest     = array_slice($segments, 1);
$method   = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// ---- Dispatch ------------------------------------------------------
$routes = [
    ''               => 'route_root',
    'auth'           => 'route_auth',
    'users'          => 'route_users',
    'hotel-groups'   => 'route_hotel_groups',
    'hotels'         => 'route_hotels',
    'packages'       => 'route_packages',
    'package-hotels' => 'route_package_hotels',
    'rates'          => 'route_rates',
    'quotes'         => 'route_quotes',
    'quote-items'    => 'route_quote_items',
    'import'         => 'route_import',
    'export'         => 'route_export',
    'whatsapp'       => 'route_whatsapp',
    'lists'          => 'route_lists',
    'system-check'   => 'route_system_check',
];

try {
    $handler = $routes[$resource] ?? null;
    if (!$handler || !function_exists($handler)) {
        fail('المسار غير موجود.', 404, 'not_found', ['path' => $path]);
    }
    $handler($method, $rest, body());
    // Handlers always exit via ok()/created()/send_json.
    fail('لم يتم إرجاع استجابة.', 500, 'no_response');
} catch (ApiError $e) {
    send_json([
        'error'   => $e->errorCode,
        'message' => $e->getMessage(),
        'details' => $e->details,
    ], $e->status);
} catch (Throwable $e) {
    send_json([
        'error'   => 'server_error',
        'message' => $dev ? $e->getMessage() : 'حدث خطأ في الخادم.',
        'trace'   => $dev ? explode("\n", $e->getTraceAsString()) : null,
    ], 500);
}

// ---- Root + lists helpers -----------------------------------------
function route_root(string $method, array $seg, array $body): void
{
    ok([
        'name'    => config('APP_NAME'),
        'status'  => 'online',
        'version' => '1.0.0',
    ]);
}

function route_lists(string $method, array $seg, array $body): void
{
    require_auth();
    ok([
        'room_types'      => ROOM_TYPES,
        'meal_plans'      => MEAL_PLANS,
        'pricing_basis'   => PRICING_BASES,
        'currencies'      => CURRENCIES,
        'rate_statuses'   => RATE_STATUSES,
        'transfer_opts'   => TRANSFER_OPTS,
        'categories'      => CATEGORIES,
        'quote_statuses'  => QUOTE_STATUSES,
        'roles'           => USER_ROLES,
    ]);
}
