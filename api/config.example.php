<?php
/**
 * ELBAKRI Hotel Rate Hub — Backend configuration
 * --------------------------------------------------------------------
 * 1. Copy this file to  config.php
 * 2. Fill in your GoDaddy / cPanel MySQL credentials
 * 3. Change APP_SECRET to a long random string
 *
 * NEVER commit config.php — it is in .gitignore.
 */

return [
    // ---- Database (cPanel MySQL) ----
    'DB_HOST' => 'localhost',
    'DB_NAME' => 'elbakri_rates',
    'DB_USER' => 'elbakri_user',
    'DB_PASS' => 'change_me',
    'DB_PORT' => 3306,
    'DB_CHARSET' => 'utf8mb4',

    // ---- Auth ----
    // Long random secret used to sign JWT tokens. Generate with:
    //   php -r "echo bin2hex(random_bytes(32));"
    'APP_SECRET' => 'CHANGE_ME_TO_A_LONG_RANDOM_STRING_32_BYTES_MIN',
    'TOKEN_TTL_HOURS' => 12,
    'COOKIE_NAME' => 'elbakri_token',
    'COOKIE_SECURE' => true,   // set false only for local http testing
    'COOKIE_SAMESITE' => 'Lax',

    // ---- CORS ----
    // Same-origin deployment needs no CORS. For split dev set the SPA origin(s):
    // e.g. ['http://localhost:5173']
    'CORS_ALLOWED_ORIGINS' => [],

    // ---- App ----
    'APP_ENV' => 'production',  // 'development' enables verbose errors
    'APP_NAME' => 'ELBAKRI Hotel Rate Hub',

    // ---- WhatsApp Cloud API (optional) ----
    'WHATSAPP_ENABLED' => false,
    'WHATSAPP_TOKEN' => '',
    'WHATSAPP_PHONE_NUMBER_ID' => '',
    'WHATSAPP_VERIFY_TOKEN' => '',
    'WHATSAPP_WHITELIST' => [],   // ['201000000000', ...]
];
