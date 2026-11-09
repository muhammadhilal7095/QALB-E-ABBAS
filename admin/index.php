<?php
/* ==========================================================================
   Qalb-E-Abbas — Admin dashboard  (https://www.qalbeabbas.com/admin/)

   Bookings & orders · Enquiries & assessments · Reviews · Prices · Settings.
   First visit: click "Email me a setup link" — the link goes to
   contact@qalbeabbas.com and lets you choose the admin password.
   ========================================================================== */
declare(strict_types=1);
require __DIR__ . '/../api/_blog.php';

header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');
header("Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; frame-src https://www.youtube-nocookie.com https://player.vimeo.com; form-action 'self'; frame-ancestors 'none'");

$https = (($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
session_name('qa_admin');
session_set_cookie_params(['lifetime' => 0, 'path' => '/admin', 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict']);
session_start();

const SESSION_HOURS = 12;
// Temporary first password (only its one-way hash is stored here). It stops working as
// soon as a new password is saved in Settings or through an emailed reset link.
const ADMIN_TEMP_HASH = 'pbkdf2_sha256$200000$8baa121837504633e7698e761ec51017$565126e92ec63768d4b5290d09f102e64ca9194134302321d2bcf5ca6a13e29e';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function h($v): string { return htmlspecialchars((string)($v ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function csrf(): string { return $_SESSION['csrf'] ??= bin2hex(random_bytes(16)); }
function csrf_field(): string { return '<input type="hidden" name="csrf" value="' . h(csrf()) . '">'; }
function flash(string $msg, string $type = 'ok'): void { $_SESSION['flash'] = [$msg, $type]; }
function go(string $qs = ''): void { header('Location: /admin/' . ($qs ? '?' . $qs : '')); exit; }
function when(?string $iso): string {
    if (!$iso) return '—';
    try { return (new DateTimeImmutable($iso))->setTimezone(new DateTimeZone('Europe/London'))->format('j M Y, H:i'); } catch (Throwable $e) { return h($iso); }
}
function ago(?string $iso): string {
    if (!$iso) return '';
    $s = time() - strtotime($iso);
    if ($s < 90) return 'just now';
    if ($s < 3600) return floor($s / 60) . ' min ago';
    if ($s < 86400) return floor($s / 3600) . ' h ago';
    if ($s < 86400 * 30) return floor($s / 86400) . ' days ago';
    return when($iso);
}
function icon(string $n): string {
    $p = [
        'home' => '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
        'cart' => '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.6 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L22 7H6"/>',
        'mail' => '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
        'star' => '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
        'tag' => '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
        'cog' => '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
        'out' => '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
        'ext' => '<path d="M14 3h7v7"/><path d="M10 14L21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
        'back' => '<path d="M15 18l-6-6 6-6"/>',
        'cal' => '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
        'money' => '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
        'check' => '<path d="M20 6L9 17l-5-5"/>',
        'pen' => '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
        'search' => '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
        'warn' => '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    ][$n] ?? '';
    return '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' . $p . '</svg>';
}
function badge(string $value, array $map): string {
    [$label, $tone] = $map[$value] ?? [ucfirst(str_replace('_', ' ', $value)), 'grey'];
    return '<span class="badge badge--' . $tone . '">' . h($label) . '</span>';
}
const ORDER_STATUS = ['new' => ['New', 'blue'], 'confirmed' => ['Confirmed', 'teal'], 'in_progress' => ['In progress', 'amber'], 'completed' => ['Completed', 'green'], 'cancelled' => ['Cancelled', 'grey']];
const PAYMENT_STATUS = ['paid' => ['Paid', 'green'], 'pending' => ['Card payment not finished', 'grey'], 'awaiting' => ['Awaiting payment', 'amber'], 'refunded' => ['Refunded', 'red']];
const ENQ_STATUS = ['new' => ['New', 'blue'], 'replied' => ['Replied', 'teal'], 'closed' => ['Closed', 'grey']];
const REVIEW_STATUS = ['pending' => ['Waiting for approval', 'amber'], 'approved' => ['Live on website', 'green'], 'rejected' => ['Rejected', 'grey']];

function admin_data(): array { return qa_read('admin'); }
function admin_email(): string { return (string)(admin_data()['email'] ?? QA_ADMIN_EMAIL); }
function active_hash(): string { return (string)(admin_data()['passwordHash'] ?? ADMIN_TEMP_HASH); }
function using_temp_password(): bool { return empty(admin_data()['passwordHash']); }
function pwv(): string { return substr(hash('sha256', active_hash()), 0, 16); }
function check_password(string $p): bool {
    $hash = active_hash();
    if (str_starts_with($hash, 'pbkdf2_sha256$')) {
        [, $it, $salt, $want] = explode('$', $hash);
        return hash_equals($want, hash_pbkdf2('sha256', $p, $salt, (int)$it));
    }
    return password_verify($p, $hash);
}
function logged_in(): bool {
    return !empty($_SESSION['admin'])
        && ($_SESSION['pwv'] ?? '') === pwv()
        && (time() - (int)($_SESSION['since'] ?? 0)) < SESSION_HOURS * 3600;
}
/** Max $max attempts per $seconds per IP for $bucket. Returns false when the limit is reached. */
function allow(string $bucket, int $max, int $seconds): bool {
    $file = sys_get_temp_dir() . '/qa_rl_admin_' . $bucket . '_' . hash('sha256', qa_ip());
    $now = time();
    $hits = array_filter(array_map('intval', @file($file, FILE_IGNORE_NEW_LINES) ?: []), fn($t) => $t > $now - $seconds);
    if (count($hits) >= $max) return false;
    $hits[] = $now;
    @file_put_contents($file, implode("\n", $hits));
    return true;
}
function send_setup_link(): void {
    $token = bin2hex(random_bytes(24));
    qa_update('admin', function (array $a) use ($token) { $a['setupHash'] = hash('sha256', $token); $a['setupExpires'] = time() + 3600; return $a; });
    $link = QA_SITE . '/admin/?setup=' . $token;
    qa_mail(admin_email(), 'Qalb-E-Abbas admin — set your password',
        "Use this link within 1 hour to set the admin dashboard password:\n\n$link\n\nIf you didn't ask for this, ignore this email — nothing changes.\n");
}
function strong_enough(string $p): ?string {
    if (strlen($p) < 10) return 'Use at least 10 characters.';
    if (!preg_match('/[A-Za-z]/', $p) || !preg_match('/[0-9]/', $p)) return 'Use letters and numbers.';
    return null;
}

// ---------------------------------------------------------------------------
// Admin-only review photo
// ---------------------------------------------------------------------------
if (isset($_GET['photo']) && logged_in()) {
    $r = qa_find('reviews', preg_replace('/[^a-f0-9]/', '', (string)$_GET['photo']));
    $file = $r && $r['photo'] ? qa_data_dir() . '/photos/' . basename($r['photo']) : '';
    if (!$file || !is_file($file)) { http_response_code(404); exit; }
    header('Content-Type: ' . ($r['photoMime'] ?: 'image/jpeg'));
    readfile($file);
    exit;
}

// ---------------------------------------------------------------------------
// Actions (POST)
// ---------------------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $do = (string)($_POST['do'] ?? '');
    if (!hash_equals(csrf(), (string)($_POST['csrf'] ?? ''))) { flash('Your session expired. Please try again.', 'err'); go(); }

    // --- Not logged in: login, setup link, set password ---
    if ($do === 'login') {
        if (!allow('login', 8, 900)) { flash('Too many attempts. Please wait 15 minutes.', 'err'); go(); }
        $email = strtolower(trim((string)($_POST['email'] ?? '')));
        if ($email === strtolower(admin_email()) && check_password((string)($_POST['password'] ?? ''))) {
            session_regenerate_id(true);
            $_SESSION['admin'] = true; $_SESSION['since'] = time(); $_SESSION['pwv'] = pwv();
            qa_update('admin', function (array $x) { $x['lastLogin'] = qa_now(); return $x; });
            go();
        }
        usleep(400000);
        flash('Wrong email or password.', 'err'); go();
    }
    if ($do === 'send_setup') {
        if (allow('setup', 3, 3600)) send_setup_link();
        flash('A password reset link has been sent to the admin email address. It works for 1 hour.');
        go();
    }
    if ($do === 'set_password') {
        $token = (string)($_POST['token'] ?? '');
        $a = admin_data();
        if (!$token || empty($a['setupHash']) || !hash_equals($a['setupHash'], hash('sha256', $token)) || time() > (int)($a['setupExpires'] ?? 0)) {
            flash('This setup link has expired. Please request a new one.', 'err'); go();
        }
        $p = (string)($_POST['password'] ?? '');
        if ($err = strong_enough($p)) { flash($err, 'err'); go('setup=' . urlencode($token)); }
        if ($p !== (string)($_POST['password2'] ?? '')) { flash('The two passwords do not match.', 'err'); go('setup=' . urlencode($token)); }
        $hash = password_hash($p, PASSWORD_DEFAULT);
        qa_update('admin', function (array $x) use ($hash) { $x['passwordHash'] = $hash; unset($x['setupHash'], $x['setupExpires']); $x['passwordSetAt'] = qa_now(); return $x; });
        session_regenerate_id(true);
        $_SESSION['admin'] = true; $_SESSION['since'] = time(); $_SESSION['pwv'] = pwv();
        flash('Password saved. Welcome to your dashboard!'); go();
    }

    if (!logged_in()) go();

    // --- Logged in ---
    $id = preg_replace('/[^a-f0-9]/', '', (string)($_POST['id'] ?? ''));
    switch ($do) {
        case 'logout':
            $_SESSION = []; session_destroy(); go();

        case 'order_update':
            qa_patch('orders', $id, function (array $o) {
                $status = (string)($_POST['status'] ?? $o['status']);
                $payment = (string)($_POST['payment'] ?? $o['payment']);
                $note = qa_text($_POST['note'] ?? '', 4000);
                if (isset(ORDER_STATUS[$status]) && $status !== $o['status']) { $o['log'][] = ['at' => qa_now(), 'text' => 'Status → ' . ORDER_STATUS[$status][0]]; $o['status'] = $status; }
                if (isset(PAYMENT_STATUS[$payment]) && $payment !== $o['payment']) {
                    $o['log'][] = ['at' => qa_now(), 'text' => 'Payment → ' . PAYMENT_STATUS[$payment][0] . ' (set by admin)'];
                    $o['payment'] = $payment;
                    if ($payment === 'paid' && empty($o['paidAt'])) $o['paidAt'] = qa_now();
                }
                $o['note'] = $note;
                return $o;
            });
            flash('Order updated.'); go('tab=orders&id=' . $id);

        case 'order_delete':
            qa_update('orders', fn(array $l) => array_values(array_filter($l, fn($o) => $o['id'] !== $id)));
            flash('Order deleted.'); go('tab=orders');

        case 'enquiry_update':
            qa_patch('enquiries', $id, function (array $e) {
                $s = (string)($_POST['status'] ?? $e['status']);
                if (isset(ENQ_STATUS[$s])) $e['status'] = $s;
                $e['note'] = qa_text($_POST['note'] ?? '', 4000);
                return $e;
            });
            flash('Enquiry updated.'); go('tab=enquiries&id=' . $id);

        case 'enquiry_delete':
            qa_update('enquiries', fn(array $l) => array_values(array_filter($l, fn($e) => $e['id'] !== $id)));
            flash('Enquiry deleted.'); go('tab=enquiries');

        case 'review_update':
            qa_patch('reviews', $id, function (array $r) {
                $s = (string)($_POST['status'] ?? $r['status']);
                if (isset(REVIEW_STATUS[$s])) $r['status'] = $s;
                if (isset($_POST['name'])) {
                    $r['name'] = qa_text($_POST['name'], 80) ?: $r['name'];
                    $r['country'] = qa_text($_POST['country'] ?? '', 60);
                    $flag = strtolower(qa_text($_POST['flag'] ?? '', 2));
                    $r['flag'] = preg_match('/^[a-z]{2}$/', $flag) ? $flag : qa_country_flag($r['country']);
                    $r['service'] = qa_text($_POST['service'] ?? '', 80);
                    $page = (string)($_POST['page'] ?? '');
                    if (isset(QA_REVIEW_KEYS[$page])) $r['page'] = $page;
                    $r['text'] = qa_text($_POST['text'] ?? '', 1200) ?: $r['text'];
                    $r['rating'] = max(1, min(5, (int)($_POST['rating'] ?? $r['rating'])));
                    $r['featured'] = !empty($_POST['featured']);
                    if (!empty($_POST['remove_photo']) && $r['photo']) { @unlink(qa_data_dir() . '/photos/' . basename($r['photo'])); $r['photo'] = null; }
                    $up = $_FILES['photo'] ?? null;
                    if ($up && ($up['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK && is_uploaded_file($up['tmp_name']) && $up['size'] <= 5 * 1024 * 1024) {
                        $types = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
                        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($up['tmp_name']) ?: '';
                        if (isset($types[$mime]) && @getimagesize($up['tmp_name']) !== false) {
                            $file = $r['id'] . '-' . substr(bin2hex(random_bytes(3)), 0, 6) . '.' . $types[$mime];
                            if (@move_uploaded_file($up['tmp_name'], qa_data_dir() . '/photos/' . $file)) {
                                if ($r['photo']) @unlink(qa_data_dir() . '/photos/' . basename($r['photo']));
                                $r['photo'] = $file; $r['photoMime'] = $mime;
                            }
                        }
                    }
                }
                if ($r['status'] === 'approved' && empty($r['approvedAt'])) $r['approvedAt'] = qa_now();
                return $r;
            });
            $msg = ['approved' => 'Review approved — it is now live on the website.', 'rejected' => 'Review rejected.'][$_POST['status'] ?? ''] ?? 'Review saved.';
            flash($msg); go('tab=reviews' . (isset($_POST['back']) ? '' : '&id=' . $id));

        case 'review_add':
            $name = qa_text($_POST['name'] ?? '', 80);
            $text = qa_text($_POST['text'] ?? '', 1200);
            $page = (string)($_POST['page'] ?? 'students');
            if (mb_strlen($name) < 2 || mb_strlen($text) < 10 || !isset(QA_REVIEW_KEYS[$page])) { flash('Please fill in the name, the page and the review text.', 'err'); go('tab=reviews&new=1'); }
            if (empty($_POST['confirm'])) { flash('Please confirm this is a real client who agreed to publish their review.', 'err'); go('tab=reviews&new=1'); }
            $rid = qa_id(); $photoFile = null; $mime = null;
            if (!empty($_FILES['photo']) && ($_FILES['photo']['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK && is_uploaded_file($_FILES['photo']['tmp_name'])) {
                $types = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
                $mime = (new finfo(FILEINFO_MIME_TYPE))->file($_FILES['photo']['tmp_name']) ?: '';
                if ($_FILES['photo']['size'] > 5 * 1024 * 1024 || !isset($types[$mime]) || @getimagesize($_FILES['photo']['tmp_name']) === false) { flash('The photo must be a JPG, PNG or WebP image up to 5 MB.', 'err'); go('tab=reviews&new=1'); }
                $photoFile = "$rid.{$types[$mime]}";
                if (!@move_uploaded_file($_FILES['photo']['tmp_name'], qa_data_dir() . "/photos/$photoFile")) { $photoFile = null; $mime = null; }
            }
            $country = qa_text($_POST['country'] ?? '', 60);
            qa_insert('reviews', [
                'id' => $rid, 'ref' => qa_ref('REV'), 'createdAt' => qa_now(), 'approvedAt' => qa_now(), 'status' => 'approved', 'addedByAdmin' => true,
                'name' => $name, 'email' => qa_text($_POST['email'] ?? '', 120), 'country' => $country, 'flag' => qa_country_flag($country),
                'service' => qa_text($_POST['service'] ?? '', 80), 'page' => $page, 'rating' => max(1, min(5, (int)($_POST['rating'] ?? 5))), 'text' => $text,
                'photo' => $photoFile, 'photoMime' => $mime, 'consent' => true, 'featured' => !empty($_POST['featured']),
            ]);
            flash('Review added — it is now live on the website.'); go('tab=reviews');

        case 'samples_toggle':
            $key = (string)($_POST['key'] ?? '');
            qa_update('settings', function (array $s) use ($key) {
                $list = (array)($s['hiddenSampleKeys'] ?? []);
                $list = in_array($key, $list, true) ? array_values(array_diff($list, [$key])) : array_merge($list, [$key]);
                $s['hiddenSampleKeys'] = $list;
                return $s;
            });
            flash('Saved. The website updates within about a minute.'); go('tab=reviews&f=samples');

        case 'blog_upload':
            header('Content-Type: application/json');
            $f = $_FILES['image'] ?? null;
            if (!$f || ($f['error'] ?? 1) !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) { echo json_encode(['ok' => false, 'error' => 'Upload failed.']); exit; }
            if ($f['size'] > 8 * 1024 * 1024) { echo json_encode(['ok' => false, 'error' => 'The image must be 8 MB or smaller.']); exit; }
            $url = blog_store_image($f['tmp_name']);
            echo json_encode($url ? ['ok' => true, 'url' => $url] : ['ok' => false, 'error' => 'Please upload a JPG, PNG, WebP or GIF image.']);
            exit;

        case 'post_save':
            $existing = $id ? qa_find('posts', $id) : null;
            $title = qa_text($_POST['title'] ?? '', 160);
            if (mb_strlen($title) < 5) { flash('Please write a title (at least 5 characters).', 'err'); go('tab=blog&' . ($id ? 'id=' . $id : 'new=1')); }
            $slug = blog_slugify((string)($_POST['slug'] ?? '') ?: $title);
            foreach (blog_posts() as $p) if ($p['slug'] === $slug && $p['id'] !== $id) $slug .= '-' . substr(qa_id(), 0, 4);
            if (blog_reserved_slug($slug)) $slug .= '-post';
            $status = (string)($_POST['status'] ?? ($existing['status'] ?? 'draft'));
            if (!in_array($status, ['draft', 'published'], true)) $status = 'draft';
            $pubInput = trim((string)($_POST['publishedAt'] ?? ''));
            $pubAt = $existing['publishedAt'] ?? null;
            if ($pubInput !== '') { try { $pubAt = (new DateTimeImmutable($pubInput, new DateTimeZone('Europe/London')))->format('c'); } catch (Throwable $e) { /* keep */ } }
            if ($status === 'published' && !$pubAt) $pubAt = qa_now();
            $faqs = [];
            foreach ((array)($_POST['faq_q'] ?? []) as $i => $q) {
                $q = qa_text($q, 200); $a = qa_text($_POST['faq_a'][$i] ?? '', 1000);
                if ($q !== '' && $a !== '') $faqs[] = ['q' => $q, 'a' => $a];
            }
            $cover = (string)($_POST['cover'] ?? '');
            if ($cover !== '' && !preg_match('#^(/blog-img/[\w.-]+|/assets/[\w./-]+)$#', $cover)) $cover = '';
            $ctaLink = qa_text($_POST['ctaLink'] ?? '', 200);
            if ($ctaLink !== '' && !preg_match('#^(/|https://)#', $ctaLink)) $ctaLink = '';
            $canonical = qa_text($_POST['canonical'] ?? '', 300);
            if ($canonical !== '' && !preg_match('#^https://#', $canonical)) $canonical = '';
            $post = array_merge($existing ?? ['id' => qa_id(), 'createdAt' => qa_now()], [
                'title' => $title, 'slug' => $slug, 'status' => $status, 'publishedAt' => $pubAt, 'updatedAt' => qa_now(),
                'excerpt' => qa_text($_POST['excerpt'] ?? '', 400),
                'content' => blog_clean_html((string)($_POST['content'] ?? ''), $slug),
                'category' => in_array($_POST['category'] ?? '', BLOG_CATEGORIES, true) ? $_POST['category'] : 'News',
                'tags' => array_values(array_filter(array_map(fn($t) => qa_text($t, 40), explode(',', (string)($_POST['tags'] ?? ''))))),
                'cover' => $cover, 'coverAlt' => qa_text($_POST['coverAlt'] ?? '', 160),
                'author' => qa_text($_POST['author'] ?? '', 80), 'authorIsPerson' => !empty($_POST['authorIsPerson']),
                'featured' => !empty($_POST['featured']),
                'seoTitle' => qa_text($_POST['seoTitle'] ?? '', 80), 'seoDescription' => qa_text($_POST['seoDescription'] ?? '', 200),
                'keyword' => qa_text($_POST['keyword'] ?? '', 80), 'canonical' => $canonical, 'noindex' => !empty($_POST['noindex']),
                'faqs' => $faqs,
                'ctaTitle' => qa_text($_POST['ctaTitle'] ?? '', 120), 'ctaText' => qa_text($_POST['ctaText'] ?? '', 300),
                'ctaButton' => qa_text($_POST['ctaButton'] ?? '', 60), 'ctaLink' => $ctaLink,
            ]);
            if ($post['featured']) qa_update('posts', fn(array $l) => array_map(fn($p) => array_merge($p, ['featured' => false]), $l));
            if ($existing) qa_patch('posts', $post['id'], fn() => $post); else qa_insert('posts', $post);
            $live = blog_is_live($post);
            flash($status === 'published' ? ($live ? 'Published — the post is live at /blog/' . $slug : 'Scheduled — it goes live on ' . when($pubAt) . '.') : 'Draft saved.');
            go('tab=blog&id=' . $post['id']);

        case 'post_delete':
            qa_update('posts', fn(array $l) => array_values(array_filter($l, fn($p) => $p['id'] !== $id)));
            flash('Post deleted.'); go('tab=blog');

        case 'seo_verify_add':
            $name = basename(trim((string)($_POST['file'] ?? '')));
            $body = trim((string)($_POST['body'] ?? ''));
            if (!preg_match('/^(google[0-9a-f]+\.html|yandex_[0-9a-f]+\.html|BingSiteAuth\.xml)$/', $name) || $body === '' || strlen($body) > 5000) {
                flash('Use the exact file name from Google (google….html) or Bing (BingSiteAuth.xml) and paste its contents.', 'err'); go('tab=seo');
            }
            qa_update('settings', function (array $s) use ($name, $body) { $s['verifyFiles'][$name] = $body; return $s; });
            flash("Added — it is now online at /$name. Go back to Google/Bing and press Verify."); go('tab=seo');

        case 'seo_verify_delete':
            $name = (string)($_POST['file'] ?? '');
            qa_update('settings', function (array $s) use ($name) { unset($s['verifyFiles'][$name]); return $s; });
            flash('Verification file removed.'); go('tab=seo');

        case 'review_delete':
            $r = qa_find('reviews', $id);
            if ($r && $r['photo']) @unlink(qa_data_dir() . '/photos/' . basename($r['photo']));
            qa_update('reviews', fn(array $l) => array_values(array_filter($l, fn($x) => $x['id'] !== $id)));
            flash('Review deleted.'); go('tab=reviews');

        case 'prices_save':
            $cat = qa_catalog(); $cons = qa_consultations();
            $items = []; $consult = [];
            foreach ((array)($_POST['p'] ?? []) as $sku => $v) {
                $v = trim((string)$v);
                if (!isset($cat[$sku]) || $v === '' || $cat[$sku]['defaultPrice'] === null) continue;
                $n = round((float)$v, 2);
                if ($n >= 0 && $n <= 1000000 && abs($n - (float)$cat[$sku]['defaultPrice']) > 0.001) $items[$sku] = $n;
            }
            foreach ((array)($_POST['c'] ?? []) as $slug => $v) {
                $v = trim((string)$v);
                if (!isset($cons[$slug]) || $v === '') continue;
                $n = round((float)$v, 2);
                if ($n >= 0 && $n <= 1000000 && abs($n - (float)$cons[$slug]['defaultPrice']) > 0.001) $consult[$slug] = $n;
            }
            qa_update('prices', fn() => ['items' => $items, 'consultations' => $consult, 'updatedAt' => qa_now()]);
            flash('Prices saved. The website shows the new prices within about a minute.'); go('tab=prices');

        case 'prices_reset':
            qa_update('prices', fn() => ['items' => [], 'consultations' => [], 'updatedAt' => qa_now()]);
            flash('All prices are back to the standard price list.'); go('tab=prices');

        case 'settings_save':
            qa_update('settings', function (array $s) {
                $email = qa_text($_POST['notifyEmail'] ?? '', 200);
                $s['notifyEmail'] = filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : QA_ADMIN_EMAIL;
                $sk = trim((string)($_POST['stripeSecret'] ?? ''));
                if ($sk !== '' && preg_match('/^(sk|rk)_(live|test)_[A-Za-z0-9]+$/', $sk)) $s['stripeSecret'] = $sk;
                $wh = trim((string)($_POST['stripeWebhook'] ?? ''));
                if ($wh !== '' && preg_match('/^whsec_[A-Za-z0-9]+$/', $wh)) $s['stripeWebhook'] = $wh;
                if (!empty($_POST['clearStripe'])) { $s['stripeSecret'] = ''; $s['stripeWebhook'] = ''; }
                $s['manualPayments'] = !empty($_POST['manualPayments']);
                $s['hideSamples'] = !empty($_POST['hideSamples']);
                return $s;
            });
            flash('Settings saved.'); go('tab=settings');

        case 'password_change':
            if (!check_password((string)($_POST['current'] ?? ''))) { flash('Your current password is wrong.', 'err'); go('tab=settings'); }
            $newEmail = strtolower(trim((string)($_POST['email'] ?? '')));
            if (!filter_var($newEmail, FILTER_VALIDATE_EMAIL)) { flash('Please enter a valid login email.', 'err'); go('tab=settings'); }
            $p = (string)($_POST['password'] ?? '');
            if ($p === '' && !using_temp_password()) {
                qa_update('admin', function (array $x) use ($newEmail) { $x['email'] = $newEmail; return $x; });
                flash('Login email saved.'); go('tab=settings');
            }
            if ($err = strong_enough($p)) { flash($err, 'err'); go('tab=settings'); }
            if ($p !== (string)($_POST['password2'] ?? '')) { flash('The two new passwords do not match.', 'err'); go('tab=settings'); }
            $hash = password_hash($p, PASSWORD_DEFAULT);
            qa_update('admin', function (array $x) use ($hash, $newEmail) { $x['passwordHash'] = $hash; $x['email'] = $newEmail; $x['passwordSetAt'] = qa_now(); return $x; });
            $_SESSION['pwv'] = pwv();
            flash('Login details saved. Other devices are signed out.'); go('tab=settings');
    }
    go();
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------
$flash = $_SESSION['flash'] ?? null; unset($_SESSION['flash']);

function page_start(string $title, bool $app = true): void {
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
       . '<meta name="robots" content="noindex, nofollow"><title>' . h($title) . ' · Qalb-E-Abbas Admin</title>'
       . '<link rel="icon" href="/assets/img/favicon.svg"><link rel="stylesheet" href="/admin/admin.css?v=2"></head><body class="' . ($app ? 'app' : 'auth') . '">';
}
function flash_html(?array $f): string { return $f ? '<div class="flash flash--' . h($f[1]) . '" role="status">' . icon($f[1] === 'err' ? 'warn' : 'check') . '<span>' . h($f[0]) . '</span></div>' : ''; }

// ---- Sign in / setup -------------------------------------------------------
if (!logged_in()) {
    $a = admin_data();
    $token = (string)($_GET['setup'] ?? '');
    page_start('Sign in', false);
    echo '<main class="auth__box"><div class="auth__brand"><span class="logo">Q</span><div><b>Qalb-E-Abbas</b><small>Admin dashboard</small></div></div>' . flash_html($flash);
    if ($token !== '') {
        $valid = !empty($a['setupHash']) && hash_equals($a['setupHash'], hash('sha256', $token)) && time() <= (int)($a['setupExpires'] ?? 0);
        if ($valid) {
            echo '<h1>Choose your password</h1><p class="muted">At least 10 characters, with letters and numbers.</p>'
               . '<form method="post" class="stack">' . csrf_field() . '<input type="hidden" name="do" value="set_password"><input type="hidden" name="token" value="' . h($token) . '">'
               . '<label>New password<input type="password" name="password" autocomplete="new-password" required minlength="10"></label>'
               . '<label>Repeat password<input type="password" name="password2" autocomplete="new-password" required minlength="10"></label>'
               . '<button class="btn btn--primary btn--block">Save password &amp; sign in</button></form>';
        } else {
            echo '<h1>Link expired</h1><p class="muted">This setup link is no longer valid. Request a new one below.</p>'
               . '<form method="post">' . csrf_field() . '<input type="hidden" name="do" value="send_setup"><button class="btn btn--primary btn--block">Email me a new setup link</button></form>';
        }
    } else {
        echo '<h1>Sign in</h1><p class="muted">Use your admin email and password.</p>'
           . '<form method="post" class="stack">' . csrf_field() . '<input type="hidden" name="do" value="login">'
           . '<label>Email<input type="email" name="email" autocomplete="username" required autofocus></label>'
           . '<label>Password<input type="password" name="password" autocomplete="current-password" required></label>'
           . '<button class="btn btn--primary btn--block">Sign in</button></form>'
           . '<form method="post" class="auth__forgot">' . csrf_field() . '<input type="hidden" name="do" value="send_setup"><button class="linkbtn">Forgot password? Email me a reset link</button></form>';
    }
    echo '</main></body></html>';
    exit;
}

// ---- Logged in: layout -----------------------------------------------------
$tab = (string)($_GET['tab'] ?? 'dashboard');
$orders = qa_read('orders'); $enquiries = qa_read('enquiries'); $reviews = qa_read('reviews'); $settings = qa_settings();
$count = [
    'orders' => count(array_filter($orders, fn($o) => $o['status'] === 'new')),
    'enquiries' => count(array_filter($enquiries, fn($e) => $e['status'] === 'new')),
    'reviews' => count(array_filter($reviews, fn($r) => $r['status'] === 'pending')),
];
$nav = ['dashboard' => ['Dashboard', 'home'], 'orders' => ['Bookings & orders', 'cart'], 'enquiries' => ['Enquiries', 'mail'], 'reviews' => ['Reviews', 'star'], 'prices' => ['Prices', 'tag'], 'blog' => ['Blog', 'pen'], 'seo' => ['SEO', 'search'], 'settings' => ['Settings', 'cog']];
if (!isset($nav[$tab])) $tab = 'dashboard';

page_start($nav[$tab][0]);
echo '<aside class="side"><div class="side__brand"><span class="logo">Q</span><div><b>Qalb-E-Abbas</b><small>Admin</small></div></div><nav class="side__nav">';
foreach ($nav as $k => [$label, $ic]) {
    $n = $count[$k] ?? 0;
    echo '<a href="/admin/?tab=' . $k . '"' . ($k === $tab ? ' class="is-active" aria-current="page"' : '') . '>' . icon($ic) . '<span>' . h($label) . '</span>' . ($n ? '<em>' . $n . '</em>' : '') . '</a>';
}
echo '</nav><div class="side__foot"><a href="/" target="_blank" rel="noopener">' . icon('ext') . '<span>View website</span></a>'
   . '<form method="post">' . csrf_field() . '<input type="hidden" name="do" value="logout"><button>' . icon('out') . '<span>Sign out</span></button></form></div></aside>';
echo '<main class="main">' . flash_html($flash);

$id = preg_replace('/[^a-f0-9]/', '', (string)($_GET['id'] ?? ''));
$q = trim((string)($_GET['q'] ?? ''));
$filter = (string)($_GET['f'] ?? '');

function matches(array $row, string $q, array $fields): bool {
    if ($q === '') return true;
    foreach ($fields as $f) {
        $v = $row;
        foreach (explode('.', $f) as $k) $v = is_array($v) ? ($v[$k] ?? '') : '';
        if (is_string($v) && stripos($v, $q) !== false) return true;
    }
    return false;
}
function toolbar(string $tab, array $filters, string $current, string $q, string $placeholder): string {
    $out = '<div class="toolbar"><div class="chips">';
    foreach ($filters as $k => $label) $out .= '<a class="chip' . ($k === $current ? ' is-on' : '') . '" href="/admin/?tab=' . $tab . ($k ? '&f=' . $k : '') . ($q ? '&q=' . urlencode($q) : '') . '">' . h($label) . '</a>';
    $out .= '</div><form class="search" method="get"><input type="hidden" name="tab" value="' . $tab . '">' . ($current ? '<input type="hidden" name="f" value="' . h($current) . '">' : '')
          . '<input type="search" name="q" value="' . h($q) . '" placeholder="' . h($placeholder) . '"></form></div>';
    return $out;
}
function empty_state(string $text): string { return '<div class="empty">' . h($text) . '</div>'; }

// ===========================================================================
// DASHBOARD
// ===========================================================================
if ($tab === 'dashboard') {
    $monthStart = (new DateTimeImmutable('first day of this month 00:00', new DateTimeZone('Europe/London')))->getTimestamp();
    $revenue = [];
    foreach ($orders as $o) {
        if ($o['payment'] === 'paid' && strtotime($o['paidAt'] ?? $o['createdAt']) >= $monthStart) {
            $cur = $o['priced']['currency'];
            $revenue[$cur] = ($revenue[$cur] ?? 0) + (int)($o['paidCents'] ?? $o['priced']['totalCents']);
        }
    }
    $rev = $revenue ? implode(' + ', array_map(fn($c, $v) => qa_money($v, $c), array_keys($revenue), $revenue)) : '$0';
    $awaiting = count(array_filter($orders, fn($o) => $o['payment'] === 'awaiting' && $o['status'] !== 'cancelled'));
    $upcoming = array_filter($orders, fn($o) => $o['kind'] === 'booking' && !in_array($o['status'], ['completed', 'cancelled'], true) && ($o['submission']['date'] ?? '') >= date('Y-m-d'));
    usort($upcoming, fn($a, $b) => strcmp($a['submission']['date'] . $a['submission']['time'], $b['submission']['date'] . $b['submission']['time']));

    echo '<header class="head"><div><h1>Dashboard</h1><p class="muted">' . h((new DateTimeImmutable('now', new DateTimeZone('Europe/London')))->format('l j F Y')) . ' · UK time</p></div></header>';
    echo '<div class="stats">'
       . '<a class="stat" href="/admin/?tab=orders&f=new"><span class="stat__ic stat__ic--blue">' . icon('cart') . '</span><span><b>' . $count['orders'] . '</b>New bookings &amp; orders</span></a>'
       . '<a class="stat" href="/admin/?tab=orders&f=paid"><span class="stat__ic stat__ic--green">' . icon('money') . '</span><span><b>' . h($rev) . '</b>Paid this month</span></a>'
       . '<a class="stat" href="/admin/?tab=enquiries&f=new"><span class="stat__ic stat__ic--teal">' . icon('mail') . '</span><span><b>' . $count['enquiries'] . '</b>New enquiries</span></a>'
       . '<a class="stat" href="/admin/?tab=reviews&f=pending"><span class="stat__ic stat__ic--amber">' . icon('star') . '</span><span><b>' . $count['reviews'] . '</b>Reviews to approve</span></a>'
       . '</div>';

    $todo = [];
    if (using_temp_password()) $todo[] = '<b>You are using the temporary password.</b> <a href="/admin/?tab=settings#login">Choose your own password</a> now.';
    if (!$settings['stripeSecret']) $todo[] = 'Card payments are off. Add your Stripe secret key in <a href="/admin/?tab=settings">Settings</a> to take payments online' . ($settings['manualPayments'] ? ' (until then, clients can send a request and you email them a payment link).' : '.');
    elseif (!$settings['stripeWebhook']) $todo[] = 'Add the Stripe webhook signing secret in <a href="/admin/?tab=settings">Settings</a> so payments are confirmed automatically.';
    if ($awaiting) $todo[] = "$awaiting order" . ($awaiting > 1 ? 's are' : ' is') . ' waiting for payment — <a href="/admin/?tab=orders&f=awaiting">send payment links</a>.';
    if ($todo) echo '<div class="notice">' . icon('warn') . '<ul><li>' . implode('</li><li>', $todo) . '</li></ul></div>';

    echo '<div class="grid2"><section class="card"><div class="card__head"><h2>Upcoming consultations</h2><a href="/admin/?tab=orders&f=booking">All bookings</a></div>';
    if (!$upcoming) echo empty_state('No upcoming consultations.');
    else {
        echo '<ul class="list">';
        foreach (array_slice($upcoming, 0, 6) as $o) {
            $d = DateTimeImmutable::createFromFormat('Y-m-d', $o['submission']['date']);
            echo '<li><a href="/admin/?tab=orders&id=' . h($o['id']) . '"><span class="date"><b>' . ($d ? $d->format('j') : '') . '</b>' . ($d ? $d->format('M') : '') . '</span><span class="grow"><b>' . h($o['submission']['customer']['name']) . '</b><small>' . h($o['priced']['title']) . ' · ' . h($o['submission']['time']) . ' UK</small></span>' . badge($o['payment'], PAYMENT_STATUS) . '</a></li>';
        }
        echo '</ul>';
    }
    echo '</section><section class="card"><div class="card__head"><h2>Latest enquiries</h2><a href="/admin/?tab=enquiries">All enquiries</a></div>';
    if (!$enquiries) echo empty_state('No enquiries yet.');
    else {
        echo '<ul class="list">';
        foreach (array_slice($enquiries, 0, 6) as $e) {
            echo '<li><a href="/admin/?tab=enquiries&id=' . h($e['id']) . '"><span class="grow"><b>' . h($e['name']) . '</b><small>' . h($e['subject'] ?: ($e['topic'] ?: $e['source'])) . ' · ' . ago($e['createdAt']) . '</small></span>' . badge($e['status'], ENQ_STATUS) . '</a></li>';
        }
        echo '</ul>';
    }
    echo '</section></div>';

    echo '<section class="card"><div class="card__head"><h2>Latest orders</h2><a href="/admin/?tab=orders">All orders</a></div>';
    $recent = array_slice($orders, 0, 6);
    if (!$recent) echo empty_state('No bookings or orders yet.');
    else {
        echo '<div class="table"><table><thead><tr><th>Reference</th><th>Client</th><th>What</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead><tbody>';
        foreach ($recent as $o) {
            echo '<tr onclick="location=\'/admin/?tab=orders&id=' . h($o['id']) . '\'"><td><a href="/admin/?tab=orders&id=' . h($o['id']) . '">' . h($o['ref']) . '</a><small>' . ago($o['createdAt']) . '</small></td><td>' . h($o['submission']['customer']['name']) . '</td><td>' . h($o['priced']['title']) . '</td><td>' . h(qa_money($o['priced']['totalCents'], $o['priced']['currency'])) . '</td><td>' . badge($o['payment'], PAYMENT_STATUS) . '</td><td>' . badge($o['status'], ORDER_STATUS) . '</td></tr>';
        }
        echo '</tbody></table></div>';
    }
    echo '</section>';
}

// ===========================================================================
// ORDERS
// ===========================================================================
if ($tab === 'orders' && $id) {
    $o = qa_find('orders', $id);
    if (!$o) { echo empty_state('Order not found.'); }
    else {
        $s = $o['submission']; $c = $s['customer']; $p = $o['priced'];
        echo '<a class="back" href="/admin/?tab=orders">' . icon('back') . 'All bookings &amp; orders</a>';
        echo '<header class="head"><div><h1>' . h($p['title']) . '</h1><p class="muted">' . h($o['ref']) . ' · ' . ($o['kind'] === 'booking' ? 'Consultation booking' : 'Service order') . ' · ' . when($o['createdAt']) . '</p></div><div class="head__badges">' . badge($o['payment'], PAYMENT_STATUS) . badge($o['status'], ORDER_STATUS) . '</div></header>';
        echo '<div class="grid2 grid2--wide"><div class="stack">';
        echo '<section class="card"><h2>' . ($o['kind'] === 'booking' ? 'Consultation' : 'Services') . '</h2><dl class="dl">';
        if ($o['kind'] === 'booking') {
            $d = DateTimeImmutable::createFromFormat('Y-m-d', $s['date']);
            echo '<dt>Type</dt><dd>' . h($p['lines'][0]['name']) . '</dd><dt>Preferred date</dt><dd>' . h($d ? $d->format('l j F Y') : $s['date']) . '</dd><dt>Preferred time</dt><dd>' . h($s['time']) . ' UK time</dd>';
            if (!empty($s['topic'])) echo '<dt>From page</dt><dd>' . h($s['topic']) . '</dd>';
        } else {
            foreach ($p['lines'] as $l) echo '<dt>' . h($l['name']) . ($l['quantity'] > 1 ? ' × ' . (int)$l['quantity'] : '') . ($l['note'] ? '<small>' . h($l['note']) . '</small>' : '') . '</dt><dd>' . h(qa_money($l['lineCents'], $p['currency'])) . '</dd>';
        }
        echo '<dt class="dl__total">Total</dt><dd class="dl__total">' . h(qa_money($p['totalCents'], $p['currency'])) . '</dd></dl></section>';
        $msg = $o['kind'] === 'booking' ? ($s['message'] ?? '') : ($s['notes'] ?? '');
        echo '<section class="card"><h2>Client</h2><dl class="dl"><dt>Name</dt><dd>' . h($c['name']) . '</dd><dt>Email</dt><dd><a href="mailto:' . h($c['email']) . '?subject=' . rawurlencode($p['title'] . ' (' . $o['ref'] . ')') . '">' . h($c['email']) . '</a></dd>'
           . '<dt>Phone / WhatsApp</dt><dd>' . ($c['phone'] ? '<a href="https://wa.me/' . h(preg_replace('/\D/', '', $c['phone'])) . '" target="_blank" rel="noopener">' . h($c['phone']) . '</a>' : '—') . '</dd><dt>Country</dt><dd>' . h($c['country'] ?: '—') . '</dd></dl>'
           . ($msg ? '<h3>' . ($o['kind'] === 'booking' ? 'Message' : 'Notes') . '</h3><p class="pre">' . h($msg) . '</p>' : '') . '</section>';
        echo '<section class="card"><h2>History</h2><ul class="log">';
        foreach (array_reverse($o['log'] ?? []) as $l) echo '<li><span>' . when($l['at']) . '</span>' . h($l['text']) . '</li>';
        echo '</ul></section></div>';

        echo '<section class="card card--sticky"><h2>Update</h2><form method="post" class="stack">' . csrf_field() . '<input type="hidden" name="do" value="order_update"><input type="hidden" name="id" value="' . h($o['id']) . '">'
           . '<label>Status<select name="status">';
        foreach (ORDER_STATUS as $k => [$label]) echo '<option value="' . $k . '"' . ($k === $o['status'] ? ' selected' : '') . '>' . h($label) . '</option>';
        echo '</select></label><label>Payment<select name="payment">';
        foreach (PAYMENT_STATUS as $k => [$label]) echo '<option value="' . $k . '"' . ($k === $o['payment'] ? ' selected' : '') . '>' . h($label) . '</option>';
        echo '</select></label><label>Internal note <small>(only you see this)</small><textarea name="note" rows="5">' . h($o['note'] ?? '') . '</textarea></label>'
           . '<button class="btn btn--primary btn--block">Save changes</button></form>';
        if ($o['payment'] === 'awaiting') echo '<p class="hint">' . icon('money') . 'Not paid yet. Email the client a payment link (for example a Stripe Payment Link) or bank details, then set Payment to “Paid”.</p>';
        if (!empty($o['paymentId'])) echo '<p class="hint">Payment ID: <code>' . h($o['paymentId']) . '</code></p>';
        echo '<a class="btn btn--ghost btn--block" href="mailto:' . h($c['email']) . '?subject=' . rawurlencode($p['title'] . ' (' . $o['ref'] . ')') . '">' . icon('mail') . 'Email client</a>'
           . '<form method="post" onsubmit="return confirm(\'Delete this order permanently?\')">' . csrf_field() . '<input type="hidden" name="do" value="order_delete"><input type="hidden" name="id" value="' . h($o['id']) . '"><button class="linkbtn linkbtn--danger">Delete order</button></form>'
           . '</section></div>';
    }
} elseif ($tab === 'orders') {
    echo '<header class="head"><div><h1>Bookings &amp; orders</h1><p class="muted">Consultation bookings and cart orders from the website.</p></div></header>';
    echo toolbar('orders', ['' => 'All', 'new' => 'New', 'booking' => 'Consultations', 'order' => 'Service orders', 'awaiting' => 'Awaiting payment', 'paid' => 'Paid', 'completed' => 'Completed', 'cancelled' => 'Cancelled'], $filter, $q, 'Search name, email or reference…');
    $list = array_filter($orders, function ($o) use ($filter, $q) {
        $ok = match ($filter) {
            'new' => $o['status'] === 'new', 'booking', 'order' => $o['kind'] === $filter, 'awaiting', 'paid' => $o['payment'] === $filter,
            'completed', 'cancelled' => $o['status'] === $filter, default => true,
        };
        return $ok && matches($o, $q, ['ref', 'submission.customer.name', 'submission.customer.email', 'priced.title']);
    });
    if (!$list) echo empty_state($orders ? 'Nothing matches.' : 'No bookings or orders yet. They appear here as soon as a client books or checks out.');
    else {
        echo '<div class="card card--flush"><div class="table"><table><thead><tr><th>Reference</th><th>Client</th><th>What</th><th>When</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead><tbody>';
        foreach ($list as $o) {
            $when = $o['kind'] === 'booking' ? h($o['submission']['date'] . ' ' . $o['submission']['time']) : '—';
            echo '<tr onclick="location=\'/admin/?tab=orders&id=' . h($o['id']) . '\'"><td><a href="/admin/?tab=orders&id=' . h($o['id']) . '">' . h($o['ref']) . '</a><small>' . ago($o['createdAt']) . '</small></td><td>' . h($o['submission']['customer']['name']) . '<small>' . h($o['submission']['customer']['email']) . '</small></td><td>' . h($o['priced']['title']) . '</td><td>' . $when . '</td><td>' . h(qa_money($o['priced']['totalCents'], $o['priced']['currency'])) . '</td><td>' . badge($o['payment'], PAYMENT_STATUS) . '</td><td>' . badge($o['status'], ORDER_STATUS) . '</td></tr>';
        }
        echo '</tbody></table></div></div>';
    }
}

// ===========================================================================
// ENQUIRIES
// ===========================================================================
if ($tab === 'enquiries' && $id) {
    $e = qa_find('enquiries', $id);
    if (!$e) echo empty_state('Enquiry not found.');
    else {
        echo '<a class="back" href="/admin/?tab=enquiries">' . icon('back') . 'All enquiries</a>';
        echo '<header class="head"><div><h1>' . h($e['subject'] ?: ($e['topic'] ?: 'Enquiry')) . '</h1><p class="muted">' . h($e['ref']) . ' · ' . h($e['source']) . ' · ' . when($e['createdAt']) . '</p></div><div class="head__badges">' . badge($e['status'], ENQ_STATUS) . '</div></header>';
        echo '<div class="grid2 grid2--wide"><div class="stack"><section class="card"><h2>From</h2><dl class="dl"><dt>Name</dt><dd>' . h($e['name']) . '</dd><dt>Email</dt><dd><a href="mailto:' . h($e['email']) . '?subject=' . rawurlencode('Re: ' . ($e['subject'] ?: 'Your enquiry') . ' (' . $e['ref'] . ')') . '">' . h($e['email']) . '</a></dd>'
           . '<dt>Phone</dt><dd>' . ($e['phone'] ? '<a href="https://wa.me/' . h(preg_replace('/\D/', '', $e['phone'])) . '" target="_blank" rel="noopener">' . h($e['phone']) . '</a>' : '—') . '</dd>' . ($e['topic'] ? '<dt>Topic</dt><dd>' . h($e['topic']) . '</dd>' : '') . '</dl>'
           . ($e['message'] ? '<h3>Message</h3><p class="pre">' . h($e['message']) . '</p>' : '') . '</section>';
        if (!empty($e['assessment'])) {
            $a = $e['assessment'];
            echo '<section class="card"><h2>Assessment result</h2><div class="score"><b>' . (int)$a['score'] . '%</b><span>' . h($a['level']) . '<small>' . h($a['path']) . '</small></span></div><dl class="dl">';
            foreach ($a['scores'] as $s) echo '<dt>' . h($s['area']) . '</dt><dd><span class="bar"><i style="width:' . (int)$s['score'] . '%"></i></span>' . (int)$s['score'] . '%</dd>';
            echo '<dt>Country</dt><dd>' . h($a['country'] ?: '—') . '</dd><dt>Age group</dt><dd>' . h($a['ageGroup'] ?: '—') . '</dd><dt>Educational updates</dt><dd>' . ($a['marketingOptIn'] ? 'Yes' : 'No') . '</dd></dl>';
            if ($a['blockers']) echo '<h3>Top priorities</h3><ul class="bul"><li>' . implode('</li><li>', array_map('h', $a['blockers'])) . '</li></ul>';
            if ($a['next']['title']) echo '<h3>Next step: ' . h($a['next']['title']) . '</h3><p>' . h($a['next']['text']) . '</p>';
            echo '<details><summary>All answers (' . count($a['answers']) . ')</summary><dl class="dl dl--answers">';
            foreach ($a['answers'] as $k => $v) echo '<dt>' . h($k . ' · ' . $v['question']) . '</dt><dd>' . h($v['answer']) . '</dd>';
            echo '</dl></details></section>';
        }
        echo '</div><section class="card card--sticky"><h2>Update</h2><form method="post" class="stack">' . csrf_field() . '<input type="hidden" name="do" value="enquiry_update"><input type="hidden" name="id" value="' . h($e['id']) . '"><label>Status<select name="status">';
        foreach (ENQ_STATUS as $k => [$label]) echo '<option value="' . $k . '"' . ($k === $e['status'] ? ' selected' : '') . '>' . h($label) . '</option>';
        echo '</select></label><label>Internal note<textarea name="note" rows="5">' . h($e['note'] ?? '') . '</textarea></label><button class="btn btn--primary btn--block">Save</button></form>'
           . '<a class="btn btn--ghost btn--block" href="mailto:' . h($e['email']) . '?subject=' . rawurlencode('Re: ' . ($e['subject'] ?: 'Your enquiry') . ' (' . $e['ref'] . ')') . '">' . icon('mail') . 'Reply by email</a>'
           . '<form method="post" onsubmit="return confirm(\'Delete this enquiry permanently?\')">' . csrf_field() . '<input type="hidden" name="do" value="enquiry_delete"><input type="hidden" name="id" value="' . h($e['id']) . '"><button class="linkbtn linkbtn--danger">Delete enquiry</button></form></section></div>';
    }
} elseif ($tab === 'enquiries') {
    echo '<header class="head"><div><h1>Enquiries</h1><p class="muted">Contact form messages and assessment results.</p></div></header>';
    echo toolbar('enquiries', ['' => 'All', 'new' => 'New', 'contact' => 'Contact form', 'assessment' => 'Assessments', 'replied' => 'Replied', 'closed' => 'Closed'], $filter, $q, 'Search name, email or text…');
    $list = array_filter($enquiries, function ($e) use ($filter, $q) {
        $ok = match ($filter) { 'new', 'replied', 'closed' => $e['status'] === $filter, 'contact', 'assessment' => $e['type'] === $filter, default => true };
        return $ok && matches($e, $q, ['ref', 'name', 'email', 'subject', 'message', 'topic']);
    });
    if (!$list) echo empty_state($enquiries ? 'Nothing matches.' : 'No enquiries yet.');
    else {
        echo '<div class="card card--flush"><div class="table"><table><thead><tr><th>From</th><th>Subject</th><th>Type</th><th>Received</th><th>Status</th></tr></thead><tbody>';
        foreach ($list as $e) {
            echo '<tr' . ($e['status'] === 'new' ? ' class="is-new"' : '') . ' onclick="location=\'/admin/?tab=enquiries&id=' . h($e['id']) . '\'"><td><a href="/admin/?tab=enquiries&id=' . h($e['id']) . '">' . h($e['name']) . '</a><small>' . h($e['email']) . '</small></td><td>' . h($e['subject'] ?: ($e['topic'] ?: '—')) . '<small>' . h(mb_strimwidth((string)$e['message'], 0, 90, '…')) . '</small></td><td>' . ($e['type'] === 'assessment' ? 'Assessment' : 'Contact') . '</td><td>' . ago($e['createdAt']) . '</td><td>' . badge($e['status'], ENQ_STATUS) . '</td></tr>';
        }
        echo '</tbody></table></div></div>';
    }
}

// ===========================================================================
// REVIEWS
// ===========================================================================
function stars(int $n): string { return '<span class="stars" aria-label="' . $n . ' out of 5">' . str_repeat('★', $n) . '<i>' . str_repeat('★', 5 - $n) . '</i></span>'; }
function avatar(array $r): string {
    if ($r['photo']) return '<img class="av" src="/admin/?photo=' . h($r['id']) . '" alt="">';
    $ini = implode('', array_map(fn($p) => mb_substr($p, 0, 1), array_slice(preg_split('/\s+/', trim($r['name'])), 0, 2)));
    return '<span class="av av--ini">' . h(mb_strtoupper($ini)) . '</span>';
}
if ($tab === 'reviews' && $id) {
    $r = qa_find('reviews', $id);
    if (!$r) echo empty_state('Review not found.');
    else {
        echo '<a class="back" href="/admin/?tab=reviews">' . icon('back') . 'All reviews</a>';
        echo '<header class="head"><div><h1>Review from ' . h($r['name']) . '</h1><p class="muted">' . h($r['ref']) . ' · ' . when($r['createdAt']) . ' · ' . h($r['email']) . '</p></div><div class="head__badges">' . badge($r['status'], REVIEW_STATUS) . '</div></header>';
        echo '<form method="post" enctype="multipart/form-data" class="grid2 grid2--wide">' . csrf_field() . '<input type="hidden" name="do" value="review_update"><input type="hidden" name="id" value="' . h($r['id']) . '">';
        echo '<section class="card stack"><h2>Edit before publishing</h2><p class="muted">Only fix spelling or remove private details — keep the client\'s meaning.</p>'
           . '<div class="row2"><label>Name shown<input name="name" value="' . h($r['name']) . '" maxlength="80"></label><label>Country<input name="country" value="' . h($r['country']) . '" maxlength="60"></label></div>'
           . '<div class="row2"><label>Service shown<input name="service" value="' . h($r['service']) . '" maxlength="80"></label><label>Flag code <small>(gb, pk, us…)</small><input name="flag" value="' . h($r['flag']) . '" maxlength="2"></label></div>'
           . '<div class="row2"><label>Show on page<select name="page">';
        foreach (QA_REVIEW_KEYS as $k => $label) echo '<option value="' . $k . '"' . ($k === $r['page'] ? ' selected' : '') . '>' . h($label) . '</option>';
        echo '</select></label><label>Rating<select name="rating">';
        for ($i = 5; $i >= 1; $i--) echo '<option value="' . $i . '"' . ($i === (int)$r['rating'] ? ' selected' : '') . '>' . $i . ' star' . ($i > 1 ? 's' : '') . '</option>';
        echo '</select></label></div><label>Review text<textarea name="text" rows="7" maxlength="1200">' . h($r['text']) . '</textarea></label>'
           . '<label class="check"><input type="checkbox" name="featured" value="1"' . (!empty($r['featured']) ? ' checked' : '') . '> Show first in its section</label>'
           . '<label>' . ($r['photo'] ? 'Replace photo' : 'Add the client\'s photo') . ' <small>(JPG, PNG or WebP up to 5 MB — square works best)</small><input type="file" name="photo" accept="image/jpeg,image/png,image/webp"></label>'
           . ($r['photo'] ? '<label class="check"><input type="checkbox" name="remove_photo" value="1"> Remove the photo</label>' : '')
           . '</section>';
        echo '<section class="card card--sticky stack"><h2>Preview</h2><figure class="rvp">' . stars((int)$r['rating']) . '<blockquote>' . h($r['text']) . '</blockquote><figcaption>' . avatar($r) . '<span><b>' . h($r['name']) . '</b><small>' . h(implode(' · ', array_filter([$r['country'], $r['service']]))) . '</small></span></figcaption></figure>'
           . '<p class="hint">' . icon('check') . 'The client agreed that we may publish their name, photo, country and review.</p>'
           . '<button class="btn btn--primary btn--block" name="status" value="approved">' . icon('check') . ($r['status'] === 'approved' ? 'Save (stays live)' : 'Approve &amp; publish') . '</button>'
           . ($r['status'] !== 'rejected' ? '<button class="btn btn--ghost btn--block" name="status" value="' . ($r['status'] === 'approved' ? 'pending' : 'rejected') . '">' . ($r['status'] === 'approved' ? 'Unpublish' : 'Reject') . '</button>' : '<button class="btn btn--ghost btn--block" name="status" value="pending">Move back to waiting</button>')
           . '</section></form>';
        echo '<form method="post" class="danger-row" onsubmit="return confirm(\'Delete this review and its photo permanently?\')">' . csrf_field() . '<input type="hidden" name="do" value="review_delete"><input type="hidden" name="id" value="' . h($r['id']) . '"><button class="linkbtn linkbtn--danger">Delete review</button></form>';
    }
} elseif ($tab === 'reviews' && isset($_GET['new'])) {
    echo '<a class="back" href="/admin/?tab=reviews">' . icon('back') . 'All reviews</a>';
    echo '<header class="head"><div><h1>Add a real review</h1><p class="muted">For a review a client sent you by WhatsApp, email or in person. Use their own words.</p></div></header>';
    echo '<form method="post" enctype="multipart/form-data" class="card stack narrow">' . csrf_field() . '<input type="hidden" name="do" value="review_add">'
       . '<div class="row2"><label>Client name *<input name="name" maxlength="80" required></label><label>Country<input name="country" maxlength="60" placeholder="e.g. United Kingdom"></label></div>'
       . '<div class="row2"><label>Service or course<input name="service" maxlength="80" placeholder="e.g. Amazon account creation"></label><label>Client email <small>(private)</small><input type="email" name="email" maxlength="120"></label></div>'
       . '<div class="row2"><label>Show on page *<select name="page">';
    foreach (QA_REVIEW_KEYS as $k => $label) echo '<option value="' . $k . '">' . h($label) . '</option>';
    echo '</select></label><label>Rating<select name="rating"><option value="5">5 stars</option><option value="4">4 stars</option><option value="3">3 stars</option><option value="2">2 stars</option><option value="1">1 star</option></select></label></div>'
       . '<label>Review (client\'s own words) *<textarea name="text" rows="6" maxlength="1200" required></textarea></label>'
       . '<label>Client photo <small>(optional — JPG, PNG or WebP, square works best)</small><input type="file" name="photo" accept="image/jpeg,image/png,image/webp"></label>'
       . '<label class="check"><input type="checkbox" name="featured" value="1"> Show first in its section</label>'
       . '<label class="check"><input type="checkbox" name="confirm" value="1" required> This is a real client or student, these are their words, and they agreed that we may publish their name, photo and review.</label>'
       . '<button class="btn btn--primary">' . icon('check') . 'Add &amp; publish</button></form>';
} elseif ($tab === 'reviews' && $filter === 'samples') {
    $samples = json_decode((string)@file_get_contents(__DIR__ . '/../api/_samples.json'), true) ?: [];
    $hidden = (array)$settings['hiddenSampleKeys'];
    $realCount = [];
    foreach ($reviews as $r) if ($r['status'] === 'approved') $realCount[$r['page']] = ($realCount[$r['page']] ?? 0) + 1;
    echo '<header class="head"><div><h1>Reviews</h1><p class="muted">Sample (placeholder) reviews shown on the website with a “Sample review” badge.</p></div><a class="btn btn--primary" href="/admin/?tab=reviews&new=1">+ Add a real review</a></header>';
    echo toolbar('reviews', ['' => 'All', 'pending' => 'Waiting for approval', 'approved' => 'Live', 'rejected' => 'Rejected', 'samples' => 'Sample reviews'], $filter, '', 'Search name or text…');
    echo '<div class="notice notice--info">' . icon('star') . '<p>Sample reviews are placeholders written by us, so they can\'t carry a real person\'s name or photo. Replace them with real reviews: <b>Add a real review</b>, or share <a href="/leave-review" target="_blank" rel="noopener">qalbeabbas.com/leave-review</a>. A page hides its samples automatically once it has 3 real reviews.</p></div>';
    if ($settings['hideSamples']) echo '<div class="notice">' . icon('warn') . '<p>All samples are hidden (Settings → “Hide all sample reviews”).</p></div>';
    foreach ($samples as $key => $list) {
        if (!$list) continue;
        $isHidden = $settings['hideSamples'] || in_array($key, $hidden, true) || ($realCount[$key] ?? 0) >= 3;
        echo '<details class="card"><summary><h2>' . h(QA_REVIEW_KEYS[$key] ?? $key) . '</h2><small>' . count($list) . ' samples · ' . (int)($realCount[$key] ?? 0) . ' real</small>'
           . '<span style="margin-left:auto">' . ($isHidden ? '<span class="badge badge--grey">Hidden on website</span>' : '<span class="badge badge--amber">Shown on website</span>') . '</span></summary>'
           . '<form method="post" style="margin:14px 0">' . csrf_field() . '<input type="hidden" name="do" value="samples_toggle"><input type="hidden" name="key" value="' . h($key) . '"><button class="btn btn--ghost btn--sm">' . (in_array($key, $hidden, true) ? 'Show samples on this page' : 'Hide samples on this page') . '</button></form><ul class="list">';
        foreach ($list as $sm) echo '<li style="padding:10px 0">' . stars((int)$sm['rating']) . ' <small class="muted">' . h($sm['service']) . '</small><br>' . h($sm['text']) . '</li>';
        echo '</ul></details>';
    }
} elseif ($tab === 'reviews') {
    echo '<header class="head"><div><h1>Reviews</h1><p class="muted">Real reviews from <a href="/leave-review" target="_blank" rel="noopener">/leave-review</a> or added by you. Approved reviews appear on the website within a minute.</p></div><a class="btn btn--primary" href="/admin/?tab=reviews&new=1">+ Add a real review</a></header>';
    if (!$settings['hideSamples']) echo '<div class="notice notice--info">' . icon('star') . '<p>Sample reviews are still shown on the website (with a “Sample review” badge). A section stops showing samples once it has 3 approved real reviews — or hide all samples now in <a href="/admin/?tab=settings">Settings</a>.</p></div>';
    echo toolbar('reviews', ['' => 'All', 'pending' => 'Waiting for approval', 'approved' => 'Live', 'rejected' => 'Rejected', 'samples' => 'Sample reviews'], $filter, $q, 'Search name or text…');
    $list = array_filter($reviews, fn($r) => ($filter === '' || $r['status'] === $filter) && matches($r, $q, ['name', 'email', 'text', 'service']));
    if (!$list) echo empty_state($reviews ? 'Nothing matches.' : 'No reviews yet. Share the link qalbeabbas.com/leave-review with your clients and students.');
    else {
        echo '<div class="rv-grid">';
        foreach ($list as $r) {
            echo '<article class="card rv"><div class="rv__top">' . avatar($r) . '<span class="grow"><b>' . h($r['name']) . '</b><small>' . h(implode(' · ', array_filter([$r['country'], $r['service']]))) . '</small></span>' . badge($r['status'], REVIEW_STATUS) . '</div>'
               . stars((int)$r['rating']) . '<p>' . h(mb_strimwidth($r['text'], 0, 260, '…')) . '</p><small class="muted">' . ago($r['createdAt']) . ' · shows on: ' . h(QA_REVIEW_KEYS[$r['page']] ?? $r['page']) . '</small>'
               . '<div class="rv__actions"><a class="btn btn--ghost btn--sm" href="/admin/?tab=reviews&id=' . h($r['id']) . '">Edit</a>';
            if ($r['status'] !== 'approved') echo '<form method="post">' . csrf_field() . '<input type="hidden" name="do" value="review_update"><input type="hidden" name="id" value="' . h($r['id']) . '"><input type="hidden" name="back" value="1"><button class="btn btn--primary btn--sm" name="status" value="approved">Approve</button></form>';
            if ($r['status'] === 'pending') echo '<form method="post">' . csrf_field() . '<input type="hidden" name="do" value="review_update"><input type="hidden" name="id" value="' . h($r['id']) . '"><input type="hidden" name="back" value="1"><button class="btn btn--ghost btn--sm" name="status" value="rejected">Reject</button></form>';
            echo '</div></article>';
        }
        echo '</div>';
    }
}

// ===========================================================================
// PRICES
// ===========================================================================
if ($tab === 'prices') {
    $cat = qa_catalog(); $cons = qa_consultations(); $raw = qa_catalog_raw(); $ov = qa_price_overrides();
    $changed = count($ov['items']) + count($ov['consultations']);
    echo '<header class="head"><div><h1>Prices</h1><p class="muted">Change a price and press Save — the website and checkout use it within about a minute. Leave a box as it is to keep the standard price.</p></div>'
       . ($changed ? '<form method="post" onsubmit="return confirm(\'Put every price back to the standard price list?\')">' . csrf_field() . '<input type="hidden" name="do" value="prices_reset"><button class="btn btn--ghost btn--sm">Reset all (' . $changed . ' changed)</button></form>' : '') . '</header>';
    echo '<form method="post" class="stack">' . csrf_field() . '<input type="hidden" name="do" value="prices_save">';
    $field = function (string $name, $value, $default, string $currency) {
        $sym = ['USD' => '$', 'GBP' => '£', 'EUR' => '€'][$currency] ?? $currency . ' ';
        $diff = abs((float)$value - (float)$default) > 0.001;
        return '<span class="price' . ($diff ? ' is-changed' : '') . '"><i>' . h($sym) . '</i><input type="number" name="' . h($name) . '" value="' . h(rtrim(rtrim(number_format((float)$value, 2, '.', ''), '0'), '.')) . '" min="0" step="0.01" inputmode="decimal"></span>'
             . ($diff ? '<small class="was">standard ' . h($sym . rtrim(rtrim(number_format((float)$default, 2, '.', ''), '0'), '.')) . '</small>' : '');
    };
    echo '<section class="card"><h2>Consultations</h2><div class="prices">';
    foreach ($cons as $slug => $c) echo '<div class="prices__row"><span><b>' . h($c['name']) . '</b><small>' . (int)$c['minutes'] . ' min</small></span>' . $field("c[$slug]", $c['price'], $c['defaultPrice'], $c['currency']) . '</div>';
    echo '</div></section>';
    $byPage = [];
    foreach ($cat as $sku => $it) if (empty($it['stateCode'])) $byPage[$it['page']][$it['group']][] = $it;
    foreach ($byPage as $page => $groups) {
        $title = $raw['pages'][$page]['title'] ?? ucfirst($page);
        echo '<details class="card"' . ($changed && array_filter(array_merge(...array_values($groups)), fn($i) => isset($ov['items'][$i['sku']])) ? ' open' : '') . '><summary><h2>' . h($title) . '</h2><small>' . count(array_merge(...array_values($groups))) . ' services</small></summary>';
        foreach ($groups as $g => $items) {
            echo '<h3>' . h($g) . '</h3><div class="prices">';
            foreach ($items as $it) {
                echo '<div class="prices__row"><span><b>' . h($it['name']) . '</b><small>' . h(implode(' · ', array_filter([$it['from'] ? 'From price' : null, $it['unit'] ? 'per ' . preg_replace('/^per /', '', $it['unit']) : null]))) . '</small></span>'
                   . ($it['price'] === null ? '<span class="muted">On request</span>' : $field("p[{$it['sku']}]", $it['price'], $it['defaultPrice'], $it['currency'])) . '</div>';
            }
            echo '</div>';
        }
        echo '</details>';
    }
    echo '<details class="card"><summary><h2>US LLC — state filing fees</h2><small>' . count($raw['usStateFees']['states'] ?? []) . ' states</small></summary><div class="prices prices--cols">';
    foreach ($cat as $sku => $it) if (!empty($it['stateCode'])) echo '<div class="prices__row"><span><b>' . h(str_replace('US LLC state filing fee — ', '', $it['name'])) . '</b></span>' . $field("p[$sku]", $it['price'], $it['defaultPrice'], 'USD') . '</div>';
    echo '</div></details>';
    echo '<div class="savebar"><span class="muted">Prices are charged in the currency shown. Google may show old prices until the next site update.</span><button class="btn btn--primary">Save prices</button></div></form>';
}

// ===========================================================================
// BLOG
// ===========================================================================
function preview_link(array $p): string {
    $key = (string)(admin_data()['previewKey'] ?? '');
    if ($key === '') { $key = bin2hex(random_bytes(16)); qa_update('admin', function (array $a) use ($key) { $a['previewKey'] ??= $key; return $a; }); $key = (string)admin_data()['previewKey']; }
    return '/blog/' . $p['slug'] . '?preview=' . hash_hmac('sha256', $p['id'], $key);
}
function post_badge(array $p): string {
    if (($p['status'] ?? '') !== 'published') return '<span class="badge badge--grey">Draft</span>';
    return blog_is_live($p) ? '<span class="badge badge--green">Published</span>' : '<span class="badge badge--blue">Scheduled</span>';
}
function score_badge(int $s): string { return '<span class="badge badge--' . ($s >= 80 ? 'green' : ($s >= 50 ? 'amber' : 'red')) . '">SEO ' . $s . '</span>'; }

if ($tab === 'blog' && ($id || isset($_GET['new']))) {
    $p = $id ? qa_find('posts', $id) : null;
    if ($id && !$p) { echo empty_state('Post not found.'); }
    else {
        $p ??= ['id' => '', 'title' => '', 'slug' => '', 'status' => 'draft', 'publishedAt' => null, 'excerpt' => '', 'content' => '', 'category' => 'Amazon', 'tags' => [],
            'cover' => '', 'coverAlt' => '', 'author' => 'Qalb-E-Abbas Team', 'authorIsPerson' => false, 'featured' => false, 'seoTitle' => '', 'seoDescription' => '',
            'keyword' => '', 'canonical' => '', 'noindex' => false, 'faqs' => [], 'ctaTitle' => '', 'ctaText' => '', 'ctaButton' => '', 'ctaLink' => ''];
        $pubLocal = $p['publishedAt'] ? (new DateTimeImmutable($p['publishedAt']))->setTimezone(new DateTimeZone('Europe/London'))->format('Y-m-d\TH:i') : '';
        echo '<a class="back" href="/admin/?tab=blog">' . icon('back') . 'All posts</a>';
        echo '<header class="head"><div><h1>' . ($p['id'] ? 'Edit post' : 'New post') . '</h1>' . ($p['id'] ? '<p class="muted">' . post_badge($p) . ' Last saved ' . ago($p['updatedAt'] ?? null) . '</p>' : '<p class="muted">Write, add images, then check the SEO panel on the right.</p>') . '</div>'
           . ($p['id'] ? '<div class="head__badges">' . (blog_is_live($p) ? '<a class="btn btn--ghost btn--sm" href="/blog/' . h($p['slug']) . '" target="_blank" rel="noopener">' . icon('ext') . 'View live</a>' : '<a class="btn btn--ghost btn--sm" href="' . h(preview_link($p)) . '" target="_blank" rel="noopener">' . icon('ext') . 'Preview</a>') . '</div>' : '') . '</header>';
        echo '<form method="post" id="post-form" class="editor">' . csrf_field() . '<input type="hidden" name="do" value="post_save"><input type="hidden" name="id" value="' . h($p['id']) . '">';
        // Main column
        echo '<div class="stack">';
        echo '<section class="card stack"><label>Title *<input name="title" value="' . h($p['title']) . '" maxlength="160" required class="input--lg" placeholder="e.g. How to Start Selling on Amazon UK in 2026"></label>'
           . '<label>Short summary <small>(shown under the title and on the blog page — 1–2 sentences)</small><textarea name="excerpt" rows="2" maxlength="400">' . h($p['excerpt']) . '</textarea></label></section>';
        echo '<section class="card card--flush"><div class="ed-bar" id="ed-bar">'
           . '<button data-cmd="h2" title="Heading">H2</button><button data-cmd="h3" title="Sub-heading">H3</button><button data-cmd="p" title="Normal text">¶</button><span></span>'
           . '<button data-cmd="bold" title="Bold"><b>B</b></button><button data-cmd="italic" title="Italic"><i>I</i></button><button data-cmd="underline" title="Underline"><u>U</u></button><span></span>'
           . '<button data-cmd="insertUnorderedList" title="Bullet list">• List</button><button data-cmd="insertOrderedList" title="Numbered list">1. List</button><button data-cmd="blockquote" title="Quote">“ ”</button><span></span>'
           . '<button data-cmd="link" title="Add link">Link</button><button data-cmd="unlink" title="Remove link">Unlink</button><button data-cmd="image" title="Insert image">Image</button><button data-cmd="video" title="YouTube video">Video</button><button data-cmd="table" title="Table">Table</button><span></span>'
           . '<button data-cmd="removeFormat" title="Clear formatting">Clear</button><button data-cmd="undo" title="Undo">↶</button><button data-cmd="redo" title="Redo">↷</button><button data-cmd="source" title="Edit HTML">&lt;/&gt;</button>'
           . '<em id="ed-status"></em></div>'
           . '<div id="ed" class="ed" contenteditable="true">' . ($p['content'] ?: '<p><br></p>') . '</div><textarea id="ed-src" class="ed-src" hidden></textarea><textarea name="content" hidden></textarea></section>';
        echo '<section class="card stack"><h2>FAQs <small class="muted">(optional — can appear as rich results on Google)</small></h2><div id="faqs" class="stack">';
        foreach ($p['faqs'] as $f) echo '<div class="faq-row"><input name="faq_q[]" value="' . h($f['q']) . '" maxlength="200" placeholder="Question"><textarea name="faq_a[]" rows="2" maxlength="1000" placeholder="Answer">' . h($f['a']) . '</textarea><button type="button" class="linkbtn linkbtn--danger" data-faq-del>Remove</button></div>';
        echo '</div><button class="btn btn--ghost btn--sm" id="faq-add" type="button">+ Add a question</button></section>';
        echo '<details class="card"><summary><h2>Call-to-action box</h2><small>shown at the end of the post</small></summary><div class="stack" style="margin-top:14px">'
           . '<div class="row2"><label>Heading<input name="ctaTitle" value="' . h($p['ctaTitle']) . '" placeholder="Need expert help with this?"></label><label>Button text<input name="ctaButton" value="' . h($p['ctaButton']) . '" placeholder="Book Consultation — $50"></label></div>'
           . '<div class="row2"><label>Text<input name="ctaText" value="' . h($p['ctaText']) . '" placeholder="Book a one-to-one consultation with our team…"></label><label>Button link<input name="ctaLink" value="' . h($p['ctaLink']) . '" placeholder="/book-consultation?topic=amazon"></label></div></div></details>';
        echo '</div>';
        // Side column
        echo '<aside class="stack editor__side">';
        echo '<section class="card stack"><h2>Publish</h2>'
           . '<label>Publish date &amp; time <small>(UK time — a future date schedules the post)</small><input type="datetime-local" name="publishedAt" value="' . h($pubLocal) . '"></label>'
           . '<label class="check"><input type="checkbox" name="featured" value="1"' . ($p['featured'] ? ' checked' : '') . '> Feature at the top of the blog page</label>'
           . '<div class="row2 row2--tight"><button class="btn btn--ghost" name="status" value="draft">Save draft</button><button class="btn btn--primary" name="status" value="published">' . icon('check') . ($p['status'] === 'published' ? 'Update' : 'Publish') . '</button></div>'
           . '<small class="muted">Tip: Ctrl/Cmd + S saves.</small></section>';
        echo '<section class="card stack"><h2>Cover image</h2><img id="cover-img" class="cover-prev" src="' . h($p['cover']) . '" alt=""' . ($p['cover'] ? '' : ' hidden') . '><input type="hidden" name="cover" value="' . h($p['cover']) . '">'
           . '<div class="row2 row2--tight"><button class="btn btn--ghost btn--sm" id="cover-btn" type="button">Upload image</button><button class="btn btn--ghost btn--sm" id="cover-remove" type="button"' . ($p['cover'] ? '' : ' hidden') . '>Remove</button></div>'
           . '<label>Alt text <small>(describe the image)</small><input name="coverAlt" value="' . h($p['coverAlt']) . '" maxlength="160"></label><small class="muted">Best size: 1200 × 675 px (16:9). Large photos are resized and converted to WebP automatically.</small></section>';
        echo '<section class="card stack"><h2>Category &amp; author</h2><label>Category<select name="category">';
        foreach (BLOG_CATEGORIES as $c) echo '<option' . ($c === $p['category'] ? ' selected' : '') . '>' . h($c) . '</option>';
        echo '</select></label><label>Tags <small>(comma separated)</small><input name="tags" value="' . h(implode(', ', $p['tags'])) . '" placeholder="amazon fba, uk vat"></label>'
           . '<label>Author<input name="author" value="' . h($p['author']) . '" maxlength="80"></label><label class="check"><input type="checkbox" name="authorIsPerson" value="1"' . ($p['authorIsPerson'] ? ' checked' : '') . '> The author is a person (not the company)</label></section>';
        echo '<section class="card stack"><h2>SEO</h2>'
           . '<div class="gprev"><span id="g-url"></span><b id="g-title"></b><p id="g-desc"></p></div>'
           . '<label>Focus keyword <small>(what people type into Google)</small><input name="keyword" value="' . h($p['keyword']) . '" maxlength="80" placeholder="e.g. amazon fba uk"></label>'
           . '<label>SEO title <span class="count"></span><input name="seoTitle" value="' . h($p['seoTitle']) . '" maxlength="80"></label>'
           . '<label>Meta description <span class="count"></span><textarea name="seoDescription" rows="3" maxlength="200">' . h($p['seoDescription']) . '</textarea></label>'
           . '<label>URL <small>qalbeabbas.com/blog/…</small><input name="slug" value="' . h($p['slug']) . '" maxlength="80" pattern="[a-z0-9-]*"></label>'
           . '<div id="seo-live" class="seo-live"></div>'
           . '<details><summary><b>Advanced</b></summary><div class="stack" style="margin-top:10px"><label>Canonical URL <small>(only if this post was first published elsewhere)</small><input name="canonical" value="' . h($p['canonical']) . '" placeholder="https://…"></label>'
           . '<label class="check"><input type="checkbox" name="noindex" value="1"' . ($p['noindex'] ? ' checked' : '') . '> Hide from Google (noindex)</label></div></details></section>';
        if ($p['id']) {
            $chk = blog_seo_checks($p);
            echo '<section class="card stack"><h2>Full SEO check <small class="muted">(after last save)</small></h2>' . score_badge($chk['score']) . '<ul class="checks">';
            foreach ($chk['checks'] as $c) echo '<li class="' . ($c['ok'] ? 'is-ok' : 'is-no') . '">' . h($c['text']) . '</li>';
            echo '</ul></section>';
        }
        echo '</aside></form>';
        if ($p['id']) echo '<form method="post" class="danger-row" onsubmit="return confirm(\'Delete this post permanently?\')">' . csrf_field() . '<input type="hidden" name="do" value="post_delete"><input type="hidden" name="id" value="' . h($p['id']) . '"><button class="linkbtn linkbtn--danger">Delete post</button></form>';
        echo '<script src="/admin/editor.js?v=1" defer></script>';
    }
} elseif ($tab === 'blog') {
    $posts = blog_posts();
    echo '<header class="head"><div><h1>Blog</h1><p class="muted">Write articles that bring visitors from Google. Published posts appear on <a href="/blog" target="_blank" rel="noopener">/blog</a> and in your sitemap automatically.</p></div><a class="btn btn--primary" href="/admin/?tab=blog&new=1">+ New post</a></header>';
    echo toolbar('blog', ['' => 'All', 'published' => 'Published', 'draft' => 'Drafts'], $filter, $q, 'Search posts…');
    $list = array_filter($posts, fn($p) => ($filter === '' || ($filter === 'published' ? $p['status'] === 'published' : $p['status'] !== 'published')) && matches($p, $q, ['title', 'excerpt', 'keyword', 'category']));
    if (!$list) echo empty_state($posts ? 'Nothing matches.' : 'No posts yet. Click “New post” to write your first article.');
    else {
        echo '<div class="card card--flush"><div class="table"><table><thead><tr><th>Title</th><th>Category</th><th>Status</th><th>Date</th><th>SEO</th></tr></thead><tbody>';
        foreach ($list as $p) {
            $s = blog_seo_checks($p)['score'];
            echo '<tr onclick="location=\'/admin/?tab=blog&id=' . h($p['id']) . '\'"><td><a href="/admin/?tab=blog&id=' . h($p['id']) . '">' . h($p['title']) . '</a><small>/blog/' . h($p['slug']) . ($p['featured'] ? ' · ★ featured' : '') . '</small></td><td>' . h($p['category']) . '</td><td>' . post_badge($p) . '</td><td>' . ($p['publishedAt'] ? when($p['publishedAt']) : '—') . '</td><td>' . score_badge($s) . '</td></tr>';
        }
        echo '</tbody></table></div></div>';
    }
    echo '<p class="muted">The two older articles (Amazon FBA vs FBM, US LLC vs UK LTD) are part of the website code and stay as they are.</p>';
}

// ===========================================================================
// SEO
// ===========================================================================
if ($tab === 'seo') {
    $posts = array_filter(blog_posts(), 'blog_is_live');
    echo '<header class="head"><div><h1>SEO</h1><p class="muted">Google &amp; Bing setup, sitemaps and the SEO health of your blog.</p></div></header>';
    echo '<div class="grid2">';
    echo '<section class="card stack"><h2>1. Connect Google Search Console</h2><ol class="steps"><li>Open <a href="https://search.google.com/search-console" target="_blank" rel="noopener">Google Search Console</a> → Add property → <b>URL prefix</b> → <code>' . h(QA_SITE) . '</code>.</li>'
       . '<li>Choose <b>HTML file</b> verification and download the file (e.g. <code>google1a2b3c.html</code>).</li><li>Open the file, copy its text, and add it below. Then press <b>Verify</b> in Google.</li>'
       . '<li>In Search Console → <b>Sitemaps</b>, submit <code>sitemap.xml</code> and <code>sitemap-blog.xml</code>.</li></ol>'
       . '<p class="muted">Bing: <a href="https://www.bing.com/webmasters" target="_blank" rel="noopener">Bing Webmaster Tools</a> can import everything from Google Search Console in one click.</p></section>';
    $files = (array)($settings['verifyFiles'] ?? []);
    echo '<section class="card stack"><h2>2. Verification files</h2>';
    if ($files) {
        echo '<ul class="list">';
        foreach ($files as $name => $body) echo '<li style="display:flex;align-items:center;gap:10px;padding:8px 0"><span class="grow"><a href="/' . h($name) . '" target="_blank" rel="noopener">/' . h($name) . '</a></span><form method="post">' . csrf_field() . '<input type="hidden" name="do" value="seo_verify_delete"><input type="hidden" name="file" value="' . h($name) . '"><button class="linkbtn linkbtn--danger">Remove</button></form></li>';
        echo '</ul>';
    }
    echo '<form method="post" class="stack">' . csrf_field() . '<input type="hidden" name="do" value="seo_verify_add"><label>File name<input name="file" placeholder="google1a2b3c4d5e6f.html" required></label><label>File contents<textarea name="body" rows="3" placeholder="google-site-verification: google1a2b3c4d5e6f.html" required></textarea></label><button class="btn btn--primary">Add verification file</button></form></section>';
    echo '</div>';
    echo '<section class="card"><div class="card__head"><h2>Sitemaps &amp; tools</h2></div><div class="tools">'
       . '<a href="/sitemap.xml" target="_blank" rel="noopener"><b>sitemap.xml</b><small>All website pages</small></a>'
       . '<a href="/sitemap-blog.xml" target="_blank" rel="noopener"><b>sitemap-blog.xml</b><small>' . count($posts) . ' published post' . (count($posts) === 1 ? '' : 's') . '</small></a>'
       . '<a href="/robots.txt" target="_blank" rel="noopener"><b>robots.txt</b><small>Tells search engines what to crawl</small></a>'
       . '<a href="https://pagespeed.web.dev/analysis?url=' . rawurlencode(QA_SITE . '/') . '" target="_blank" rel="noopener"><b>PageSpeed Insights</b><small>Speed &amp; Core Web Vitals</small></a>'
       . '<a href="https://search.google.com/test/rich-results?url=' . rawurlencode(QA_SITE . '/') . '" target="_blank" rel="noopener"><b>Rich Results Test</b><small>Check structured data</small></a>'
       . '<a href="https://search.google.com/search-console" target="_blank" rel="noopener"><b>Search Console</b><small>Clicks, rankings &amp; errors</small></a>'
       . '</div></section>';
    echo '<section class="card"><div class="card__head"><h2>Blog SEO health</h2><a href="/admin/?tab=blog&new=1">+ New post</a></div>';
    $all = blog_posts();
    if (!$all) echo empty_state('No blog posts yet.');
    else {
        echo '<div class="table"><table><thead><tr><th>Post</th><th>Score</th><th>To improve</th></tr></thead><tbody>';
        foreach ($all as $p) {
            $chk = blog_seo_checks($p);
            $todo = array_slice(array_values(array_filter($chk['checks'], fn($c) => !$c['ok'])), 0, 3);
            echo '<tr onclick="location=\'/admin/?tab=blog&id=' . h($p['id']) . '\'"><td><a href="/admin/?tab=blog&id=' . h($p['id']) . '">' . h($p['title']) . '</a><small>' . post_badge($p) . '</small></td><td>' . score_badge($chk['score']) . '</td><td><small>' . ($todo ? implode('<br>', array_map(fn($c) => '• ' . h($c['text']), $todo)) : 'Looks great ✓') . '</small></td></tr>';
        }
        echo '</tbody></table></div>';
    }
    echo '</section>';
    echo '<section class="card"><h2>Writing tips that help ranking</h2><ul class="bul" style="margin-top:10px"><li>One clear topic per post, answering a real question your clients ask.</li><li>Use the focus keyword naturally in the title, first paragraph, one subheading and the URL — never repeat it unnaturally.</li><li>Add your own experience: real examples, numbers, screenshots. Google rewards first-hand expertise.</li><li>Link to a related service page and to official sources (Amazon, GOV.UK, IRS).</li><li>Update older posts when rules or fees change — the “Updated” date shows on the post.</li></ul></section>';
}

// ===========================================================================
// SETTINGS
// ===========================================================================
if ($tab === 'settings') {
    $mask = fn(string $v) => $v ? substr($v, 0, 8) . '••••••' . substr($v, -4) : '';
    $a = admin_data();
    echo '<header class="head"><div><h1>Settings</h1><p class="muted">Payments, notifications and your password.</p></div></header>';
    echo '<form method="post" class="grid2">' . csrf_field() . '<input type="hidden" name="do" value="settings_save">';
    echo '<section class="card stack"><h2>Card payments (Stripe)</h2>'
       . '<p class="muted">Stripe Dashboard → Developers → API keys → <b>Secret key</b>. Then Developers → Webhooks → add endpoint <code>' . h(QA_SITE) . '/api/stripe-webhook.php</code> with event <code>checkout.session.completed</code> and paste its <b>signing secret</b>.</p>'
       . '<label>Secret key ' . ($settings['stripeSecret'] ? '<small class="ok">saved: ' . h($mask($settings['stripeSecret'])) . '</small>' : '<small>not set</small>') . '<input type="password" name="stripeSecret" placeholder="' . ($settings['stripeSecret'] ? 'Leave empty to keep the saved key' : 'sk_live_…') . '" autocomplete="off"></label>'
       . '<label>Webhook signing secret ' . ($settings['stripeWebhook'] ? '<small class="ok">saved: ' . h($mask($settings['stripeWebhook'])) . '</small>' : '<small>not set</small>') . '<input type="password" name="stripeWebhook" placeholder="' . ($settings['stripeWebhook'] ? 'Leave empty to keep the saved secret' : 'whsec_…') . '" autocomplete="off"></label>'
       . ($settings['stripeSecret'] ? '<label class="check"><input type="checkbox" name="clearStripe" value="1"> Remove the saved Stripe keys</label>' : '')
       . '<label class="check"><input type="checkbox" name="manualPayments" value="1"' . ($settings['manualPayments'] ? ' checked' : '') . '> Also allow “Request now, pay by link/invoice” (you email the client a payment link)</label>'
       . '</section>';
    echo '<section class="card stack"><h2>Notifications &amp; website</h2>'
       . '<label>Send notifications to<input type="email" name="notifyEmail" value="' . h($settings['notifyEmail']) . '" required></label>'
       . '<label class="check"><input type="checkbox" name="hideSamples" value="1"' . ($settings['hideSamples'] ? ' checked' : '') . '> Hide all sample reviews on the website (show only approved real reviews)</label>'
       . '<button class="btn btn--primary">Save settings</button></section></form>';
    $temp = using_temp_password();
    echo '<form method="post" class="card stack narrow" id="login">' . csrf_field() . '<input type="hidden" name="do" value="password_change"><h2>Login email &amp; password</h2>'
       . ($temp ? '<div class="notice">' . icon('warn') . '<p>You are using the temporary password. Choose your own password now.</p></div>' : '<p class="muted">Last sign-in: ' . when($a['lastLogin'] ?? null) . '. Leave the new password empty to change only the email.</p>')
       . '<label>Login email<input type="email" name="email" value="' . h(admin_email()) . '" autocomplete="username" required></label>'
       . '<label>Current password<input type="password" name="current" autocomplete="current-password" required></label>'
       . '<div class="row2"><label>New password<input type="password" name="password" autocomplete="new-password" minlength="10"' . ($temp ? ' required' : '') . '></label><label>Repeat new password<input type="password" name="password2" autocomplete="new-password" minlength="10"' . ($temp ? ' required' : '') . '></label></div>'
       . '<button class="btn btn--primary">Save login details</button></form>';
}

echo '</main></body></html>';
