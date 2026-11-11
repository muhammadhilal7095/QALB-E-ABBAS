<?php
/* GET /blog/<slug> → this file (see .htaccess). Renders a published blog post
   with full SEO tags and Article schema, inside the normal website layout. */
declare(strict_types=1);
require __DIR__ . '/_blog.php';

$slug = preg_replace('/[^a-z0-9-]/', '', (string)($_GET['slug'] ?? ''));
$post = $slug ? blog_find_slug($slug) : null;
$preview = false;
if ($post && !blog_is_live($post)) {
    // Admins can preview drafts (signed link from the dashboard).
    $sig = (string)($_GET['preview'] ?? '');
    $preview = $sig !== '' && hash_equals(hash_hmac('sha256', $post['id'], (string)(qa_read('admin')['previewKey'] ?? 'x')), $sig);
    if (!$preview) $post = null;
}
if (!$post) {
    http_response_code(404);
    readfile(QA_ROOT . '/404.html');
    exit;
}

$e = 'blog_e';
$url = blog_url($post);
$title = $post['seoTitle'] ?: $post['title'] . ' | Qalb-E-Abbas';
$desc = $post['seoDescription'] ?: $post['excerpt'];
$cover = blog_cover_url($post);
$coverAbs = blog_cover_url($post, true);
$published = $post['publishedAt'] ?? $post['createdAt'];
$modified = $post['updatedAt'] ?? $published;
$canonical = $post['canonical'] ?: $url;
$robots = $preview || !empty($post['noindex']) ? 'noindex, nofollow' : 'index, follow, max-image-preview:large';
$author = $post['author'] ?: 'Qalb-E-Abbas Team';
$content = $post['content'];
$toc = blog_toc($content);
$minutes = blog_reading_minutes($content);
$date = fn(string $iso) => (new DateTimeImmutable($iso))->setTimezone(new DateTimeZone('Europe/London'))->format('j F Y');

$seo = '<title>' . $e($title) . '</title>
  <meta name="description" content="' . $e($desc) . '">
  <meta name="robots" content="' . $robots . '">
  <link rel="canonical" href="' . $e($canonical) . '">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Qalb-E-Abbas">
  <meta property="og:locale" content="en_GB">
  <meta property="og:title" content="' . $e($post['seoTitle'] ?: $post['title']) . '">
  <meta property="og:description" content="' . $e($desc) . '">
  <meta property="og:url" content="' . $e($url) . '">
  <meta property="og:image" content="' . $e($coverAbs) . '">
  <meta property="og:image:alt" content="' . $e($post['coverAlt'] ?: $post['title']) . '">
  <meta property="article:published_time" content="' . $e($published) . '">
  <meta property="article:modified_time" content="' . $e($modified) . '">
  <meta property="article:section" content="' . $e($post['category']) . '">'
  . implode('', array_map(fn($t) => "\n  <meta property=\"article:tag\" content=\"" . $e($t) . '">', $post['tags'] ?? [])) . '
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="' . $e($post['seoTitle'] ?: $post['title']) . '">
  <meta name="twitter:description" content="' . $e($desc) . '">
  <meta name="twitter:image" content="' . $e($coverAbs) . '">'
  . ($cover ? "\n  <link rel=\"preload\" as=\"image\" href=\"" . $e($cover) . '" fetchpriority="high">' : '');

$schema = [
    '@context' => 'https://schema.org',
    '@graph' => [
        ['@type' => 'BreadcrumbList', 'itemListElement' => [
            ['@type' => 'ListItem', 'position' => 1, 'name' => 'Home', 'item' => QA_SITE . '/'],
            ['@type' => 'ListItem', 'position' => 2, 'name' => 'Blog', 'item' => QA_SITE . '/blog'],
            ['@type' => 'ListItem', 'position' => 3, 'name' => $post['title'], 'item' => $url],
        ]],
        ['@type' => 'BlogPosting', '@id' => $url . '#article', 'headline' => mb_substr($post['title'], 0, 110), 'description' => $desc, 'url' => $url,
            'mainEntityOfPage' => ['@type' => 'WebPage', '@id' => $url], 'image' => [$coverAbs], 'datePublished' => $published, 'dateModified' => $modified,
            'author' => ['@type' => !empty($post['authorIsPerson']) ? 'Person' : 'Organization', 'name' => $author, 'url' => QA_SITE . '/team'],
            'publisher' => ['@type' => 'Organization', 'name' => 'Qalb-E-Abbas', 'url' => QA_SITE . '/', 'logo' => ['@type' => 'ImageObject', 'url' => QA_SITE . '/assets/img/logo.svg']],
            'articleSection' => $post['category'], 'keywords' => implode(', ', array_filter(array_merge([$post['keyword'] ?? ''], $post['tags'] ?? []))),
            'wordCount' => blog_words($content), 'inLanguage' => 'en-GB'],
    ],
];
if (!empty($post['faqs'])) {
    $schema['@graph'][] = ['@type' => 'FAQPage', 'mainEntity' => array_map(fn($f) => ['@type' => 'Question', 'name' => $f['q'], 'acceptedAnswer' => ['@type' => 'Answer', 'text' => $f['a']]], $post['faqs'])];
}
$schemaHtml = '<script type="application/ld+json">' . json_encode($schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) . '</script>';

// Related posts: same category first, then newest.
$related = array_values(array_filter(blog_posts(), fn($p) => blog_is_live($p) && $p['id'] !== $post['id']));
usort($related, fn($a, $b) => [($b['category'] === $post['category']), $b['publishedAt']] <=> [($a['category'] === $post['category']), $a['publishedAt']]);
$related = array_slice($related, 0, 3);

$shell = blog_shell();
$head = str_replace(['{{SEO}}', '{{SCHEMA}}'], [$seo, $schemaHtml], $shell['head']);

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: public, max-age=300');
if ($preview) header('X-Robots-Tag: noindex');
?><!doctype html>
<html lang="en">
<head><?= $head ?></head>
<body>
  <a class="skip-link" href="/blog/<?= $e($post['slug']) ?>#main">Skip to main content</a>
  <div id="header-mount" class="header-placeholder"></div>
<?php if ($preview): ?>
  <div class="bp-preview">Preview — this post is not published yet. Only people with this link can see it.</div>
<?php endif; ?>
  <main id="main">
    <section class="page-hero">
      <div class="container page-hero__inner">
        <ol class="breadcrumb" aria-label="Breadcrumb"><li><a href="/">Home</a></li><li><a href="/blog">Blog</a></li><li aria-current="page"><?= $e(mb_strimwidth($post['title'], 0, 60, '…')) ?></li></ol>
        <p class="bp-cat"><?= $e($post['category']) ?></p>
        <h1><?= $e($post['title']) ?></h1>
        <p class="byline"><span><svg class="icon" aria-hidden="true"><use href="#i-users"></use></svg>By <?= $e($author) ?></span><span><svg class="icon" aria-hidden="true"><use href="#i-calendar"></use></svg>Published <time datetime="<?= $e(substr($published, 0, 10)) ?>"><?= $e($date($published)) ?></time></span><?php if (substr($modified, 0, 10) !== substr($published, 0, 10)): ?><span>Updated <time datetime="<?= $e(substr($modified, 0, 10)) ?>"><?= $e($date($modified)) ?></time></span><?php endif; ?><span><svg class="icon" aria-hidden="true"><use href="#i-clock"></use></svg><?= $minutes ?> min read</span></p>
      </div>
    </section>
    <section class="section">
      <div class="container bp-layout">
        <article class="content bp-article">
<?php if ($cover): ?>
          <figure class="article-figure"><img src="<?= $e($cover) ?>" alt="<?= $e($post['coverAlt']) ?>" width="1200" height="675" fetchpriority="high" decoding="async"></figure>
<?php endif; ?>
<?php if ($post['excerpt']): ?>
          <p class="lead-p"><?= $e($post['excerpt']) ?></p>
<?php endif; ?>
          <div class="bp-body">
<?= $content ?>

          </div>
<?php if (!empty($post['faqs'])): ?>
          <h2 id="faq">Frequently asked questions</h2>
          <div class="faq bp-faq">
<?php foreach ($post['faqs'] as $f): ?>
            <details><summary><?= $e($f['q']) ?><svg class="icon" aria-hidden="true"><use href="#i-chevron-down"></use></svg></summary><div><p><?= nl2br($e($f['a'])) ?></p></div></details>
<?php endforeach; ?>
          </div>
<?php endif; ?>
<?php if (!empty($post['tags'])): ?>
          <p class="bp-tags"><?php foreach ($post['tags'] as $t): ?><span>#<?= $e($t) ?></span><?php endforeach; ?></p>
<?php endif; ?>
          <div class="bp-share" aria-label="Share this article"><span>Share:</span>
            <a href="https://wa.me/?text=<?= rawurlencode($post['title'] . ' ' . $url) ?>" target="_blank" rel="noopener">WhatsApp</a>
            <a href="https://www.facebook.com/sharer/sharer.php?u=<?= rawurlencode($url) ?>" target="_blank" rel="noopener">Facebook</a>
            <a href="https://www.linkedin.com/sharing/share-offsite/?url=<?= rawurlencode($url) ?>" target="_blank" rel="noopener">LinkedIn</a>
            <a href="https://twitter.com/intent/tweet?url=<?= rawurlencode($url) ?>&amp;text=<?= rawurlencode($post['title']) ?>" target="_blank" rel="noopener">X</a>
          </div>
          <div class="page-cta"><h2><?= $e($post['ctaTitle'] ?: 'Need expert help with this?') ?></h2><p><?= $e($post['ctaText'] ?: 'Book a one-to-one consultation with our team and get a clear plan for your next step.') ?></p><div class="btn-row"><a class="btn btn--accent" href="<?= $e($post['ctaLink'] ?: '/book-consultation') ?>"><?= $e($post['ctaButton'] ?: 'Book Consultation') ?><svg class="icon btn__arrow" aria-hidden="true"><use href="#i-arrow-right"></use></svg></a><a class="btn btn--outline" href="/contact">Contact us</a></div></div>
        </article>
<?php if (count($toc) >= 2): ?>
        <aside class="bp-toc" aria-label="On this page"><p>On this page</p><ol><?php foreach ($toc as $t): ?><li><a href="/blog/<?= $e($post['slug']) ?>#<?= $e($t['id']) ?>"><?= $e($t['text']) ?></a></li><?php endforeach; ?></ol></aside>
<?php endif; ?>
      </div>
    </section>
<?php if ($related): ?>
    <section class="section section--soft" aria-labelledby="rel-title">
      <div class="container">
        <h2 id="rel-title" class="section-title">Keep reading</h2>
        <div class="post-grid">
<?php foreach ($related as $r): ?>
          <article class="post">
<?php if ($r['cover']): ?>
            <a class="post__img" href="/blog/<?= $e($r['slug']) ?>" tabindex="-1" aria-hidden="true"><img src="<?= $e(blog_cover_url($r)) ?>" alt="<?= $e($r['coverAlt']) ?>" width="800" height="450" loading="lazy"></a>
<?php endif; ?>
            <div class="post__body"><p class="post__meta"><span class="post__cat"><?= $e($r['category']) ?></span></p><h3 class="post__title"><a href="/blog/<?= $e($r['slug']) ?>"><?= $e($r['title']) ?></a></h3><p><?= $e($r['excerpt']) ?></p><a class="text-link" href="/blog/<?= $e($r['slug']) ?>">Read more<svg class="icon" aria-hidden="true"><use href="#i-arrow-right"></use></svg></a></div>
          </article>
<?php endforeach; ?>
        </div>
      </div>
    </section>
<?php endif; ?>
  </main>

  <div id="footer-mount"></div>
</body>
</html>
