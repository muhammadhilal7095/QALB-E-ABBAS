<?php
/* ==========================================================================
   "Leave a review" form handler (/leave-review → POST /api/review.php).
   Saves the review as "pending" in the admin dashboard (Admin → Reviews) and
   emails the team. Nothing appears on the website until it is approved.
   ========================================================================== */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

const MAX_PHOTO = 3 * 1024 * 1024; // 3 MB

if ($_SERVER['REQUEST_METHOD'] !== 'POST') qa_json(405, ['ok' => false, 'error' => 'Method not allowed.']);
qa_check_origin();
if (qa_text($_POST['website'] ?? '', 200) !== '') qa_json(200, ['ok' => true]); // spam trap

$name    = qa_text($_POST['name'] ?? '', 80);
$email   = qa_text($_POST['email'] ?? '', 120);
$country = qa_text($_POST['country'] ?? '', 60);
$service = qa_text($_POST['service'] ?? '', 80);
$rating  = (int)($_POST['rating'] ?? 0);
$text    = qa_text($_POST['review'] ?? '', 1200);
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
        else $photo = ['tmp' => $f['tmp_name'], 'mime' => $mime, 'ext' => $types[$mime]];
    }
}
if ($errors) qa_json(422, ['ok' => false, 'error' => implode(' ', $errors)]);
qa_rate_limit('review', 5, 3600);

$id = qa_id();
$ref = qa_ref('REV');
$photoFile = null;
if ($photo) {
    $photoFile = "$id.{$photo['ext']}";
    if (!@move_uploaded_file($photo['tmp'], qa_data_dir() . "/photos/$photoFile")) $photoFile = null;
}

qa_insert('reviews', [
    'id' => $id, 'ref' => $ref, 'createdAt' => qa_now(), 'status' => 'pending',
    'name' => $name, 'email' => $email, 'country' => $country, 'flag' => qa_country_flag($country),
    'service' => $service, 'page' => qa_review_key_for($service), 'rating' => $rating, 'text' => $text,
    'photo' => $photoFile, 'photoMime' => $photo['mime'] ?? null, 'consent' => true, 'ip' => hash('sha256', qa_ip()),
]);

$stars = str_repeat('★', $rating) . str_repeat('☆', 5 - $rating);
$attachment = null;
if ($photoFile) $attachment = ['name' => $photoFile, 'mime' => $photo['mime'], 'data' => (string)@file_get_contents(qa_data_dir() . "/photos/$photoFile")];
qa_notify("New review ($rating/5) from $name — $ref",
    "New review submitted on qalbeabbas.com ($ref)\n\nName:    $name\nEmail:   $email\nCountry: " . ($country ?: '—') . "\nService: " . ($service ?: '—') . "\nRating:  $stars ($rating/5)\n\nReview:\n$text\n\n"
    . "Photo: " . ($photoFile ? 'attached' : 'not provided') . "\n\nApprove or reject it in the admin dashboard: " . QA_SITE . "/admin/?tab=reviews\n",
    $email, $attachment);

qa_json(200, ['ok' => true, 'ref' => $ref]);
