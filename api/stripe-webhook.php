<?php
/* ==========================================================================
   POST /api/stripe-webhook.php — Stripe tells us when a payment succeeds.
   In Stripe → Developers → Webhooks add the endpoint
     https://www.qalbeabbas.com/api/stripe-webhook.php
   with the event "checkout.session.completed", then paste its signing secret
   (whsec_…) into Admin → Settings.
   ========================================================================== */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

$secret = qa_settings()['stripeWebhook'];
$payload = (string)file_get_contents('php://input');
$sigHeader = (string)($_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '');
if (!$secret || !$sigHeader) qa_json(400, ['ok' => false]);

$t = null; $sigs = [];
foreach (explode(',', $sigHeader) as $part) {
    [$k, $v] = array_pad(explode('=', trim($part), 2), 2, '');
    if ($k === 't') $t = (int)$v;
    if ($k === 'v1') $sigs[] = $v;
}
$expected = hash_hmac('sha256', $t . '.' . $payload, $secret);
$valid = false;
foreach ($sigs as $s) if (hash_equals($expected, $s)) $valid = true;
if (!$t || !$valid || abs(time() - $t) > 600) qa_json(400, ['ok' => false, 'error' => 'Bad signature']);

$event = json_decode($payload, true);
$type = $event['type'] ?? '';
if (in_array($type, ['checkout.session.completed', 'checkout.session.async_payment_succeeded'], true)) {
    $s = $event['data']['object'] ?? [];
    $ref = (string)($s['metadata']['ref'] ?? $s['client_reference_id'] ?? '');
    if ($ref && ($s['payment_status'] ?? '') === 'paid') {
        qa_mark_paid($ref, (string)($s['payment_intent'] ?? $s['id'] ?? ''), isset($s['amount_total']) ? (int)$s['amount_total'] : null);
    }
}
qa_json(200, ['ok' => true]);
