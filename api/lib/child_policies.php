<?php
/** Structured child policies, with legacy fallback kept intact. */

const CHILD_POLICY_PRICING_TYPES = ['free', 'fixed', 'percent_adult', 'adult_rate', 'manual'];
const CHILD_POLICY_BED_TYPES     = ['sharing', 'extra_bed', 'any'];
const CHILD_POLICY_STATUSES      = ['Active', 'Inactive'];

function child_policy_schema_ready(): bool
{
    return db_table_exists('child_policies')
        && db_table_exists('child_policy_rules')
        && db_column_exists('hotel_rates', 'child_policy_id')
        && db_column_exists('hotels', 'default_child_policy_id');
}

function child_policy_add_index_if_missing(string $table, string $index, string $sql): void
{
    if (!db_index_exists($table, $index)) q($sql);
}

function ensure_child_policy_schema(): void
{
    static $done = false;
    if ($done) return;
    $done = true;

    q("CREATE TABLE IF NOT EXISTS child_policies (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        hotel_id BIGINT UNSIGNED NOT NULL,
        policy_code VARCHAR(80) NOT NULL,
        policy_name VARCHAR(190) NOT NULL,
        description TEXT NULL,
        min_adults TINYINT UNSIGNED NOT NULL DEFAULT 1,
        max_children TINYINT UNSIGNED NOT NULL DEFAULT 0,
        status ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
        created_by BIGINT UNSIGNED NULL,
        updated_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_child_policy_hotel_code (hotel_id, policy_code),
        KEY idx_child_policy_hotel (hotel_id),
        KEY idx_child_policy_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    q("CREATE TABLE IF NOT EXISTS child_policy_rules (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        child_policy_id BIGINT UNSIGNED NOT NULL,
        child_number_from TINYINT UNSIGNED NOT NULL DEFAULT 1,
        child_number_to TINYINT UNSIGNED NOT NULL DEFAULT 1,
        age_from DECIMAL(4,2) NOT NULL DEFAULT 0,
        age_to DECIMAL(4,2) NOT NULL DEFAULT 11.99,
        pricing_type ENUM('free','fixed','percent_adult','adult_rate','manual') NOT NULL DEFAULT 'manual',
        value DECIMAL(12,2) NULL,
        bed_type ENUM('sharing','extra_bed','any') NOT NULL DEFAULT 'any',
        notes TEXT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_child_rule_policy (child_policy_id),
        KEY idx_child_rule_sort (child_policy_id, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    if (!db_column_exists('hotel_rates', 'child_policy_id')) {
        q('ALTER TABLE hotel_rates ADD COLUMN child_policy_id BIGINT UNSIGNED NULL AFTER child_age_to');
    }
    if (!db_column_exists('hotels', 'default_child_policy_id')) {
        q('ALTER TABLE hotels ADD COLUMN default_child_policy_id BIGINT UNSIGNED NULL AFTER child_policy_default');
    }

    child_policy_add_index_if_missing('hotel_rates', 'idx_rates_child_policy', 'ALTER TABLE hotel_rates ADD KEY idx_rates_child_policy (child_policy_id)');
    child_policy_add_index_if_missing('hotels', 'idx_hotels_default_child_policy', 'ALTER TABLE hotels ADD KEY idx_hotels_default_child_policy (default_child_policy_id)');
}

function child_policy_summary_from_rules(array $rules): string
{
    $parts = [];
    foreach ($rules as $r) {
        $childNo = (int)$r['child_number_from'] === (int)$r['child_number_to']
            ? 'child ' . (int)$r['child_number_from']
            : 'children ' . (int)$r['child_number_from'] . '-' . (int)$r['child_number_to'];
        $age = number_format((float)$r['age_from'], 2, '.', '') . '-' . number_format((float)$r['age_to'], 2, '.', '');
        $type = (string)$r['pricing_type'];
        $value = $r['value'];
        if ($type === 'free') $price = 'free';
        elseif ($type === 'fixed') $price = number_format((float)$value, 0) . ' fixed';
        elseif ($type === 'percent_adult') $price = number_format((float)$value, 0) . '% adult';
        elseif ($type === 'adult_rate') $price = 'adult rate';
        else $price = 'manual confirmation';
        $parts[] = "$childNo age $age: $price";
    }
    return implode('; ', array_slice($parts, 0, 4)) . (count($parts) > 4 ? '...' : '');
}

function child_policy_fetch(int $id, bool $includeInactive = true): ?array
{
    if (!child_policy_schema_ready()) return null;
    $where = $includeInactive ? 'id = ?' : "id = ? AND status = 'Active'";
    $policy = fetch_one("SELECT * FROM child_policies WHERE $where", [$id]);
    if (!$policy) return null;
    $rules = fetch_all('SELECT * FROM child_policy_rules WHERE child_policy_id = ? ORDER BY sort_order, id', [$id]);
    $policy['rules'] = $rules;
    $policy['summary'] = child_policy_summary_from_rules($rules);
    return $policy;
}

function child_policy_list(?int $hotelId = null, bool $includeInactive = true): array
{
    if (!child_policy_schema_ready()) return [];
    $where = [];
    $params = [];
    if ($hotelId) { $where[] = 'hotel_id = ?'; $params[] = $hotelId; }
    if (!$includeInactive) $where[] = "status = 'Active'";
    $sql = 'SELECT * FROM child_policies' . ($where ? (' WHERE ' . implode(' AND ', $where)) : '') . ' ORDER BY status, policy_name';
    $rows = fetch_all($sql, $params);
    foreach ($rows as &$p) {
        $p['rules'] = fetch_all('SELECT * FROM child_policy_rules WHERE child_policy_id = ? ORDER BY sort_order, id', [(int)$p['id']]);
        $p['summary'] = child_policy_summary_from_rules($p['rules']);
    }
    unset($p);
    return $rows;
}

function child_policy_validate_rules(array $rules, int $maxChildren): array
{
    $out = [];
    foreach ($rules as $idx => $r) {
        if (!is_array($r)) fail('Invalid child policy rule.', 422, 'validation', ['rule' => $idx + 1]);
        $fromNo = v_int($r['child_number_from'] ?? 1) ?? 1;
        $toNo   = v_int($r['child_number_to'] ?? $fromNo) ?? $fromNo;
        $ageFrom = v_num($r['age_from'] ?? 0);
        $ageTo   = v_num($r['age_to'] ?? 11.99);
        $type = v_enum($r['pricing_type'] ?? 'manual', CHILD_POLICY_PRICING_TYPES, 'manual');
        $bed = v_enum($r['bed_type'] ?? 'any', CHILD_POLICY_BED_TYPES, 'any');
        $value = array_key_exists('value', $r) ? v_num($r['value']) : null;

        if ($fromNo < 1 || $toNo < $fromNo) fail('Child order range is invalid.', 422, 'validation', ['rule' => $idx + 1]);
        if ($maxChildren > 0 && $toNo > $maxChildren) fail('Child rule exceeds max_children.', 422, 'validation', ['rule' => $idx + 1]);
        if ($ageFrom === null || $ageTo === null || $ageFrom < 0 || $ageTo > 17.99 || $ageFrom >= $ageTo) {
            fail('Child age range must be 0-17.99 and age_from must be smaller than age_to.', 422, 'validation', ['rule' => $idx + 1]);
        }
        if ($type === 'percent_adult' && ($value === null || $value < 0 || $value > 100)) {
            fail('Percent child pricing must be between 0 and 100.', 422, 'validation', ['rule' => $idx + 1]);
        }
        if ($type === 'fixed' && ($value === null || $value < 0)) {
            fail('Fixed child price must be zero or higher.', 422, 'validation', ['rule' => $idx + 1]);
        }
        if ($type === 'free') $value = 0;
        if (in_array($type, ['manual', 'adult_rate'], true)) $value = null;

        foreach ($out as $old) {
            $sameBed = $old['bed_type'] === $bed || $old['bed_type'] === 'any' || $bed === 'any';
            $childOverlap = $fromNo <= $old['child_number_to'] && $toNo >= $old['child_number_from'];
            $ageOverlap = $ageFrom < (float)$old['age_to'] && $ageTo > (float)$old['age_from'];
            if ($sameBed && $childOverlap && $ageOverlap) {
                fail('Child policy rules overlap for the same child/age/bed condition.', 422, 'validation', ['rule' => $idx + 1]);
            }
        }

        $out[] = [
            'child_number_from' => $fromNo,
            'child_number_to'   => $toNo,
            'age_from'          => $ageFrom,
            'age_to'            => $ageTo,
            'pricing_type'      => $type,
            'value'             => $value,
            'bed_type'          => $bed,
            'notes'             => v_str($r['notes'] ?? null),
            'sort_order'        => v_int($r['sort_order'] ?? $idx) ?? $idx,
        ];
    }
    return $out;
}

function child_policy_validate_payload(array $body, ?array $old = null): array
{
    $hotelId = v_int($body['hotel_id'] ?? ($old['hotel_id'] ?? null));
    if (!$hotelId) fail('hotel_id is required for child policy.', 422, 'validation');
    if (!fetch_one('SELECT id FROM hotels WHERE id = ?', [$hotelId])) fail('Hotel not found for child policy.', 422, 'validation');
    $code = strtoupper((string)(v_str($body['policy_code'] ?? ($old['policy_code'] ?? null), 80) ?? ''));
    if ($code === '') fail('policy_code is required.', 422, 'validation');
    if (!preg_match('/^[A-Z0-9][A-Z0-9_-]{1,79}$/', $code)) {
        fail('policy_code must use letters, numbers, underscore or dash.', 422, 'validation');
    }
    $name = v_str($body['policy_name'] ?? ($old['policy_name'] ?? null), 190);
    if ($name === null) fail('policy_name is required.', 422, 'validation');
    $minAdults = v_int($body['min_adults'] ?? ($old['min_adults'] ?? 1)) ?? 1;
    $maxChildren = v_int($body['max_children'] ?? ($old['max_children'] ?? 0)) ?? 0;
    if ($minAdults < 1) fail('min_adults must be at least 1.', 422, 'validation');
    if ($maxChildren < 0) fail('max_children must be zero or more.', 422, 'validation');
    $status = v_enum($body['status'] ?? ($old['status'] ?? 'Active'), CHILD_POLICY_STATUSES, 'Active');
    $rulesRaw = array_key_exists('rules', $body) ? (array)$body['rules'] : [];
    $rules = child_policy_validate_rules($rulesRaw, $maxChildren);

    return [
        'hotel_id'      => $hotelId,
        'policy_code'  => $code,
        'policy_name'  => $name,
        'description'  => v_str($body['description'] ?? ($old['description'] ?? null)),
        'min_adults'   => $minAdults,
        'max_children' => $maxChildren,
        'status'       => $status,
        'rules'        => $rules,
    ];
}

function child_policy_lookup_by_code(int $hotelId, string $code): ?array
{
    if (!child_policy_schema_ready()) return null;
    $code = strtoupper(trim($code));
    $row = fetch_one("SELECT id FROM child_policies WHERE hotel_id = ? AND policy_code = ? AND status = 'Active'", [$hotelId, $code]);
    return $row ? child_policy_fetch((int)$row['id'], false) : null;
}

function child_policy_resolve_for_hotel(int $hotelId, $idOrNull, ?string $code = null): ?int
{
    ensure_child_policy_schema();
    if (($idOrNull === null || $idOrNull === '') && ($code === null || trim($code) === '')) return null;
    if ($code !== null && trim($code) !== '') {
        $policy = child_policy_lookup_by_code($hotelId, $code);
        if (!$policy) fail('child_policy_code is not active or does not belong to this hotel.', 422, 'validation');
        return (int)$policy['id'];
    }
    $id = v_int($idOrNull);
    if (!$id) return null;
    $policy = child_policy_fetch($id, false);
    if (!$policy || (int)$policy['hotel_id'] !== $hotelId) {
        fail('child_policy_id is not active or does not belong to this hotel.', 422, 'validation');
    }
    return $id;
}

function child_policy_public_object(?array $policy): ?array
{
    if (!$policy || ($policy['status'] ?? null) !== 'Active') return null;
    $rules = [];
    foreach (($policy['rules'] ?? []) as $r) {
        $rules[] = [
            'child_number_from' => (int)$r['child_number_from'],
            'child_number_to'   => (int)$r['child_number_to'],
            'age_from'          => (float)$r['age_from'],
            'age_to'            => (float)$r['age_to'],
            'pricing_type'      => $r['pricing_type'],
            'value'             => $r['value'] !== null ? (float)$r['value'] : null,
            'bed_type'          => $r['bed_type'],
            'notes'             => $r['notes'] ?? null,
        ];
    }
    $requiresManual = empty($rules);
    foreach ($rules as $rule) {
        if ($rule['pricing_type'] === 'manual') {
            $requiresManual = true;
            break;
        }
    }
    return [
        'id'           => (int)$policy['id'],
        'code'         => $policy['policy_code'],
        'name'         => $policy['policy_name'],
        'description'  => $policy['description'] ?? null,
        'min_adults'   => (int)$policy['min_adults'],
        'max_children' => (int)$policy['max_children'],
        'rules'        => $rules,
        'requires_manual_confirmation' => $requiresManual,
    ];
}

function child_policy_legacy_public(?array $row): ?array
{
    if (!$row) return null;
    if (($row['child_price'] ?? null) === null && ($row['child_age_from'] ?? null) === null && ($row['child_age_to'] ?? null) === null) {
        return [
            'legacy' => true,
            'name' => 'Child price requires confirmation',
            'min_adults' => 1,
            // Keep the form usable even before Operations defines a structured
            // policy. Checkout will collect ages then route to manual confirmation.
            'max_children' => 4,
            'rules' => [],
            'requires_manual_confirmation' => true,
        ];
    }
    return [
        'legacy' => true,
        'name' => 'Legacy child rule',
        'min_adults' => 1,
        'max_children' => 1,
        'rules' => [[
            'child_number_from' => 1,
            'child_number_to'   => 1,
            'age_from'          => $row['child_age_from'] !== null ? (float)$row['child_age_from'] : 0,
            'age_to'            => $row['child_age_to'] !== null ? (float)$row['child_age_to'] : 11.99,
            'pricing_type'      => 'fixed',
            'value'             => $row['child_price'] !== null ? (float)$row['child_price'] : null,
            'bed_type'          => 'any',
        ]],
        'requires_manual_confirmation' => $row['child_price'] === null,
    ];
}

function child_policy_public_for_rate(array $row): ?array
{
    if (!child_policy_schema_ready()) return child_policy_legacy_public($row);
    $policyId = v_int($row['child_policy_id'] ?? null) ?: v_int($row['default_child_policy_id'] ?? null);
    if ($policyId) {
        $policy = child_policy_fetch($policyId, false);
        if ($policy) return child_policy_public_object($policy);
    }
    return child_policy_legacy_public($row);
}
