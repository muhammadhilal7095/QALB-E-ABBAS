<?php
/* GET /blog-img/<file> → blog images uploaded in Admin → Blog. */
declare(strict_types=1);
require __DIR__ . '/_blog.php';

$f = basename((string)($_GET['f'] ?? ''));
if (!preg_match('/^[a-z0-9-]+\.(webp|jpg|jpeg|png|gif)$/', $f)) { http_response_code(404); exit; }
$path = blog_dir() . '/' . $f;
if (!is_file($path)) { http_response_code(404); exit; }
$types = ['webp' => 'image/webp', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'gif' => 'image/gif'];
header('Content-Type: ' . $types[pathinfo($f, PATHINFO_EXTENSION)]);
header('Content-Length: ' . filesize($path));
header('Cache-Control: public, max-age=31536000, immutable');
header('X-Content-Type-Options: nosniff');
readfile($path);
