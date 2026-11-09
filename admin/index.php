<?php
/* ==========================================================================
   Qalb-E-Abbas — Admin dashboard  (https://www.qalbeabbas.com/admin/)

   Bookings & orders · Enquiries & assessments · Reviews · Prices · Settings.
   First visit: click "Email me a setup link" — the link goes to
   contact@qalbeabbas.com and lets you choose the admin password.
   ========================================================================== */
declare(strict_types=1);
require __DIR__ . '/../api/_lib.php';

header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');
header("Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'");

$https = (($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
session_name('qa_admin');
session_set_cookie_params(['lifetime' => 0, 'path' => '/admin', 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict']);
session_start();

const SESSION_HOURS = 12;

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
function logged_in(): bool {
    $a = admin_data();
    return !empty($_SESSION['admin']) && !empty($a['passwordHash'])
        && ($_SESSION['pwv'] ?? '') === substr(hash('sha256', $a['passwordHash']), 0, 16)
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
    qa_mail(QA_ADMIN_EMAIL, 'Qalb-E-Abbas admin — set your password',
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
        $a = admin_data();
        if (!empty($a['passwordHash']) && password_verify((string)($_POST['password'] ?? ''), $a['passwordHash'])) {
            session_regenerate_id(true);
            $_SESSION['admin'] = true; $_SESSION['since'] = time(); $_SESSION['pwv'] = substr(hash('sha256', $a['passwordHash']), 0, 16);
            qa_update('admin', function (array $x) { $x['lastLogin'] = qa_now(); return $x; });
            go();
        }
        usleep(400000);
        flash('Wrong password.', 'err'); go();
    }
    if ($do === 'send_setup') {
        if (allow('setup', 3, 3600)) send_setup_link();
        flash('If the email address is correct, a setup link has been sent to ' . QA_ADMIN_EMAIL . '. It works for 1 hour.');
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
        $_SESSION['admin'] = true; $_SESSION['since'] = time(); $_SESSION['pwv'] = substr(hash('sha256', $hash), 0, 16);
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
                }
                if ($r['status'] === 'approved' && empty($r['approvedAt'])) $r['approvedAt'] = qa_now();
                return $r;
            });
            $msg = ['approved' => 'Review approved — it is now live on the website.', 'rejected' => 'Review rejected.'][$_POST['status'] ?? ''] ?? 'Review saved.';
            flash($msg); go('tab=reviews' . (isset($_POST['back']) ? '' : '&id=' . $id));

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
            $a = admin_data();
            if (!password_verify((string)($_POST['current'] ?? ''), $a['passwordHash'] ?? '')) { flash('Your current password is wrong.', 'err'); go('tab=settings'); }
            $p = (string)($_POST['password'] ?? '');
            if ($err = strong_enough($p)) { flash($err, 'err'); go('tab=settings'); }
            if ($p !== (string)($_POST['password2'] ?? '')) { flash('The two new passwords do not match.', 'err'); go('tab=settings'); }
            $hash = password_hash($p, PASSWORD_DEFAULT);
            qa_update('admin', function (array $x) use ($hash) { $x['passwordHash'] = $hash; $x['passwordSetAt'] = qa_now(); return $x; });
            $_SESSION['pwv'] = substr(hash('sha256', $hash), 0, 16);
            flash('Password changed. Other devices are signed out.'); go('tab=settings');
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
       . '<link rel="icon" href="/assets/img/favicon.svg"><link rel="stylesheet" href="/admin/admin.css?v=1"></head><body class="' . ($app ? 'app' : 'auth') . '">';
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
    } elseif (empty($a['passwordHash'])) {
        echo '<h1>Set up your dashboard</h1><p class="muted">For security, we email a one-time link to <b>' . h(QA_ADMIN_EMAIL) . '</b>. Open it to choose your admin password.</p>'
           . '<form method="post">' . csrf_field() . '<input type="hidden" name="do" value="send_setup"><button class="btn btn--primary btn--block">' . icon('mail') . 'Email me a setup link</button></form>';
    } else {
        echo '<h1>Sign in</h1>'
           . '<form method="post" class="stack">' . csrf_field() . '<input type="hidden" name="do" value="login">'
           . '<label>Password<input type="password" name="password" autocomplete="current-password" required autofocus></label>'
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
$nav = ['dashboard' => ['Dashboard', 'home'], 'orders' => ['Bookings & orders', 'cart'], 'enquiries' => ['Enquiries', 'mail'], 'reviews' => ['Reviews', 'star'], 'prices' => ['Prices', 'tag'], 'settings' => ['Settings', 'cog']];
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
        echo '<form method="post" class="grid2 grid2--wide">' . csrf_field() . '<input type="hidden" name="do" value="review_update"><input type="hidden" name="id" value="' . h($r['id']) . '">';
        echo '<section class="card stack"><h2>Edit before publishing</h2><p class="muted">Only fix spelling or remove private details — keep the client\'s meaning.</p>'
           . '<div class="row2"><label>Name shown<input name="name" value="' . h($r['name']) . '" maxlength="80"></label><label>Country<input name="country" value="' . h($r['country']) . '" maxlength="60"></label></div>'
           . '<div class="row2"><label>Service shown<input name="service" value="' . h($r['service']) . '" maxlength="80"></label><label>Flag code <small>(gb, pk, us…)</small><input name="flag" value="' . h($r['flag']) . '" maxlength="2"></label></div>'
           . '<div class="row2"><label>Show on page<select name="page">';
        foreach (QA_REVIEW_KEYS as $k => $label) echo '<option value="' . $k . '"' . ($k === $r['page'] ? ' selected' : '') . '>' . h($label) . '</option>';
        echo '</select></label><label>Rating<select name="rating">';
        for ($i = 5; $i >= 1; $i--) echo '<option value="' . $i . '"' . ($i === (int)$r['rating'] ? ' selected' : '') . '>' . $i . ' star' . ($i > 1 ? 's' : '') . '</option>';
        echo '</select></label></div><label>Review text<textarea name="text" rows="7" maxlength="1200">' . h($r['text']) . '</textarea></label>'
           . '<label class="check"><input type="checkbox" name="featured" value="1"' . (!empty($r['featured']) ? ' checked' : '') . '> Show first in its section</label>'
           . ($r['photo'] ? '<label class="check"><input type="checkbox" name="remove_photo" value="1"> Remove the photo</label>' : '')
           . '</section>';
        echo '<section class="card card--sticky stack"><h2>Preview</h2><figure class="rvp">' . stars((int)$r['rating']) . '<blockquote>' . h($r['text']) . '</blockquote><figcaption>' . avatar($r) . '<span><b>' . h($r['name']) . '</b><small>' . h(implode(' · ', array_filter([$r['country'], $r['service']]))) . '</small></span></figcaption></figure>'
           . '<p class="hint">' . icon('check') . 'The client agreed that we may publish their name, photo, country and review.</p>'
           . '<button class="btn btn--primary btn--block" name="status" value="approved">' . icon('check') . ($r['status'] === 'approved' ? 'Save (stays live)' : 'Approve &amp; publish') . '</button>'
           . ($r['status'] !== 'rejected' ? '<button class="btn btn--ghost btn--block" name="status" value="' . ($r['status'] === 'approved' ? 'pending' : 'rejected') . '">' . ($r['status'] === 'approved' ? 'Unpublish' : 'Reject') . '</button>' : '<button class="btn btn--ghost btn--block" name="status" value="pending">Move back to waiting</button>')
           . '</section></form>';
        echo '<form method="post" class="danger-row" onsubmit="return confirm(\'Delete this review and its photo permanently?\')">' . csrf_field() . '<input type="hidden" name="do" value="review_delete"><input type="hidden" name="id" value="' . h($r['id']) . '"><button class="linkbtn linkbtn--danger">Delete review</button></form>';
    }
} elseif ($tab === 'reviews') {
    echo '<header class="head"><div><h1>Reviews</h1><p class="muted">Real reviews from <a href="/leave-review" target="_blank" rel="noopener">/leave-review</a>. Approved reviews appear on the website within a minute.</p></div></header>';
    if (!$settings['hideSamples']) echo '<div class="notice notice--info">' . icon('star') . '<p>Sample reviews are still shown on the website (with a “Sample review” badge). A section stops showing samples once it has 3 approved real reviews — or hide all samples now in <a href="/admin/?tab=settings">Settings</a>.</p></div>';
    echo toolbar('reviews', ['' => 'All', 'pending' => 'Waiting for approval', 'approved' => 'Live', 'rejected' => 'Rejected'], $filter, $q, 'Search name or text…');
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
    echo '<form method="post" class="card stack narrow">' . csrf_field() . '<input type="hidden" name="do" value="password_change"><h2>Change password</h2>'
       . '<p class="muted">Last sign-in: ' . when($a['lastLogin'] ?? null) . '</p>'
       . '<label>Current password<input type="password" name="current" autocomplete="current-password" required></label>'
       . '<div class="row2"><label>New password<input type="password" name="password" autocomplete="new-password" minlength="10" required></label><label>Repeat new password<input type="password" name="password2" autocomplete="new-password" minlength="10" required></label></div>'
       . '<button class="btn btn--ghost">Change password</button></form>';
}

echo '</main></body></html>';
