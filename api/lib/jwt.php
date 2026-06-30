<?php
/** Minimal HS256 JWT (no external dependency) */

function b64url_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function b64url_decode(string $data): string
{
    $pad = strlen($data) % 4;
    if ($pad) $data .= str_repeat('=', 4 - $pad);
    return base64_decode(strtr($data, '-_', '+/'));
}

function jwt_encode(array $payload): string
{
    $secret = (string) config('APP_SECRET');
    $header = ['alg' => 'HS256', 'typ' => 'JWT'];
    $segments = [
        b64url_encode(json_encode($header, JSON_UNESCAPED_UNICODE)),
        b64url_encode(json_encode($payload, JSON_UNESCAPED_UNICODE)),
    ];
    $signing_input = implode('.', $segments);
    $signature = hash_hmac('sha256', $signing_input, $secret, true);
    $segments[] = b64url_encode($signature);
    return implode('.', $segments);
}

/** Returns payload array or null if invalid/expired. */
function jwt_decode(string $jwt): ?array
{
    $parts = explode('.', $jwt);
    if (count($parts) !== 3) return null;
    [$h, $p, $s] = $parts;

    $secret = (string) config('APP_SECRET');
    $expected = b64url_encode(hash_hmac('sha256', "$h.$p", $secret, true));
    if (!hash_equals($expected, $s)) return null;

    $payload = json_decode(b64url_decode($p), true);
    if (!is_array($payload)) return null;
    if (isset($payload['exp']) && time() >= (int)$payload['exp']) return null;

    return $payload;
}
