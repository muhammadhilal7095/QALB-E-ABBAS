<?php
/* ==========================================================================
   Blog (Admin → Blog): posts are stored in qa-data/posts.json, images in
   qa-data/blog/. Public pages: /blog/<slug> (api/blog-post.php), list for
   /blog (api/posts.php), images /blog-img/<file>, sitemap /sitemap-blog.xml.
   ========================================================================== */
declare(strict_types=1);
require_once __DIR__ . '/_lib.php';

const BLOG_CATEGORIES = ['Amazon', 'E-commerce', 'Legal & Tax', 'Company Formation', 'Marketing', 'AI Automation', 'Getting Started', 'Education', 'Real Estate', 'News'];

function blog_dir(): string {
    $d = qa_data_dir() . '/blog';
    if (!is_dir($d)) @mkdir($d, 0750, true);
    return $d;
}

function blog_slugify(string $s): string {
    $s = strtolower(trim($s));
    $s = preg_replace('/[^a-z0-9]+/', '-', $s) ?? '';
    $s = trim($s, '-');
    return substr($s, 0, 80) ?: 'post';
}

function blog_posts(): array { return qa_read('posts'); }

function blog_is_live(array $p): bool {
    return ($p['status'] ?? '') === 'published' && strtotime($p['publishedAt'] ?? 'now') <= time();
}

function blog_find_slug(string $slug): ?array {
    foreach (blog_posts() as $p) if (($p['slug'] ?? '') === $slug) return $p;
    return null;
}

/** Slugs that already exist as real pages on the website (never reuse them). */
function blog_reserved_slug(string $slug): bool {
    return is_file(QA_ROOT . "/$slug.html") || in_array($slug, ['admin', 'api', 'assets', 'blog', 'booking'], true);
}

function blog_url(array $p): string { return QA_SITE . '/blog/' . $p['slug']; }

function blog_plain(string $html): string {
    return trim(preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags(str_replace('<', ' <', $html)), ENT_QUOTES | ENT_HTML5, 'UTF-8')) ?? '');
}

function blog_words(string $html): int { return count(preg_split('/\s+/u', blog_plain($html), -1, PREG_SPLIT_NO_EMPTY)); }

function blog_reading_minutes(string $html): int { return max(1, (int)round(blog_words($html) / 220)); }

// ---------------------------------------------------------------------------
// HTML cleaning: only safe tags & attributes survive (the editor's output is
// never trusted as-is).
// ---------------------------------------------------------------------------
function blog_has_block(DOMNode $n): bool {
    foreach ($n->childNodes as $c) if ($c instanceof DOMElement && in_array(strtolower($c->tagName), ['p', 'h2', 'h3', 'h4', 'ul', 'ol', 'table', 'figure', 'blockquote', 'pre', 'hr'], true)) return true;
    return false;
}

function blog_clean_html(string $html, string $slug = ''): string {
    if (trim($html) === '') return '';
    if (!class_exists('DOMDocument')) return nl2br(htmlspecialchars(blog_plain($html), ENT_QUOTES, 'UTF-8'));
    $allowed = [
        'p' => [], 'h2' => ['id'], 'h3' => ['id'], 'h4' => ['id'], 'strong' => [], 'b' => [], 'em' => [], 'i' => [], 'u' => [], 's' => [],
        'a' => ['href', 'title'], 'ul' => [], 'ol' => [], 'li' => [], 'blockquote' => [], 'br' => [], 'hr' => [],
        'img' => ['src', 'alt', 'title', 'width', 'height'], 'figure' => [], 'figcaption' => [],
        'table' => [], 'thead' => [], 'tbody' => [], 'tr' => [], 'th' => [], 'td' => [], 'code' => [], 'pre' => [],
        'iframe' => ['src', 'title'],
    ];
    $doc = new DOMDocument('1.0', 'UTF-8');
    libxml_use_internal_errors(true);
    $doc->loadHTML('<?xml encoding="UTF-8"><div id="qa-root">' . $html . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
    libxml_clear_errors();
    $root = (new DOMXPath($doc))->query('//*[@id="qa-root"]')->item(0);
    if (!$root) return '';

    $walk = function (DOMNode $node) use (&$walk, $allowed, $doc, $slug) {
        for ($i = $node->childNodes->length - 1; $i >= 0; $i--) {
            $child = $node->childNodes->item($i);
            if ($child instanceof DOMComment) { $node->removeChild($child); continue; }
            if (!($child instanceof DOMElement)) continue;
            $tag = strtolower($child->tagName);
            if (in_array($tag, ['script', 'style', 'object', 'embed', 'form', 'input', 'button', 'select', 'textarea', 'svg', 'math', 'link', 'meta'], true)) { $node->removeChild($child); continue; }
            if ($tag === 'div' || $tag === 'span' || $tag === 'font' || $tag === 'section' || $tag === 'article' || !isset($allowed[$tag])) {
                $walk($child);
                // unwrap: keep the children, drop the element (a div becomes a paragraph break)
                $frag = $doc->createDocumentFragment();
                while ($child->firstChild) $frag->appendChild($child->firstChild);
                if (!$frag->hasChildNodes()) $node->removeChild($child);
                elseif ($tag === 'div' && !blog_has_block($frag)) { $p = $doc->createElement('p'); $p->appendChild($frag); $node->replaceChild($p, $child); }
                else $node->replaceChild($frag, $child);
                continue;
            }
            foreach (iterator_to_array($child->attributes) as $attr) {
                if (!in_array(strtolower($attr->name), $allowed[$tag], true)) $child->removeAttribute($attr->name);
            }
            if ($tag === 'a') {
                $href = trim($child->getAttribute('href'));
                if (!preg_match('#^(https?://|mailto:|tel:|/|\#)#i', $href)) { $child->removeAttribute('href'); }
                elseif ($href[0] === '#' && $slug) { $child->setAttribute('href', '/blog/' . $slug . $href); }
                elseif (preg_match('#^https?://#i', $href) && !preg_match('#^https?://(www\.)?qalbeabbas\.com#i', $href)) {
                    $child->setAttribute('target', '_blank'); $child->setAttribute('rel', 'noopener');
                }
            }
            if ($tag === 'img') {
                $src = trim($child->getAttribute('src'));
                if (!preg_match('#^(/blog-img/[\w.-]+|/assets/[\w./-]+|https://[^\s"]+)$#', $src)) { $node->removeChild($child); continue; }
                $child->setAttribute('loading', 'lazy'); $child->setAttribute('decoding', 'async');
                if (!$child->hasAttribute('alt')) $child->setAttribute('alt', '');
            }
            if ($tag === 'iframe') {
                $src = trim($child->getAttribute('src'));
                if (!preg_match('#^https://(www\.youtube(-nocookie)?\.com/embed/|player\.vimeo\.com/video/)[\w?=&-]+$#', $src)) { $node->removeChild($child); continue; }
                $child->setAttribute('loading', 'lazy'); $child->setAttribute('allowfullscreen', '');
                $child->setAttribute('allow', 'accelerometer; encrypted-media; gyroscope; picture-in-picture');
            }
            $walk($child);
        }
    };
    $walk($root);

    // Headings get ids so a table of contents can link to them.
    $used = [];
    foreach (['h2', 'h3'] as $h) {
        foreach ($root->getElementsByTagName($h) as $el) {
            $id = blog_slugify($el->textContent);
            $base = $id; $n = 2;
            while (isset($used[$id])) $id = $base . '-' . $n++;
            $used[$id] = true;
            $el->setAttribute('id', $id);
        }
    }
    $out = '';
    foreach ($root->childNodes as $c) $out .= $doc->saveHTML($c);
    // Remove empty paragraphs left by the editor.
    $out = preg_replace('#<p>(\s|&nbsp;|<br>)*</p>#u', '', $out) ?? $out;
    return trim($out);
}

/** Table of contents from the H2 headings. */
function blog_toc(string $html): array {
    preg_match_all('#<h2 id="([^"]+)">(.*?)</h2>#s', $html, $m, PREG_SET_ORDER);
    return array_map(fn($x) => ['id' => $x[1], 'text' => blog_plain($x[2])], $m);
}

// ---------------------------------------------------------------------------
// SEO checklist for a post (used by the editor and the SEO tab)
// ---------------------------------------------------------------------------
function blog_seo_checks(array $p): array {
    $title = $p['seoTitle'] ?: $p['title'];
    $desc = $p['seoDescription'] ?: $p['excerpt'];
    $kw = mb_strtolower(trim((string)($p['keyword'] ?? '')));
    $text = mb_strtolower(blog_plain($p['content'] ?? ''));
    $words = blog_words($p['content'] ?? '');
    $first = mb_substr($text, 0, 600);
    preg_match_all('#<h[23][^>]*>(.*?)</h[23]>#s', $p['content'] ?? '', $hs);
    $headings = mb_strtolower(blog_plain(implode(' ', $hs[1] ?? [])));
    preg_match_all('#<img[^>]*>#', $p['content'] ?? '', $imgs);
    $noAlt = count(array_filter($imgs[0] ?? [], fn($t) => !preg_match('#alt="[^"]+"#', $t)));
    preg_match_all('#<a [^>]*href="(/[^"]*|https?://(www\.)?qalbeabbas\.com[^"]*)"#', $p['content'] ?? '', $internal);
    preg_match_all('#<a [^>]*href="https?://(?!(www\.)?qalbeabbas\.com)#', $p['content'] ?? '', $external);
    $tl = mb_strlen($title); $dl = mb_strlen($desc);
    $c = [];
    $c[] = ['ok' => $tl >= 30 && $tl <= 62, 'text' => "SEO title length: $tl characters (aim for 50–60)"];
    $c[] = ['ok' => $dl >= 120 && $dl <= 160, 'text' => "Meta description length: $dl characters (aim for 140–160)"];
    $c[] = ['ok' => $words >= 600, 'text' => "Article length: $words words (aim for 600+; 1,000+ for competitive topics)"];
    $c[] = ['ok' => count($hs[1] ?? []) >= 2, 'text' => 'Uses subheadings (H2/H3) to break up the article'];
    $c[] = ['ok' => !empty($p['cover']), 'text' => 'Has a cover image (used on Google, Facebook and WhatsApp previews)'];
    $c[] = ['ok' => !empty($p['cover']) ? trim((string)($p['coverAlt'] ?? '')) !== '' : false, 'text' => 'Cover image has alt text'];
    $c[] = ['ok' => $noAlt === 0, 'text' => $noAlt ? "$noAlt image(s) in the article have no alt text" : 'All article images have alt text'];
    $c[] = ['ok' => count($internal[0] ?? []) >= 1, 'text' => 'Links to at least one page on qalbeabbas.com (service, course or another post)'];
    $c[] = ['ok' => count($external[0] ?? []) >= 1, 'text' => 'Links to at least one trusted outside source (e.g. Amazon, GOV.UK, IRS)'];
    if ($kw !== '') {
        $c[] = ['ok' => str_contains(mb_strtolower($title), $kw), 'text' => "Focus keyword “{$p['keyword']}” is in the SEO title"];
        $c[] = ['ok' => str_contains(mb_strtolower($desc), $kw), 'text' => 'Focus keyword is in the meta description'];
        $c[] = ['ok' => str_contains($p['slug'] ?? '', blog_slugify($kw)), 'text' => 'Focus keyword is in the URL'];
        $c[] = ['ok' => str_contains($first, $kw), 'text' => 'Focus keyword appears in the first paragraph'];
        $c[] = ['ok' => str_contains($headings, $kw), 'text' => 'Focus keyword appears in a subheading'];
        $count = $kw !== '' ? substr_count($text, $kw) : 0;
        $density = $words ? round($count * max(1, count(explode(' ', $kw))) / $words * 100, 1) : 0;
        $c[] = ['ok' => $count >= 2 && $density <= 3, 'text' => "Focus keyword used $count times ({$density}% — natural use, not stuffing)"];
    } else {
        $c[] = ['ok' => false, 'text' => 'Set a focus keyword (the phrase people type into Google)'];
    }
    $score = (int)round(count(array_filter($c, fn($x) => $x['ok'])) / count($c) * 100);
    return ['score' => $score, 'checks' => $c];
}

// ---------------------------------------------------------------------------
// Public page: the shell (fonts, CSS, scripts, header & footer) comes from an
// existing built page, so posts always match the rest of the website.
// ---------------------------------------------------------------------------
function blog_shell(): array {
    $tpl = (string)@file_get_contents(QA_ROOT . '/blog-amazon-fba-vs-fbm.html');
    if ($tpl === '') $tpl = (string)@file_get_contents(QA_ROOT . '/blog.html');
    $head = '';
    if (preg_match('#<head>(.*?)</head>#s', $tpl, $m)) $head = $m[1];
    $head = preg_replace('#<!-- SEO:START.*?<!-- SEO:END -->#s', '{{SEO}}', $head) ?? $head;
    $head = preg_replace('#<!-- SCHEMA:START.*?<!-- SCHEMA:END -->#s', '{{SCHEMA}}', $head) ?? $head;
    $head = preg_replace('#<meta name="viewport"[^>]*>#', '$0' . "\n  <base href=\"/\">", $head, 1) ?? $head;
    return ['head' => $head];
}

function blog_e($v): string { return htmlspecialchars((string)($v ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

function blog_cover_url(array $p, bool $absolute = false): string {
    $c = (string)($p['cover'] ?? '');
    if ($c === '') return $absolute ? QA_SITE . '/assets/img/hero/amazon-seller.jpg' : '';
    if (str_starts_with($c, 'http')) return $c;
    return ($absolute ? QA_SITE : '') . $c;
}

/** Save an uploaded image for the blog. Large photos are resized (max 1600px wide)
    and converted to WebP when the server supports it. Returns its /blog-img/ URL. */
function blog_store_image(string $tmp): ?string {
    $info = @getimagesize($tmp);
    $types = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp', IMAGETYPE_GIF => 'gif'];
    if (!$info || !isset($types[$info[2]])) return null;
    $ext = $types[$info[2]];
    $name = date('Ymd') . '-' . bin2hex(random_bytes(5));
    $dir = blog_dir();
    $canConvert = $ext !== 'gif' && function_exists('imagewebp') && function_exists('imagecreatetruecolor');
    if ($canConvert) {
        $img = match ($ext) { 'jpg' => @imagecreatefromjpeg($tmp), 'png' => @imagecreatefrompng($tmp), 'webp' => @imagecreatefromwebp($tmp), default => false };
        if ($img) {
            $w = imagesx($img); $h = imagesy($img);
            if ($w > 1600) {
                $nh = (int)round($h * 1600 / $w);
                $dst = imagecreatetruecolor(1600, $nh);
                imagealphablending($dst, false); imagesavealpha($dst, true);
                imagecopyresampled($dst, $img, 0, 0, 0, 0, 1600, $nh, $w, $h);
                imagedestroy($img); $img = $dst;
            }
            if ($ext === 'jpg' && function_exists('exif_read_data')) {
                $o = (int)(@exif_read_data($tmp)['Orientation'] ?? 1);
                if ($o === 3) $img = imagerotate($img, 180, 0); elseif ($o === 6) $img = imagerotate($img, -90, 0); elseif ($o === 8) $img = imagerotate($img, 90, 0);
            }
            if (@imagewebp($img, "$dir/$name.webp", 82)) { imagedestroy($img); return "/blog-img/$name.webp"; }
            imagedestroy($img);
        }
    }
    return @move_uploaded_file($tmp, "$dir/$name.$ext") ? "/blog-img/$name.$ext" : null;
}
