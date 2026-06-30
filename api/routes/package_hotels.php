<?php
/** /api/package-hotels  — link/unlink hotels to a package */

function route_package_hotels(string $method, array $seg, array $body): void
{
    $user = require_auth();
    require_edit($user);

    if ($method === 'POST') {
        $packageId = v_int($body['package_id'] ?? null);
        $hotelId   = v_int($body['hotel_id'] ?? null);
        if (!$packageId || !$hotelId) fail('package_id و hotel_id مطلوبان.', 422, 'validation');
        q('INSERT IGNORE INTO package_hotels (package_id, hotel_id) VALUES (?,?)', [$packageId, $hotelId]);
        log_audit('create', 'package_hotel', $packageId, null, ['hotel_id' => $hotelId]);
        created(['linked' => true]);
    }

    if ($method === 'DELETE') {
        $packageId = v_int($body['package_id'] ?? query_param('package_id'));
        $hotelId   = v_int($body['hotel_id'] ?? query_param('hotel_id'));
        if (!$packageId || !$hotelId) fail('package_id و hotel_id مطلوبان.', 422, 'validation');
        q('DELETE FROM package_hotels WHERE package_id = ? AND hotel_id = ?', [$packageId, $hotelId]);
        log_audit('delete', 'package_hotel', $packageId, ['hotel_id' => $hotelId], null);
        ok(['unlinked' => true]);
    }

    fail('مسار غير صحيح.', 404, 'not_found');
}
