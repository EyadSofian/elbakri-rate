<?php
/** /api/auth/* */

function route_auth(string $method, array $seg, array $body): void
{
    $action = $seg[0] ?? '';

    if ($action === 'login' && $method === 'POST') {
        $email = v_required($body, 'email', 'البريد الإلكتروني');
        $pass  = (string)($body['password'] ?? '');
        if ($pass === '') fail('كلمة المرور مطلوبة.', 422, 'validation');
        $result = do_login($email, $pass);
        log_audit('login', 'user', $result['user']['id']);
        ok($result);
    }

    if ($action === 'logout' && $method === 'POST') {
        clear_auth_cookie();
        ok(['logged_out' => true]);
    }

    if ($action === 'me' && $method === 'GET') {
        $u = current_user();
        if (!$u) ok(null);
        $rules = user_rules($u);
        ok([
            'id'         => $u['id'],
            'email'      => $u['email'],
            'full_name'  => $u['full_name'],
            'role'       => $u['role'],
            'can_edit'   => can_edit_data($u),
            'can_export' => can_export($u),
            'rules'      => $rules,
        ]);
    }

    fail('مسار غير صحيح.', 404, 'not_found');
}
