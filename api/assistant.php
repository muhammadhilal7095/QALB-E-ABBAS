<?php
/* ==========================================================================
   Website assistant (chat box on every page).
   GET  /api/assistant.php  → on/off, name, welcome text and the extra answers
                              written in Admin → Assistant.
   POST /api/assistant.php  → records a visitor's question (and whether the
                              assistant found an answer) for Admin → Assistant.
   ========================================================================== */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $a = qa_assistant();
    header('Cache-Control: public, max-age=60');
    qa_json(200, [
        'ok' => true,
        'enabled' => $a['enabled'],
        'name' => $a['name'],
        'welcome' => $a['welcome'],
        'answers' => array_values(array_map(fn($x) => [
            'id' => $x['id'], 'q' => $x['q'], 'keywords' => $x['keywords'], 'a' => $x['a'], 'link' => $x['link'], 'label' => $x['label'],
        ], array_filter($a['answers'], fn($x) => !empty($x['live'])))),
    ]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') qa_json(405, ['ok' => false, 'error' => 'Method not allowed.']);
qa_check_origin();
$in = qa_read_json_body(4000);
$q = qa_text($in['q'] ?? '', 300);
if (mb_strlen($q) < 2) qa_json(200, ['ok' => true]);
qa_rate_limit('assistant', 60, 3600);

$row = [
    'id' => qa_id(), 'at' => qa_now(), 'q' => $q,
    'hit' => qa_text($in['hit'] ?? '', 80),          // id of the answer shown ('' = no answer found)
    'hitTitle' => qa_text($in['hitTitle'] ?? '', 160),
    'kind' => in_array($in['kind'] ?? '', ['typed', 'button'], true) ? $in['kind'] : 'typed',
    'page' => qa_text($in['page'] ?? '', 120),
    'sid' => substr(preg_replace('/[^a-z0-9]/', '', (string)($in['sid'] ?? '')), 0, 16),
];
qa_update('assistant-log', function (array $list) use ($row) {
    array_unshift($list, $row);
    return array_slice($list, 0, 3000);
});
qa_json(200, ['ok' => true]);
