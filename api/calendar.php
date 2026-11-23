<?php
/* GET /api/calendar.php — this week's economic calendar (time, currency, impact, event, forecast,
   previous) from Forex Factory's public weekly export, cached on the server for 30 minutes so the
   source is asked at most twice an hour. If the source is down, the last saved copy is served. */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

const CAL_SRC = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
const CAL_TTL = 1800;

$file = qa_data_dir() . '/calendar-cache.json';
$cached = is_file($file) ? json_decode((string)@file_get_contents($file), true) : null;
$fresh = is_array($cached) && (time() - (int)($cached['at'] ?? 0)) < CAL_TTL;

if (!$fresh && function_exists('curl_init')) {
    $ch = curl_init(CAL_SRC);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; QalbEAbbasCalendar/1.0)', CURLOPT_HTTPHEADER => ['Accept: application/json']]);
    $raw = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $list = $code === 200 ? json_decode((string)$raw, true) : null;
    if (is_array($list) && $list) {
        $events = [];
        foreach ($list as $e) {
            if (!is_array($e) || empty($e['date']) || empty($e['title'])) continue;
            $ts = strtotime((string)$e['date']);
            if (!$ts) continue;
            $events[] = [
                't' => $ts, 'c' => substr(preg_replace('/[^A-Z]/', '', (string)($e['country'] ?? '')), 0, 4),
                'i' => in_array($e['impact'] ?? '', ['High', 'Medium', 'Low', 'Holiday'], true) ? $e['impact'] : 'Low',
                'e' => mb_substr((string)$e['title'], 0, 120), 'f' => mb_substr((string)($e['forecast'] ?? ''), 0, 20), 'p' => mb_substr((string)($e['previous'] ?? ''), 0, 20),
            ];
        }
        usort($events, fn($a, $b) => $a['t'] <=> $b['t']);
        $cached = ['at' => time(), 'events' => $events];
        @file_put_contents($file, json_encode($cached), LOCK_EX);
    }
}

header('Cache-Control: public, max-age=300');
qa_json(200, ['ok' => is_array($cached), 'updated' => $cached['at'] ?? null, 'events' => $cached['events'] ?? []]);
