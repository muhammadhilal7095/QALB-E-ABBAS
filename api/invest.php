<?php
/* ==========================================================================
   POST /api/invest.php — "Apply to invest with us" form on /stock-exchange.
   Saves the application in Admin → Enquiries (type "investment"), emails the team
   and sends the applicant a confirmation. No money is taken on the website.
   ========================================================================== */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') qa_json(405, ['ok' => false, 'error' => 'Method not allowed.']);
qa_check_origin();
if (qa_text($_POST['website'] ?? '', 200) !== '') qa_json(200, ['ok' => true]); // spam trap

$name    = qa_text($_POST['name'] ?? '', 120);
$email   = qa_text($_POST['email'] ?? '', 200);
$phone   = qa_text($_POST['phone'] ?? '', 40);
$country = qa_text($_POST['country'] ?? '', 60);
$market  = qa_text($_POST['market'] ?? '', 60);
$amount  = qa_text($_POST['amount'] ?? '', 60);
$risk    = qa_text($_POST['risk'] ?? '', 60);
$horizon = qa_text($_POST['horizon'] ?? '', 60);
$message = qa_text($_POST['message'] ?? '', 2000);
$ack     = ($_POST['risk_ack'] ?? '') === 'yes';

$errors = [];
if (mb_strlen($name) < 2) $errors[] = 'Please enter your name.';
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Please enter a valid email address.';
if (!preg_match('/^\+?[0-9 ()\-]{7,20}$/', $phone)) $errors[] = 'Please enter a valid phone number.';
if (mb_strlen($country) < 2) $errors[] = 'Please enter your country.';
if ($market === '' || $amount === '' || $risk === '' || $horizon === '') $errors[] = 'Please answer all the investment questions.';
if (!$ack) $errors[] = 'Please confirm you understand the risks of investing.';
if ($errors) qa_json(422, ['ok' => false, 'error' => implode(' ', $errors)]);
qa_rate_limit('invest', 6, 3600);

$id = qa_id();
$ref = qa_ref('INV');
$details = "Market:   $market\nAmount:   $amount\nRisk:     $risk\nHorizon:  $horizon";
qa_insert('enquiries', [
    'id' => $id, 'ref' => $ref, 'createdAt' => qa_now(), 'status' => 'new', 'type' => 'investment',
    'source' => 'Managed investing application', 'name' => $name, 'email' => $email, 'phone' => $phone,
    'country' => $country, 'topic' => 'Stock exchange', 'subject' => "Investment application: $amount, $market",
    'invest' => ['market' => $market, 'amount' => $amount, 'risk' => $risk, 'horizon' => $horizon, 'riskAcknowledged' => true],
    'message' => $message,
]);

qa_notify("Investment application: $amount, $market — $name ($ref)",
    "New managed investing application from qalbeabbas.com ($ref)\n\n"
    . "Name:     $name\nPhone:    $phone\nCountry:  $country\nEmail:    $email\n\n$details\n\n"
    . "Risk warning accepted: yes\n\nMessage:\n" . ($message ?: '—') . "\n\n"
    . "Reply to this email to contact the applicant. Admin: " . QA_SITE . "/admin/?tab=enquiries&id=$id\n",
    $email);

$first = explode(' ', $name)[0];
qa_mail($email, "We've received your investment application ($ref)",
    "Hi $first,\n\nThank you for applying to invest with Qalb-E-Abbas. Our team will review your application and contact you within one working day (Monday–Friday, 10:00–18:00 UK time).\n\n"
    . "Your reference: $ref\n\n$details\n\nPlease don't send any money until we have spoken with you and you have received our written terms.\n\n"
    . "Capital at risk: the value of investments can go down as well as up.\n\nQalb-E-Abbas\n" . QA_SITE . "/stock-exchange\n",
    qa_settings()['notifyEmail'] ?: QA_ADMIN_EMAIL);

qa_json(200, ['ok' => true, 'ref' => $ref]);
