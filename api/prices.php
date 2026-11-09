<?php
/* GET /api/prices.php — current prices (catalog + changes made in Admin → Prices).
   The website uses it to show up-to-date prices without rebuilding the pages. */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

$items = []; $states = [];
foreach (qa_catalog() as $sku => $it) {
    if ($it['price'] === null) continue;
    $items[$sku] = $it['price'];
    if (!empty($it['stateCode'])) $states[$it['stateCode']] = $it['price'];
}
$consultations = [];
foreach (qa_consultations() as $slug => $c) $consultations[$slug] = $c['price'];
header('Cache-Control: public, max-age=60');
qa_json(200, ['ok' => true, 'items' => (object)$items, 'states' => (object)$states, 'consultations' => (object)$consultations]);
