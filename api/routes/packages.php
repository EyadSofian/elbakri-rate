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
                (SELECT COUNT(DISTINCT ph.hotel_id)
                   FROM package_hotels ph
                   JOIN hotel_rates r ON r.hotel_id = ph.hotel_id
                  WHERE ph.package_id = p.id AND $visSql) AS visible_hotels_count,
                (SELECT COUNT(DISTINCT r.id)
                   FROM package_hotels ph
                   JOIN hotel_rates r ON r.hotel_id = ph.hotel_id
                  WHERE ph.package_id = p.id AND r.status='Ready' AND $visSql) AS ready_rates_count,
                (SELECT COUNT(DISTINCT r.id)
                   FROM package_hotels ph
                   JOIN hotel_rates r ON r.hotel_id = ph.hotel_id
                  WHERE ph.package_id = p.id AND r.status='Draft' AND $visSql) AS draft_rates_count,
                (SELECT COUNT(DISTINCT r.id)
                   FROM package_hotels ph
                   JOIN hotel_rates r ON r.hotel_id = ph.hotel_id
                  WHERE ph.package_id = p.id AND $visSql) AS rates_count
             FROM packages p
             LEFT JOIN hotel_groups g ON g.id = p.hotel_group_id
             ORDER BY p.package_name",
            array_merge($visParams, $visParams, $visParams, $visParams)
        );
        if (!is_privileged($user)) {
            $rows = array_values(array_filter($rows, fn($r) => (int)$r['ready_rates_count'] > 0));
            foreach ($rows as &$row) {
                $row['hotels_count'] = (int)$row['visible_hotels_count'];
                unset($row['visible_hotels_count']);
            }
            unset($row);
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
        if (is_privileged($user)) {
            $pkg['hotels'] = fetch_all(
                'SELECT h.id, h.hotel_name, h.region, h.sub_region, h.star_rating, h.status,
                        h.description, h.facilities, h.child_policy_default, h.transfer_notes_default
                 FROM package_hotels ph JOIN hotels h ON h.id = ph.hotel_id
                 WHERE ph.package_id = ? ORDER BY h.hotel_name',
                [$id]
            );
        } else {
            $pkg['hotels'] = fetch_all(
                "SELECT DISTINCT h.id, h.hotel_name, h.region, h.sub_region, h.star_rating, h.status,
                        h.description, h.facilities, h.child_policy_default, h.transfer_notes_default
                 FROM package_hotels ph
                 JOIN hotels h ON h.id = ph.hotel_id
                 JOIN hotel_rates r ON r.hotel_id = h.id
                 WHERE ph.package_id = ? AND $visSql
                 ORDER BY h.hotel_name",
                array_merge([$id], $visParams)
            );
        }
        $pkg['rates'] = fetch_all(
            "SELECT DISTINCT r.*, " . rate_hotel_info_select('h') . "
             FROM package_hotels ph
             JOIN hotel_rates r ON r.hotel_id = ph.hotel_id
             LEFT JOIN hotels h ON h.id = r.hotel_id
             WHERE ph.package_id = ? AND $visSql
             ORDER BY r.hotel_name, r.date_from, r.room_type",
            array_merge([$id], $visParams)
        );
        if (!is_privileged($user) && empty($pkg['rates'])) {
            fail('الباقة غير متاحة ضمن نطاق صلاحياتك.', 404, 'not_found');
        }
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
                null,
                null,
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
                null,
                null,
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
