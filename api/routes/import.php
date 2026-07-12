<?php
/** /api/import  — bulk import normalized rate rows (from CSV/XLSX parsed on the client) */

function resolve_group_id(?string $name): ?int
{
    $name = v_str($name, 190);
    if ($name === null) return null;
    $row = fetch_one('SELECT id FROM hotel_groups WHERE name = ? LIMIT 1', [$name]);
    if ($row) return (int)$row['id'];
    q('INSERT INTO hotel_groups (name) VALUES (?)', [$name]);
    return insert_id();
}

function resolve_hotel_id(array $row, array $user): ?int
{
    if (!empty($row['hotel_id']) && is_numeric($row['hotel_id'])) return (int)$row['hotel_id'];
    $name = v_str($row['hotel_name'] ?? null, 190);
    if ($name === null) return null;
    $region = v_str($row['region'] ?? null, 120);
    $found = $region
        ? fetch_one('SELECT id FROM hotels WHERE hotel_name = ? AND region = ? LIMIT 1', [$name, $region])
        : fetch_one('SELECT id FROM hotels WHERE hotel_name = ? LIMIT 1', [$name]);
    if ($found) return (int)$found['id'];

    $groupId = resolve_group_id($row['hotel_group'] ?? null);
    q('INSERT INTO hotels (hotel_group_id, hotel_name, region, sub_region, status) VALUES (?,?,?,?,"Active")',
        [$groupId, $name, $region, v_str($row['sub_region'] ?? null, 120)]);
    return insert_id();
}

function route_import(string $method, array $seg, array $body): void
{
    $user = require_auth();
    require_edit($user);

    if ($method !== 'POST') fail('استخدم POST.', 405, 'method_not_allowed');

    $rows = $body['rows'] ?? null;
    if (!is_array($rows) || empty($rows)) fail('لا توجد صفوف لاستيرادها.', 422, 'validation');

    $defaultStatus = v_enum($body['default_status'] ?? 'Draft', RATE_STATUSES, 'Draft');
    $overwrite = v_bool($body['overwrite'] ?? false) === 1;

    $total = count($rows);
    $success = 0; $failed = 0; $errors = [];
    foreach ($rows as $row) {
        if (is_array($row) && (array_key_exists('child_policy_id', $row) || array_key_exists('child_policy_code', $row))) {
            ensure_child_policy_schema();
            break;
        }
    }

    $importType = v_enum($body['type'] ?? 'csv', ['csv', 'xlsx'], 'csv');
    q('INSERT INTO import_jobs (type, status, rows_total, created_by) VALUES (?,?,?,?)',
        [$importType, 'processing', $total, $user['id']]);
    $jobId = insert_id();

    db()->beginTransaction();
    try {
        foreach ($rows as $i => $row) {
            try {
                if (!is_array($row)) throw new Exception('صف غير صالح');
                $hotelId = resolve_hotel_id($row, $user);
                if (!$hotelId) throw new Exception('hotel_name أو hotel_id مطلوب');

                $in = $row;
                $in['hotel_id'] = $hotelId;
                $in['package_id'] = null;
                $in['status'] = $row['status'] ?? $defaultStatus;
                $in['source_type'] = $importType;

                $roomType = v_str($row['room_type'] ?? 'Double', 60) ?? 'Double';
                if ($overwrite) {
                    delete_duplicate_rate($hotelId, null, v_date($row['date_from'] ?? null), v_date($row['date_to'] ?? null), $roomType, v_enum($row['meal_plan'] ?? 'BB', MEAL_PLANS, 'BB'));
                }
                insert_rate($in, $user);
                $success++;
            } catch (Throwable $e) {
                $failed++;
                if (count($errors) < 50) $errors[] = ['row' => $i + 1, 'error' => $e->getMessage()];
            }
        }
        db()->commit();
    } catch (Throwable $e) {
        db()->rollBack();
        q('UPDATE import_jobs SET status="failed", error_summary=? WHERE id=?', [$e->getMessage(), $jobId]);
        throw $e;
    }

    q('UPDATE import_jobs SET status="done", rows_success=?, rows_failed=?, error_summary=? WHERE id=?',
        [$success, $failed, $errors ? json_encode($errors, JSON_UNESCAPED_UNICODE) : null, $jobId]);
    log_audit('import', 'rate', $jobId, null, ['total' => $total, 'success' => $success, 'failed' => $failed]);

    created(['job_id' => $jobId, 'rows_total' => $total, 'rows_success' => $success, 'rows_failed' => $failed, 'errors' => $errors]);
}
