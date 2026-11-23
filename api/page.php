<?php
/* Serves a website page (/services → services.html) with any SEO changes saved in
   Admin → SEO → Page SEO applied to its <head>. If anything goes wrong, the page is
   sent exactly as built, so the website never breaks because of SEO settings. */
declare(strict_types=1);

$slug = (string)($_GET['p'] ?? 'index');
if (!preg_match('/^[a-z0-9-]+$/', $slug)) $slug = '404';
$file = dirname(__DIR__) . '/' . $slug . '.html';
if (!is_file($file)) { http_response_code(404); $file = dirname(__DIR__) . '/404.html'; $slug = '404'; }

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache');
$html = (string)file_get_contents($file);
try {
    require_once __DIR__ . '/_seo.php';
    $o = seo_overrides()[$slug] ?? [];
    if ($o) $html = seo_apply($html, $o);
} catch (Throwable $e) {
    // Serve the page unchanged.
}
echo $html;
