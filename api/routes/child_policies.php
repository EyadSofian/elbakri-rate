<?php
/** /api/child-policies */

function child_policy_write_rules(int $policyId, array $rules): void
{
    q('DELETE FROM child_policy_rules WHERE child_policy_id = ?', [$policyId]);
    foreach ($rules as $r) {
        q('INSERT INTO child_policy_rules
            (child_policy_id, child_number_from, child_number_to, age_from, age_to,
             pricing_type, value, bed_type, notes, sort_order)
           VALUES (?,?,?,?,?,?,?,?,?,?)',
            [
                $policyId,
                $r['child_number_from'],
                $r['child_number_to'],
                $r['age_from'],
                $r['age_to'],
                $r['pricing_type'],
                $r['value'],
                $r['bed_type'],
                $r['notes'],
                $r['sort_order'],
            ]
        );
    }
}

function route_child_policies(string $method, array $seg, array $body): void
{
    $user = require_auth();
    ensure_child_policy_schema();

    $id = isset($seg[0]) && is_numeric($seg[0]) ? (int)$seg[0] : null;
    $action = $seg[1] ?? null;

    if ($method === 'GET' && $id === null) {
        $hotelId = v_int(query_param('hotel_id'));
        ok(child_policy_list($hotelId, true));
    }

    if ($method === 'GET' && $id !== null) {
        $policy = child_policy_fetch($id, true);
        if (!$policy) fail('Child policy not found.', 404, 'not_found');
        ok($policy);
    }

    if ($method === 'POST' && $id !== null && $action === 'clone') {
        require_edit($user);
        $old = child_policy_fetch($id, true);
        if (!$old) fail('Child policy not found.', 404, 'not_found');
        $payload = $old;
        $payload['policy_code'] = strtoupper(v_str($body['policy_code'] ?? ($old['policy_code'] . '_COPY'), 80) ?? ($old['policy_code'] . '_COPY'));
        $payload['policy_name'] = v_str($body['policy_name'] ?? ($old['policy_name'] . ' Copy'), 190) ?? ($old['policy_name'] . ' Copy');
        $payload['status'] = 'Active';
        $payload = child_policy_validate_payload($payload, null);

        db()->beginTransaction();
        try {
            q('INSERT INTO child_policies
                (hotel_id, policy_code, policy_name, description, min_adults, max_children, status, created_by, updated_by)
               VALUES (?,?,?,?,?,?,?,?,?)',
                [$payload['hotel_id'], $payload['policy_code'], $payload['policy_name'], $payload['description'],
                 $payload['min_adults'], $payload['max_children'], $payload['status'], $user['id'], $user['id']]
            );
            $newId = insert_id();
            child_policy_write_rules($newId, $payload['rules']);
            db()->commit();
        } catch (Throwable $e) {
            db()->rollBack();
            throw $e;
        }
        log_audit('create', 'child_policy_clone', $newId, $old, ['source_id' => $id]);
        created(child_policy_fetch($newId, true));
    }

    if ($method === 'POST' && $id !== null && $action === 'default') {
        require_edit($user);
        $policy = child_policy_fetch($id, false);
        if (!$policy) fail('Child policy not found or inactive.', 404, 'not_found');
        $hotelId = (int)$policy['hotel_id'];
        $old = fetch_one('SELECT * FROM hotels WHERE id = ?', [$hotelId]);
        q('UPDATE hotels SET default_child_policy_id = ? WHERE id = ?', [$id, $hotelId]);
        log_audit('assign', 'hotel_default_child_policy', $hotelId, $old, ['child_policy_id' => $id]);
        ok(['default_child_policy_id' => $id, 'hotel_id' => $hotelId]);
    }

    if ($method === 'POST' && $id === null) {
        require_edit($user);
        $payload = child_policy_validate_payload($body, null);
        db()->beginTransaction();
        try {
            q('INSERT INTO child_policies
                (hotel_id, policy_code, policy_name, description, min_adults, max_children, status, created_by, updated_by)
               VALUES (?,?,?,?,?,?,?,?,?)',
                [$payload['hotel_id'], $payload['policy_code'], $payload['policy_name'], $payload['description'],
                 $payload['min_adults'], $payload['max_children'], $payload['status'], $user['id'], $user['id']]
            );
            $newId = insert_id();
            child_policy_write_rules($newId, $payload['rules']);
            db()->commit();
        } catch (Throwable $e) {
            db()->rollBack();
            throw $e;
        }
        log_audit('create', 'child_policy', $newId, null, $payload);
        created(child_policy_fetch($newId, true));
    }

    if (($method === 'PUT' || $method === 'PATCH') && $id !== null) {
        require_edit($user);
        $old = child_policy_fetch($id, true);
        if (!$old) fail('Child policy not found.', 404, 'not_found');
        $payload = child_policy_validate_payload($body, $old);

        db()->beginTransaction();
        try {
            q('UPDATE child_policies
                  SET hotel_id=?, policy_code=?, policy_name=?, description=?, min_adults=?, max_children=?,
                      status=?, updated_by=?
                WHERE id=?',
                [$payload['hotel_id'], $payload['policy_code'], $payload['policy_name'], $payload['description'],
                 $payload['min_adults'], $payload['max_children'], $payload['status'], $user['id'], $id]
            );
            child_policy_write_rules($id, $payload['rules']);
            db()->commit();
        } catch (Throwable $e) {
            db()->rollBack();
            throw $e;
        }
        log_audit('update', 'child_policy', $id, $old, $payload);
        ok(child_policy_fetch($id, true));
    }

    if ($method === 'DELETE' && $id !== null) {
        require_edit($user);
        $old = child_policy_fetch($id, true);
        if (!$old) fail('Child policy not found.', 404, 'not_found');
        q("UPDATE child_policies SET status = 'Inactive', updated_by = ? WHERE id = ?", [$user['id'], $id]);
        q('UPDATE hotels SET default_child_policy_id = NULL WHERE default_child_policy_id = ?', [$id]);
        log_audit('deactivate', 'child_policy', $id, $old, null);
        ok(['deactivated' => true]);
    }

    fail('Invalid child-policies route.', 404, 'not_found');
}
