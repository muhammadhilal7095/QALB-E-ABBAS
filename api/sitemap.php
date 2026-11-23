<?php
/* GET /sitemap.xml — the built sitemap, minus pages hidden from Google in Admin → SEO → Page SEO. */
declare(strict_types=1);
$xml = (string)@file_get_contents(dirname(__DIR__) . '/sitemap.xml');
try {
    require_once __DIR__ . '/_seo.php';
    foreach (seo_overrides() as $slug => $o) {
        if (empty($o['noindex']) || !is_string($slug)) continue;
        $loc = preg_quote(seo_url($slug), '#');
        $xml = preg_replace('#\s*<url>\s*<loc>' . $loc . '</loc>.*?</url>#s', '', $xml) ?? $xml;
    }
} catch (Throwable $e) { /* serve as built */ }
header('Content-Type: application/xml; charset=utf-8');
echo $xml;
