<?php
/* GET /api/review-photo.php?id=… — the photo of an APPROVED review (others are never served here). */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

$id = preg_replace('/[^a-f0-9]/', '', (string)($_GET['id'] ?? ''));
$r = $id ? qa_find('reviews', $id) : null;
if (!$r || ($r['status'] ?? '') !== 'approved' || empty($r['photo'])) { http_response_code(404); exit; }
$file = qa_data_dir() . '/photos/' . basename($r['photo']);
if (!is_file($file)) { http_response_code(404); exit; }
header('Content-Type: ' . ($r['photoMime'] ?: 'image/jpeg'));
header('Content-Length: ' . filesize($file));
header('Cache-Control: public, max-age=86400');
header('X-Content-Type-Options: nosniff');
readfile($file);
