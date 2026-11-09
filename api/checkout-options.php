<?php
/* GET /api/checkout-options.php — which payment methods the cart can offer. */
declare(strict_types=1);
require __DIR__ . '/_lib.php';
qa_json(200, ['gateways' => qa_gateways()]);
