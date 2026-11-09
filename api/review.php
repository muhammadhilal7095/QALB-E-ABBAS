<?php
/* ==========================================================================
   Qalb-E-Abbas — "Leave a review" form handler (runs on Hostinger PHP).

   Receives the form from /leave-review, checks every field, and emails the
   review (with the photo attached) to the team. Nothing is published
   automatically: the team approves a review and adds it to
   assets/js/reviews-data.js (sample: false) before it appears on the site.
   ========================================================================== */
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

const TO_EMAIL   = 'contact@qalbeabbas.com';
const FROM_EMAIL = 'no-reply@qalbeabbas.com';   // must be an address on your own domain
const MAX_PHOTO  = 3 * 1024 * 1024;              // 3 MB
const RATE_LIMIT = 5;                            // reviews per IP per hour

function reply(int $code, array $body): void { http_response_code($code); echo json_encode($body); exit; }
function clean(string $key, int $max): string {
    $v = trim((string)($_POST[$key] ?? ''));
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v) ?? '';
    return mb_substr($v, 0, $max);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') reply(405, ['ok' => false, 'error' => 'Method not allowed.']);

// Only accept submissions from our own website.
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && !preg_match('#^https://(www\.)?qalbeabbas\.com$#', $origin)) reply(403, ['ok' => false, 'error' => 'Not allowed.']);

// Spam trap: real visitors never fill the hidden "website" field.
if (clean('website', 200) !== '') reply(200, ['ok' => true]);

// Simple rate limit per IP.
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rlFile = sys_get_temp_dir() . '/qa_review_' . hash('sha256', $ip);
$now = time();
$hits = array_filter(array_map('intval', @file($rlFile, FILE_IGNORE_NEW_LINES) ?: []), fn($t) => $t > $now - 3600);
if (count($hits) >= RATE_LIMIT) reply(429, ['ok' => false, 'error' => 'Too many reviews from this connection. Please try again later.']);

$name    = clean('name', 80);
$email   = clean('email', 120);
$country = clean('country', 60);
$service = clean('service', 80);
$rating  = (int)($_POST['rating'] ?? 0);
$text    = clean('review', 1200);
$consent = ($_POST['consent'] ?? '') === 'yes';

$errors = [];
if (mb_strlen($name) < 2) $errors[] = 'Please enter your name.';
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Please enter a valid email address.';
if ($rating < 1 || $rating > 5) $errors[] = 'Please choose a star rating.';
if (mb_strlen($text) < 30) $errors[] = 'Please write at least 30 characters about your experience.';
if (!$consent) $errors[] = 'Please confirm we may publish your review.';

// Optional photo: JPG, PNG or WebP up to 3 MB, checked by its real content.
$photo = null;
if (!empty($_FILES['photo']) && ($_FILES['photo']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
    $f = $_FILES['photo'];
    if ($f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) $errors[] = 'The photo could not be uploaded. Please try again.';
    elseif ($f['size'] > MAX_PHOTO) $errors[] = 'The photo must be 3 MB or smaller.';
    else {
        $types = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']) ?: '';
        if (!isset($types[$mime]) || @getimagesize($f['tmp_name']) === false) $errors[] = 'The photo must be a JPG, PNG or WebP image.';
        else $photo = ['data' => file_get_contents($f['tmp_name']), 'mime' => $mime, 'ext' => $types[$mime]];
    }
}
if ($errors) reply(422, ['ok' => false, 'error' => implode(' ', $errors)]);

// Build the email (plain text + optional photo attachment).
$ref = 'REV-' . date('ymd') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 5));
$stars = str_repeat('★', $rating) . str_repeat('☆', 5 - $rating);
$body = "New review submitted on qalbeabbas.com ($ref)\n\n"
      . "Name:    $name\nEmail:   $email\nCountry: " . ($country ?: '—') . "\nService: " . ($service ?: '—') . "\nRating:  $stars ($rating/5)\n\n"
      . "Review:\n$text\n\n"
      . "Consent: the reviewer agreed that Qalb-E-Abbas may publish their name, photo, country and review on its website.\n"
      . "Photo:   " . ($photo ? "attached" : "not provided") . "\n\n"
      . "To publish: add it to assets/js/reviews-data.js with sample: false (and the photo in assets/img/reviews/).\n";

$boundary = 'qa_' . bin2hex(random_bytes(12));
$headers = "From: Qalb-E-Abbas Website <" . FROM_EMAIL . ">\r\n"
         . "Reply-To: " . str_replace(["\r", "\n"], '', $email) . "\r\n"
         . "MIME-Version: 1.0\r\n"
         . "Content-Type: multipart/mixed; boundary=\"$boundary\"\r\n";
$msg  = "--$boundary\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($body));
if ($photo) {
    $file = preg_replace('/[^a-z0-9]+/', '-', strtolower($name)) . '-' . strtolower($ref) . '.' . $photo['ext'];
    $msg .= "--$boundary\r\nContent-Type: {$photo['mime']}; name=\"$file\"\r\nContent-Transfer-Encoding: base64\r\n"
          . "Content-Disposition: attachment; filename=\"$file\"\r\n\r\n" . chunk_split(base64_encode($photo['data']));
}
$msg .= "--$boundary--";
$subject = '=?UTF-8?B?' . base64_encode("New review ($rating/5) from $name — $ref") . '?=';

if (!@mail(TO_EMAIL, $subject, $msg, $headers, '-f' . FROM_EMAIL)) {
    reply(500, ['ok' => false, 'error' => 'Sorry, we could not send your review just now. Please email it to ' . TO_EMAIL . '.']);
}
$hits[] = $now;
@file_put_contents($rlFile, implode("\n", $hits));
reply(200, ['ok' => true, 'ref' => $ref]);
