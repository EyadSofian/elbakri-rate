<?php
/** /api/honeymoon */

function ensure_honeymoon_tables(): void
{
    static $done = false;
    if ($done) return;
    $done = true;

    q("CREATE TABLE IF NOT EXISTS `honeymoon_offers` (
      `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      `hotel_name` VARCHAR(190) NOT NULL,
      `offer_name` VARCHAR(190) NOT NULL,
      `region` VARCHAR(120) NULL,
      `features` TEXT NULL,
      `internal_notes` TEXT NULL,
      `status` ENUM('Draft','Ready','Archived') NOT NULL DEFAULT 'Draft',
      `created_by` BIGINT UNSIGNED NULL,
      `updated_by` BIGINT UNSIGNED NULL,
      `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      KEY `idx_hm_status` (`status`),
      KEY `idx_hm_hotel` (`hotel_name`),
      KEY `idx_hm_region` (`region`),
      CONSTRAINT `fk_hm_created_by` FOREIGN KEY (`created_by`)
        REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT `fk_hm_updated_by` FOREIGN KEY (`updated_by`)
        REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    q("CREATE TABLE IF NOT EXISTS `honeymoon_offer_periods` (
      `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      `honeymoon_offer_id` BIGINT UNSIGNED NOT NULL,
      `date_from` DATE NULL,
      `date_to` DATE NULL,
      `price_label` VARCHAR(120) NULL,
      `price` DECIMAL(12,2) NULL,
      `currency` VARCHAR(3) NOT NULL DEFAULT 'EGP',
      `notes` TEXT NULL,
      `sort_order` INT NOT NULL DEFAULT 0,
      `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      KEY `idx_hmp_offer` (`honeymoon_offer_id`),
      KEY `idx_hmp_dates` (`date_from`,`date_to`),
      CONSTRAINT `fk_hmp_offer` FOREIGN KEY (`honeymoon_offer_id`)
        REFERENCES `honeymoon_offers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function sync_honeymoon_periods(int $offerId, array $periods): int
{
    q('DELETE FROM honeymoon_offer_periods WHERE honeymoon_offer_id = ?', [$offerId]);
    $count = 0;
    foreach ($periods as $idx => $p) {
        if (!is_array($p)) continue;
        $label = v_str($p['price_label'] ?? null, 120);
        $price = v_num($p['price'] ?? null);
        $notes = v_str($p['notes'] ?? null);
        $from = v_date($p['date_from'] ?? null);
        $to = v_date($p['date_to'] ?? null);
        if ($from !== null && $to !== null && $from > $to) {
            fail('تاريخ بداية الفترة يجب أن يكون قبل تاريخ النهاية.', 422, 'validation');
        }
        if ($label === null && $price === null && $notes === null && $from === null && $to === null) {
            continue;
        }
        q('INSERT INTO honeymoon_offer_periods
            (honeymoon_offer_id, date_from, date_to, price_label, price, currency, notes, sort_order)
           VALUES (?,?,?,?,?,?,?,?)',
            [
                $offerId,
                $from,
                $to,
                $label,
                $price,
                v_enum($p['currency'] ?? 'EGP', CURRENCIES, 'EGP'),
                $notes,
                v_int($p['sort_order'] ?? null) ?? $idx,
            ]
        );
        $count++;
    }
    return $count;
}

function honeymoon_offer_with_periods(int $id): ?array
{
    $offer = fetch_one(
        'SELECT o.*, cu.full_name AS created_by_name, uu.full_name AS updated_by_name
           FROM honeymoon_offers o
           LEFT JOIN users cu ON cu.id = o.created_by
           LEFT JOIN users uu ON uu.id = o.updated_by
          WHERE o.id = ?',
        [$id]
    );
    if (!$offer) return null;
    $offer['periods'] = fetch_all(
        'SELECT id, honeymoon_offer_id, date_from, date_to, price_label, price, currency, notes, sort_order
           FROM honeymoon_offer_periods
          WHERE honeymoon_offer_id = ?
          ORDER BY sort_order, date_from, id',
        [$id]
    );
    return $offer;
}

function route_honeymoon(string $method, array $seg, array $body): void
{
    ensure_honeymoon_tables();
    $user = require_auth();
    $id = isset($seg[0]) && is_numeric($seg[0]) ? (int)$seg[0] : null;

    if ($method === 'GET' && $id === null) {
        $where = [];
        $params = [];
        if (!is_privileged($user)) {
            $where[] = "o.status = 'Ready'";
        }
        if ($status = v_str(query_param('status'))) {
            $where[] = 'o.status = ?';
            $params[] = v_enum($status, RATE_STATUSES, 'Ready');
        }
        if ($q = v_str(query_param('q'))) {
            $where[] = '(o.hotel_name LIKE ? OR o.offer_name LIKE ? OR o.region LIKE ?)';
            $params[] = "%$q%";
            $params[] = "%$q%";
            $params[] = "%$q%";
        }
        $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

        $rows = fetch_all(
            "SELECT o.*,
                    (SELECT COUNT(*) FROM honeymoon_offer_periods p WHERE p.honeymoon_offer_id = o.id) AS periods_count,
                    (SELECT MIN(p.date_from) FROM honeymoon_offer_periods p WHERE p.honeymoon_offer_id = o.id) AS first_date,
                    (SELECT MAX(p.date_to) FROM honeymoon_offer_periods p WHERE p.honeymoon_offer_id = o.id) AS last_date
               FROM honeymoon_offers o
              $whereSql
              ORDER BY CASE o.status WHEN 'Ready' THEN 0 WHEN 'Draft' THEN 1 ELSE 2 END,
                       o.updated_at DESC, o.offer_name",
            $params
        );
        ok($rows);
    }

    if ($method === 'GET' && $id !== null) {
        $offer = honeymoon_offer_with_periods($id);
        if (!$offer) fail('عرض الهاني مون غير موجود.', 404, 'not_found');
        if (!is_privileged($user) && $offer['status'] !== 'Ready') {
            fail('عرض الهاني مون غير متاح ضمن صلاحياتك.', 404, 'not_found');
        }
        ok($offer);
    }

    if ($method === 'POST' && $id === null) {
        require_edit($user);
        $hotelName = v_required($body, 'hotel_name', 'اسم الفندق');
        $offerName = v_required($body, 'offer_name', 'اسم عرض الهاني مون');

        db()->beginTransaction();
        try {
            q('INSERT INTO honeymoon_offers
                (hotel_name, offer_name, region, features, internal_notes, status, created_by, updated_by)
               VALUES (?,?,?,?,?,?,?,?)',
                [
                    $hotelName,
                    $offerName,
                    v_str($body['region'] ?? null, 120),
                    v_str($body['features'] ?? null),
                    v_str($body['internal_notes'] ?? null),
                    v_enum($body['status'] ?? 'Draft', RATE_STATUSES, 'Draft'),
                    $user['id'],
                    $user['id'],
                ]
            );
            $newId = insert_id();
            if (isset($body['periods']) && is_array($body['periods'])) {
                sync_honeymoon_periods($newId, $body['periods']);
            }
            db()->commit();
        } catch (Throwable $e) {
            db()->rollBack();
            throw $e;
        }

        log_audit('create', 'honeymoon_offer', $newId, null, ['hotel_name' => $hotelName, 'offer_name' => $offerName]);
        created(honeymoon_offer_with_periods($newId));
    }

    if (($method === 'PUT' || $method === 'PATCH') && $id !== null) {
        require_edit($user);
        $old = honeymoon_offer_with_periods($id);
        if (!$old) fail('عرض الهاني مون غير موجود.', 404, 'not_found');

        db()->beginTransaction();
        try {
            q('UPDATE honeymoon_offers
                  SET hotel_name = ?, offer_name = ?, region = ?, features = ?,
                      internal_notes = ?, status = ?, updated_by = ?
                WHERE id = ?',
                [
                    v_str($body['hotel_name'] ?? $old['hotel_name'], 190) ?? $old['hotel_name'],
                    v_str($body['offer_name'] ?? $old['offer_name'], 190) ?? $old['offer_name'],
                    v_str($body['region'] ?? $old['region'], 120),
                    v_str($body['features'] ?? $old['features']),
                    v_str($body['internal_notes'] ?? $old['internal_notes']),
                    v_enum($body['status'] ?? $old['status'], RATE_STATUSES, $old['status']),
                    $user['id'],
                    $id,
                ]
            );
            if (array_key_exists('periods', $body) && is_array($body['periods'])) {
                sync_honeymoon_periods($id, $body['periods']);
            }
            db()->commit();
        } catch (Throwable $e) {
            db()->rollBack();
            throw $e;
        }

        log_audit('update', 'honeymoon_offer', $id, $old, $body);
        ok(honeymoon_offer_with_periods($id));
    }

    if ($method === 'DELETE' && $id !== null) {
        require_role(['admin', 'operations']);
        $old = honeymoon_offer_with_periods($id);
        if (!$old) fail('عرض الهاني مون غير موجود.', 404, 'not_found');
        q('DELETE FROM honeymoon_offers WHERE id = ?', [$id]);
        log_audit('delete', 'honeymoon_offer', $id, $old, null);
        ok(['deleted' => true]);
    }

    fail('مسار غير صحيح.', 404, 'not_found');
}
