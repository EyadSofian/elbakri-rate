<?php
/** /api/whatsapp  — formatted bilingual message (copy) + optional Cloud API.
 *  The message mirrors the visual export grouping: hotel → period → rooms,
 *  so a hotel is never repeated and prices stay readable. */

function wa_t(string $lang, string $key): string
{
    $dict = [
        'ar' => [
            'offer' => 'عرض سعر', 'presentedTo' => 'مقدم إلى', 'period' => 'الفترة',
            'allPeriods' => 'كل الفترات', 'to' => 'إلى', 'transfers' => 'الانتقالات',
            'included' => 'مشمولة', 'children' => 'سياسة الأطفال', 'notes' => 'ملاحظات',
            'onRequest' => 'حسب الطلب', 'perPerson' => 'للفرد', 'perRoom' => 'للغرفة',
            'terms' => 'الأسعار قابلة للتغيير حسب التوافر. برجاء التأكيد قبل الحجز.',
        ],
        'en' => [
            'offer' => 'Price Offer', 'presentedTo' => 'Presented to', 'period' => 'Period',
            'allPeriods' => 'All periods', 'to' => 'to', 'transfers' => 'Transfers',
            'included' => 'Included', 'children' => 'Child policy', 'notes' => 'Notes',
            'onRequest' => 'On request', 'perPerson' => 'per person', 'perRoom' => 'per room',
            'terms' => 'Prices are subject to availability. Please confirm before booking.',
        ],
    ];
    return $dict[$lang][$key] ?? $dict['ar'][$key] ?? $key;
}

function wa_meal(string $m, string $lang): string
{
    $ar = ['RO' => 'بدون وجبات', 'BB' => 'إفطار', 'HB' => 'نصف إقامة', 'FB' => 'إقامة كاملة', 'AI' => 'شامل', 'UAI' => 'شامل فاخر'];
    $en = ['RO' => 'Room Only', 'BB' => 'Bed & Breakfast', 'HB' => 'Half Board', 'FB' => 'Full Board', 'AI' => 'All Inclusive', 'UAI' => 'Ultra All Inclusive'];
    return ($lang === 'en' ? $en : $ar)[$m] ?? $m;
}

function wa_room(string $r, string $lang): string
{
    $ar = ['Single' => 'فردية', 'Double' => 'مزدوجة', 'Triple' => 'ثلاثية', 'Quad' => 'رباعية', 'Family' => 'عائلية', 'Custom' => 'مخصصة'];
    if ($lang === 'en') return $r;
    return $ar[$r] ?? $r;
}

function wa_basis_per(string $b, string $lang): string
{
    $perRoom = ($b === 'per_room_per_night' || $b === 'per_room_package');
    return wa_t($lang, $perRoom ? 'perRoom' : 'perPerson');
}

function wa_date(?string $d): string
{
    if (!$d) return '—';
    $t = DateTime::createFromFormat('Y-m-d', substr($d, 0, 10));
    return $t ? $t->format('d/m/Y') : $d;
}

function wa_clean($v): ?string
{
    $s = trim((string)($v ?? ''));
    return $s === '' ? null : $s;
}

/** Group rate rows hotel → period → rooms (mirrors lib/grouping.ts). */
function wa_group(array $items): array
{
    $hotels = [];
    foreach ($items as $r) {
        $hid = $r['hotel_id'] ?? null;
        $hkey = $hid !== null ? 'id:' . $hid : 'name:' . ($r['hotel_name'] ?? '');
        if (!isset($hotels[$hkey])) {
            $hotels[$hkey] = [
                'hotel_id'     => $hid,
                'hotel_name'   => $r['hotel_name'] ?? '',
                'region'       => wa_clean($r['region'] ?? null),
                'sub_region'   => wa_clean($r['sub_region'] ?? null),
                'package_id'   => $r['package_id'] ?? null,
                'package_name' => wa_clean($r['package_name'] ?? null),
                'periods'      => [],
            ];
        } elseif (($hotels[$hkey]['package_id'] ?? null) !== ($r['package_id'] ?? null)) {
            $hotels[$hkey]['package_id'] = null;
            $hotels[$hkey]['package_name'] = null;
        }
        $pkey = ($r['date_from'] ?? '') . '|' . ($r['date_to'] ?? '') . '|' . ($r['meal_plan'] ?? '');
        if (!isset($hotels[$hkey]['periods'][$pkey])) {
            $hotels[$hkey]['periods'][$pkey] = [
                'date_from'    => $r['date_from'] ?? null,
                'date_to'      => $r['date_to'] ?? null,
                'meal_plan'    => $r['meal_plan'] ?? '',
                'transfer'     => $r['transfer_included'] ?? null,
                'child_policy' => wa_clean($r['child_policy'] ?? null),
                'rooms'        => [],
            ];
        }
        $hotels[$hkey]['periods'][$pkey]['rooms'][] = $r;
    }
    return $hotels;
}

function build_whatsapp_text(array $items, ?string $clientName, ?string $title, ?string $notes, string $lang = 'ar'): string
{
    $hotels = wa_group($items);

    // Offer-level title: package → package name; single hotel → "عرض سعر {hotel}".
    $packageIds = array_unique(array_map(fn($r) => $r['package_id'] ?? null, $items));
    $isPackage = count($packageIds) === 1 && reset($packageIds) !== null;
    $packageName = null;
    if ($isPackage) {
        foreach ($items as $r) { if (wa_clean($r['package_name'] ?? null)) { $packageName = $r['package_name']; break; } }
    }
    $headline = $title;
    if (!$headline) {
        if ($isPackage && $packageName) {
            $headline = $packageName;
        } elseif (count($hotels) === 1) {
            $only = reset($hotels);
            $headline = wa_t($lang, 'offer') . ' ' . $only['hotel_name'];
        }
    }

    $lines = [];
    $lines[] = '*ELBAKRI OVERSEAS FOR TRAVEL*';
    $lines[] = '*' . ($headline ?: wa_t($lang, 'offer')) . '*';
    if ($clientName) $lines[] = wa_t($lang, 'presentedTo') . ': ' . $clientName;
    $lines[] = '────────────────';

    $hi = 0;
    $hotelCount = count($hotels);
    foreach ($hotels as $h) {
        $lines[] = '🏨 *' . $h['hotel_name'] . '*';
        if ($isPackage && $h['package_name']) $lines[] = '📦 ' . $h['package_name'];
        $loc = $h['region'] . ($h['sub_region'] ? ' - ' . $h['sub_region'] : '');
        if (trim($loc) !== '') $lines[] = '📍 ' . $loc;

        // Shared child policy → show once under the hotel.
        $policies = array_values(array_unique(array_filter(array_map(fn($p) => $p['child_policy'], $h['periods']))));
        $sharedChild = count($policies) === 1 ? $policies[0] : null;

        foreach ($h['periods'] as $p) {
            $when = ($p['date_from'] || $p['date_to'])
                ? wa_date($p['date_from']) . ' ' . wa_t($lang, 'to') . ' ' . wa_date($p['date_to'])
                : wa_t($lang, 'allPeriods');
            $lines[] = '🗓 ' . wa_t($lang, 'period') . ': ' . $when . ' · ' . wa_meal((string)$p['meal_plan'], $lang);
            foreach ($p['rooms'] as $r) {
                $price = ($r['adult_price'] !== null && $r['adult_price'] !== '')
                    ? number_format((float)$r['adult_price'], 0) . ' ' . ($r['currency'] ?? 'EGP')
                    : wa_t($lang, 'onRequest');
                $lines[] = '   • ' . wa_room((string)($r['room_type'] ?? ''), $lang) . ': ' . $price . ' (' . wa_basis_per((string)($r['pricing_basis'] ?? ''), $lang) . ')';
            }
            if (($p['transfer'] ?? '') === 'Included') $lines[] = '   🚐 ' . wa_t($lang, 'transfers') . ': ' . wa_t($lang, 'included');
            if (!$sharedChild && $p['child_policy']) $lines[] = '   👶 ' . mb_substr($p['child_policy'], 0, 140);
        }
        if ($sharedChild) $lines[] = '👶 ' . wa_t($lang, 'children') . ': ' . mb_substr($sharedChild, 0, 160);

        if (++$hi < $hotelCount) $lines[] = '────────────────';
    }

    $lines[] = '════════════════';
    if ($notes) $lines[] = '📌 ' . wa_t($lang, 'notes') . ': ' . $notes;
    $lines[] = wa_t($lang, 'terms');
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
        $lang = (($body['lang'] ?? 'ar') === 'en') ? 'en' : 'ar';

        if (!empty($body['quote_id'])) {
            $quote = fetch_one('SELECT * FROM quotes WHERE id = ?', [(int)$body['quote_id']]);
            if (!$quote) fail('عرض السعر غير موجود.', 404, 'not_found');
            if (!can_access_quote($user, $quote)) fail('لا تملك صلاحية لهذا العرض.', 403, 'forbidden');
            $items = fetch_all(
                'SELECT r.*, qi.custom_note, ' . rate_hotel_info_select('h') . '
                 FROM quote_items qi
                 JOIN hotel_rates r ON r.id = qi.hotel_rate_id
                 LEFT JOIN hotels h ON h.id = r.hotel_id
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
            $items = fetch_all(
                "SELECT r.*, " . rate_hotel_info_select('h') . "
                 FROM hotel_rates r
                 LEFT JOIN hotels h ON h.id = r.hotel_id
                 WHERE r.id IN ($place) AND $visSql",
                array_merge($ids, $visParams)
            );
            $title = v_str($body['title'] ?? null, 190);
            $notes = v_str($body['notes'] ?? null);
        } else {
            fail('حدد quote_id أو rate_ids.', 422, 'validation');
        }

        if (empty($items)) fail('لا توجد عناصر متاحة.', 422, 'validation');
        $text = build_whatsapp_text($items, $clientName, $title, $notes, $lang);

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
