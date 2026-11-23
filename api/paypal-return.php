<?php
/* GET /api/paypal-return.php?ref=…&token=<PayPal order id> — PayPal sends the customer here after
   they approve the payment. We capture it, mark the order paid (emails go out), then show the
   usual thank-you page (or the Stock Market Club page for club sign-ups). */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

$ref = preg_replace('/[^A-Z0-9-]/', '', strtoupper((string)($_GET['ref'] ?? '')));
$token = preg_replace('/[^A-Za-z0-9]/', '', (string)($_GET['token'] ?? ''));
$order = null;
foreach (qa_read('orders') as $o) if (($o['ref'] ?? '') === $ref) { $order = $o; break; }
if (!$order) { header('Location: /'); exit; }
$next = !empty($order['membership']) ? '/stock-exchange-join?ref=' . rawurlencode($ref) : '/thank-you?ref=' . rawurlencode($ref);

if (($order['payment'] ?? '') !== 'paid' && $token !== '' && $token === ($order['paypalOrder'] ?? '')) {
    $done = null;
    try {
        $done = qa_paypal('POST', '/v2/checkout/orders/' . $token . '/capture');
    } catch (QaUserError $e) {
        // Already captured (e.g. the page was refreshed): read the order instead.
        try { $done = qa_paypal('GET', '/v2/checkout/orders/' . $token); } catch (Throwable $e2) { $done = null; }
    } catch (Throwable $e) { $done = null; }
    $cap = $done['purchase_units'][0]['payments']['captures'][0] ?? null;
    if ($done && ($done['status'] ?? '') === 'COMPLETED' && $cap && ($cap['status'] ?? '') === 'COMPLETED') {
        $cents = (int)round(((float)($cap['amount']['value'] ?? 0)) * 100);
        qa_mark_paid($ref, 'paypal:' . (string)($cap['id'] ?? $token), $cents ?: null);
    } else {
        qa_patch('orders', $order['id'], function (array $o) { $o['log'][] = ['at' => qa_now(), 'text' => 'PayPal payment not completed']; return $o; });
    }
}
header('Location: ' . $next);
