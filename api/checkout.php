<?php
/* ==========================================================================
   POST /api/checkout.php — Book a Consultation form or cart → order.
   Body: { submission: {kind:"booking"|"order", …}, acceptTerms: true, gateway?: "STRIPE"|"MANUAL" }

   STRIPE: creates a Stripe Checkout page and returns its URL. The order is
           marked paid by the Stripe webhook (or when the client returns).
   MANUAL: saves the request; the team sends a payment link / bank details.
   Every order appears in Admin → Bookings & orders.
   ========================================================================== */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') qa_json(405, ['ok' => false, 'error' => 'Method not allowed.']);
qa_check_origin();
qa_rate_limit('checkout', 15, 600);
$body = qa_read_json_body(60000);
if (($body['acceptTerms'] ?? false) !== true) qa_json(422, ['ok' => false, 'error' => 'Please accept the terms to continue.']);

$in = is_array($body['submission'] ?? null) ? $body['submission'] : [];
$c = is_array($in['customer'] ?? null) ? $in['customer'] : [];
$customer = [
    'name' => qa_text($c['name'] ?? '', 120), 'email' => qa_text($c['email'] ?? '', 200),
    'phone' => qa_text($c['phone'] ?? '', 40), 'country' => qa_text($c['country'] ?? '', 80),
];
if (mb_strlen($customer['name']) < 2) qa_json(422, ['ok' => false, 'error' => 'Please enter your full name.']);
if (!filter_var($customer['email'], FILTER_VALIDATE_EMAIL)) qa_json(422, ['ok' => false, 'error' => 'Please enter a valid email address.']);

if (($in['kind'] ?? '') === 'booking') {
    $sub = [
        'kind' => 'booking', 'consultation' => qa_text($in['consultation'] ?? '', 60), 'customer' => $customer,
        'date' => qa_text($in['date'] ?? '', 10), 'time' => qa_text($in['time'] ?? '', 5),
        'timezone' => qa_text($in['timezone'] ?? '', 60), 'message' => qa_text($in['message'] ?? '', 1000),
        'topic' => preg_replace('/[^a-z0-9-]/', '', (string)($in['topic'] ?? '')),
    ];
    if ($sub['message'] === '') qa_json(422, ['ok' => false, 'error' => 'Please tell us how we can help.']);
} elseif (($in['kind'] ?? '') === 'order') {
    $items = [];
    foreach (array_slice((array)($in['items'] ?? []), 0, 40) as $l) $items[] = ['sku' => qa_text($l['sku'] ?? '', 80), 'quantity' => (int)($l['quantity'] ?? 1)];
    $sub = ['kind' => 'order', 'items' => $items, 'customer' => $customer, 'notes' => qa_text($in['notes'] ?? '', 1000)];
} else {
    qa_json(422, ['ok' => false, 'error' => 'Invalid request.']);
}

try {
    $priced = qa_price_submission($sub);
} catch (QaUserError $e) {
    qa_json(422, ['ok' => false, 'error' => $e->getMessage()]);
}

$gateways = qa_gateways();
if (!$gateways) qa_json(503, ['ok' => false, 'error' => 'Online booking is not available right now. Please email ' . QA_ADMIN_EMAIL . '.']);
$gateway = in_array($body['gateway'] ?? '', $gateways, true) ? $body['gateway'] : $gateways[0];

$ref = qa_ref($sub['kind'] === 'booking' ? 'BK' : 'ORD');
$order = [
    'id' => qa_id(), 'ref' => $ref, 'createdAt' => qa_now(), 'kind' => $sub['kind'], 'status' => 'new',
    'payment' => $gateway === 'STRIPE' ? 'pending' : 'awaiting', 'gateway' => $gateway,
    'submission' => $sub, 'priced' => $priced, 'note' => '', 'log' => [['at' => qa_now(), 'text' => 'Order created (' . $gateway . ')']],
];

if ($gateway === 'STRIPE') {
    $line_items = [];
    foreach ($priced['lines'] as $l) {
        $pd = ['name' => $l['name']];
        if ($l['note']) $pd['description'] = $l['note'];
        $line_items[] = ['quantity' => $l['quantity'], 'price_data' => ['currency' => strtolower($priced['currency']), 'unit_amount' => $l['unitCents'], 'product_data' => $pd]];
    }
    $cancel = $sub['kind'] === 'booking'
        ? QA_SITE . '/book-consultation?cancelled=1' . ($sub['topic'] ? '&topic=' . rawurlencode($sub['topic']) : '')
        : QA_SITE . '/cart?cancelled=1';
    try {
        $session = qa_stripe('POST', 'checkout/sessions', [
            'mode' => 'payment', 'customer_email' => $customer['email'], 'client_reference_id' => $ref,
            'line_items' => $line_items, 'metadata' => ['ref' => $ref],
            'payment_intent_data' => ['metadata' => ['ref' => $ref], 'receipt_email' => $customer['email']],
            'success_url' => QA_SITE . '/thank-you?ref=' . rawurlencode($ref) . '&session_id={CHECKOUT_SESSION_ID}',
            'cancel_url' => $cancel,
        ]);
    } catch (QaUserError $e) {
        qa_json(502, ['ok' => false, 'error' => $e->getMessage()]);
    }
    $order['stripeSession'] = $session['id'] ?? null;
    qa_insert('orders', $order);
    qa_json(200, ['ok' => true, 'reference' => $ref, 'redirectUrl' => $session['url']]);
}

// MANUAL: save the request and tell both sides what happens next.
qa_insert('orders', $order);
$isBooking = $sub['kind'] === 'booking';
qa_notify(($isBooking ? 'New booking request: ' : 'New order request: ') . "{$priced['title']} — {$customer['name']} (" . qa_money($priced['totalCents'], $priced['currency']) . ')',
    "A client submitted " . ($isBooking ? 'a consultation booking' : 'an order') . " on the website. Payment is NOT taken yet — send them a payment link or bank details, then mark it paid in the admin dashboard.\n\n"
    . qa_order_text($order) . "\nClient details\n" . qa_customer_text($order) . "\nAdmin: " . QA_SITE . "/admin/?tab=orders&id={$order['id']}\n",
    $customer['email']);
$first = explode(' ', $customer['name'])[0];
qa_mail($customer['email'], ($isBooking ? 'Booking request received' : 'Order request received') . " ({$ref})",
    "Hi $first,\n\nThank you — we've received your " . ($isBooking ? 'consultation booking request' : 'order') . ". Our team will email you within one working day with a secure payment link"
    . ($isBooking ? ' and to confirm your consultation time.' : ' and the next steps.') . "\n\n" . qa_order_text($order) . "\nQuestions? Just reply to this email.\n\nQalb-E-Abbas\n" . QA_SITE . "\n",
    qa_settings()['notifyEmail'] ?: QA_ADMIN_EMAIL);
qa_json(200, ['ok' => true, 'reference' => $ref, 'redirectUrl' => '/thank-you?ref=' . rawurlencode($ref)]);
