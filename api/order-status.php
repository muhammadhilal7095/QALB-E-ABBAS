<?php
/* GET /api/order-status.php?ref=…&session_id=… — used by the thank-you page.
   If the client has just paid with Stripe, this confirms the payment directly with
   Stripe (in case the webhook hasn't arrived yet). Returns only what the page shows. */
declare(strict_types=1);
require __DIR__ . '/_lib.php';
qa_rate_limit('status', 30, 600);

$ref = preg_replace('/[^A-Z0-9-]/', '', strtoupper((string)($_GET['ref'] ?? '')));
$sessionId = preg_replace('/[^A-Za-z0-9_]/', '', (string)($_GET['session_id'] ?? ''));
$order = null;
foreach (qa_read('orders') as $o) if ($o['ref'] === $ref) { $order = $o; break; }
if (!$order) qa_json(404, ['ok' => false]);

if (($order['payment'] ?? '') === 'pending' && $sessionId && $sessionId === ($order['stripeSession'] ?? '')) {
    try {
        $s = qa_stripe('GET', 'checkout/sessions/' . $sessionId);
        if (($s['payment_status'] ?? '') === 'paid') {
            $order = qa_mark_paid($ref, (string)($s['payment_intent'] ?? $s['id']), isset($s['amount_total']) ? (int)$s['amount_total'] : null) ?? $order;
        }
    } catch (Throwable $e) { /* the webhook will confirm it */ }
}

qa_json(200, [
    'ok' => true, 'ref' => $order['ref'], 'kind' => $order['kind'], 'payment' => $order['payment'],
    'title' => $order['priced']['title'], 'total' => qa_money($order['priced']['totalCents'], $order['priced']['currency']),
]);
