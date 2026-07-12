<?php
/** /api/hotel-groups */

function route_hotel_groups(string $method, array $seg, array $body): void
{
    $user = require_auth();
    $id = isset($seg[0]) ? (int)$seg[0] : null;

    if ($method === 'GET' && $id === null) {
        [$visSql, $visParams] = rates_visibility($user, 'r');
        $rows = fetch_all(
            "SELECT g.*,
                (SELECT COUNT(*) FROM hotels h WHERE h.hotel_group_id = g.id) AS hotels_count,
                (SELECT COUNT(*) FROM packages p WHERE p.hotel_group_id = g.id) AS packages_count,
                (SELECT COUNT(DISTINCT h.id)
                   FROM hotels h
                   JOIN hotel_rates r ON r.hotel_id = h.id
                  WHERE h.hotel_group_id = g.id AND $visSql) AS visible_hotels_count,
                (SELECT COUNT(DISTINCT p.id)
                   FROM packages p
                   JOIN package_hotels ph ON ph.package_id = p.id
                   JOIN hotel_rates r ON r.hotel_id = ph.hotel_id
                  WHERE p.hotel_group_id = g.id AND $visSql) AS visible_packages_count
             FROM hotel_groups g ORDER BY g.name",
            array_merge($visParams, $visParams)
        );
        if (!is_privileged($user)) {
            $rows = array_values(array_filter($rows, fn($r) => ((int)$r['visible_hotels_count'] + (int)$r['visible_packages_count']) > 0));
            foreach ($rows as &$row) {
                $row['hotels_count'] = (int)$row['visible_hotels_count'];
                $row['packages_count'] = (int)$row['visible_packages_count'];
                unset($row['visible_hotels_count'], $row['visible_packages_count']);
            }
            unset($row);
        }
        ok($rows);
    }

    if ($method === 'GET' && $id !== null) {
        $row = fetch_one('SELECT * FROM hotel_groups WHERE id = ?', [$id]);
        if (!$row) fail('المجموعة غير موجودة.', 404, 'not_found');
        if (is_privileged($user)) {
            $row['hotels'] = fetch_all('SELECT id,hotel_name,region,status FROM hotels WHERE hotel_group_id = ? ORDER BY hotel_name', [$id]);
        } else {
            [$visSql, $visParams] = rates_visibility($user, 'r');
            $row['hotels'] = fetch_all(
                "SELECT DISTINCT h.id,h.hotel_name,h.region,h.status
                 FROM hotels h
                 JOIN hotel_rates r ON r.hotel_id = h.id
                 WHERE h.hotel_group_id = ? AND $visSql
                 ORDER BY h.hotel_name",
                array_merge([$id], $visParams)
            );
            if (empty($row['hotels'])) fail('المجموعة غير متاحة.', 404, 'not_found');
        }
        ok($row);
    }

    if ($method === 'POST' && $id === null) {
        require_edit($user);
        $name = v_required($body, 'name', 'اسم المجموعة');
        q('INSERT INTO hotel_groups (name, brand_name, region, notes) VALUES (?,?,?,?)', [
            $name,
            v_str($body['brand_name'] ?? null, 190),
            v_str($body['region'] ?? null, 120),
            v_str($body['notes'] ?? null),
        ]);
        $newId = insert_id();
        log_audit('create', 'hotel_group', $newId, null, ['name' => $name]);
        created(fetch_one('SELECT * FROM hotel_groups WHERE id = ?', [$newId]));
    }

    if (($method === 'PUT' || $method === 'PATCH') && $id !== null) {
        require_edit($user);
        $old = fetch_one('SELECT * FROM hotel_groups WHERE id = ?', [$id]);
        if (!$old) fail('المجموعة غير موجودة.', 404, 'not_found');
        q('UPDATE hotel_groups SET name=?, brand_name=?, region=?, notes=? WHERE id=?', [
            v_str($body['name'] ?? $old['name'], 190) ?? $old['name'],
            v_str($body['brand_name'] ?? $old['brand_name'], 190),
            v_str($body['region'] ?? $old['region'], 120),
            v_str($body['notes'] ?? $old['notes']),
            $id,
        ]);
        log_audit('update', 'hotel_group', $id, $old, $body);
        ok(fetch_one('SELECT * FROM hotel_groups WHERE id = ?', [$id]));
    }

    if ($method === 'DELETE' && $id !== null) {
        require_role(['admin']);
        $old = fetch_one('SELECT * FROM hotel_groups WHERE id = ?', [$id]);
        if (!$old) fail('المجموعة غير موجودة.', 404, 'not_found');
        q('DELETE FROM hotel_groups WHERE id = ?', [$id]);
        log_audit('delete', 'hotel_group', $id, $old, null);
        ok(['deleted' => true]);
    }

    fail('مسار غير صحيح.', 404, 'not_found');
}
