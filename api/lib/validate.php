<?php
/** Lightweight input validation / coercion helpers */

function v_str($val, ?int $max = null): ?string
{
    if ($val === null) return null;
    if (is_array($val)) return null;
    $s = trim((string)$val);
    if ($s === '') return null;
    if ($max !== null && mb_strlen($s) > $max) $s = mb_substr($s, 0, $max);
    return $s;
}

function v_required(array $data, string $key, string $label): string
{
    $val = v_str($data[$key] ?? null);
    if ($val === null) fail("الحقل \"$label\" مطلوب.", 422, 'validation', [$key => 'required']);
    return $val;
}

function v_int($val): ?int
{
    if ($val === null || $val === '') return null;
    if (!is_numeric($val)) return null;
    return (int)$val;
}

function v_num($val): ?float
{
    if ($val === null || $val === '') return null;
    if (!is_numeric($val)) return null;
    return (float)$val;
}

function v_bool($val): int
{
    if (is_bool($val)) return $val ? 1 : 0;
    if (in_array($val, [1, '1', 'true', 'yes', 'on'], true)) return 1;
    return 0;
}

/** Accepts YYYY-MM-DD (or empty). Returns normalized date or null. */
function v_date($val): ?string
{
    $s = v_str($val);
    if ($s === null) return null;
    $s = substr($s, 0, 10);
    $d = DateTime::createFromFormat('Y-m-d', $s);
    if (!$d || $d->format('Y-m-d') !== $s) {
        fail("تاريخ غير صحيح: $s (الصيغة المطلوبة YYYY-MM-DD).", 422, 'validation');
    }
    return $s;
}

function v_enum($val, array $allowed, $default = null)
{
    $s = v_str($val);
    if ($s === null) return $default;
    if (!in_array($s, $allowed, true)) {
        fail("قيمة غير مسموحة: $s. المسموح: " . implode(', ', $allowed), 422, 'validation');
    }
    return $s;
}

/** Canonical lists (single source of truth, mirrored on the frontend). */
const ROOM_TYPES     = ['Single', 'Double', 'Triple', 'Quad', 'Family', 'Custom'];
const MEAL_PLANS     = ['RO', 'BB', 'HB', 'FB', 'AI', 'SAI', 'UAI'];
const PRICING_BASES  = ['per_person_per_night', 'per_room_per_night', 'per_person_package', 'per_room_package'];
const CURRENCIES     = ['EGP', 'USD', 'EUR', 'SAR'];
const RATE_STATUSES  = ['Draft', 'Ready', 'Archived'];
const TRANSFER_OPTS  = ['Included', 'Optional', 'Not Included'];
const CATEGORIES     = ['Hotel', 'Package', 'Select', 'Premium', 'Elite', 'Honeymoon', 'Trip', 'Transfer'];
const QUOTE_STATUSES = ['draft', 'ready', 'sent', 'archived'];
const USER_ROLES     = ['admin', 'operations', 'sales', 'viewer'];
