<?php
/* GET /sitemap-blog.xml — published blog posts from the admin dashboard. */
declare(strict_types=1);
require __DIR__ . '/_blog.php';

header('Content-Type: application/xml; charset=utf-8');
header('Cache-Control: public, max-age=600');
echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' . "\n";
foreach (blog_posts() as $p) {
    if (!blog_is_live($p) || !empty($p['noindex']) || !empty($p['canonical'])) continue;
    echo "  <url>\n    <loc>" . blog_e(blog_url($p)) . "</loc>\n    <lastmod>" . blog_e(substr($p['updatedAt'] ?? $p['publishedAt'], 0, 10)) . "</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n";
    if (!empty($p['cover'])) echo "    <image:image><image:loc>" . blog_e(blog_cover_url($p, true)) . "</image:loc></image:image>\n";
    echo "  </url>\n";
}
echo "</urlset>\n";
