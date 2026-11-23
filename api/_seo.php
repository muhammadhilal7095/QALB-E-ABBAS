<?php
/* ==========================================================================
   Page SEO managed in Admin → SEO → Page SEO.
   The website pages are static HTML (their default title/description come from
   booking/scripts/seo-pages.json at build time). Changes made in the admin are
   saved in qa-data/seo-pages.json and applied when a page is served by
   api/page.php, so they survive every GitHub deploy.
   ========================================================================== */
declare(strict_types=1);
require_once __DIR__ . '/_lib.php';

const SEO_SKIP = ['404', 'thank-you'];

/** All website pages: slug => file path (index = home page). */
function seo_pages(): array {
    $out = [];
    foreach (glob(QA_ROOT . '/*.html') ?: [] as $f) {
        $slug = basename($f, '.html');
        if ($slug[0] === '_' || in_array($slug, SEO_SKIP, true) || !preg_match('/^[a-z0-9-]+$/', $slug)) continue;
        $out[$slug] = $f;
    }
    ksort($out);
    if (isset($out['index'])) $out = ['index' => $out['index']] + $out;
    return $out;
}

function seo_url(string $slug): string { return QA_SITE . ($slug === 'index' ? '/' : '/' . $slug); }

/** Saved admin changes: slug => [title, description, ogTitle, ogDescription, ogImage, ogImageAlt, noindex, keyword, updatedAt]. */
function seo_overrides(): array {
    static $o = null;
    if ($o === null) { $o = qa_read('seo-pages'); }
    return $o;
}

function seo_attr(string $html, string $pattern): string {
    return preg_match($pattern, $html, $m) ? html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8') : '';
}

/** The page's built-in SEO values, read from its HTML. */
function seo_defaults(string $html): array {
    return [
        'title' => seo_attr($html, '#<title>(.*?)</title>#s'),
        'description' => seo_attr($html, '#<meta name="description" content="([^"]*)"#'),
        'ogImage' => seo_attr($html, '#<meta property="og:image" content="([^"]*)"#'),
        'ogImageAlt' => seo_attr($html, '#<meta property="og:image:alt" content="([^"]*)"#'),
        'noindex' => str_contains(seo_attr($html, '#<meta name="robots" content="([^"]*)"#'), 'noindex'),
    ];
}

/** Final values = saved changes on top of the defaults. */
function seo_effective(array $def, array $o): array {
    $pick = fn(string $k) => isset($o[$k]) && $o[$k] !== '' ? $o[$k] : ($def[$k] ?? '');
    $title = $pick('title'); $desc = $pick('description');
    return [
        'title' => $title, 'description' => $desc,
        'ogTitle' => ($o['ogTitle'] ?? '') !== '' ? $o['ogTitle'] : $title,
        'ogDescription' => ($o['ogDescription'] ?? '') !== '' ? $o['ogDescription'] : $desc,
        'ogImage' => $pick('ogImage'), 'ogImageAlt' => $pick('ogImageAlt'),
        'noindex' => array_key_exists('noindex', $o) ? (bool)$o['noindex'] : $def['noindex'],
        'keyword' => (string)($o['keyword'] ?? ''),
    ];
}

/** Rewrite the page's head tags with the saved values. Anything not changed is left as built. */
function seo_apply(string $html, array $o): string {
    if (!$o) return $html;
    $e = seo_effective(seo_defaults($html), $o);
    $a = fn(string $v) => htmlspecialchars($v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $img = $e['ogImage'];
    if ($img !== '' && $img[0] === '/') $img = QA_SITE . $img;
    $map = [
        '#<title>.*?</title>#s' => '<title>' . $a($e['title']) . '</title>',
        '#<meta name="description" content="[^"]*">#' => '<meta name="description" content="' . $a($e['description']) . '">',
        '#<meta name="robots" content="[^"]*">#' => '<meta name="robots" content="' . ($e['noindex'] ? 'noindex, follow' : 'index, follow, max-image-preview:large') . '">',
        '#<meta property="og:title" content="[^"]*">#' => '<meta property="og:title" content="' . $a($e['ogTitle']) . '">',
        '#<meta property="og:description" content="[^"]*">#' => '<meta property="og:description" content="' . $a($e['ogDescription']) . '">',
        '#<meta name="twitter:title" content="[^"]*">#' => '<meta name="twitter:title" content="' . $a($e['ogTitle']) . '">',
        '#<meta name="twitter:description" content="[^"]*">#' => '<meta name="twitter:description" content="' . $a($e['ogDescription']) . '">',
        '#<meta property="og:image" content="[^"]*">#' => '<meta property="og:image" content="' . $a($img) . '">',
        '#<meta name="twitter:image" content="[^"]*">#' => '<meta name="twitter:image" content="' . $a($img) . '">',
        '#<meta property="og:image:alt" content="[^"]*">#' => '<meta property="og:image:alt" content="' . $a($e['ogImageAlt']) . '">',
        '#<meta name="twitter:image:alt" content="[^"]*">#' => '<meta name="twitter:image:alt" content="' . $a($e['ogImageAlt']) . '">',
    ];
    // A changed share image has its own size, so drop the built-in width/height tags.
    if (($o['ogImage'] ?? '') !== '') $map['#\s*<meta property="og:image:(?:width|height)" content="[^"]*">#'] = '';
    $head = strstr($html, '</head>', true);
    if ($head === false) return $html;
    foreach ($map as $re => $to) $head = preg_replace($re, str_replace(['\\', '$'], ['\\\\', '\\$'], $to), $head, 1) ?? $head;
    return $head . substr($html, strlen($head));
}

/** On-page SEO checks for the admin. Each: [label, ok, detail]. */
function seo_checks(string $html, array $e): array {
    $main = ($i = strpos($html, '<main')) !== false ? substr($html, $i) : $html;
    $main = ($j = strpos($main, '</main>')) !== false ? substr($main, 0, $j) : $main;
    $text = trim(preg_replace('/\s+/', ' ', strip_tags(preg_replace('#<(script|style|svg)\b.*?</\1>#s', ' ', $main))));
    $words = $text === '' ? 0 : count(preg_split('/\s+/', $text));
    preg_match_all('#<h1\b#i', $main, $h1); $h1 = count($h1[0]);
    preg_match_all('#<img\b[^>]*>#i', $main, $imgs);
    $noAlt = 0; foreach ($imgs[0] as $t) if (!preg_match('/\balt="[^"]+"/', $t)) $noAlt++;
    preg_match_all('#<a\b[^>]*href="(/[^"]*|https?://(www\.)?qalbeabbas\.com[^"]*)"#i', $main, $links);
    $tl = mb_strlen($e['title']); $dl = mb_strlen($e['description']);
    $kw = mb_strtolower(trim($e['keyword']));
    $c = [
        ['Title length', $tl >= 30 && $tl <= 62, "$tl characters (aim for 50–60)"],
        ['Meta description length', $dl >= 110 && $dl <= 165, "$dl characters (aim for 140–160)"],
        ['One main heading (H1)', $h1 === 1, $h1 . ' found'],
        ['Enough text on the page', $words >= 300, number_format($words) . ' words (aim for 300+)'],
        ['All images have alt text', $noAlt === 0, $noAlt ? "$noAlt image" . ($noAlt > 1 ? 's' : '') . ' without alt text' : count($imgs[0]) . ' images checked'],
        ['Links to other pages', count($links[0]) >= 3, count($links[0]) . ' internal links'],
        ['Share image set', $e['ogImage'] !== '', $e['ogImage'] !== '' ? 'Used when the page is shared' : 'No image for social shares'],
        ['Shown in Google', !$e['noindex'], $e['noindex'] ? 'Hidden (noindex)' : 'Indexable'],
    ];
    if ($kw !== '') {
        $c[] = ['Focus keyword in title', str_contains(mb_strtolower($e['title']), $kw), '“' . $e['keyword'] . '”'];
        $c[] = ['Focus keyword in description', str_contains(mb_strtolower($e['description']), $kw), ''];
        $c[] = ['Focus keyword in page text', str_contains(mb_strtolower($text), $kw), ''];
    }
    return $c;
}

function seo_score(array $checks): int {
    return $checks ? (int)round(100 * count(array_filter($checks, fn($c) => $c[1])) / count($checks)) : 0;
}
