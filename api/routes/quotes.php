<?php
/** /api/quotes  + draft helper used by quote-items */

function can_access_quote(array $user, array $quote): bool
{
    if (is_privileged($user)) return true;
    return (int)$quote['created_by'] === (int)$user['id'];
}

/** Find the caller's open draft quote, or create one. Returns quote row. */
function get_or_create_draft(array $user): array
{
    $row = fetch_one(
        "SELECT * FROM quotes WHERE created_by = ? AND status = 'draft' ORDER BY id DESC LIMIT 1",
        [$user['id']]
    );
    if ($row) return $row;

    q("INSERT INTO quotes (quote_number, status, created_by) VALUES (?, 'draft', ?)",
        ['TMP-' . uniqid(), $user['id']]);
    $id = insert_id();
    q('UPDATE quotes SET quote_number = ? WHERE id = ?', ['ELB-' . str_pad((string)$id, 5, '0', STR_PAD_LEFT), $id]);
    return fetch_one('SELECT * FROM quotes WHERE id = ?', [$id]);
}

function quote_with_items(int $id): array
{
    $quote = fetch_one('SELECT * FROM quotes WHERE id = ?', [$id]);
    if (!$quote) fail('عرض السعر غير موجود.', 404, 'not_found');
    $quote['items'] = fetch_all(
        'SELECT qi.id AS item_id, qi.custom_note, qi.sort_order, qi.hotel_rate_id, r.*, ' . rate_hotel_info_select('h') . '
         FROM quote_items qi
         JOIN hotel_rates r ON r.id = qi.hotel_rate_id
         LEFT JOIN hotels h ON h.id = r.hotel_id
         WHERE qi.quote_id = ?
         ORDER BY qi.sort_order, qi.id',
        [$id]
    );
    $quote['items_count'] = count($quote['items']);
    return $quote;
}

function route_quotes(string $method, array $seg, array $body): void
{
    $user = require_auth();
    $first = $seg[0] ?? null;

    // GET /quotes/current  -> the caller's open draft (creates if missing)
    if ($method === 'GET' && $first === 'current') {
        $draft = get_or_create_draft($user);
        ok(quote_with_items((int)$draft['id']));
    }

    $id = is_numeric($first) ? (int)$first : null;

    if ($method === 'GET' && $id === null) {
        $where = []; $params = [];
        if (!is_privileged($user)) { $where[] = 'created_by = ?'; $params[] = $user['id']; }
        if ($status = v_enum(query_param('status'), QUOTE_STATUSES, null)) { $where[] = 'status = ?'; $params[] = $status; }
        $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';
        $rows = fetch_all(
            "SELECT q.*, u.full_name AS creator_name,
                (SELECT COUNT(*) FROM quote_items qi WHERE qi.quote_id = q.id) AS items_count
             FROM quotes q LEFT JOIN users u ON u.id = q.created_by
             $whereSql ORDER BY q.updated_at DESC",
            $params
        );
        ok($rows);
    }

    if ($method === 'GET' && $id !== null) {
        $quote = fetch_one('SELECT * FROM quotes WHERE id = ?', [$id]);
        if (!$quote) fail('عرض السعر غير موجود.', 404, 'not_found');
        if (!can_access_quote($user, $quote)) fail('لا تملك صلاحية لهذا العرض.', 403, 'forbidden');
        ok(quote_with_items($id));
    }

    if ($method === 'POST' && $id === null) {
        require_role(['admin', 'operations', 'sales']);
        q('INSERT INTO quotes (quote_number, client_name, client_phone, client_notes, status, created_by)
           VALUES (?,?,?,?,?,?)',
            [
                'TMP-' . uniqid(),
                v_str($body['client_name'] ?? null, 190),
                v_str($body['client_phone'] ?? null, 40),
                v_str($body['client_notes'] ?? null),
                v_enum($body['status'] ?? 'draft', QUOTE_STATUSES, 'draft'),
                $user['id'],
            ]
        );
        $newId = insert_id();
        q('UPDATE quotes SET quote_number = ? WHERE id = ?', ['ELB-' . str_pad((string)$newId, 5, '0', STR_PAD_LEFT), $newId]);

        // Optional initial items
        if (!empty($body['rate_ids']) && is_array($body['rate_ids'])) {
            $order = 0;
            foreach ($body['rate_ids'] as $rid) {
                $rid = (int)$rid;
                if ($rid) q('INSERT IGNORE INTO quote_items (quote_id, hotel_rate_id, sort_order) VALUES (?,?,?)', [$newId, $rid, $order++]);
            }
        }
        log_audit('create', 'quote', $newId, null, ['client' => $body['client_name'] ?? null]);
        created(quote_with_items($newId));
    }

    if (($method === 'PUT' || $method === 'PATCH') && $id !== null) {
        $quote = fetch_one('SELECT * FROM quotes WHERE id = ?', [$id]);
        if (!$quote) fail('عرض السعر غير موجود.', 404, 'not_found');
        if (!can_access_quote($user, $quote)) fail('لا تملك صلاحية لهذا العرض.', 403, 'forbidden');
        q('UPDATE quotes SET client_name=?, client_phone=?, client_notes=?, status=? WHERE id=?',
            [
                v_str($body['client_name'] ?? $quote['client_name'], 190),
                v_str($body['client_phone'] ?? $quote['client_phone'], 40),
                v_str($body['client_notes'] ?? $quote['client_notes']),
                v_enum($body['status'] ?? $quote['status'], QUOTE_STATUSES, $quote['status']),
                $id,
            ]
        );
        log_audit('update', 'quote', $id, $quote, $body);
        ok(quote_with_items($id));
    }

    if ($method === 'DELETE' && $id !== null) {
        $quote = fetch_one('SELECT * FROM quotes WHERE id = ?', [$id]);
        if (!$quote) fail('عرض السعر غير موجود.', 404, 'not_found');
        if (!can_access_quote($user, $quote)) fail('لا تملك صلاحية لهذا العرض.', 403, 'forbidden');
        q('DELETE FROM quotes WHERE id = ?', [$id]);
        log_audit('delete', 'quote', $id, $quote, null);
        ok(['deleted' => true]);
    }

    fail('مسار غير صحيح.', 404, 'not_found');
}
