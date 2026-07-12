<?php
/** /api/rates  + shared rate helpers (used by hotels & matrix) */

// ---- Lookups (request-cached) -------------------------------------
function rate_lookup_hotel(int $hotelId): array
{
    static $cache = [];
    if (isset($cache[$hotelId])) return $cache[$hotelId];
    $h = fetch_one(
        'SELECT h.*, g.name AS group_name FROM hotels h
         LEFT JOIN hotel_groups g ON g.id = h.hotel_group_id WHERE h.id = ?',
        [$hotelId]
    );
    if (!$h) fail("الفندق غير موجود (#$hotelId).", 422, 'validation');
    return $cache[$hotelId] = $h;
}

function rate_lookup_package(?int $pid): ?array
{
    if (!$pid) return null;
    static $cache = [];
    if (array_key_exists($pid, $cache)) return $cache[$pid];
    return $cache[$pid] = fetch_one('SELECT * FROM packages WHERE id = ?', [$pid]);
}

/** Insert a single rate row with denormalized snapshots. Returns new id. */
function insert_rate(array $in, array $user): int
{
    $hotelId = (int)($in['hotel_id'] ?? 0);
    if (!$hotelId) fail('hotel_id مطلوب.', 422, 'validation');
    $h   = rate_lookup_hotel($hotelId);
    $pid = v_int($in['package_id'] ?? null);
    $pkg = rate_lookup_package($pid);
    $groupId = $h['hotel_group_id'] ? (int)$h['hotel_group_id'] : null;

    $roomType = v_str($in['room_type'] ?? 'Double', 60) ?? 'Double';
    $status   = v_enum($in['status'] ?? 'Draft', RATE_STATUSES, 'Draft');

    $childPolicyId = null;
    $hasChildPolicyColumn = false;
    if (array_key_exists('child_policy_id', $in) || array_key_exists('child_policy_code', $in)) {
        $childPolicyId = child_policy_resolve_for_hotel($hotelId, $in['child_policy_id'] ?? null, v_str($in['child_policy_code'] ?? null));
        $hasChildPolicyColumn = true;
    } elseif (child_policy_schema_ready()) {
        $hasChildPolicyColumn = true;
    }

    $cols = [
        'hotel_id', 'hotel_group_id', 'package_id', 'package_name', 'hotel_name', 'hotel_group',
        'region', 'sub_region', 'category', 'offer_name', 'season_name', 'date_from', 'date_to',
        'room_type', 'meal_plan', 'pricing_basis', 'currency', 'adult_price', 'child_price',
        'child_age_from', 'child_age_to',
    ];
    $vals = [
        $hotelId,
        $groupId,
        $pid,
        $pkg['package_name'] ?? null,
        $h['hotel_name'],
        $h['group_name'] ?? null,
        v_str($in['region'] ?? $h['region'], 120),
        v_str($in['sub_region'] ?? $h['sub_region'], 120),
        v_enum($in['category'] ?? ($pid ? 'Package' : 'Hotel'), CATEGORIES, $pid ? 'Package' : 'Hotel'),
        v_str($in['offer_name'] ?? null, 190),
        v_str($in['season_name'] ?? null, 190),
        v_date($in['date_from'] ?? null),
        v_date($in['date_to'] ?? null),
        $roomType,
        v_enum($in['meal_plan'] ?? 'BB', MEAL_PLANS, 'BB'),
        v_enum($in['pricing_basis'] ?? 'per_person_per_night', PRICING_BASES, 'per_person_per_night'),
        v_enum($in['currency'] ?? 'EGP', CURRENCIES, 'EGP'),
        v_num($in['adult_price'] ?? null),
        v_num($in['child_price'] ?? null),
        v_num($in['child_age_from'] ?? null),
        v_num($in['child_age_to'] ?? null),
    ];
    if ($hasChildPolicyColumn) {
        $cols[] = 'child_policy_id';
        $vals[] = $childPolicyId;
    }
    foreach ([
        'nights' => v_int($in['nights'] ?? null),
        'days' => v_int($in['days'] ?? null),
        'transfer_included' => v_enum($in['transfer_included'] ?? 'Optional', TRANSFER_OPTS, 'Optional'),
        'transfer_details' => v_str($in['transfer_details'] ?? null),
        'child_policy' => v_str($in['child_policy'] ?? null),
        'cancellation_policy' => v_str($in['cancellation_policy'] ?? null),
        'booking_notes' => v_str($in['booking_notes'] ?? null),
        'status' => $status,
        'source_type' => v_enum($in['source_type'] ?? 'manual', ['manual', 'csv', 'xlsx'], 'manual'),
        'created_by' => $user['id'],
        'updated_by' => $user['id'],
    ] as $col => $val) {
        $cols[] = $col;
        $vals[] = $val;
    }
    $placeholders = implode(',', array_fill(0, count($cols), '?'));
    q('INSERT INTO hotel_rates (' . implode(',', $cols) . ") VALUES ($placeholders)", $vals);
    return insert_id();
}

function delete_duplicate_rate(int $hotelId, ?int $pid, ?string $from, ?string $to, string $roomType, string $meal): int
{
    $sql = 'DELETE FROM hotel_rates WHERE hotel_id = ? AND room_type = ? AND meal_plan = ?
            AND ' . ($pid ? 'package_id = ?' : 'package_id IS NULL') . '
            AND ' . ($from ? 'date_from = ?' : 'date_from IS NULL') . '
            AND ' . ($to ? 'date_to = ?' : 'date_to IS NULL');
    $params = [$hotelId, $roomType, $meal];
    if ($pid)  $params[] = $pid;
    if ($from) $params[] = $from;
    if ($to)   $params[] = $to;
    return q($sql, $params)->rowCount();
}

function rate_hotel_info_select(string $hotelAlias = 'h'): string
{
    $defaultPolicy = db_column_exists('hotels', 'default_child_policy_id')
        ? "$hotelAlias.default_child_policy_id AS hotel_default_child_policy_id,"
        : "NULL AS hotel_default_child_policy_id,";
    return "$hotelAlias.description AS hotel_description,
            $hotelAlias.facilities AS hotel_facilities,
            $hotelAlias.child_policy_default AS hotel_child_policy_default,
            $defaultPolicy
            $hotelAlias.transfer_notes_default AS hotel_transfer_notes_default";
}

function rate_child_policy_sql(): array
{
    if (!child_policy_schema_ready()) return ['', ''];
    return [
        ", cp.policy_code AS child_policy_code,
           cp.policy_name AS child_policy_name,
           cp.status AS child_policy_status",
        ' LEFT JOIN child_policies cp ON cp.id = r.child_policy_id ',
    ];
}

/**
 * Expand "periods" (each holding several room prices) into rate rows.
 * Period shape:
 *   { date_from, date_to, meal_plan, pricing_basis, currency, status, ...
 *     prices: { "Double": 1200, "Triple": 1100, ... }   // room_type => adult_price
 *     OR rooms: [ { room_type, adult_price, child_price } ] }
 * Returns number of rate rows created.
 */
function expand_periods_to_rates(int $hotelId, ?int $packageId, array $periods, array $user, bool $overwrite = false): int
{
    $count = 0;
    foreach ($periods as $p) {
        if (!is_array($p)) continue;
        $base = [
            'hotel_id'          => $hotelId,
            'package_id'        => $packageId,
            'category'          => $p['category'] ?? null,
            'region'            => $p['region'] ?? null,
            'sub_region'        => $p['sub_region'] ?? null,
            'offer_name'        => $p['offer_name'] ?? null,
            'season_name'       => $p['season_name'] ?? null,
            'date_from'         => $p['date_from'] ?? null,
            'date_to'           => $p['date_to'] ?? null,
            'meal_plan'         => $p['meal_plan'] ?? 'BB',
            'pricing_basis'     => $p['pricing_basis'] ?? 'per_person_per_night',
            'currency'          => $p['currency'] ?? 'EGP',
            'child_price'       => $p['child_price'] ?? null,
            'child_age_from'    => $p['child_age_from'] ?? null,
            'child_age_to'      => $p['child_age_to'] ?? null,
            'child_policy_id'   => $p['child_policy_id'] ?? null,
            'child_policy_code' => $p['child_policy_code'] ?? null,
            'nights'            => $p['nights'] ?? null,
            'days'              => $p['days'] ?? null,
            'transfer_included' => $p['transfer_included'] ?? 'Optional',
            'transfer_details'  => $p['transfer_details'] ?? null,
            'child_policy'      => $p['child_policy'] ?? null,
            'cancellation_policy' => $p['cancellation_policy'] ?? null,
            'booking_notes'     => $p['booking_notes'] ?? null,
            'status'            => $p['status'] ?? 'Draft',
            'source_type'       => $p['source_type'] ?? 'manual',
        ];

        // Normalize room list.
        $rooms = [];
        if (!empty($p['rooms']) && is_array($p['rooms'])) {
            foreach ($p['rooms'] as $r) {
                $rt = v_str($r['room_type'] ?? null, 60);
                $price = v_num($r['adult_price'] ?? ($r['price'] ?? null));
                if ($rt === null || $price === null) continue;
                $rooms[] = [
                    'room_type' => $rt,
                    'adult_price' => $price,
                    'child_price' => $r['child_price'] ?? null,
                    'child_policy_id' => $r['child_policy_id'] ?? null,
                    'child_policy_code' => $r['child_policy_code'] ?? null,
                ];
            }
        } elseif (!empty($p['prices']) && is_array($p['prices'])) {
            foreach ($p['prices'] as $rt => $price) {
                $price = v_num($price);
                if ($price === null) continue;
                $rooms[] = ['room_type' => (string)$rt, 'adult_price' => $price, 'child_price' => null, 'child_policy_id' => null, 'child_policy_code' => null];
            }
        }

        foreach ($rooms as $room) {
            $row = $base;
            $row['room_type']   = $room['room_type'];
            $row['adult_price'] = $room['adult_price'];
            if ($room['child_price'] !== null) $row['child_price'] = $room['child_price'];
            if ($room['child_policy_id'] !== null) $row['child_policy_id'] = $room['child_policy_id'];
            if ($room['child_policy_code'] !== null) $row['child_policy_code'] = $room['child_policy_code'];

            if ($overwrite) {
                delete_duplicate_rate(
                    $hotelId, $packageId,
                    v_str($row['date_from']), v_str($row['date_to']),
                    $room['room_type'], (string)$row['meal_plan']
                );
            }
            insert_rate($row, $user);
            $count++;
        }
    }
    return $count;
}

function periods_need_child_policy_schema(array $periods): bool
{
    foreach ($periods as $p) {
        if (!is_array($p)) continue;
        if (array_key_exists('child_policy_id', $p) || array_key_exists('child_policy_code', $p)) return true;
        if (!empty($p['rooms']) && is_array($p['rooms'])) {
            foreach ($p['rooms'] as $r) {
                if (is_array($r) && (array_key_exists('child_policy_id', $r) || array_key_exists('child_policy_code', $r))) return true;
            }
        }
    }
    return false;
}

// ---- Route ---------------------------------------------------------
function route_rates(string $method, array $seg, array $body): void
{
    $user = require_auth();
    $sub  = $seg[0] ?? null;

    // POST /rates/matrix
    if ($method === 'POST' && $sub === 'matrix') {
        require_edit($user);
        $hotelIds = array_values(array_filter(array_map('intval', (array)($body['hotel_ids'] ?? []))));
        $periods  = (array)($body['periods'] ?? []);
        $pid      = v_int($body['package_id'] ?? null);
        $overwrite = v_bool($body['overwrite'] ?? false) === 1;
        $preview  = v_bool($body['preview'] ?? false) === 1;

        if (empty($hotelIds)) fail('اختر فندقًا واحدًا على الأقل.', 422, 'validation');
        if (empty($periods))  fail('أضف فترة واحدة على الأقل.', 422, 'validation');

        if (periods_need_child_policy_schema($periods)) ensure_child_policy_schema();

        // Count room prices present across periods.
        $roomsPerPeriod = 0;
        foreach ($periods as $p) {
            if (!empty($p['rooms']) && is_array($p['rooms'])) {
                foreach ($p['rooms'] as $r) {
                    if (v_num($r['adult_price'] ?? ($r['price'] ?? null)) !== null) $roomsPerPeriod++;
                }
            } elseif (!empty($p['prices']) && is_array($p['prices'])) {
                foreach ($p['prices'] as $price) if (v_num($price) !== null) $roomsPerPeriod++;
            }
        }
        $expected = count($hotelIds) * $roomsPerPeriod;

        if ($preview) {
            ok(['preview' => true, 'expected_records' => $expected, 'hotels' => count($hotelIds)]);
        }

        $created = 0;
        db()->beginTransaction();
        try {
            foreach ($hotelIds as $hid) {
                $created += expand_periods_to_rates($hid, $pid, $periods, $user, $overwrite);
            }
            db()->commit();
        } catch (Throwable $e) {
            db()->rollBack();
            throw $e;
        }
        log_audit('create', 'rate_matrix', $pid, null, ['hotels' => $hotelIds, 'created' => $created]);
        created(['rates_created' => $created]);
    }

    // POST /rates/bulk-status
    if ($method === 'POST' && $sub === 'bulk-status') {
        require_edit($user);
        $ids = array_values(array_filter(array_map('intval', (array)($body['ids'] ?? []))));
        $status = v_enum($body['status'] ?? null, RATE_STATUSES);
        if (empty($ids) || !$status) fail('حدد الأسعار والحالة.', 422, 'validation');
        $place = implode(',', array_fill(0, count($ids), '?'));
        q("UPDATE hotel_rates SET status = ?, updated_by = ? WHERE id IN ($place)",
            array_merge([$status, $user['id']], $ids));
        log_audit('update', 'rate_bulk_status', null, null, ['ids' => $ids, 'status' => $status]);
        ok(['updated' => count($ids), 'status' => $status]);
    }

    // POST /rates/bulk-child-policy
    if ($method === 'POST' && $sub === 'bulk-child-policy') {
        require_edit($user);
        ensure_child_policy_schema();
        $ids = array_values(array_filter(array_map('intval', (array)($body['ids'] ?? []))));
        if (empty($ids)) fail('Select rates first.', 422, 'validation');
        $policyIdRaw = $body['child_policy_id'] ?? null;
        $policyId = $policyIdRaw === null || $policyIdRaw === '' ? null : v_int($policyIdRaw);
        $place = implode(',', array_fill(0, count($ids), '?'));
        $rates = fetch_all("SELECT id, hotel_id, child_policy_id FROM hotel_rates WHERE id IN ($place)", $ids);
        if (count($rates) !== count($ids)) fail('Some selected rates were not found.', 404, 'not_found');
        if ($policyId !== null) {
            $policy = child_policy_fetch($policyId, false);
            if (!$policy) fail('Child policy not found or inactive.', 422, 'validation');
            foreach ($rates as $r) {
                if ((int)$r['hotel_id'] !== (int)$policy['hotel_id']) {
                    fail('Selected child policy belongs to another hotel.', 422, 'validation', ['rate_id' => (int)$r['id']]);
                }
            }
        }
        q("UPDATE hotel_rates SET child_policy_id = ?, updated_by = ? WHERE id IN ($place)",
            array_merge([$policyId, $user['id']], $ids));
        log_audit($policyId === null ? 'unassign' : 'assign', 'rate_child_policy', null, null, ['ids' => $ids, 'child_policy_id' => $policyId]);
        ok(['updated' => count($ids), 'child_policy_id' => $policyId]);
    }

    // POST /rates/copy  (copy rates to other hotels)
    if ($method === 'POST' && $sub === 'copy') {
        require_edit($user);
        $rateIds   = array_values(array_filter(array_map('intval', (array)($body['rate_ids'] ?? []))));
        $targets   = array_values(array_filter(array_map('intval', (array)($body['target_hotel_ids'] ?? []))));
        $overwrite = v_bool($body['overwrite'] ?? false) === 1;
        if (empty($rateIds) || empty($targets)) fail('حدد الأسعار والفنادق الهدف.', 422, 'validation');

        $place = implode(',', array_fill(0, count($rateIds), '?'));
        $src = fetch_all("SELECT * FROM hotel_rates WHERE id IN ($place)", $rateIds);
        $created = 0;
        db()->beginTransaction();
        try {
            foreach ($targets as $hid) {
                foreach ($src as $r) {
                    $in = $r;
                    unset($in['id'], $in['created_at'], $in['updated_at']);
                    $in['hotel_id'] = $hid;
                    unset($in['child_policy_id'], $in['child_policy_code']);
                    if ($overwrite) {
                        delete_duplicate_rate($hid, v_int($r['package_id']), $r['date_from'], $r['date_to'], $r['room_type'], $r['meal_plan']);
                    }
                    insert_rate($in, $user);
                    $created++;
                }
            }
            db()->commit();
        } catch (Throwable $e) {
            db()->rollBack();
            throw $e;
        }
        log_audit('create', 'rate_copy', null, null, ['from' => $rateIds, 'to' => $targets, 'created' => $created]);
        created(['rates_created' => $created]);
    }

    $id = is_numeric($sub) ? (int)$sub : null;

    // GET /rates (list)
    if ($method === 'GET' && $id === null) {
        [$visSql, $visParams] = rates_visibility($user, 'r');
        $where = [$visSql];
        $params = $visParams;

        $map = [
            'status'           => 'r.status = ?',
            'region'           => 'r.region = ?',
            'hotel_id'         => 'r.hotel_id = ?',
            'package_id'       => 'r.package_id = ?',
            'hotel_group_id'   => 'r.hotel_group_id = ?',
            'room_type'        => 'r.room_type = ?',
            'meal_plan'        => 'r.meal_plan = ?',
            'category'         => 'r.category = ?',
            'transfer_included'=> 'r.transfer_included = ?',
        ];
        foreach ($map as $param => $clause) {
            $val = v_str(query_param($param));
            if ($val !== null) { $where[] = $clause; $params[] = $val; }
        }
        if ($df = v_str(query_param('date_from'))) { $where[] = 'r.date_to >= ?';   $params[] = $df; }
        if ($dt = v_str(query_param('date_to')))   { $where[] = 'r.date_from <= ?'; $params[] = $dt; }
        if (($mp = query_param('max_price')) !== null && is_numeric($mp)) { $where[] = 'r.adult_price <= ?'; $params[] = (float)$mp; }
        if ($q = v_str(query_param('q'))) {
            $where[] = '(r.hotel_name LIKE ? OR r.package_name LIKE ? OR r.offer_name LIKE ?)';
            array_push($params, "%$q%", "%$q%", "%$q%");
        }

        $whereSql = 'WHERE ' . implode(' AND ', $where);
        $total = (int) (fetch_one("SELECT COUNT(*) c FROM hotel_rates r $whereSql", $params)['c'] ?? 0);

        $page = max(1, (int)(query_param('page') ?: 1));
        $per  = min(200, max(1, (int)(query_param('per_page') ?: 50)));
        $off  = ($page - 1) * $per;

        [$policyCols, $policyJoin] = rate_child_policy_sql();
        $items = fetch_all(
            "SELECT r.*, " . rate_hotel_info_select('h') . $policyCols . "
             FROM hotel_rates r
             LEFT JOIN hotels h ON h.id = r.hotel_id
             $policyJoin
             $whereSql ORDER BY r.updated_at DESC LIMIT $per OFFSET $off",
            $params
        );
        ok(['items' => $items, 'total' => $total, 'page' => $page, 'per_page' => $per]);
    }

    // GET /rates/:id
    if ($method === 'GET' && $id !== null) {
        [$visSql, $visParams] = rates_visibility($user, 'r');
        [$policyCols, $policyJoin] = rate_child_policy_sql();
        $row = fetch_one(
            "SELECT r.*, " . rate_hotel_info_select('h') . $policyCols . "
             FROM hotel_rates r
             LEFT JOIN hotels h ON h.id = r.hotel_id
             $policyJoin
             WHERE r.id = ? AND $visSql",
            array_merge([$id], $visParams)
        );
        if (!$row) fail('السعر غير موجود أو خارج نطاقك.', 404, 'not_found');
        ok($row);
    }

    // POST /rates (single)
    if ($method === 'POST' && $id === null) {
        require_edit($user);
        v_required($body, 'hotel_id', 'الفندق');
        $newId = insert_rate($body, $user);
        log_audit('create', 'rate', $newId, null, $body);
        created(fetch_one('SELECT * FROM hotel_rates WHERE id = ?', [$newId]));
    }

    // PUT/PATCH /rates/:id
    if (($method === 'PUT' || $method === 'PATCH') && $id !== null) {
        require_edit($user);
        $old = fetch_one('SELECT * FROM hotel_rates WHERE id = ?', [$id]);
        if (!$old) fail('السعر غير موجود.', 404, 'not_found');
        if ($old['status'] === 'Archived' && $user['role'] !== 'admin') {
            fail('الأسعار المؤرشفة لا يمكن تعديلها إلا بواسطة المدير.', 403, 'forbidden');
        }

        if (array_key_exists('child_policy_id', $body) || array_key_exists('child_policy_code', $body)) {
            $body['child_policy_id'] = child_policy_resolve_for_hotel((int)$old['hotel_id'], $body['child_policy_id'] ?? null, v_str($body['child_policy_code'] ?? null));
        }

        $fields = [
            'package_id' => fn($v) => v_int($v),
            'offer_name' => fn($v) => v_str($v, 190),
            'season_name'=> fn($v) => v_str($v, 190),
            'region'     => fn($v) => v_str($v, 120),
            'sub_region' => fn($v) => v_str($v, 120),
            'category'   => fn($v) => v_enum($v, CATEGORIES, $old['category']),
            'date_from'  => fn($v) => v_date($v),
            'date_to'    => fn($v) => v_date($v),
            'room_type'  => fn($v) => v_str($v, 60),
            'meal_plan'  => fn($v) => v_enum($v, MEAL_PLANS, $old['meal_plan']),
            'pricing_basis' => fn($v) => v_enum($v, PRICING_BASES, $old['pricing_basis']),
            'currency'   => fn($v) => v_enum($v, CURRENCIES, $old['currency']),
            'adult_price'=> fn($v) => v_num($v),
            'child_price'=> fn($v) => v_num($v),
            'child_age_from' => fn($v) => v_num($v),
            'child_age_to'   => fn($v) => v_num($v),
            'child_policy_id' => fn($v) => v_int($v),
            'nights'     => fn($v) => v_int($v),
            'days'       => fn($v) => v_int($v),
            'transfer_included' => fn($v) => v_enum($v, TRANSFER_OPTS, $old['transfer_included']),
            'transfer_details'  => fn($v) => v_str($v),
            'child_policy'      => fn($v) => v_str($v),
            'cancellation_policy' => fn($v) => v_str($v),
            'booking_notes'     => fn($v) => v_str($v),
            'status'     => fn($v) => v_enum($v, RATE_STATUSES, $old['status']),
        ];
        $set = []; $params = [];
        foreach ($fields as $key => $caster) {
            if (array_key_exists($key, $body)) {
                $set[] = "$key = ?";
                $params[] = $caster($body[$key]);
            }
        }
        if ($set) {
            $set[] = 'updated_by = ?'; $params[] = $user['id'];
            $params[] = $id;
            q('UPDATE hotel_rates SET ' . implode(', ', $set) . ' WHERE id = ?', $params);
        }
        log_audit('update', 'rate', $id, $old, $body);
        ok(fetch_one('SELECT * FROM hotel_rates WHERE id = ?', [$id]));
    }

    // DELETE /rates/:id
    if ($method === 'DELETE' && $id !== null) {
        require_edit($user);
        $old = fetch_one('SELECT * FROM hotel_rates WHERE id = ?', [$id]);
        if (!$old) fail('السعر غير موجود.', 404, 'not_found');
        if ($old['status'] === 'Archived' && $user['role'] !== 'admin') {
            fail('الأسعار المؤرشفة لا يمكن حذفها إلا بواسطة المدير.', 403, 'forbidden');
        }
        q('DELETE FROM hotel_rates WHERE id = ?', [$id]);
        log_audit('delete', 'rate', $id, $old, null);
        ok(['deleted' => true]);
    }

    fail('مسار غير صحيح.', 404, 'not_found');
}
