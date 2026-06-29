<?php
/** /api/packages */

function sync_package_hotels(int $packageId, array $hotelIds): void
{
    $hotelIds = array_values(array_unique(array_filter(array_map('intval', $hotelIds))));
    q('DELETE FROM package_hotels WHERE package_id = ?', [$packageId]);
    foreach ($hotelIds as $hid) {
        q('INSERT IGNORE INTO package_hotels (package_id, hotel_id) VALUES (?,?)', [$packageId, $hid]);
    }
}

function route_packages(string $method, array $seg, array $body): void
{
    $user = require_auth();
    $id = isset($seg[0]) && is_numeric($seg[0]) ? (int)$seg[0] : null;
    $subAction = $seg[1] ?? null;

    if ($method === 'GET' && $id === null) {
        [$visSql, $visParams] = rates_visibility($user, 'r');
        $rows = fetch_all(
            "SELECT p.*, g.name AS group_name,
                (SELECT COUNT(*) FROM package_hotels ph WHERE ph.package_id = p.id) AS hotels_count,
                (SELECT COUNT(*) FROM hotel_rates r
                    WHERE r.package_id IS NULL
                    AND EXISTS (SELECT 1 FROM package_hotels ph WHERE ph.package_id = p.id AND ph.hotel_id = r.hotel_id)
                    AND r.status='Ready' AND $visSql) AS ready_rates_count,
                (SELECT COUNT(*) FROM hotel_rates r
                    WHERE r.package_id IS NULL
                    AND EXISTS (SELECT 1 FROM package_hotels ph WHERE ph.package_id = p.id AND ph.hotel_id = r.hotel_id)
                    AND $visSql) AS rates_count
             FROM packages p
             LEFT JOIN hotel_groups g ON g.id = p.hotel_group_id
             ORDER BY p.package_name",
            array_merge($visParams, $visParams)
        );
        if (!is_privileged($user)) {
            $rows = array_values(array_filter($rows, fn($r) => (int)$r['ready_rates_count'] > 0));
        }
        ok($rows);
    }

    if ($method === 'GET' && $id !== null) {
        $pkg = fetch_one(
            'SELECT p.*, g.name AS group_name FROM packages p
             LEFT JOIN hotel_groups g ON g.id = p.hotel_group_id WHERE p.id = ?',
            [$id]
        );
        if (!$pkg) fail('الباقة غير موجودة.', 404, 'not_found');

        [$visSql, $visParams] = rates_visibility($user, 'r');
        $pkg['hotels'] = fetch_all(
            'SELECT h.id, h.hotel_name, h.region, h.star_rating, h.status
             FROM package_hotels ph JOIN hotels h ON h.id = ph.hotel_id
             WHERE ph.package_id = ? ORDER BY h.hotel_name',
            [$id]
        );
        $pkg['rates'] = fetch_all(
            "SELECT r.*, p.package_name AS package_name
             FROM hotel_rates r
             JOIN package_hotels ph ON ph.hotel_id = r.hotel_id AND ph.package_id = ?
             JOIN packages p ON p.id = ph.package_id
             WHERE r.package_id IS NULL AND $visSql
             ORDER BY r.hotel_name, r.date_from, r.room_type",
            array_merge([$id], $visParams)
        );
        ok($pkg);
    }

    if ($method === 'POST' && $id === null) {
        require_edit($user);
        $name = v_required($body, 'package_name', 'اسم الباقة');
        q('INSERT INTO packages
            (package_name, package_type, region, hotel_group_id, description, default_meal_plan, default_pricing_basis, status)
           VALUES (?,?,?,?,?,?,?,?)',
            [
                $name,
                v_str($body['package_type'] ?? null, 80),
                v_str($body['region'] ?? null, 120),
                v_int($body['hotel_group_id'] ?? null),
                v_str($body['description'] ?? null),
                v_enum($body['default_meal_plan'] ?? null, MEAL_PLANS, null),
                v_enum($body['default_pricing_basis'] ?? null, PRICING_BASES, null),
                v_enum($body['status'] ?? 'Active', ['Active', 'Inactive'], 'Active'),
            ]
        );
        $newId = insert_id();
        if (isset($body['hotel_ids']) && is_array($body['hotel_ids'])) {
            sync_package_hotels($newId, $body['hotel_ids']);
        }
        log_audit('create', 'package', $newId, null, ['package_name' => $name]);
        created(fetch_one('SELECT * FROM packages WHERE id = ?', [$newId]));
    }

    if (($method === 'PUT' || $method === 'PATCH') && $id !== null) {
        require_edit($user);
        $old = fetch_one('SELECT * FROM packages WHERE id = ?', [$id]);
        if (!$old) fail('الباقة غير موجودة.', 404, 'not_found');
        q('UPDATE packages SET package_name=?, package_type=?, region=?, hotel_group_id=?,
             description=?, default_meal_plan=?, default_pricing_basis=?, status=? WHERE id=?',
            [
                v_str($body['package_name'] ?? $old['package_name'], 190) ?? $old['package_name'],
                v_str($body['package_type'] ?? $old['package_type'], 80),
                v_str($body['region'] ?? $old['region'], 120),
                array_key_exists('hotel_group_id', $body) ? v_int($body['hotel_group_id']) : $old['hotel_group_id'],
                v_str($body['description'] ?? $old['description']),
                v_enum($body['default_meal_plan'] ?? $old['default_meal_plan'], MEAL_PLANS, $old['default_meal_plan']),
                v_enum($body['default_pricing_basis'] ?? $old['default_pricing_basis'], PRICING_BASES, $old['default_pricing_basis']),
                v_enum($body['status'] ?? $old['status'], ['Active', 'Inactive'], $old['status']),
                $id,
            ]
        );
        if (isset($body['hotel_ids']) && is_array($body['hotel_ids'])) {
            sync_package_hotels($id, $body['hotel_ids']);
        }
        log_audit('update', 'package', $id, $old, $body);
        ok(fetch_one('SELECT * FROM packages WHERE id = ?', [$id]));
    }

    if ($method === 'DELETE' && $id !== null) {
        require_role(['admin', 'operations']);
        $old = fetch_one('SELECT * FROM packages WHERE id = ?', [$id]);
        if (!$old) fail('الباقة غير موجودة.', 404, 'not_found');
        q('DELETE FROM packages WHERE id = ?', [$id]);
        log_audit('delete', 'package', $id, $old, null);
        ok(['deleted' => true]);
    }

    fail('مسار غير صحيح.', 404, 'not_found');
}
