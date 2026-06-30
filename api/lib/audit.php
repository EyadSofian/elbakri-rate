<?php
/** Audit logging */

function log_audit(string $action, string $entityType, ?int $entityId, ?array $old = null, ?array $new = null): void
{
    try {
        $u = current_user();
        q(
            'INSERT INTO audit_logs (actor_id, actor_name, action, entity_type, entity_id, old_data, new_data)
             VALUES (?,?,?,?,?,?,?)',
            [
                $u['id'] ?? null,
                $u['full_name'] ?? null,
                $action,
                $entityType,
                $entityId,
                $old !== null ? json_encode($old, JSON_UNESCAPED_UNICODE) : null,
                $new !== null ? json_encode($new, JSON_UNESCAPED_UNICODE) : null,
            ]
        );
    } catch (Throwable $e) {
        // Never let auditing break the main request.
    }
}
