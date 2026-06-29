<?php
/** /api/whatsapp  — formatted Arabic message (copy) + optional Cloud API */

function wa_meal(string $m): string
{
    return [
        'RO' => 'بدون وجبات', 'BB' => 'إفطار', 'HB' => 'نصف إقامة',
        'FB' => 'إقامة كاملة', 'AI' => 'شامل', 'SAI' => 'سوفت أول إنكلوسيف', 'UAI' => 'شامل فاخر',
    ][$m] ?? $m;
}

function wa_room(string $r): string
{
    return [
        'Single' => 'غرفة فردية', 'Double' => 'غرفة مزدوجة', 'Triple' => 'غرفة ثلاثية',
        'Quad' => 'غرفة رباعية', 'Family' => 'غرفة عائلية',
    ][$r] ?? $r;
}

function wa_basis(string $b): string
{
    return [
        'per_person_per_night' => 'للفرد/الليلة', 'per_room_per_night' => 'للغرفة/الليلة',
        'per_person_package' => 'للفرد/الباقة', 'per_room_package' => 'للغرفة/الباقة',
    ][$b] ?? $b;
}

function wa_date(?string $d): string
{
    if (!$d) return '—';
    $t = DateTime::createFromFormat('Y-m-d', substr($d, 0, 10));
    return $t ? $t->format('d/m/Y') : $d;
}

function build_whatsapp_text(array $items, ?string $clientName, ?string $title, ?string $notes): string
{
    $lines = [];
    $lines[] = '*ELBAKRI OVERSEAS FOR TRAVEL*';
    $lines[] = 'عرض سعر' . ($clientName ? ' مقدم إلى: ' . $clientName : ($title ? ': ' . $title : ''));
    $lines[] = '────────────────';

    foreach ($items as $i => $r) {
        $price = $r['adult_price'] !== null && $r['adult_price'] !== ''
            ? number_format((float)$r['adult_price'], 0) . ' ' . ($r['currency'] ?? 'EGP')
            : 'حسب الطلب';
        $lines[] = '🏨 ' . ($r['hotel_name'] ?? '');
        if (!empty($r['package_name'])) $lines[] = '📦 ' . $r['package_name'];
        if (!empty($r['region']))       $lines[] = '📍 ' . $r['region'] . (!empty($r['sub_region']) ? ' - ' . $r['sub_region'] : '');
        if ($r['date_from'] || $r['date_to']) $lines[] = '🗓 الفترة: ' . wa_date($r['date_from'] ?? null) . ' إلى ' . wa_date($r['date_to'] ?? null);
        $lines[] = '🛏 ' . wa_room((string)($r['room_type'] ?? '')) . ' - ' . wa_meal((string)($r['meal_plan'] ?? ''));
        $lines[] = '💰 السعر: ' . $price . ' (' . wa_basis((string)($r['pricing_basis'] ?? '')) . ')';
        if (($r['transfer_included'] ?? '') === 'Included') $lines[] = '🚐 الانتقالات: مشمولة';
        if (!empty($r['child_policy'])) $lines[] = '👶 ' . mb_substr($r['child_policy'], 0, 120);
        if (!empty($r['custom_note']))  $lines[] = '📝 ' . $r['custom_note'];
        if ($i < count($items) - 1) $lines[] = '────────────────';
    }

    $lines[] = '════════════════';
    if ($notes) $lines[] = '📌 ' . $notes;
    $lines[] = 'الأسعار قابلة للتغيير حسب التوافر. برجاء التأكيد قبل الحجز.';
    $lines[] = '*ELBAKRI OVERSEAS FOR TRAVEL*';
    return implode("\n", $lines);
}

function route_whatsapp(string $method, array $seg, array $body): void
{
    $action = $seg[0] ?? '';

    // Webhook verification for Cloud API (optional)
    if ($action === 'webhook' && $method === 'GET') {
        $mode = $_GET['hub_mode'] ?? ($_GET['hub.mode'] ?? '');
        $token = $_GET['hub_verify_token'] ?? ($_GET['hub.verify_token'] ?? '');
        $challenge = $_GET['hub_challenge'] ?? ($_GET['hub.challenge'] ?? '');
        if ($mode === 'subscribe' && $token === config('WHATSAPP_VERIFY_TOKEN')) {
            header('Content-Type: text/plain'); echo $challenge; exit;
        }
        fail('verification failed', 403, 'forbidden');
    }

    $user = require_auth();

    if ($action === 'copy-template' && $method === 'POST') {
        if (!can_export($user)) fail('ليس لديك صلاحية.', 403, 'forbidden');

        $items = []; $clientName = null; $title = null; $notes = null;

        if (!empty($body['quote_id'])) {
            $quote = fetch_one('SELECT * FROM quotes WHERE id = ?', [(int)$body['quote_id']]);
            if (!$quote) fail('عرض السعر غير موجود.', 404, 'not_found');
            if (!can_access_quote($user, $quote)) fail('لا تملك صلاحية لهذا العرض.', 403, 'forbidden');
            $items = fetch_all(
                'SELECT r.*, qi.custom_note FROM quote_items qi JOIN hotel_rates r ON r.id = qi.hotel_rate_id
                 WHERE qi.quote_id = ? ORDER BY qi.sort_order, qi.id',
                [$quote['id']]
            );
            $clientName = $quote['client_name'];
            $notes = $quote['client_notes'];
        } elseif (!empty($body['rate_ids']) && is_array($body['rate_ids'])) {
            $ids = array_values(array_filter(array_map('intval', $body['rate_ids'])));
            if (empty($ids)) fail('لا توجد أسعار.', 422, 'validation');
            [$visSql, $visParams] = rates_visibility($user, 'r');
            $place = implode(',', array_fill(0, count($ids), '?'));
            $items = fetch_all("SELECT r.* FROM hotel_rates r WHERE r.id IN ($place) AND $visSql", array_merge($ids, $visParams));
            $title = v_str($body['title'] ?? null, 190);
            $notes = v_str($body['notes'] ?? null);
        } else {
            fail('حدد quote_id أو rate_ids.', 422, 'validation');
        }

        if (empty($items)) fail('لا توجد عناصر متاحة.', 422, 'validation');
        $text = build_whatsapp_text($items, $clientName, $title, $notes);

        if (!empty($body['quote_id'])) {
            try { q('INSERT INTO whatsapp_message_logs (phone, direction, message, quote_id) VALUES (?,?,?,?)',
                [null, 'out', $text, (int)$body['quote_id']]); } catch (Throwable $e) {}
        }
        ok(['text' => $text]);
    }

    if ($action === 'send' && $method === 'POST') {
        if (!config('WHATSAPP_ENABLED')) {
            fail('خدمة واتساب غير مفعّلة. استخدم نسخ الرسالة بدلاً من ذلك.', 400, 'whatsapp_disabled');
        }
        // Cloud API send would go here (token never exposed to frontend).
        fail('إرسال واتساب عبر الـ API غير منفّذ في هذه النسخة.', 501, 'not_implemented');
    }

    fail('مسار غير صحيح.', 404, 'not_found');
}
