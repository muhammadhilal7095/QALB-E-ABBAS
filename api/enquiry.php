<?php
/* POST /api/enquiry.php — contact form. Saved in Admin → Enquiries and emailed to the team. */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') qa_json(405, ['ok' => false, 'error' => 'Method not allowed.']);
qa_check_origin();
if (qa_text($_POST['website'] ?? '', 200) !== '') qa_json(200, ['ok' => true]); // spam trap

$name    = qa_text($_POST['name'] ?? '', 120);
$email   = qa_text($_POST['email'] ?? '', 200);
$phone   = qa_text($_POST['phone'] ?? '', 40);
$topic   = qa_text($_POST['topic'] ?? '', 100);
$subject = qa_text($_POST['subject'] ?? '', 200);
$message = qa_text($_POST['message'] ?? '', 4000);
$source  = qa_text($_POST['source'] ?? 'Contact form', 80);

$errors = [];
if (mb_strlen($name) < 2) $errors[] = 'Please enter your name.';
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Please enter a valid email address.';
if (mb_strlen($message) < 5) $errors[] = 'Please write your message.';
if ($errors) qa_json(422, ['ok' => false, 'error' => implode(' ', $errors)]);
qa_rate_limit('enquiry', 8, 3600);

$ref = qa_ref('ENQ');
qa_insert('enquiries', [
    'id' => qa_id(), 'ref' => $ref, 'createdAt' => qa_now(), 'status' => 'new', 'type' => 'contact', 'source' => $source,
    'name' => $name, 'email' => $email, 'phone' => $phone, 'topic' => $topic, 'subject' => $subject, 'message' => $message,
]);

qa_notify("Website enquiry: " . ($subject ?: ($topic ?: 'General')) . " — $name ($ref)",
    "New enquiry from qalbeabbas.com ($ref)\n\nName:  $name\nEmail: $email\nPhone: " . ($phone ?: '—') . "\nTopic: " . ($topic ?: '—') . "\nSubject: " . ($subject ?: '—') . "\n\nMessage:\n$message\n\n"
    . "Reply to this email to answer the client. Admin: " . QA_SITE . "/admin/?tab=enquiries\n", $email);
$first = explode(' ', $name)[0];
qa_mail($email, "We've received your message ($ref)",
    "Hi $first,\n\nThank you for contacting Qalb-E-Abbas. We've received your message and will reply within one working day (Monday–Friday, 10:00–18:00 UK time).\n\nYour reference: $ref\n\nYour message:\n$message\n\nQalb-E-Abbas\n" . QA_SITE . "\n",
    qa_settings()['notifyEmail'] ?: QA_ADMIN_EMAIL);

qa_json(200, ['ok' => true, 'ref' => $ref]);
