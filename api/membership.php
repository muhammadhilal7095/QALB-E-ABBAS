<?php
/* ==========================================================================
   Stock Market Club sign-up (/stock-exchange-join).
   POST /api/membership.php  { name, email, whatsapp, country, city, experience,
                              markets[], goal, acceptTerms, gateway? }
   Creates the member (status "pending") and an order for the joining fee,
   then sends the visitor to Stripe Checkout. When the payment is confirmed
   (Stripe webhook, the join page, or "Paid" in the admin) the member becomes
   active and receives the WhatsApp group link (see qa_activate_member).

   GET /api/membership.php?ref=…&session_id=…
   Used by the join page after payment: confirms the payment with Stripe if
   needed and returns the member ID and WhatsApp link once paid.
   ========================================================================== */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

// ---------- Status (after payment) ----------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    qa_rate_limit('club-status', 40, 600);
    $ref = preg_replace('/[^A-Z0-9-]/', '', strtoupper((string)($_GET['ref'] ?? '')));
    $sessionId = preg_replace('/[^A-Za-z0-9_]/', '', (string)($_GET['session_id'] ?? ''));
    $order = null;
    foreach (qa_read('orders') as $o) if (($o['ref'] ?? '') === $ref && !empty($o['membership'])) { $order = $o; break; }
    if (!$order) qa_json(404, ['ok' => false, 'error' => 'We could not find this membership. Please contact us.']);
    if (($order['payment'] ?? '') === 'pending' && $sessionId && $sessionId === ($order['stripeSession'] ?? '')) {
        try {
            $s = qa_stripe('GET', 'checkout/sessions/' . $sessionId);
            if (($s['payment_status'] ?? '') === 'paid') {
                $order = qa_mark_paid($ref, (string)($s['payment_intent'] ?? $s['id']), isset($s['amount_total']) ? (int)$s['amount_total'] : null) ?? $order;
            }
        } catch (Throwable $e) { /* the webhook will confirm it */ }
    }
    $m = qa_member_by_ref($ref);
    $paid = ($order['payment'] ?? '') === 'paid';
    if ($paid && $m && ($m['status'] ?? '') !== 'active') { qa_activate_member($order); $m = qa_member_by_ref($ref); }
    $link = trim((string)qa_settings()['clubWhatsapp']);
    // Only reveal the group link to someone who also knows the Stripe session id or the email used.
    $email = strtolower(trim((string)($_GET['email'] ?? '')));
    $proven = ($sessionId && $sessionId === ($order['stripeSession'] ?? '')) || ($m && $email !== '' && hash_equals(strtolower($m['email']), $email));
    qa_json(200, [
        'ok' => true, 'ref' => $order['ref'], 'payment' => $order['payment'],
        'total' => qa_money($order['priced']['totalCents'], $order['priced']['currency']),
        'memberId' => $m['memberId'] ?? null, 'name' => $m['name'] ?? '',
        'whatsapp' => ($paid && $proven && $link !== '') ? $link : null,
        'linkPending' => $paid && $link === '',
    ]);
}

// ---------- Sign up ----------
if ($_SERVER['REQUEST_METHOD'] !== 'POST') qa_json(405, ['ok' => false, 'error' => 'Method not allowed.']);
qa_check_origin();
qa_rate_limit('club-join', 10, 600);
$b = qa_read_json_body(20000);
if (($b['acceptTerms'] ?? false) !== true) qa_json(422, ['ok' => false, 'error' => 'Please accept the terms to continue.']);

$name = qa_text($b['name'] ?? '', 120);
$email = qa_text($b['email'] ?? '', 200);
$whatsapp = preg_replace('/[^0-9+ ]/', '', qa_text($b['whatsapp'] ?? '', 30));
$country = qa_text($b['country'] ?? '', 80);
$city = qa_text($b['city'] ?? '', 80);
$experience = in_array($b['experience'] ?? '', ['Beginner', 'Some experience', 'Experienced'], true) ? $b['experience'] : '';
$markets = array_values(array_intersect((array)($b['markets'] ?? []), ['US shares', 'UK shares']));
$goal = qa_text($b['goal'] ?? '', 500);

$errors = [];
if (mb_strlen($name) < 2) $errors[] = 'Please enter your full name.';
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Please enter a valid email address.';
if (strlen(preg_replace('/\D/', '', $whatsapp)) < 8) $errors[] = 'Please enter your WhatsApp number with country code (e.g. +92 300 1234567).';
if ($country === '') $errors[] = 'Please choose your country.';
if ($errors) qa_json(422, ['ok' => false, 'error' => implode(' ', $errors)]);

// One active membership per email: send existing members back to their welcome page.
foreach (qa_read('members') as $m) {
    if (strtolower($m['email']) === strtolower($email) && ($m['status'] ?? '') === 'active') {
        qa_json(409, ['ok' => false, 'error' => 'This email already has an active membership (Member ID ' . $m['memberId'] . '). Check your email for the WhatsApp link, or contact us at ' . QA_ADMIN_EMAIL . '.']);
    }
}

try {
    $priced = qa_price_submission(['kind' => 'order', 'items' => [['sku' => QA_CLUB_SKU, 'quantity' => 1]]]);
} catch (QaUserError $e) {
    qa_json(422, ['ok' => false, 'error' => $e->getMessage()]);
}
$gateways = qa_gateways();
if (!$gateways) qa_json(503, ['ok' => false, 'error' => 'Online payment is not available right now. Please email ' . QA_ADMIN_EMAIL . '.']);
$gateway = in_array($b['gateway'] ?? '', $gateways, true) ? $b['gateway'] : $gateways[0];

$ref = qa_ref('CLUB');
$memberId = qa_member_id();
$customer = ['name' => $name, 'email' => $email, 'phone' => $whatsapp, 'country' => $country];
$notes = "Stock Market Club membership\nMember ID: $memberId\nCity: " . ($city ?: '—') . "\nExperience: " . ($experience ?: '—') . "\nMarkets: " . (implode(', ', $markets) ?: '—') . "\nGoal: " . ($goal ?: '—');
$order = [
    'id' => qa_id(), 'ref' => $ref, 'createdAt' => qa_now(), 'kind' => 'order', 'status' => 'new', 'membership' => true,
    'payment' => $gateway === 'STRIPE' ? 'pending' : 'awaiting', 'gateway' => $gateway,
    'submission' => ['kind' => 'order', 'items' => [['sku' => QA_CLUB_SKU, 'quantity' => 1]], 'customer' => $customer, 'notes' => $notes],
    'priced' => $priced, 'note' => '', 'log' => [['at' => qa_now(), 'text' => 'Club sign-up (' . $gateway . ')']],
];
$member = [
    'id' => qa_id(), 'memberId' => $memberId, 'ref' => $ref, 'createdAt' => qa_now(), 'status' => 'pending',
    'name' => $name, 'email' => $email, 'whatsapp' => $whatsapp, 'country' => $country, 'city' => $city,
    'experience' => $experience, 'markets' => $markets, 'goal' => $goal, 'joinedGroup' => false,
];

if ($gateway === 'STRIPE') {
    $line_items = [];
    foreach ($priced['lines'] as $l) {
        $pd = ['name' => $l['name']];
        if ($l['note']) $pd['description'] = $l['note'];
        $line_items[] = ['quantity' => $l['quantity'], 'price_data' => ['currency' => strtolower($priced['currency']), 'unit_amount' => $l['unitCents'], 'product_data' => $pd]];
    }
    try {
        $session = qa_stripe('POST', 'checkout/sessions', [
            'mode' => 'payment', 'customer_email' => $email, 'client_reference_id' => $ref,
            'line_items' => $line_items, 'metadata' => ['ref' => $ref, 'memberId' => $memberId],
            'payment_intent_data' => ['metadata' => ['ref' => $ref], 'receipt_email' => $email],
            'success_url' => QA_SITE . '/stock-exchange-join?ref=' . rawurlencode($ref) . '&session_id={CHECKOUT_SESSION_ID}',
            'cancel_url' => QA_SITE . '/stock-exchange-join?cancelled=1',
        ]);
    } catch (QaUserError $e) {
        qa_json(502, ['ok' => false, 'error' => $e->getMessage()]);
    }
    $order['stripeSession'] = $session['id'] ?? null;
    qa_insert('orders', $order);
    qa_insert('members', $member);
    qa_json(200, ['ok' => true, 'reference' => $ref, 'memberId' => $memberId, 'redirectUrl' => $session['url']]);
}

// MANUAL: the team emails a payment link; marking the order "Paid" in the admin activates the member.
qa_insert('orders', $order);
qa_insert('members', $member);
qa_notify("New Stock Market Club sign-up (awaiting payment): $name",
    "Someone signed up for the Stock Market Club. Payment is NOT taken yet — send them a payment link, then mark the order Paid in the admin. They will then receive the WhatsApp group link automatically.\n\n"
    . "Member ID: $memberId\nName: $name\nEmail: $email\nWhatsApp: $whatsapp\nCountry: $country\n\nAdmin: " . QA_SITE . "/admin/?tab=members\n", $email);
qa_mail($email, "Your Stock Market Club sign-up ($memberId)",
    "Hi " . explode(' ', $name)[0] . ",\n\nThank you for signing up for the Qalb-E-Abbas Stock Market Club. We'll email you a secure payment link for the " . qa_money($priced['totalCents'], $priced['currency'])
    . " joining fee within one working day. As soon as it's paid, you'll receive the WhatsApp group link.\n\nMember ID: $memberId\n\nQalb-E-Abbas\n" . QA_SITE . "\n",
    qa_settings()['notifyEmail'] ?: QA_ADMIN_EMAIL);
qa_json(200, ['ok' => true, 'reference' => $ref, 'memberId' => $memberId, 'redirectUrl' => '/stock-exchange-join?ref=' . rawurlencode($ref) . '&manual=1']);
