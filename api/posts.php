<?php
/* GET /api/posts.php — published blog posts (newest first) for the /blog page. */
declare(strict_types=1);
require __DIR__ . '/_blog.php';

$out = [];
foreach (blog_posts() as $p) {
    if (!blog_is_live($p)) continue;
    $out[] = [
        'title' => $p['title'], 'url' => '/blog/' . $p['slug'], 'excerpt' => $p['excerpt'], 'category' => $p['category'],
        'cover' => blog_cover_url($p) ?: null, 'coverAlt' => $p['coverAlt'] ?? '', 'date' => substr($p['publishedAt'], 0, 10),
        'minutes' => blog_reading_minutes($p['content']), 'featured' => !empty($p['featured']),
    ];
}
usort($out, fn($a, $b) => strcmp($b['date'], $a['date']));
header('Cache-Control: public, max-age=120');
qa_json(200, ['ok' => true, 'posts' => $out]);
