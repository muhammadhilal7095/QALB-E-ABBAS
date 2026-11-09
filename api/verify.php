<?php
/* Search engine verification files added in Admin → SEO
   (e.g. /google1234abcd.html for Google Search Console, /BingSiteAuth.xml for Bing). */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

$name = basename((string)($_GET['f'] ?? ''));
$files = (array)(qa_settings()['verifyFiles'] ?? []);
if (!isset($files[$name])) { http_response_code(404); readfile(QA_ROOT . '/404.html'); exit; }
header('Content-Type: ' . (str_ends_with($name, '.xml') ? 'application/xml' : (str_ends_with($name, '.txt') ? 'text/plain' : 'text/html')) . '; charset=utf-8');
echo $files[$name];
