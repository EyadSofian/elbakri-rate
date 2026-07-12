<?php
/** /api/hotels */

function route_hotels(string $method, array $seg, array $body): void
{
    $user = require_auth();
    $id = isset($seg[0]) ? (int)$seg[0] : null;

    if ($method === 'GET' && $id === null) {
        [$visSql, $visParams] = rates_visibility($user, 'r');

        $where = [];
        $params = [];
        if ($region = v_str(query_param('region'))) { $where[] = 'h.region = ?'; $params[] = $region; }
        if ($gid = v_int(query_param('hotel_group_id'))) { $where[] = 'h.hotel_group_id = ?'; $params[] = $gid; }
        if ($status = v_str(query_param('status'))) { $where[] = 'h.status = ?'; $params[] = $status; }
        if ($q = v_str(query_param('q'))) { $where[] = 'h.hotel_name LIKE ?'; $params[] = "%$q%"; }
        $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

        $rows = fetch_all(
            "SELECT h.*, g.name AS group_name,
                (SELECT COUNT(*) FROM hotel_rates r WHERE r.hotel_id = h.id AND $visSql) AS rates_count,
                (SELECT COUNT(*) FROM hotel_rates r WHERE r.hotel_id = h.id AND r.status='Ready' AND $visSql) AS ready_count,
                (SELECT COUNT(*) FROM hotel_rates r WHERE r.hotel_id = h.id AND r.status='Draft' AND $visSql) AS draft_count
             FROM hotels h
             LEFT JOIN hotel_groups g ON g.id = h.hotel_group_id
             $whereSql
             ORDER BY h.hotel_name",
            array_merge($visParams, $visParams, $visParams, $params)
        );
        // Non-privileged users only see hotels that have visible rates.
        if (!is_privileged($user)) {
            $rows = array_values(array_filter($rows, fn($r) => (int)$r['rates_count'] > 0));
        }
        ok($rows);
    }

    if ($method === 'GET' && $id !== null) {
        $hotel = fetch_one(
            'SELECT h.*, g.name AS group_name FROM hotels h
             LEFT JOIN hotel_groups g ON g.id = h.hotel_group_id WHERE h.id = ?',
            [$id]
        );
        if (!$hotel) fail('الفندق غير موجود.', 404, 'not_found');

        [$visSql, $visParams] = rates_visibility($user, 'r');
        [$policyCols, $policyJoin] = rate_child_policy_sql();

        $hotel['independent_rates'] = fetch_all(
            "SELECT r.* $policyCols FROM hotel_rates r
             $policyJoin
             WHERE r.hotel_id = ? AND r.package_id IS NULL AND $visSql
             ORDER BY r.date_from, r.room_type",
            array_merge([$id], $visParams)
        );
        $hotel['package_rates'] = fetch_all(
            "SELECT r.*, p.package_name AS pkg_name $policyCols FROM hotel_rates r
             LEFT JOIN packages p ON p.id = r.package_id
             $policyJoin
             WHERE r.hotel_id = ? AND r.package_id IS NOT NULL AND $visSql
             ORDER BY r.package_id, r.date_from, r.room_type",
            array_merge([$id], $visParams)
        );
        if (!is_privileged($user) && empty($hotel['independent_rates']) && empty($hotel['package_rates'])) {
            fail('الفندق غير متاح ضمن نطاق صلاحياتك.', 404, 'not_found');
        }
        if (is_privileged($user)) {
            $hotel['packages'] = fetch_all(
                'SELECT p.id, p.package_name, p.package_type FROM package_hotels ph
                 JOIN packages p ON p.id = ph.package_id WHERE ph.hotel_id = ? ORDER BY p.package_name',
                [$id]
            );
        } else {
            $hotel['packages'] = fetch_all(
                "SELECT DISTINCT p.id, p.package_name, p.package_type
                 FROM package_hotels ph
                 JOIN packages p ON p.id = ph.package_id
                 JOIN hotel_rates r ON r.hotel_id = ph.hotel_id
                 WHERE ph.hotel_id = ? AND $visSql
                 ORDER BY p.package_name",
                array_merge([$id], $visParams)
            );
        }
        if (child_policy_schema_ready()) {
            $hotel['child_policies'] = child_policy_list($id, true);
        } else {
            $hotel['child_policies'] = [];
        }
        ok($hotel);
    }

    if ($method === 'POST' && $id === null) {
        require_edit($user);
        $name = v_required($body, 'hotel_name', 'اسم الفندق');
        $gid  = v_int($body['hotel_group_id'] ?? null);

        q('INSERT INTO hotels
            (hotel_group_id, hotel_name, region, sub_region, star_rating, address, description,
             facilities, child_policy_default, transfer_notes_default, status)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)',
            [
                $gid,
                $name,
                v_str($body['region'] ?? null, 120),
                v_str($body['sub_region'] ?? null, 120),
                v_int($body['star_rating'] ?? null),
                v_str($body['address'] ?? null, 255),
                v_str($body['description'] ?? null),
                v_str($body['facilities'] ?? null),
                v_str($body['child_policy_default'] ?? null),
                v_str($body['transfer_notes_default'] ?? null),
                v_enum($body['status'] ?? 'Active', ['Active', 'Inactive'], 'Active'),
            ]
        );
        $hotelId = insert_id();
        log_audit('create', 'hotel', $hotelId, null, ['hotel_name' => $name]);

        // Optional inline pricing periods -> expand into hotel_rates (no package).
        $created = 0;
        if (!empty($body['periods']) && is_array($body['periods'])) {
            $created = expand_periods_to_rates($hotelId, null, $body['periods'], $user);
        }

        created([
            'hotel' => fetch_one('SELECT * FROM hotels WHERE id = ?', [$hotelId]),
            'rates_created' => $created,
        ]);
    }

    if (($method === 'PUT' || $method === 'PATCH') && $id !== null) {
        require_edit($user);
        $old = fetch_one('SELECT * FROM hotels WHERE id = ?', [$id]);
        if (!$old) fail('الفندق غير موجود.', 404, 'not_found');

        q('UPDATE hotels SET hotel_group_id=?, hotel_name=?, region=?, sub_region=?, star_rating=?,
             address=?, description=?, facilities=?, child_policy_default=?, transfer_notes_default=?, status=?
           WHERE id=?',
            [
                array_key_exists('hotel_group_id', $body) ? v_int($body['hotel_group_id']) : $old['hotel_group_id'],
                v_str($body['hotel_name'] ?? $old['hotel_name'], 190) ?? $old['hotel_name'],
                v_str($body['region'] ?? $old['region'], 120),
                v_str($body['sub_region'] ?? $old['sub_region'], 120),
                array_key_exists('star_rating', $body) ? v_int($body['star_rating']) : $old['star_rating'],
                v_str($body['address'] ?? $old['address'], 255),
                v_str($body['description'] ?? $old['description']),
                v_str($body['facilities'] ?? $old['facilities']),
                v_str($body['child_policy_default'] ?? $old['child_policy_default']),
                v_str($body['transfer_notes_default'] ?? $old['transfer_notes_default']),
                v_enum($body['status'] ?? $old['status'], ['Active', 'Inactive'], $old['status']),
                $id,
            ]
        );
        log_audit('update', 'hotel', $id, $old, $body);
        ok(fetch_one('SELECT * FROM hotels WHERE id = ?', [$id]));
    }

    if ($method === 'DELETE' && $id !== null) {
        require_role(['admin', 'operations']);
        $old = fetch_one('SELECT * FROM hotels WHERE id = ?', [$id]);
        if (!$old) fail('الفندق غير موجود.', 404, 'not_found');
        q('DELETE FROM hotels WHERE id = ?', [$id]);
        log_audit('delete', 'hotel', $id, $old, null);
        ok(['deleted' => true]);
    }

    fail('مسار غير صحيح.', 404, 'not_found');
}
