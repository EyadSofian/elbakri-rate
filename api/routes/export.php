<?php
/** /api/export  — CSV export of rates (respects visibility) */

function route_export(string $method, array $seg, array $body): void
{
    $user = require_auth();
    if (!can_export($user)) fail('ليس لديك صلاحية التصدير.', 403, 'forbidden');

    [$visSql, $visParams] = rates_visibility($user, 'r');
    $where = [$visSql]; $params = $visParams;

    foreach (['status', 'region', 'hotel_id', 'package_id', 'hotel_group_id'] as $p) {
        $val = v_str(query_param($p));
        if ($val !== null) { $where[] = "r.$p = ?"; $params[] = $val; }
    }
    $whereSql = 'WHERE ' . implode(' AND ', $where);

    $rows = fetch_all("SELECT * FROM hotel_rates r $whereSql ORDER BY r.hotel_name, r.date_from", $params);

    $cols = ['id', 'hotel_name', 'hotel_group', 'package_name', 'region', 'sub_region', 'category',
        'offer_name', 'season_name', 'date_from', 'date_to', 'room_type', 'meal_plan', 'pricing_basis',
        'currency', 'adult_price', 'child_price', 'child_age_from', 'child_age_to', 'nights', 'days',
        'child_policy', 'cancellation_policy', 'booking_notes', 'status'];

    log_audit('export', 'rate', null, null, ['count' => count($rows)]);

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="elbakri_rates_' . date('Ymd_His') . '.csv"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF"); // UTF-8 BOM for Excel
    fputcsv($out, $cols);
    foreach ($rows as $r) {
        $line = [];
        foreach ($cols as $c) $line[] = $r[$c] ?? '';
        fputcsv($out, $line);
    }
    fclose($out);
    exit;
}
