<?php
/**
 * Scope-based permissions (server-side RLS equivalent).
 *
 * Roles:
 *   admin, operations  -> full read/write on everything.
 *   sales              -> READ only, Ready rates only, within allowed scopes.
 *   viewer             -> READ only, Ready rates only, within allowed scopes.
 *
 * Scope rules live in user_access_rules:
 *   scope_type: all | region | hotel_group | hotel | package
 *   scope_id  : id of group/hotel/package   (NULL for 'all')
 *   scope_value: string value for region matching
 */

function user_rules(array $user): array
{
    static $cache = [];
    $uid = $user['id'];
    if (isset($cache[$uid])) return $cache[$uid];
    $cache[$uid] = fetch_all(
        'SELECT scope_type,scope_id,scope_value,can_view,can_edit,can_export
         FROM user_access_rules WHERE user_id = ?',
        [$uid]
    );
    return $cache[$uid];
}

function is_privileged(array $user): bool
{
    return in_array($user['role'], ['admin', 'operations'], true);
}

function normalize_nav_tabs($raw): ?array
{
    if ($raw === null || $raw === '') return null;
    $value = is_array($raw) ? $raw : json_decode((string)$raw, true);
    if (!is_array($value)) return null;
    $allowed = ['dashboard', 'hotels', 'groups', 'packages', 'sales', 'quotes', 'users', 'system', 'settings'];
    $out = [];
    foreach ($value as $key) {
        $key = (string)$key;
        if (in_array($key, $allowed, true) && !in_array($key, $out, true)) $out[] = $key;
    }
    return $out;
}

function encode_nav_tabs($value): ?string
{
    $tabs = normalize_nav_tabs($value);
    if ($tabs === null) return null;
    return json_encode($tabs, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

/** Can this user edit rates/hotels/packages at all? */
function can_edit_data(array $user): bool
{
    if (is_privileged($user)) return true;
    foreach (user_rules($user) as $r) {
        if ((int)$r['can_edit'] === 1) return true;
    }
    return false;
}

/** Can this user export offers/quotes? */
function can_export(array $user): bool
{
    if (is_privileged($user)) return true;
    foreach (user_rules($user) as $r) {
        if ((int)$r['can_export'] === 1) return true;
    }
    return false;
}

/**
 * Build a SQL WHERE fragment that limits hotel_rates visibility for $user.
 * Returns [sql, params]. Always safe to AND into a query.
 *
 * @param string $alias table alias for hotel_rates (default 'r')
 */
function rates_visibility(array $user, string $alias = 'r'): array
{
    // Privileged roles see everything.
    if (is_privileged($user)) {
        return ['1=1', []];
    }

    $clauses = [];
    $params  = [];

    // Sales & Viewer only ever see Ready rates.
    $clauses[] = "$alias.status = 'Ready'";

    // Scope filter from access rules (can_view = 1).
    $rules = array_filter(user_rules($user), fn($r) => (int)$r['can_view'] === 1);
    if (empty($rules)) {
        // No view rules at all -> see nothing.
        return ['1=0', []];
    }

    $hasAll = false;
    $scopeOr = [];
    foreach ($rules as $r) {
        switch ($r['scope_type']) {
            case 'all':
                $hasAll = true;
                break;
            case 'region':
                $scopeOr[] = "$alias.region = ?";
                $params[]  = $r['scope_value'];
                break;
            case 'hotel_group':
                $scopeOr[] = "$alias.hotel_group_id = ?";
                $params[]  = $r['scope_id'];
                break;
            case 'hotel':
                $scopeOr[] = "$alias.hotel_id = ?";
                $params[]  = $r['scope_id'];
                break;
            case 'package':
                $scopeOr[] = "$alias.package_id = ?";
                $params[]  = $r['scope_id'];
                break;
        }
    }

    if (!$hasAll) {
        if (empty($scopeOr)) {
            return ['1=0', []];
        }
        $clauses[] = '(' . implode(' OR ', $scopeOr) . ')';
    } else {
        // 'all' scope means no extra geo filter; drop collected params.
        $params = [];
    }

    return [implode(' AND ', $clauses), $params];
}

/** Throw 403 unless user can edit data. */
function require_edit(array $user): void
{
    if (!can_edit_data($user)) {
        fail('هذا الإجراء متاح لفريق العمليات والمدير فقط.', 403, 'forbidden');
    }
}
