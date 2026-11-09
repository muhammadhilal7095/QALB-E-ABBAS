<?php
/* POST /api/assessment.php — Seller Readiness Assessment result (JSON).
   Saved in Admin → Enquiries (type "assessment"), emailed to the team and to the person. */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') qa_json(405, ['ok' => false, 'error' => 'Method not allowed.']);
qa_check_origin();
$a = qa_read_json_body(150000);

$first = qa_text($a['firstName'] ?? '', 80);
$last  = qa_text($a['lastName'] ?? '', 80);
$email = qa_text($a['email'] ?? '', 200);
if ($first === '' || $last === '') qa_json(422, ['ok' => false, 'error' => 'Please enter your first and last name.']);
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) qa_json(422, ['ok' => false, 'error' => 'Please enter a valid email address.']);
if (($a['truthful'] ?? false) !== true) qa_json(422, ['ok' => false, 'error' => 'Please confirm your answers are truthful.']);
qa_rate_limit('assessment', 10, 600);

$ref   = qa_ref('SRA');
$title = qa_text($a['assessment'] ?? 'Seller Readiness Assessment', 80) ?: 'Seller Readiness Assessment';
$level = qa_text($a['level'] ?? '', 80);
$score = max(0, min(100, (int)round((float)($a['score'] ?? 0))));
$path  = qa_text($a['path'] ?? '', 80);

$scores = [];
foreach (array_slice((array)($a['scores'] ?? []), 0, 10) as $s) $scores[] = ['area' => qa_text($s['area'] ?? '', 80), 'score' => max(0, min(100, (int)round((float)($s['score'] ?? 0))))];
$blockers = array_map(fn($b) => qa_text($b, 300), array_slice((array)($a['blockers'] ?? []), 0, 10));
$next = ['title' => qa_text($a['nextStep']['title'] ?? '', 200), 'text' => qa_text($a['nextStep']['text'] ?? '', 1000)];
$answers = [];
foreach (array_slice((array)($a['answers'] ?? []), 0, 120, true) as $k => $v) {
    $answers[qa_text($k, 10)] = ['question' => qa_text($v['question'] ?? '', 400), 'answer' => qa_text($v['answer'] ?? '', 600)];
}
ksort($answers);

$person = [
    'phone' => qa_text($a['phone'] ?? '', 40), 'country' => qa_text($a['country'] ?? '', 80),
    'ageGroup' => qa_text($a['ageGroup'] ?? '', 40), 'gender' => qa_text($a['gender'] ?? '', 40), 'marketingOptIn' => !empty($a['marketingOptIn']),
];
qa_insert('enquiries', [
    'id' => qa_id(), 'ref' => $ref, 'createdAt' => qa_now(), 'status' => 'new', 'type' => 'assessment', 'source' => $title,
    'name' => "$first $last", 'email' => $email, 'phone' => $person['phone'], 'topic' => qa_text($a['topic'] ?? '', 60),
    'subject' => "$title — $level ($score%)", 'message' => '',
    'assessment' => ['title' => $title, 'level' => $level, 'score' => $score, 'path' => $path, 'scores' => $scores, 'blockers' => $blockers, 'next' => $next, 'answers' => $answers] + $person,
]);

$summary = "Reference: $ref\nReadiness: $level ($score%)\nPath: $path\n";
foreach ($scores as $s) $summary .= "- {$s['area']}: {$s['score']}%\n";
if ($blockers) $summary .= "\nTop priorities to fix first:\n- " . implode("\n- ", $blockers) . "\n";
$summary .= "\nSafest next step: {$next['title']}\n{$next['text']}\n";
$answersText = '';
foreach ($answers as $k => $v) $answersText .= "$k · {$v['question']}\n   → {$v['answer']}\n";

qa_notify("New assessment: $title — $first $last ($level, $score%)",
    "$summary\nPerson\nName: $first $last\nEmail: $email\nPhone: " . ($person['phone'] ?: '—') . "\nCountry: " . ($person['country'] ?: '—')
    . "\nAge group: " . ($person['ageGroup'] ?: '—') . "\nEducational updates: " . ($person['marketingOptIn'] ? 'Yes' : 'No') . "\n\nAnswers\n$answersText\nAdmin: " . QA_SITE . "/admin/?tab=enquiries\n",
    $email);
qa_mail($email, "Your $title result ($ref)",
    "Hi $first,\n\nThank you for completing the $title. Here is your result:\n\n$summary\nWant help with your next step? Book a consultation: " . QA_SITE . "/book-consultation\n\nQalb-E-Abbas\n" . QA_SITE . "\n",
    qa_settings()['notifyEmail'] ?: QA_ADMIN_EMAIL);

qa_json(200, ['ok' => true, 'reference' => $ref]);
