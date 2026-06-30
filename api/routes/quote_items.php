<?php
/** /api/quote-items  — add/update/remove items (Sales "add to quote" flow) */

function route_quote_items(string $method, array $seg, array $body): void
{
    $user = require_auth();
    $id = isset($seg[0]) && is_numeric($seg[0]) ? (int)$seg[0] : null;

    // POST /quote-items  -> add a rate to a quote (creates draft if none)
    if ($method === 'POST' && $id === null) {
        require_role(['admin', 'operations', 'sales']);
        $rateId = v_int($body['hotel_rate_id'] ?? null);
        if (!$rateId) fail('hotel_rate_id مطلوب.', 422, 'validation');

        // The rate must be visible to this user (RLS).
        [$visSql, $visParams] = rates_visibility($user, 'r');
        $rate = fetch_one("SELECT r.id FROM hotel_rates r WHERE r.id = ? AND $visSql", array_merge([$rateId], $visParams));
        if (!$rate) fail('هذا السعر غير متاح للإضافة.', 403, 'forbidden');

        // Target quote: explicit or the caller's draft.
        if (!empty($body['quote_id'])) {
            $quote = fetch_one('SELECT * FROM quotes WHERE id = ?', [(int)$body['quote_id']]);
            if (!$quote) fail('عرض السعر غير موجود.', 404, 'not_found');
            if (!can_access_quote($user, $quote)) fail('لا تملك صلاحية لهذا العرض.', 403, 'forbidden');
        } else {
            $quote = get_or_create_draft($user);
        }

        $maxOrder = (int)(fetch_one('SELECT COALESCE(MAX(sort_order),-1) m FROM quote_items WHERE quote_id = ?', [$quote['id']])['m'] ?? -1);
        q('INSERT IGNORE INTO quote_items (quote_id, hotel_rate_id, custom_note, sort_order) VALUES (?,?,?,?)',
            [$quote['id'], $rateId, v_str($body['custom_note'] ?? null), $maxOrder + 1]);

        $count = (int)(fetch_one('SELECT COUNT(*) c FROM quote_items WHERE quote_id = ?', [$quote['id']])['c'] ?? 0);
        created(['quote_id' => (int)$quote['id'], 'quote_number' => $quote['quote_number'], 'items_count' => $count]);
    }

    // PATCH /quote-items/:id  -> update note / sort
    if (($method === 'PUT' || $method === 'PATCH') && $id !== null) {
        $item = fetch_one('SELECT qi.*, q.created_by FROM quote_items qi JOIN quotes q ON q.id = qi.quote_id WHERE qi.id = ?', [$id]);
        if (!$item) fail('العنصر غير موجود.', 404, 'not_found');
        if (!is_privileged($user) && (int)$item['created_by'] !== (int)$user['id']) fail('لا تملك صلاحية.', 403, 'forbidden');
        q('UPDATE quote_items SET custom_note = ?, sort_order = ? WHERE id = ?',
            [
                array_key_exists('custom_note', $body) ? v_str($body['custom_note']) : $item['custom_note'],
                array_key_exists('sort_order', $body) ? (int)$body['sort_order'] : $item['sort_order'],
                $id,
            ]);
        ok(['updated' => true]);
    }

    // DELETE /quote-items/:id
    if ($method === 'DELETE' && $id !== null) {
        $item = fetch_one('SELECT qi.*, q.created_by FROM quote_items qi JOIN quotes q ON q.id = qi.quote_id WHERE qi.id = ?', [$id]);
        if (!$item) fail('العنصر غير موجود.', 404, 'not_found');
        if (!is_privileged($user) && (int)$item['created_by'] !== (int)$user['id']) fail('لا تملك صلاحية.', 403, 'forbidden');
        q('DELETE FROM quote_items WHERE id = ?', [$id]);
        $count = (int)(fetch_one('SELECT COUNT(*) c FROM quote_items WHERE quote_id = ?', [$item['quote_id']])['c'] ?? 0);
        ok(['deleted' => true, 'items_count' => $count]);
    }

    fail('مسار غير صحيح.', 404, 'not_found');
}
