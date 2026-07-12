<?php
/**
 * ELBAKRI Hotel Rate Hub — PUBLIC read-only catalog
 * --------------------------------------------------------------------
 * Exposes ONLY rows with status = 'Ready' from `hotel_rates`, grouped
 * into the shape the public website (elbakri_sharm) consumes:
 *
 *   { data: {
 *       generated_at: "2026-07-12T...",
 *       currency_default: "EGP",
 *       hotels: [
 *         {
 *           hotel_name, region, sub_region, category, package_name,
 *           star_rating,
 *           periods: [
 *             { season_name, date_from, date_to, meal_plan, currency,
 *               single, double, triple, adult_price, child_price,
 *               child_age_from, child_age_to, nights, days, pricing_basis }
 *           ]
 *         }, ...
 *       ]
 *   }}
 *
 * The nights / days / pricing_basis / child_age_* fields power the public
 * checkout price calculator (period × adults × children × nights). They are
 * additive — older site builds simply ignore any field they don't read.
 *
 * SECURITY
 *  - Read-only (GET). No auth session, but gated by a shared token so the
 *    endpoint is not wide-open to scrapers.
 *  - Add to api/config.php:  'PUBLIC_CATALOG_TOKEN' => '<long-random-string>'
 *  - Register in api/index.php $routes map:
 *        'public-catalog' => 'route_public_catalog',
 *  - Call:  GET /api/public-catalog?token=<PUBLIC_CATALOG_TOKEN>
 *           optional filter: &region=Sharm El Sheikh
 *
 * NOTE: never returns Draft/Archived rates, cost fields, users, or quotes.
 */

function route_public_catalog(string $method, array $seg, array $body): void
{
    if ($method !== 'GET') {
        fail('يسمح فقط بـ GET.', 405, 'method_not_allowed');
    }

    // ---- shared-token gate ----
    $expected = (string) (config('PUBLIC_CATALOG_TOKEN') ?? '');
    $given    = (string) (query_param('token') ?? '');
    if ($expected === '' || !hash_equals($expected, $given)) {
        fail('رمز الوصول غير صحيح.', 403, 'forbidden');
    }

    // ---- optional region filter ----
    $where  = ["r.status = 'Ready'", "(h.status IS NULL OR h.status = 'Active')"];
    $params = [];
    $region = query_param('region');
    if (is_string($region) && $region !== '') {
        $where[]  = 'r.region = ?';
        $params[] = $region;
    }
    $whereSql = 'WHERE ' . implode(' AND ', $where);

    // Denormalized snapshots on hotel_rates are the source of truth for
    // public display; hotels join only adds star_rating + active filter.
    $rows = fetch_all(
        "SELECT
            r.hotel_name, r.region, r.sub_region, r.category, r.package_name,
            r.offer_name, r.season_name, r.date_from, r.date_to,
            r.room_type, r.meal_plan, r.currency, r.pricing_basis,
            r.adult_price, r.child_price, r.child_age_from, r.child_age_to,
            r.nights, r.days,
            h.star_rating
         FROM hotel_rates r
         LEFT JOIN hotels h ON h.id = r.hotel_id
         $whereSql
         ORDER BY r.region, r.category, r.hotel_name,
                  r.date_from, r.season_name, r.room_type",
        $params
    );

    // ---- group: hotel -> period -> pivot room_type into single/double/triple ----
    $hotels  = [];   // key => hotel bucket
    $periods = [];   // "hotelKey::periodKey" => period bucket (by-ref into hotel)

    $num = static fn ($v) => $v !== null ? (float) $v : null; // decimal → float|null
    $int = static fn ($v) => $v !== null ? (int) $v   : null; // small int → int|null

    foreach ($rows as $row) {
        $hotelKey = $row['hotel_name'] . '|' . $row['region'] . '|' . $row['category'];

        if (!isset($hotels[$hotelKey])) {
            $hotels[$hotelKey] = [
                'hotel_name'   => $row['hotel_name'],
                'region'       => $row['region'],
                'sub_region'   => $row['sub_region'],
                'category'     => $row['category'],
                'package_name' => $row['package_name'],
                'star_rating'  => $row['star_rating'] !== null ? (int) $row['star_rating'] : null,
                'periods'      => [],
            ];
        }
        // Backfill a package name if the first row for this hotel had none.
        if (empty($hotels[$hotelKey]['package_name']) && !empty($row['package_name'])) {
            $hotels[$hotelKey]['package_name'] = $row['package_name'];
        }

        // A "period" = same season / date window for this hotel+category.
        $periodKey = ($row['season_name'] ?? '') . '|' . ($row['date_from'] ?? '') . '|' . ($row['date_to'] ?? '');
        $mapKey    = $hotelKey . '::' . $periodKey;

        if (!isset($periods[$mapKey])) {
            $idx = count($hotels[$hotelKey]['periods']);
            $hotels[$hotelKey]['periods'][$idx] = [
                'season_name'    => $row['season_name'],
                'date_from'      => $row['date_from'],
                'date_to'        => $row['date_to'],
                'meal_plan'      => $row['meal_plan'],
                'currency'       => $row['currency'] ?: 'EGP',
                'pricing_basis'  => $row['pricing_basis'],
                'nights'         => $int($row['nights']),
                'days'           => $int($row['days']),
                'single'         => null,
                'double'         => null,
                'triple'         => null,
                'adult_price'    => null,
                'child_price'    => $num($row['child_price']),
                'child_age_from' => $num($row['child_age_from']),
                'child_age_to'   => $num($row['child_age_to']),
            ];
            $periods[$mapKey] = &$hotels[$hotelKey]['periods'][$idx];
        }

        $price = $num($row['adult_price']);
        $slot  = strtolower((string) $row['room_type']); // single|double|triple|custom
        if (in_array($slot, ['single', 'double', 'triple'], true) && $price !== null) {
            $periods[$mapKey][$slot] = $price;
        }
        // Keep a generic adult_price (lowest seen) for single-price categories.
        if ($price !== null && ($periods[$mapKey]['adult_price'] === null || $price < $periods[$mapKey]['adult_price'])) {
            $periods[$mapKey]['adult_price'] = $price;
        }
        // Prefer a real meal plan / basis label if the first row had none.
        if (empty($periods[$mapKey]['meal_plan']) && !empty($row['meal_plan'])) {
            $periods[$mapKey]['meal_plan'] = $row['meal_plan'];
        }
        if (empty($periods[$mapKey]['pricing_basis']) && !empty($row['pricing_basis'])) {
            $periods[$mapKey]['pricing_basis'] = $row['pricing_basis'];
        }
        if ($periods[$mapKey]['nights'] === null && $row['nights'] !== null) {
            $periods[$mapKey]['nights'] = (int) $row['nights'];
        }
        if ($periods[$mapKey]['child_price'] === null && $row['child_price'] !== null) {
            $periods[$mapKey]['child_price'] = (float) $row['child_price'];
        }
        unset($slot, $price);
    }
    unset($periods); // drop references before serializing

    ok([
        'generated_at'     => date('c'),
        'currency_default' => 'EGP',
        'count'            => count($hotels),
        'hotels'           => array_values($hotels),
    ]);
}
