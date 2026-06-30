<?php
/** JSON response + error helpers */

function send_json($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function ok($data = null, int $status = 200): void
{
    send_json(['data' => $data], $status);
}

function created($data = null): void
{
    send_json(['data' => $data], 201);
}

/** Throw a structured API error (caught by the front controller). */
class ApiError extends Exception
{
    public int $status;
    public ?array $details;
    public string $errorCode;

    public function __construct(string $message, int $status = 400, string $errorCode = 'bad_request', ?array $details = null)
    {
        parent::__construct($message);
        $this->status = $status;
        $this->errorCode = $errorCode;
        $this->details = $details;
    }
}

function fail(string $message, int $status = 400, string $code = 'bad_request', ?array $details = null): void
{
    throw new ApiError($message, $status, $code, $details);
}

/** Read + decode JSON request body. */
function body(): array
{
    static $cache = null;
    if ($cache !== null) return $cache;
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) { $cache = []; return $cache; }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        // allow form-encoded fallback
        $cache = $_POST ?: [];
        return $cache;
    }
    $cache = $decoded;
    return $cache;
}

function query_param(string $key, $default = null)
{
    return $_GET[$key] ?? $default;
}
