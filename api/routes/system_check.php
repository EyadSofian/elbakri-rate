<?php
/** /api/system-check — health & readiness diagnostics */

function route_system_check(string $method, array $seg, array $body): void
{
    $checks = [];

    // DB connection
    try {
        db()->query('SELECT 1');
        $checks[] = ['key' => 'db_connection', 'label' => 'الاتصال بقاعدة البيانات', 'status' => 'ok'];
    } catch (Throwable $e) {
        $checks[] = ['key' => 'db_connection', 'label' => 'الاتصال بقاعدة البيانات', 'status' => 'fail', 'detail' => $e->getMessage()];
        ok(['checks' => $checks, 'generated_at' => date('c')]);
    }

    // Tables present
    $required = ['users', 'hotel_groups', 'hotels', 'packages', 'package_hotels', 'hotel_rates',
        'quotes', 'quote_items', 'user_access_rules', 'audit_logs', 'import_jobs'];
    $existing = [];
    foreach (fetch_all('SHOW TABLES') as $row) $existing[] = array_values($row)[0];
    $missing = array_values(array_diff($required, $existing));
    $checks[] = [
        'key' => 'schema', 'label' => 'جداول قاعدة البيانات',
        'status' => $missing ? 'fail' : 'ok',
        'detail' => $missing ? ('جداول ناقصة: ' . implode(', ', $missing)) : 'كل الجداول موجودة',
    ];

    // Auth session
    $u = current_user();
    $checks[] = [
        'key' => 'auth_session', 'label' => 'جلسة الدخول',
        'status' => $u ? 'ok' : 'warn',
        'detail' => $u ? ('مسجّل كـ ' . $u['email'] . ' (' . $u['role'] . ')') : 'لا توجد جلسة دخول',
    ];

    // Counts
    $count = fn($t) => (int)(fetch_one("SELECT COUNT(*) c FROM $t")['c'] ?? 0);
    $stats = [
        ['key' => 'hotels',     'label' => 'عدد الفنادق',          'status' => $count('hotels') > 0 ? 'ok' : 'warn', 'value' => $count('hotels')],
        ['key' => 'packages',   'label' => 'عدد الباقات',          'status' => $count('packages') > 0 ? 'ok' : 'warn', 'value' => $count('packages')],
        ['key' => 'ready_rates','label' => 'الأسعار الجاهزة (Ready)', 'status' => 'ok', 'value' => (int)(fetch_one("SELECT COUNT(*) c FROM hotel_rates WHERE status='Ready'")['c'] ?? 0)],
        ['key' => 'quotes',     'label' => 'عروض الأسعار',         'status' => 'ok', 'value' => $count('quotes')],
        ['key' => 'users',      'label' => 'المستخدمون',           'status' => 'ok', 'value' => $count('users')],
    ];
    foreach ($stats as $s) $checks[] = $s;

    // Quote write test (only for privileged + authenticated)
    if ($u && is_privileged($u)) {
        try {
            db()->beginTransaction();
            q("INSERT INTO quotes (quote_number, status, created_by) VALUES (?, 'draft', ?)", ['SELFTEST-' . uniqid(), $u['id']]);
            db()->rollBack();
            $checks[] = ['key' => 'quote_write', 'label' => 'اختبار الكتابة (عروض)', 'status' => 'ok', 'detail' => 'الكتابة تعمل (تم التراجع)'];
        } catch (Throwable $e) {
            if (db()->inTransaction()) db()->rollBack();
            $checks[] = ['key' => 'quote_write', 'label' => 'اختبار الكتابة (عروض)', 'status' => 'fail', 'detail' => $e->getMessage()];
        }
    }

    // PHP environment
    $checks[] = [
        'key' => 'php', 'label' => 'إصدار PHP', 'status' => version_compare(PHP_VERSION, '8.0.0', '>=') ? 'ok' : 'warn',
        'value' => PHP_VERSION,
    ];
    $checks[] = [
        'key' => 'whatsapp_env', 'label' => 'إعداد واتساب (اختياري)',
        'status' => config('WHATSAPP_ENABLED') ? 'ok' : 'warn',
        'detail' => config('WHATSAPP_ENABLED') ? 'مفعّل' : 'غير مفعّل (نسخ الرسالة يعمل)',
    ];

    ok(['checks' => $checks, 'generated_at' => date('c')]);
}
