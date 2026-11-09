<?php
/* ==========================================================================
   Qalb-E-Abbas — shared code for the PHP API and the admin dashboard.
   Runs on Hostinger PHP. Not reachable from the web (.htaccess blocks api/_*).

   Data is kept as JSON files OUTSIDE the website folder when possible
   (…/domains/qalbeabbas.com/qa-data), so it survives every GitHub deploy and
   can never be downloaded. Fallback: public_html/.qa-data (blocked as a dotfolder).
   ========================================================================== */
declare(strict_types=1);

const QA_SITE        = 'https://www.qalbeabbas.com';
const QA_ADMIN_EMAIL = 'contact@qalbeabbas.com';   // where notifications and setup links go
const QA_FROM_EMAIL  = 'no-reply@qalbeabbas.com';  // must be an address on your own domain
const QA_ROOT        = __DIR__ . '/..';

// ---------------------------------------------------------------------------
// Storage (JSON files with file locking)
// ---------------------------------------------------------------------------
function qa_data_dir(): string {
    static $dir = null;
    if ($dir !== null) return $dir;
    $docRoot = rtrim((string)($_SERVER['DOCUMENT_ROOT'] ?? ''), '/');
    $outside = $docRoot !== '' ? dirname($docRoot) . '/qa-data' : '';
    if ($outside !== '' && (@is_dir($outside) || (@is_writable(dirname($outside)) && @mkdir($outside, 0750, true)))) {
        $dir = $outside;
    } else {
        $dir = QA_ROOT . '/.qa-data';
        if (!is_dir($dir)) @mkdir($dir, 0750, true);
        if (!is_file("$dir/.htaccess")) @file_put_contents("$dir/.htaccess", "Require all denied\n");
    }
    foreach (['photos'] as $sub) if (!is_dir("$dir/$sub")) @mkdir("$dir/$sub", 0750, true);
    return $dir;
}

function qa_store_path(string $name): string {
    if (!preg_match('/^[a-z0-9-]+$/', $name)) throw new RuntimeException('Bad store name');
    return qa_data_dir() . "/$name.json";
}

/** Read a JSON store (array). */
function qa_read(string $name, array $default = []): array {
    $file = qa_store_path($name);
    if (!is_file($file)) return $default;
    $fh = fopen($file, 'r');
    if (!$fh) return $default;
    flock($fh, LOCK_SH);
    $raw = stream_get_contents($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
    $data = json_decode((string)$raw, true);
    return is_array($data) ? $data : $default;
}

/** Change a JSON store safely: $fn receives the current data and returns the new data. */
function qa_update(string $name, callable $fn, array $default = []) {
    $file = qa_store_path($name);
    $fh = fopen($file, 'c+');
    if (!$fh) throw new RuntimeException('Cannot open data file');
    flock($fh, LOCK_EX);
    $raw = stream_get_contents($fh);
    $data = json_decode((string)$raw, true);
    if (!is_array($data)) $data = $default;
    $new = $fn($data);
    if (is_array($new)) {
        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, json_encode($new, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        fflush($fh);
    }
    flock($fh, LOCK_UN);
    fclose($fh);
    return $new;
}

/** Add a record to a list store (newest first). */
function qa_insert(string $name, array $record): void {
    qa_update($name, function (array $list) use ($record) { array_unshift($list, $record); return $list; });
}

/** Change one record (matched by id) in a list store. */
function qa_patch(string $name, string $id, callable $fn): bool {
    $found = false;
    qa_update($name, function (array $list) use ($id, $fn, &$found) {
        foreach ($list as $i => $row) {
            if (($row['id'] ?? '') === $id) { $list[$i] = $fn($row); $found = true; }
        }
        return $list;
    });
    return $found;
}

function qa_find(string $name, string $id): ?array {
    foreach (qa_read($name) as $row) if (($row['id'] ?? '') === $id) return $row;
    return null;
}

function qa_settings(): array {
    return qa_read('settings') + [
        'notifyEmail'    => QA_ADMIN_EMAIL,
        'stripeSecret'   => '',
        'stripeWebhook'  => '',
        'manualPayments' => true,
        'hideSamples'    => false,
        'hiddenSampleKeys' => [],
    ];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function qa_json(int $code, array $body): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('X-Robots-Tag: noindex');
    $hasCache = false;
    foreach (headers_list() as $h) if (stripos($h, 'Cache-Control:') === 0) $hasCache = true;
    if (!$hasCache) header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function qa_text($v, int $max): string {
    $v = trim((string)($v ?? ''));
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v) ?? '';
    return mb_substr($v, 0, $max);
}

function qa_ref(string $prefix): string {
    return $prefix . '-' . date('ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
}

function qa_id(): string { return bin2hex(random_bytes(8)); }

function qa_now(): string { return gmdate('c'); }

function qa_ip(): string { return (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown'); }

/** Only accept browser submissions from our own website. */
function qa_check_origin(): void {
    $origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
    if ($origin !== '' && !preg_match('#^https://(www\.)?qalbeabbas\.com$#', $origin)) qa_json(403, ['ok' => false, 'error' => 'Not allowed.']);
}

/** Simple rate limit per IP: at most $max hits per $seconds for $bucket. */
function qa_rate_limit(string $bucket, int $max, int $seconds): void {
    $file = sys_get_temp_dir() . '/qa_rl_' . $bucket . '_' . hash('sha256', qa_ip());
    $now = time();
    $hits = array_filter(array_map('intval', @file($file, FILE_IGNORE_NEW_LINES) ?: []), fn($t) => $t > $now - $seconds);
    if (count($hits) >= $max) qa_json(429, ['ok' => false, 'error' => 'Too many requests. Please try again a little later.']);
    $hits[] = $now;
    @file_put_contents($file, implode("\n", $hits));
}

function qa_read_json_body(int $maxBytes = 200000): array {
    $raw = file_get_contents('php://input', false, null, 0, $maxBytes + 1);
    if ($raw === false || strlen($raw) > $maxBytes) qa_json(413, ['ok' => false, 'error' => 'Request too large.']);
    $data = json_decode($raw, true);
    if (!is_array($data)) qa_json(400, ['ok' => false, 'error' => 'Invalid request.']);
    return $data;
}

function qa_money(int $cents, string $currency): string {
    $sym = ['USD' => '$', 'GBP' => '£', 'EUR' => '€', 'PKR' => 'Rs ', 'AED' => 'AED '][strtoupper($currency)] ?? (strtoupper($currency) . ' ');
    $amount = $cents % 100 === 0 ? number_format($cents / 100) : number_format($cents / 100, 2);
    return $sym . $amount;
}

/** Plain-text email (optionally with one attachment). Returns true when handed to the mail server. */
function qa_mail(string $to, string $subject, string $text, ?string $replyTo = null, ?array $attachment = null): bool {
    $to = str_replace(["\r", "\n"], '', $to);
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) return false;
    $headers = "From: Qalb-E-Abbas <" . QA_FROM_EMAIL . ">\r\nMIME-Version: 1.0\r\n";
    if ($replyTo && filter_var($replyTo, FILTER_VALIDATE_EMAIL)) $headers .= "Reply-To: " . str_replace(["\r", "\n"], '', $replyTo) . "\r\n";
    $subj = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    if (!$attachment) {
        $headers .= "Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n";
        return @mail($to, $subj, chunk_split(base64_encode($text)), $headers, '-f' . QA_FROM_EMAIL);
    }
    $b = 'qa_' . bin2hex(random_bytes(12));
    $headers .= "Content-Type: multipart/mixed; boundary=\"$b\"\r\n";
    $msg = "--$b\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($text))
         . "--$b\r\nContent-Type: {$attachment['mime']}; name=\"{$attachment['name']}\"\r\nContent-Transfer-Encoding: base64\r\n"
         . "Content-Disposition: attachment; filename=\"{$attachment['name']}\"\r\n\r\n" . chunk_split(base64_encode($attachment['data']))
         . "--$b--";
    return @mail($to, $subj, $msg, $headers, '-f' . QA_FROM_EMAIL);
}

function qa_notify(string $subject, string $text, ?string $replyTo = null, ?array $attachment = null): bool {
    return qa_mail(qa_settings()['notifyEmail'] ?: QA_ADMIN_EMAIL, $subject, $text, $replyTo, $attachment);
}

// ---------------------------------------------------------------------------
// Catalog & prices (api/_catalog.json is written by `npm run pricing:build`)
// Admin price changes are stored in prices.json and override the catalog.
// ---------------------------------------------------------------------------
function qa_catalog_raw(): array {
    static $raw = null;
    if ($raw === null) {
        $file = __DIR__ . '/_catalog.json';
        if (!is_file($file)) $file = QA_ROOT . '/booking/src/lib/service-catalog.json';
        $raw = json_decode((string)@file_get_contents($file), true) ?: [];
    }
    return $raw;
}

function qa_price_overrides(): array {
    return qa_read('prices') + ['items' => [], 'consultations' => []];
}

/** All purchasable items: sku => [sku,name,price,currency,unit,note,from,multiQty,page,group,defaultPrice]. */
function qa_catalog(): array {
    static $map = null;
    if ($map !== null) return $map;
    $raw = qa_catalog_raw();
    $ov = qa_price_overrides()['items'];
    $map = [];
    $add = function (array $i) use (&$map, $ov) {
        $i['defaultPrice'] = $i['price'];
        if (array_key_exists($i['sku'], $ov) && $ov[$i['sku']] !== null && $i['price'] !== null) $i['price'] = (float)$ov[$i['sku']];
        $map[$i['sku']] = $i;
    };
    foreach (($raw['pages'] ?? []) as $page => $p) {
        foreach (($p['groups'] ?? []) as $g) {
            $cur = $g['currency'] ?? ($p['currency'] ?? 'USD');
            foreach (($g['items'] ?? []) as $i) {
                $add([
                    'sku' => $i['sku'], 'name' => $i['name'], 'price' => $i['price'] ?? null, 'currency' => $cur,
                    'unit' => $i['unit'] ?? null, 'note' => $i['note'] ?? null, 'from' => !empty($i['from']),
                    'multiQty' => !empty($i['unit']) && empty($i['fixedQty']), 'page' => $page, 'group' => $g['title'] ?? '',
                ]);
            }
        }
        if (!empty($p['quarters'])) {
            foreach (['Q1', 'Q2', 'Q3', 'Q4'] as $q) {
                $add([
                    'sku' => $p['quarters']['skuPrefix'] . '-' . strtolower($q), 'name' => $p['quarters']['label'] . " — $q (20 products)",
                    'price' => $p['quarters']['price'], 'currency' => $p['currency'] ?? 'USD', 'unit' => null, 'note' => null,
                    'from' => false, 'multiQty' => false, 'page' => $page, 'group' => 'Quarterly products',
                ]);
            }
        }
    }
    foreach (($raw['usStateFees']['states'] ?? []) as $s) {
        $add([
            'sku' => 'us-state-fee-' . strtolower($s['code']), 'name' => 'US LLC state filing fee — ' . $s['name'], 'price' => $s['fee'],
            'currency' => 'USD', 'unit' => null, 'note' => $s['note'] ?? null, 'from' => false, 'multiQty' => false,
            'page' => 'us-llc', 'group' => 'US state filing fees', 'stateCode' => $s['code'],
        ]);
    }
    return $map;
}

function qa_consultations(): array {
    $ov = qa_price_overrides()['consultations'];
    $out = [];
    foreach ((qa_catalog_raw()['consultations']['types'] ?? []) as $c) {
        $c['defaultPrice'] = $c['price'];
        if (isset($ov[$c['slug']]) && $ov[$c['slug']] !== null) $c['price'] = (float)$ov[$c['slug']];
        $out[$c['slug']] = $c;
    }
    return $out;
}

function qa_availability(): array {
    return (qa_catalog_raw()['availability'] ?? []) + ['timezone' => 'Europe/London', 'days' => [1, 2, 3, 4, 5], 'start' => '10:00', 'end' => '18:00', 'slotMinutes' => 30, 'minNoticeHours' => 24];
}

class QaUserError extends RuntimeException {}

/** Validate & price a booking or cart order — prices always come from the catalog, never the browser. */
function qa_price_submission(array $sub, bool $checkDate = true): array {
    if (($sub['kind'] ?? '') === 'booking') {
        $c = qa_consultations()[(string)($sub['consultation'] ?? '')] ?? null;
        if (!$c) throw new QaUserError('Please choose a consultation type.');
        $date = (string)($sub['date'] ?? ''); $time = (string)($sub['time'] ?? '');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) throw new QaUserError('Please choose a preferred date.');
        if (!preg_match('/^\d{2}:\d{2}$/', $time)) throw new QaUserError('Please choose a preferred time.');
        if ($checkDate) qa_check_availability($date, $time, (int)$c['minutes']);
        $cents = (int)round($c['price'] * 100);
        return ['currency' => $c['currency'], 'title' => $c['name'], 'totalCents' => $cents,
                'lines' => [['name' => "{$c['name']} ({$c['minutes']} min)", 'unitCents' => $cents, 'quantity' => 1, 'lineCents' => $cents, 'note' => null]]];
    }
    $items = $sub['items'] ?? null;
    if (!is_array($items) || !$items || count($items) > 40) throw new QaUserError('Your cart is empty.');
    $merged = [];
    foreach ($items as $l) {
        $sku = qa_text($l['sku'] ?? '', 80);
        $q = (int)($l['quantity'] ?? 1);
        if ($q < 1 || $q > 50) throw new QaUserError('Please check the quantities in your cart.');
        $merged[$sku] = ($merged[$sku] ?? 0) + $q;
    }
    $raw = qa_catalog_raw();
    $packages = array_values(array_intersect(array_keys($merged), $raw['usStateFees']['packages'] ?? []));
    $stateFees = array_values(array_filter(array_keys($merged), fn($s) => str_starts_with($s, 'us-state-fee-')));
    if (count($packages) > 1) throw new QaUserError('Please choose one US LLC package per order (Basic or Advanced).');
    if (count($packages) === 1 && !$stateFees) throw new QaUserError('Please choose the state for your US LLC on the US LLC page, so we can add its filing fee.');
    if (count($stateFees) > 1) throw new QaUserError('Please choose only one state for your US LLC.');
    if (count($stateFees) === 1 && !$packages) throw new QaUserError('The state filing fee must be paid together with a US LLC package (Basic or Advanced).');

    $cat = qa_catalog();
    $currency = null; $lines = [];
    foreach ($merged as $sku => $qty) {
        $it = $cat[$sku] ?? null;
        if (!$it) throw new QaUserError('One of the services in your cart is no longer available. Please refresh the page.');
        if ($it['price'] === null) throw new QaUserError("{$it['name']} is priced on request — please book a consultation for a quote.");
        $quantity = $it['multiQty'] ? $qty : 1;
        if ($currency && $currency !== $it['currency']) throw new QaUserError('All services in one payment must use the same currency. Please check out each currency separately.');
        $currency = $it['currency'];
        $unit = (int)round($it['price'] * 100);
        $note = implode(' · ', array_filter([$it['from'] ? 'Starting price' : null, $it['note']]));
        $lines[] = ['name' => $it['name'], 'unitCents' => $unit, 'quantity' => $quantity, 'lineCents' => $unit * $quantity, 'note' => $note ?: null];
    }
    $total = array_sum(array_column($lines, 'lineCents'));
    return ['currency' => $currency, 'lines' => $lines, 'totalCents' => $total, 'title' => count($lines) === 1 ? $lines[0]['name'] : count($lines) . ' services'];
}

function qa_check_availability(string $date, string $time, int $minutes): void {
    $a = qa_availability();
    $tz = new DateTimeZone($a['timezone']);
    $start = DateTimeImmutable::createFromFormat('!Y-m-d H:i', "$date $time", $tz);
    if (!$start) throw new QaUserError('Please choose a valid date and time.');
    $wd = (int)$start->format('N');
    if (!in_array($wd, $a['days'], true)) throw new QaUserError("We're not available on that day. Please choose another date.");
    $toMin = function (string $t) { [$h, $m] = array_map('intval', explode(':', $t)); return $h * 60 + $m; };
    $t = $toMin($time);
    if ($t < $toMin($a['start']) || $t + $minutes > $toMin($a['end']) || ($t - $toMin($a['start'])) % (int)$a['slotMinutes'] !== 0) {
        throw new QaUserError("Please choose a time between {$a['start']} and {$a['end']} UK time.");
    }
    if ($start->getTimestamp() < time() + (int)$a['minNoticeHours'] * 3600) throw new QaUserError("Please choose a time at least {$a['minNoticeHours']} hours from now.");
}

// ---------------------------------------------------------------------------
// Stripe (secret key is entered in Admin → Settings; never stored in GitHub)
// ---------------------------------------------------------------------------
function qa_stripe(string $method, string $path, array $params = []): array {
    $key = qa_settings()['stripeSecret'];
    if (!$key) throw new QaUserError('Card payments are not set up yet. Please contact us.');
    $ch = curl_init('https://api.stripe.com/v1/' . ltrim($path, '/') . ($method === 'GET' && $params ? '?' . http_build_query($params) : ''));
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 25, CURLOPT_USERPWD => $key . ':',
        CURLOPT_HTTPHEADER => ['Stripe-Version: 2024-06-20'],
    ]);
    if ($method === 'POST') { curl_setopt($ch, CURLOPT_POST, true); curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params)); }
    $body = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $json = json_decode((string)$body, true);
    if ($code < 200 || $code >= 300 || !is_array($json)) {
        error_log('Stripe error ' . $code . ': ' . substr((string)$body, 0, 500));
        throw new QaUserError('We could not start the secure payment just now. Please try again, or contact us.');
    }
    return $json;
}

function qa_gateways(): array {
    $s = qa_settings();
    $g = [];
    if ($s['stripeSecret'] && function_exists('curl_init')) $g[] = 'STRIPE';
    if ($s['manualPayments']) $g[] = 'MANUAL';
    return $g;
}

/** Text summary of an order, used in emails. */
function qa_order_text(array $o): string {
    $s = $o['submission']; $p = $o['priced'];
    $out = "Reference: {$o['ref']}\n";
    if ($s['kind'] === 'booking') {
        $out .= "Consultation: {$p['lines'][0]['name']}\nPreferred date: {$s['date']}\nPreferred time: {$s['time']} (UK time)\n";
    } else {
        foreach ($p['lines'] as $l) $out .= "- {$l['name']}" . ($l['quantity'] > 1 ? " × {$l['quantity']}" : '') . ': ' . qa_money($l['lineCents'], $p['currency']) . ($l['note'] ? " ({$l['note']})" : '') . "\n";
    }
    $out .= 'Total: ' . qa_money($p['totalCents'], $p['currency']) . "\n";
    return $out;
}

function qa_customer_text(array $o): string {
    $c = $o['submission']['customer'];
    $msg = $o['submission']['kind'] === 'booking' ? ($o['submission']['message'] ?? '') : ($o['submission']['notes'] ?? '');
    return "Name: {$c['name']}\nEmail: {$c['email']}\nPhone / WhatsApp: " . ($c['phone'] ?: '—') . "\nCountry: " . ($c['country'] ?: '—') . "\n\nMessage:\n" . ($msg ?: '—') . "\n";
}

/** Mark an order paid (once) and send the confirmation emails. */
function qa_mark_paid(string $ref, string $paymentId, ?int $paidCents = null): ?array {
    $order = null; $changed = false;
    qa_update('orders', function (array $list) use ($ref, $paymentId, $paidCents, &$order, &$changed) {
        foreach ($list as $i => $o) {
            if (($o['ref'] ?? '') !== $ref) continue;
            if (($o['payment'] ?? '') !== 'paid') {
                $o['payment'] = 'paid'; $o['paidAt'] = qa_now(); $o['paymentId'] = $paymentId;
                if ($paidCents !== null) $o['paidCents'] = $paidCents;
                if (($o['status'] ?? '') === 'new') $o['status'] = 'confirmed';
                $o['log'][] = ['at' => qa_now(), 'text' => 'Payment received (' . $paymentId . ')'];
                $list[$i] = $o; $changed = true;
            }
            $order = $list[$i];
        }
        return $list;
    });
    if ($order && $changed) {
        $isBooking = $order['submission']['kind'] === 'booking';
        $amount = qa_money($order['paidCents'] ?? $order['priced']['totalCents'], $order['priced']['currency']);
        qa_notify(($isBooking ? 'New paid booking: ' : 'New paid order: ') . "{$order['priced']['title']} — {$order['submission']['customer']['name']} ($amount)",
            "A payment was completed on the website.\n\n" . qa_order_text($order) . "\nClient details\n" . qa_customer_text($order) . "\nPayment ID: $paymentId\nOpen the admin dashboard: " . QA_SITE . "/admin/",
            $order['submission']['customer']['email']);
        $first = explode(' ', trim($order['submission']['customer']['name']))[0];
        qa_mail($order['submission']['customer']['email'], "Payment received — {$order['priced']['title']} ({$order['ref']})",
            "Hi $first,\n\nThank you — we've received your payment of $amount. Our team will contact you within one working day"
            . ($isBooking ? " to confirm your consultation time and send the meeting link." : " to get started.") . "\n\n" . qa_order_text($order)
            . "\nQuestions? Just reply to this email.\n\nQalb-E-Abbas\n" . QA_SITE . "\n", qa_settings()['notifyEmail'] ?: QA_ADMIN_EMAIL);
    }
    return $order;
}

// ---------------------------------------------------------------------------
// Reviews: page keys used by the review sections on the website
// ---------------------------------------------------------------------------
const QA_REVIEW_KEYS = [
    'students' => 'Home page & University (students)', 'amazon' => 'Amazon FBA', 'ebay' => 'eBay', 'tiktok' => 'TikTok Shop',
    'walmart' => 'Walmart', 'etsy' => 'Etsy', 'shopify' => 'Shopify', 'us-llc-formation' => 'US LLC formation',
    'uk-ltd-formation' => 'UK LTD formation', 'uae-company-formation' => 'UAE company formation', 'malta-company-formation' => 'Malta company formation',
    'taxation' => 'Taxation', 'trademark-registration' => 'Trademark registration', 'education-consultancy' => 'Education consultancy',
    'real-estate' => 'Real estate (Pakistan)', 'digital-marketing' => 'Digital marketing', 'seo' => 'SEO', 'social-media-marketing' => 'Social media marketing',
    'email-marketing' => 'Email marketing', 'influencer-marketing' => 'Influencer marketing', 'affiliate-marketing' => 'Affiliate marketing',
    'website-development' => 'Website development', 'app-development' => 'App development', 'crm-development' => 'CRM development',
    'facebook-automation' => 'Facebook automation', 'instagram-automation' => 'Instagram automation', 'whatsapp-automation' => 'WhatsApp automation',
    'tiktok-automation' => 'TikTok automation',
];

/** Best guess of the review section for the "Service or course" the reviewer chose. */
function qa_review_key_for(string $service): string {
    $map = [
        'Amazon FBA' => 'amazon', 'eBay' => 'ebay', 'Walmart' => 'walmart', 'TikTok Shop' => 'tiktok', 'Etsy' => 'etsy', 'Shopify' => 'shopify',
        'Qalb-E-Abbas University course' => 'students', 'US LLC formation' => 'us-llc-formation', 'UK LTD formation' => 'uk-ltd-formation',
        'UAE company formation' => 'uae-company-formation', 'Malta company formation' => 'malta-company-formation', 'Taxation' => 'taxation',
        'Trademark registration' => 'trademark-registration', 'Education consultancy (Malta)' => 'education-consultancy', 'Real estate (Pakistan)' => 'real-estate',
        'Digital marketing / ads' => 'digital-marketing', 'SEO' => 'seo', 'Social media marketing' => 'social-media-marketing',
        'Website or app development' => 'website-development', 'WhatsApp / social automation' => 'whatsapp-automation',
    ];
    return $map[$service] ?? 'students';
}

/** Two-letter flag code for common countries (for the flag on review cards). */
function qa_country_flag(string $country): string {
    $c = strtolower(trim($country));
    $map = ['united kingdom' => 'gb', 'uk' => 'gb', 'england' => 'gb', 'scotland' => 'gb', 'wales' => 'gb', 'great britain' => 'gb',
        'pakistan' => 'pk', 'united states' => 'us', 'usa' => 'us', 'us' => 'us', 'united arab emirates' => 'ae', 'uae' => 'ae', 'dubai' => 'ae',
        'saudi arabia' => 'sa', 'ksa' => 'sa', 'malta' => 'mt', 'canada' => 'ca', 'australia' => 'au', 'india' => 'in', 'qatar' => 'qa',
        'germany' => 'de', 'france' => 'fr', 'ireland' => 'ie', 'italy' => 'it', 'spain' => 'es', 'netherlands' => 'nl', 'oman' => 'om',
        'kuwait' => 'kw', 'bahrain' => 'bh', 'bangladesh' => 'bd', 'turkey' => 'tr', 'malaysia' => 'my', 'new zealand' => 'nz', 'sweden' => 'se'];
    return $map[$c] ?? '';
}
