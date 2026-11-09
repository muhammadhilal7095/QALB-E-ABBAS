<?php
/* GET /api/reviews.php — approved reviews for the review sections on the website. */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

$out = [];
foreach (qa_read('reviews') as $r) {
    if (($r['status'] ?? '') !== 'approved') continue;
    $out[$r['page'] ?: 'students'][] = [
        'name' => $r['name'], 'country' => $r['country'] ?: null, 'flag' => $r['flag'] ?: null,
        'service' => $r['service'] ?: null, 'rating' => (int)$r['rating'], 'text' => $r['text'],
        'photo' => $r['photo'] ? '/api/review-photo.php?id=' . rawurlencode($r['id']) : null,
        'featured' => !empty($r['featured']),
    ];
}
foreach ($out as &$list) usort($list, fn($a, $b) => (int)$b['featured'] <=> (int)$a['featured']);
unset($list);
header('Cache-Control: public, max-age=60');
qa_json(200, ['ok' => true, 'hideSamples' => (bool)qa_settings()['hideSamples'], 'reviews' => (object)$out]);
