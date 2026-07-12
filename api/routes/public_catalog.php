<?php
/**
 * ELBAKRI Hotel Rate Hub — public storefront catalog.
 *
 * Active packages, hotel groups and package_hotels membership are the public
 * catalog structure. Only Ready rates are exposed. Internal costs, notes,
 * users, quotes and non-ready rates never leave the operations system.
 */

function public_catalog_period_key(array $row): string
{
    return implode('|', [
        $row['season_name'] ?? '',
        $row['date_from'] ?? '',
        $row['date_to'] ?? '',
        $row['meal_plan'] ?? '',
        $row['pricing_basis'] ?? '',
        $row['nights'] ?? '',
        $row['days'] ?? '',
    ]);
}

function public_catalog_empty_period(array $row): array
{
    $num = static fn ($value) => $value !== null ? (float) $value : null;
    $int = static fn ($value) => $value !== null ? (int) $value : null;

    return [
        'season_name'          => $row['season_name'],
        'date_from'            => $row['date_from'],
        'date_to'              => $row['date_to'],
        'meal_plan'            => $row['meal_plan'],
        'currency'             => $row['currency'] ?: 'EGP',
        'pricing_basis'        => $row['pricing_basis'],
        'nights'               => $int($row['nights']),
        'days'                 => $int($row['days']),
        'single'               => null,
        'double'               => null,
        'triple'               => null,
        'adult_price'          => null,
        'child_price'          => $num($row['child_price']),
        'child_age_from'       => $num($row['child_age_from']),
        'child_age_to'         => $num($row['child_age_to']),
        'child_policy'         => null,
        'child_policy_by_room' => null,
    ];
}

function public_catalog_add_rate(array &$period, array $row): void
{
    $price = $row['adult_price'] !== null ? (float) $row['adult_price'] : null;
    $slot = strtolower((string) $row['room_type']);

    if (in_array($slot, ['single', 'double', 'triple'], true) && $price !== null) {
        $period[$slot] = $price;
    }
    if ($price !== null && ($period['adult_price'] === null || $price < $period['adult_price'])) {
        $period['adult_price'] = $price;
    }
    if ($period['child_price'] === null && $row['child_price'] !== null) {
        $period['child_price'] = (float) $row['child_price'];
    }

    $policy = child_policy_public_for_rate($row);
    if ($policy === null) return;

    if ($period['child_policy'] === null) {
        $period['child_policy'] = $policy;
    }
    if (in_array($slot, ['single', 'double', 'triple'], true)) {
        if ($period['child_policy_by_room'] === null) $period['child_policy_by_room'] = [];
        $period['child_policy_by_room'][$slot] = $policy;
    }
}

function route_public_catalog(string $method, array $seg, array $body): void
{
    if ($method !== 'GET') {
        fail('يسمح فقط بـ GET.', 405, 'method_not_allowed');
    }

    $expected = (string) (config('PUBLIC_CATALOG_TOKEN') ?? '');
    $given = (string) (query_param('token') ?? '');
    if ($expected === '' || !hash_equals($expected, $given)) {
        fail('رمز الوصول غير صحيح.', 403, 'forbidden');
    }

    $where = ["p.status = 'Active'"];
    $params = [];
    $region = query_param('region');
    if (is_string($region) && $region !== '') {
        $where[] = '(p.region = ? OR h.region = ? OR h.sub_region = ?)';
        array_push($params, $region, $region, $region);
    }
    $whereSql = 'WHERE ' . implode(' AND ', $where);
    $hasChildPolicies = child_policy_schema_ready();
    $childColumns = $hasChildPolicies
        ? ', r.child_policy_id, h.default_child_policy_id'
        : ', NULL AS child_policy_id, NULL AS default_child_policy_id';

    $rows = fetch_all(
        "SELECT
            p.id AS package_id, p.package_name, p.package_type,
            p.region AS package_region, p.description AS package_description,
            p.default_meal_plan, p.default_pricing_basis,
            p.hotel_group_id, g.name AS group_name, g.brand_name AS group_brand_name,
            g.region AS group_region,
            h.id AS hotel_id, h.hotel_name, h.region AS hotel_region,
            h.sub_region, h.star_rating, h.description AS hotel_description,
            h.facilities, h.child_policy_default, h.transfer_notes_default,
            r.id AS rate_id, r.season_name, r.date_from, r.date_to,
            r.room_type, r.meal_plan, r.currency, r.pricing_basis,
            r.adult_price, r.child_price, r.child_age_from, r.child_age_to,
            r.nights, r.days
            $childColumns
         FROM packages p
         LEFT JOIN hotel_groups g ON g.id = p.hotel_group_id
         LEFT JOIN package_hotels ph ON ph.package_id = p.id
         LEFT JOIN hotels h ON h.id = ph.hotel_id AND h.status = 'Active'
         LEFT JOIN hotel_rates r ON r.hotel_id = h.id AND r.status = 'Ready'
         $whereSql
         ORDER BY COALESCE(p.region, h.region), COALESCE(g.name, ''),
                  p.package_name, h.hotel_name, r.date_from, r.date_to,
                  r.season_name, r.meal_plan, r.room_type",
        $params
    );

    $packages = [];
    $packageIndexes = [];
    $hotelIndexes = [];
    $periodIndexes = [];
    $groups = [];

    foreach ($rows as $row) {
        $packageId = (int) $row['package_id'];
        if (!isset($packageIndexes[$packageId])) {
            $packageIndexes[$packageId] = count($packages);
            $packages[] = [
                'id'                    => $packageId,
                'package_name'          => $row['package_name'],
                'package_type'          => $row['package_type'],
                'region'                => $row['package_region'],
                'description'           => $row['package_description'],
                'default_meal_plan'     => $row['default_meal_plan'],
                'default_pricing_basis' => $row['default_pricing_basis'],
                'hotel_group_id'        => $row['hotel_group_id'] !== null ? (int) $row['hotel_group_id'] : null,
                'group_name'            => $row['group_name'],
                'group_brand_name'      => $row['group_brand_name'],
                'hotels'                => [],
            ];
        }

        if ($row['hotel_group_id'] !== null) {
            $groupId = (int) $row['hotel_group_id'];
            if (!isset($groups[$groupId])) {
                $groups[$groupId] = [
                    'id'         => $groupId,
                    'name'       => $row['group_name'],
                    'brand_name' => $row['group_brand_name'],
                    'region'     => $row['group_region'],
                    'package_ids'=> [],
                ];
            }
            if (!in_array($packageId, $groups[$groupId]['package_ids'], true)) {
                $groups[$groupId]['package_ids'][] = $packageId;
            }
        }

        // LEFT JOIN keeps active empty packages visible in the storefront.
        if ($row['hotel_id'] === null) continue;

        $packageIndex = $packageIndexes[$packageId];
        $hotelId = (int) $row['hotel_id'];
        $hotelMapKey = $packageId . '|' . $hotelId;
        if (!isset($hotelIndexes[$hotelMapKey])) {
            $hotelIndexes[$hotelMapKey] = count($packages[$packageIndex]['hotels']);
            $packages[$packageIndex]['hotels'][] = [
                'id'                     => $hotelId,
                'hotel_name'             => $row['hotel_name'],
                'region'                 => $row['hotel_region'] ?: $row['package_region'],
                'sub_region'             => $row['sub_region'],
                'star_rating'            => $row['star_rating'] !== null ? (int) $row['star_rating'] : null,
                'description'            => $row['hotel_description'],
                'facilities'             => $row['facilities'],
                'child_policy_default'   => $row['child_policy_default'],
                'transfer_notes_default' => $row['transfer_notes_default'],
                'periods'                => [],
            ];
        }

        // An assigned hotel can appear before its first rate is Ready.
        if ($row['rate_id'] === null) continue;

        $hotelIndex = $hotelIndexes[$hotelMapKey];
        $periodKey = public_catalog_period_key($row);
        $periodMapKey = $hotelMapKey . '|' . $periodKey;
        if (!isset($periodIndexes[$periodMapKey])) {
            $periodIndexes[$periodMapKey] = count($packages[$packageIndex]['hotels'][$hotelIndex]['periods']);
            $packages[$packageIndex]['hotels'][$hotelIndex]['periods'][] = public_catalog_empty_period($row);
        }
        $periodIndex = $periodIndexes[$periodMapKey];
        public_catalog_add_rate($packages[$packageIndex]['hotels'][$hotelIndex]['periods'][$periodIndex], $row);
    }

    // Backward-compatible flat collection for older storefront builds.
    $legacyHotels = [];
    foreach ($packages as $package) {
        foreach ($package['hotels'] as $hotel) {
            $key = $hotel['id'] . '|' . $package['id'];
            $legacyHotels[$key] = [
                'hotel_name'   => $hotel['hotel_name'],
                'region'       => $hotel['region'] ?: $package['region'],
                'sub_region'   => $hotel['sub_region'],
                'category'     => $package['package_type'] ?: $package['package_name'],
                'package_name' => $package['package_name'],
                'star_rating'  => $hotel['star_rating'],
                'periods'      => $hotel['periods'],
            ];
        }
    }

    $honeymoon = [];
    try {
        $honeymoonRows = fetch_all(
            "SELECT o.id, o.hotel_name, o.offer_name, o.region, o.features,
                    p.date_from, p.date_to, p.price_label, p.price, p.currency,
                    p.notes, p.sort_order
               FROM honeymoon_offers o
               LEFT JOIN honeymoon_offer_periods p ON p.honeymoon_offer_id = o.id
              WHERE o.status = 'Ready'
              ORDER BY o.region, o.hotel_name, o.id, p.sort_order, p.date_from, p.id"
        );
        $honeymoonIndexes = [];
        foreach ($honeymoonRows as $row) {
            $id = (int) $row['id'];
            if (!isset($honeymoonIndexes[$id])) {
                $honeymoonIndexes[$id] = count($honeymoon);
                $honeymoon[] = [
                    'id' => $id, 'hotel_name' => $row['hotel_name'],
                    'offer_name' => $row['offer_name'], 'region' => $row['region'],
                    'features' => $row['features'], 'periods' => [],
                ];
            }
            if ($row['date_from'] === null && $row['date_to'] === null &&
                $row['price_label'] === null && $row['price'] === null) continue;
            $honeymoon[$honeymoonIndexes[$id]]['periods'][] = [
                'date_from' => $row['date_from'], 'date_to' => $row['date_to'],
                'price_label' => $row['price_label'],
                'price' => $row['price'] !== null ? (float) $row['price'] : null,
                'currency' => $row['currency'] ?: 'EGP', 'notes' => $row['notes'],
            ];
        }
    } catch (Throwable $e) {
        $honeymoon = [];
    }

    ok([
        'version'          => 3,
        'generated_at'     => date('c'),
        'currency_default' => 'EGP',
        'count'            => count($legacyHotels),
        'hotel_groups'     => array_values($groups),
        'packages'         => $packages,
        'hotels'           => array_values($legacyHotels),
        'honeymoon'        => $honeymoon,
    ]);
}
