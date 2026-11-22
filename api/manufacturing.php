<?php
/* ==========================================================================
   POST /api/manufacturing.php — "Request Product Manufacturing" form on /china-sourcing.
   Saves the request in Admin → Enquiries (type "manufacturing", with the product photo),
   emails the team (photo attached) and sends the customer a confirmation.
   ========================================================================== */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') qa_json(405, ['ok' => false, 'error' => 'Method not allowed.']);
qa_check_origin();
if (qa_text($_POST['website'] ?? '', 200) !== '') qa_json(200, ['ok' => true]); // spam trap

$name    = qa_text($_POST['name'] ?? '', 120);
$phone   = qa_text($_POST['phone'] ?? '', 40);
$country = qa_text($_POST['country'] ?? '', 60);
$email   = qa_text($_POST['email'] ?? '', 200);
$title   = qa_text($_POST['product'] ?? '', 160);
$desc    = qa_text($_POST['description'] ?? '', 4000);

$errors = [];
if (mb_strlen($name) < 2) $errors[] = 'Please enter your name.';
if (!preg_match('/^\+?[0-9 ()\-]{7,20}$/', $phone)) $errors[] = 'Please enter a valid phone number.';
if (mb_strlen($country) < 2) $errors[] = 'Please enter your country.';
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Please enter a valid email address.';
if (mb_strlen($title) < 2) $errors[] = 'Please enter the product title.';
if (mb_strlen($desc) < 10) $errors[] = 'Please describe the product (at least 10 characters).';
$hasPhoto = !empty($_FILES['photo']) && ($_FILES['photo']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE;
if (!$hasPhoto) $errors[] = 'Please add a picture of the product.';
if ($errors) qa_json(422, ['ok' => false, 'error' => implode(' ', $errors)]);
qa_rate_limit('manufacturing', 6, 3600);

$id = qa_id();
$ref = qa_ref('MFG');
$res = qa_store_photo($_FILES['photo'], 'mfg-' . $id, 1600, 15 * 1024 * 1024);
if (!$res || isset($res['error'])) qa_json(422, ['ok' => false, 'error' => $res['error'] ?? 'Please add a picture of the product.']);

qa_insert('enquiries', [
    'id' => $id, 'ref' => $ref, 'createdAt' => qa_now(), 'status' => 'new', 'type' => 'manufacturing',
    'source' => 'Product manufacturing request', 'name' => $name, 'email' => $email, 'phone' => $phone,
    'country' => $country, 'topic' => 'China sourcing', 'subject' => 'Manufacturing: ' . $title,
    'product' => $title, 'message' => $desc, 'photo' => $res['file'], 'photoMime' => $res['mime'],
]);

$attachment = ['name' => $res['file'], 'mime' => $res['mime'], 'data' => (string)@file_get_contents(qa_data_dir() . '/photos/' . $res['file'])];
qa_notify("Product manufacturing request: $title — $name ($ref)",
    "New product manufacturing request from qalbeabbas.com ($ref)\n\n"
    . "Name:    $name\nPhone:   $phone\nCountry: $country\nEmail:   $email\n\n"
    . "Product: $title\n\nDescription:\n$desc\n\nProduct picture: attached\n\n"
    . "Reply to this email to answer the customer. Admin: " . QA_SITE . "/admin/?tab=enquiries&id=$id\n",
    $email, $attachment);

$first = explode(' ', $name)[0];
qa_mail($email, "We've received your manufacturing request ($ref)",
    "Hi $first,\n\nThank you for your product manufacturing request. Our sourcing team will review it and reply within one working day (Monday–Friday, 10:00–18:00 UK time).\n\n"
    . "Your reference: $ref\nProduct: $title\n\nQalb-E-Abbas\n" . QA_SITE . "/china-sourcing\n",
    qa_settings()['notifyEmail'] ?: QA_ADMIN_EMAIL);

qa_json(200, ['ok' => true, 'ref' => $ref]);
