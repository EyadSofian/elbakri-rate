<?php
/** /api/users  — admin only */

function user_public(array $u): array
{
    return [
        'id'        => (int)$u['id'],
        'email'     => $u['email'],
        'full_name' => $u['full_name'],
        'role'      => $u['role'],
        'is_active' => (int)$u['is_active'],
        'created_at'=> $u['created_at'] ?? null,
    ];
}

function route_users(string $method, array $seg, array $body): void
{
    $admin = require_role(['admin']);
    $id = isset($seg[0]) && is_numeric($seg[0]) ? (int)$seg[0] : null;
    $sub = $seg[1] ?? null;

    if ($method === 'GET' && $id === null) {
        $rows = fetch_all('SELECT id,email,full_name,role,is_active,created_at FROM users ORDER BY created_at DESC');
        ok(array_map('user_public', $rows));
    }

    if ($method === 'GET' && $id !== null) {
        $u = fetch_one('SELECT * FROM users WHERE id = ?', [$id]);
        if (!$u) fail('المستخدم غير موجود.', 404, 'not_found');
        $out = user_public($u);
        $out['rules'] = fetch_all('SELECT * FROM user_access_rules WHERE user_id = ?', [$id]);
        ok($out);
    }

    if ($method === 'POST' && $id === null) {
        $email = strtolower(v_required($body, 'email', 'البريد الإلكتروني'));
        $name  = v_required($body, 'full_name', 'الاسم');
        $pass  = (string)($body['password'] ?? '');
        if (strlen($pass) < 6) fail('كلمة المرور 6 أحرف على الأقل.', 422, 'validation');
        if (fetch_one('SELECT id FROM users WHERE email = ?', [$email])) fail('البريد مستخدم بالفعل.', 422, 'validation');

        q('INSERT INTO users (email, full_name, password_hash, role, is_active) VALUES (?,?,?,?,?)',
            [
                $email, $name,
                password_hash($pass, PASSWORD_BCRYPT),
                v_enum($body['role'] ?? 'viewer', USER_ROLES, 'viewer'),
                v_bool($body['is_active'] ?? true),
            ]
        );
        $newId = insert_id();
        sync_user_rules($newId, $body['rules'] ?? null, $body['role'] ?? 'viewer');
        log_audit('create', 'user', $newId, null, ['email' => $email, 'role' => $body['role'] ?? 'viewer']);
        created(user_public(fetch_one('SELECT * FROM users WHERE id = ?', [$newId])));
    }

    if (($method === 'PUT' || $method === 'PATCH') && $id !== null) {
        $u = fetch_one('SELECT * FROM users WHERE id = ?', [$id]);
        if (!$u) fail('المستخدم غير موجود.', 404, 'not_found');

        $set = []; $params = [];
        if (isset($body['full_name'])) { $set[] = 'full_name = ?'; $params[] = v_str($body['full_name'], 190); }
        if (isset($body['role']))      { $set[] = 'role = ?';      $params[] = v_enum($body['role'], USER_ROLES, $u['role']); }
        if (array_key_exists('is_active', $body)) { $set[] = 'is_active = ?'; $params[] = v_bool($body['is_active']); }
        if (!empty($body['password'])) {
            if (strlen($body['password']) < 6) fail('كلمة المرور 6 أحرف على الأقل.', 422, 'validation');
            $set[] = 'password_hash = ?'; $params[] = password_hash($body['password'], PASSWORD_BCRYPT);
        }
        if ($set) { $params[] = $id; q('UPDATE users SET ' . implode(', ', $set) . ' WHERE id = ?', $params); }

        if (array_key_exists('rules', $body)) sync_user_rules($id, $body['rules'], $body['role'] ?? $u['role']);
        log_audit('update', 'user', $id, user_public($u), $body);
        ok(user_public(fetch_one('SELECT * FROM users WHERE id = ?', [$id])));
    }

    if ($method === 'DELETE' && $id !== null) {
        if ($id === (int)$admin['id']) fail('لا يمكنك حذف حسابك.', 422, 'validation');
        $u = fetch_one('SELECT * FROM users WHERE id = ?', [$id]);
        if (!$u) fail('المستخدم غير موجود.', 404, 'not_found');
        q('DELETE FROM users WHERE id = ?', [$id]);
        log_audit('delete', 'user', $id, user_public($u), null);
        ok(['deleted' => true]);
    }

    fail('مسار غير صحيح.', 404, 'not_found');
}

/** Replace a user's access rules. If $rules is null, apply a sensible default for the role. */
function sync_user_rules(int $userId, $rules, string $role): void
{
    q('DELETE FROM user_access_rules WHERE user_id = ?', [$userId]);

    if (!is_array($rules)) {
        // Defaults per role.
        $defaults = [
            'admin'      => ['can_view' => 1, 'can_edit' => 1, 'can_export' => 1],
            'operations' => ['can_view' => 1, 'can_edit' => 1, 'can_export' => 1],
            'sales'      => ['can_view' => 1, 'can_edit' => 0, 'can_export' => 1],
            'viewer'     => ['can_view' => 1, 'can_edit' => 0, 'can_export' => 0],
        ];
        $d = $defaults[$role] ?? $defaults['viewer'];
        q('INSERT INTO user_access_rules (user_id, scope_type, scope_id, scope_value, can_view, can_edit, can_export)
           VALUES (?, "all", NULL, NULL, ?, ?, ?)',
            [$userId, $d['can_view'], $d['can_edit'], $d['can_export']]);
        return;
    }

    foreach ($rules as $r) {
        q('INSERT INTO user_access_rules (user_id, scope_type, scope_id, scope_value, can_view, can_edit, can_export)
           VALUES (?,?,?,?,?,?,?)',
            [
                $userId,
                v_enum($r['scope_type'] ?? 'all', ['all', 'region', 'hotel_group', 'hotel', 'package'], 'all'),
                v_int($r['scope_id'] ?? null),
                v_str($r['scope_value'] ?? null, 190),
                v_bool($r['can_view'] ?? true),
                v_bool($r['can_edit'] ?? false),
                v_bool($r['can_export'] ?? false),
            ]
        );
    }
}
