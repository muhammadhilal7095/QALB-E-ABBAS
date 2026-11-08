/* ==========================================================================
   Free Assessments (assessment.html?type=amazon | ebay | tiktok | walmart |
   etsy | shopify | company | tax | marketing | malta | realestate)

   The question sets live in assets/js/assessments-data.js. This engine:
   1. shows the sections in order (or, for adaptive assessments, decides the
      order from the first "triage" section),
   2. scores answers per area (0–3 per question) and checks for red flags,
   3. shows a readiness level, area scores, top blockers and the safest next
      step, and emails the result to the team and the person.

   Progress is kept in sessionStorage so a refresh doesn't lose answers.
   ========================================================================== */
(function () {
  "use strict";

  var root = document.getElementById("sra");
  var ALL = window.QA_ASSESSMENTS;
  if (!root || !ALL) return;

  var TYPE = (new URLSearchParams(location.search).get("type") || "").toLowerCase();

  // No (or unknown) ?type= → let the visitor choose which assessment to take, instead of
  // silently starting the Amazon one.
  if (!ALL[TYPE]) { renderChooser(); return; }

  function renderChooser() {
    var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
    var ic = function (n) { return '<svg class="icon" aria-hidden="true"><use href="#i-' + n + '"></use></svg>'; };
    var LIST = [
      ["amazon", "logo", "amazon", "Amazon FBA & private label"],
      ["ebay", "logo", "ebay", "Selling on eBay"],
      ["walmart", "logo", "walmart", "Walmart Marketplace"],
      ["tiktok", "logo", "tiktok", "TikTok Shop"],
      ["etsy", "logo", "etsy", "Etsy shop"],
      ["shopify", "logo", "shopify", "Shopify store"],
      ["company", "icon", "building", "UK, US, UAE or Malta company"],
      ["tax", "icon", "receipt", "US & UK company tax"],
      ["marketing", "icon", "megaphone", "Ads, SEO & social media"],
      ["malta", "icon", "graduation", "Study in Malta"],
      ["realestate", "icon", "map-pin", "Buying property"]
    ].filter(function (x) { return ALL[x[0]]; });
    var cards = LIST.map(function (x) {
      var a = ALL[x[0]];
      var mark = x[1] === "logo"
        ? '<img src="assets/img/platforms/' + x[2] + '.svg" alt="" width="28" height="28">'
        : ic(x[2]);
      return '<li><a class="sra-pick" href="?type=' + x[0] + '">' +
        '<span class="sra-pick__mark">' + mark + "</span>" +
        '<span class="sra-pick__text"><b>' + esc(a.name) + "</b><small>" + esc(x[3]) + " · " + (a.minutes ? "about " + esc(a.minutes) + " min" : "2–10 min, adapts to you") + "</small></span>" +
        ic("arrow-right") + "</a></li>";
    }).join("");
    var hide = function (sel) { var el = root.querySelector(sel); if (el) el.hidden = true; };
    hide("[data-sra-progress]"); hide("[data-sra-notice]"); hide(".sra-form");
    var h1 = root.querySelector("[data-sra-h1]"); if (h1) h1.textContent = "Free Business Readiness Assessments";
    var intro = root.querySelector("[data-sra-intro]");
    if (intro) intro.textContent = "Choose the assessment that matches your plans. Each one asks questions about that platform or service only, then shows your readiness level, the biggest blockers and the safest next step. Free and instant.";
    var crumb = root.querySelector("[data-sra-crumb]"); if (crumb) crumb.textContent = "Free Assessment";
    var box = document.createElement("div");
    box.className = "sra-chooser";
    box.innerHTML = '<h2 class="sra-chooser__title">Which assessment would you like to take?</h2><ul class="sra-chooser__grid">' + cards + "</ul>";
    root.appendChild(box);
  }
  var A = ALL[TYPE];
  var Q = A.questions;
  var SECTIONS = A.sections;
  var LEVELS = A.levels || ["Not ready yet", "Building foundations", "Nearly ready", "Ready to proceed"];

  // ---- Page header ------------------------------------------------------------
  function setText(sel, t) { var el = document.querySelector(sel); if (el && t) el.textContent = t; }
  setText("[data-sra-eyebrow]", "Qalb-E-Abbas · " + A.name);
  setText("[data-sra-h1]", A.title);
  setText("[data-sra-intro]", A.intro);
  setText("[data-sra-crumb]", A.name);
  document.title = A.title + " — Qalb-E-Abbas";

  // ---- State ----------------------------------------------------------------
  var KEY = "qa_assess_" + TYPE + "_v2";
  var fresh = function () { return { answers: {}, step: 0, path: null, details: {} }; };
  var state = fresh();
  try { var saved = JSON.parse(sessionStorage.getItem(KEY) || "null"); if (saved && saved.answers) state = saved; } catch (e) { /* ignore */ }
  function persist() { try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } }

  var H = window.QA_ASSESS_HELPERS;
  function type(id) { return Q[id].type || "radio"; }
  function opts(id) {
    var q = Q[id], t = type(id);
    if (t === "country") return H.countryNames(q.list);
    if (t === "budget") return H.budgetOptions(q, h);
    return typeof q.o === "function" ? q.o(h) : (q.o || []);
  }
  function has(id) {
    var v = state.answers[id];
    if (v == null || v === "") return false;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  }
  function idx(id) { var v = state.answers[id]; return typeof v === "number" ? v : -1; }
  function answerText(id) {
    var v = state.answers[id];
    if (v == null) return "";
    if (Array.isArray(v)) { var o = opts(id); return v.map(function (i) { return o[i]; }).join(", "); }
    if (typeof v === "number") return opts(id)[v] || "";
    return String(v) + (Q[id].unit ? " " + Q[id].unit : "");
  }
  function num(id) { var n = parseFloat(state.answers[id]); return isNaN(n) ? null : n; }
  function picked(id, i) { var v = state.answers[id]; return Array.isArray(v) && v.indexOf(i) >= 0; }
  var h = { idx: idx, text: answerText, num: num, has: has, picked: picked, answers: function () { return state.answers; } };

  // ---- Section order ----------------------------------------------------------
  function order() {
    if (A.adaptive) {
      var p = state.path ? A.adaptive.paths[state.path].order : [];
      return [A.adaptive.triage].concat(p, ["details"]);
    }
    // Sections with a `when` rule (e.g. one page per chosen marketing platform) appear only when it applies.
    return A.order.filter(function (k) { return !SECTIONS[k].when || SECTIONS[k].when(h); }).concat(["details"]);
  }
  function totalSteps() { return A.adaptive ? 2 + A.adaptive.paths[Object.keys(A.adaptive.paths)[0]].order.length : order().length; }
  function pathName() { return A.adaptive && state.path ? A.adaptive.paths[state.path].name : A.name; }

  var CFG = window.SITE_CONFIG || {};
  var API = String((CFG.links && CFG.links.bookingApp) || "").replace(/\/$/, "");
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function icon(n) { return '<svg class="icon" aria-hidden="true"><use href="#i-' + n + '"></use></svg>'; }

  var els = {
    stepLabel: root.querySelector("[data-sra-step]"),
    stepTitle: root.querySelector("[data-sra-title]"),
    bar: root.querySelector("[data-sra-bar]"),
    notice: root.querySelector("[data-sra-notice]"),
    card: root.querySelector("[data-sra-card]"),
    nav: root.querySelector("[data-sra-nav]"),
    progress: root.querySelector("[data-sra-progress]"),
    result: root.querySelector("[data-sra-result]")
  };

  // ---- Rendering ------------------------------------------------------------
  function questionHTML(id) {
    var q = Q[id], t = type(id), cur = state.answers[id];
    var head = '<legend class="sra-q__title"><span class="sra-q__id">' + id + "</span>" + esc(q.q) + (q.optional ? ' <span class="sra-q__opt">(optional)</span>' : "") + "</legend>" +
      (q.hint ? '<p class="sra-q__hint">' + esc(q.hint) + "</p>" : "");
    var body;
    if (t === "number") {
      body = '<div class="sra-input"><input type="number" inputmode="decimal" name="' + id + '"' + (q.min != null ? ' min="' + q.min + '"' : "") + (q.max != null ? ' max="' + q.max + '"' : "") + ' step="' + (q.step || "any") + '" value="' + esc(cur == null ? "" : cur) + '" placeholder="' + esc(q.placeholder || "") + '">' + (q.unit ? "<span>" + esc(q.unit) + "</span>" : "") + "</div>";
    } else if (t === "text") {
      body = '<div class="sra-input sra-input--text"><input type="text" name="' + id + '" maxlength="300" value="' + esc(cur || "") + '" placeholder="' + esc(q.placeholder || "") + '"></div>';
    } else if (t === "select" || (t === "country" && q.select)) {
      var list = opts(id);
      body = '<div class="sra-input sra-input--select"><select name="' + id + '"><option value="">Choose…</option>' + list.map(function (l, i) { return '<option value="' + i + '"' + (cur === i ? " selected" : "") + ">" + esc(l) + "</option>"; }).join("") + "</select></div>";
    } else {
      var multi = t === "multi", list2 = opts(id);
      var cols = q.cols === 2 || (t === "country") ? " sra-opts--2" : "";
      body = '<div class="sra-opts' + cols + '">' + list2.map(function (label, i) {
        var on = multi ? (Array.isArray(cur) && cur.indexOf(i) >= 0) : cur === i;
        return '<label class="sra-opt"><input type="' + (multi ? "checkbox" : "radio") + '" name="' + id + '" value="' + i + '"' + (on ? " checked" : "") + "><span>" + esc(label) + "</span></label>";
      }).join("") + "</div>";
      if (multi) head = head.replace("</legend>", ' <span class="sra-q__opt">(choose all that apply)</span></legend>');
    }
    return '<fieldset class="sra-q" id="q-' + id + '" data-q="' + id + '">' + head + body +
      '<p class="sra-q__err" role="alert" hidden>' + (t === "number" ? "Please enter a number to continue." : t === "text" ? "Please fill this in to continue." : "Please choose an answer to continue.") + "</p></fieldset>";
  }

  function detailsHTML() {
    var d = state.details;
    var sel = function (name, list) {
      return '<select id="d-' + name + '" name="' + name + '">' + list.map(function (o) { return "<option" + (d[name] === o ? " selected" : "") + ">" + esc(o) + "</option>"; }).join("") + "</select>";
    };
    var ageField = A.noAgeInDetails ? "" : '<div class="sra-field"><label for="d-ageGroup">Age group <span>(optional)</span></label>' + sel("ageGroup", ["Prefer not to say", "18–24", "25–34", "35–44", "45–54", "55–64", "65 or over"]) + "</div>";
    return '<div class="sra-grid">' +
      '<div class="sra-field"><label for="d-firstName">First name</label><input id="d-firstName" name="firstName" autocomplete="given-name" required value="' + esc(d.firstName) + '"></div>' +
      '<div class="sra-field"><label for="d-lastName">Last name</label><input id="d-lastName" name="lastName" autocomplete="family-name" required value="' + esc(d.lastName) + '"></div>' +
      '<div class="sra-field sra-field--full"><label for="d-email">Email</label><input id="d-email" name="email" type="email" autocomplete="email" required value="' + esc(d.email) + '"></div>' +
      '<div class="sra-field"><label for="d-phone">Phone / WhatsApp <span>(optional)</span></label><input id="d-phone" name="phone" type="tel" autocomplete="tel" value="' + esc(d.phone) + '"></div>' +
      ageField +
      '<div class="sra-field"><label for="d-gender">Gender <span>(optional)</span></label>' + sel("gender", ["Prefer not to say", "Female", "Male", "Another identity"]) + "</div>" +
      "</div>" +
      '<div class="sra-save">' + icon("shield") + "<p><strong>How we use your answers:</strong> When you see your result, your answers and contact details are emailed to our team so they can review them before any consultation, and we email you a copy of your result. They are not stored on this website, and this does not subscribe you to marketing.</p></div>" +
      '<label class="sra-check"><input type="checkbox" name="marketingOptIn"' + (d.marketingOptIn ? " checked" : "") + "><span>I would like to receive relevant educational updates. This is optional.</span></label>" +
      '<label class="sra-check"><input type="checkbox" name="truthful"' + (d.truthful ? " checked" : "") + "><span>I confirm these answers are truthful and that altered, borrowed, or fabricated evidence must not be used.</span></label>" +
      '<p class="sra-q__err" data-details-err role="alert" hidden></p>';
  }

  var DETAILS = { title: "Your details and consent" };
  function section(key) { return key === "details" ? DETAILS : SECTIONS[key]; }

  function render(focus) {
    var o = order();
    if (state.step >= o.length) state.step = o.length - 1;
    var key = o[state.step], sec = section(key);
    var total = totalSteps();
    var isTriage = A.adaptive && key === A.adaptive.triage;
    els.result.hidden = true;
    els.progress.hidden = false; els.card.hidden = false; els.nav.hidden = false; els.notice.hidden = false;
    els.stepLabel.textContent = isTriage ? "Triage" : "Section " + (state.step + 1) + " of " + total;
    els.stepTitle.textContent = sec.title;
    var pct = isTriage ? Math.max(6, Math.round(answeredIn(sec.q) / sec.q.length * 16)) : Math.round((state.step + 1) / total * 100);
    els.bar.style.width = pct + "%";
    els.bar.parentNode.setAttribute("aria-valuenow", String(pct));
    if (A.adaptive) {
      els.notice.innerHTML = isTriage
        ? icon("compass") + "<span>Complete this triage section to create your adaptive question path.</span>"
        : icon("layers") + "<span><strong>Adaptive path: " + esc(pathName()) + ".</strong> Section order is now based on your triage answers.</span>";
    } else {
      els.notice.innerHTML = icon("compass") + "<span>" + esc(A.notice || ("Free " + A.name + " — about " + (A.minutes || 5) + " minutes. Your answers stay private.")) + "</span>";
    }
    els.card.innerHTML = '<h2 class="sra-card__title">' + (state.step + 1) + ". " + esc(sec.title) + "</h2>" +
      (sec.sub ? '<p class="sra-card__sub">' + esc(sec.sub) + "</p>" : "") +
      (key === "details" ? detailsHTML() : sec.q.map(questionHTML).join(""));
    els.nav.innerHTML = (state.step > 0 ? '<button type="button" class="btn btn--outline sra-back" data-back>Back</button>' : "<span></span>") +
      '<button type="submit" class="btn btn--accent sra-next">' + (key === "details" ? "See my result" : "Continue") + icon("arrow-right") + "</button>";
    persist();
    if (focus) root.querySelector(".sra-progress").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function answeredIn(list) { return list.filter(has).length; }

  // ---- Validation & navigation ---------------------------------------------
  function validateSection() {
    var key = order()[state.step];
    if (key === "details") return validateDetails();
    var firstMissing = null;
    SECTIONS[key].q.forEach(function (id) {
      var fs = root.querySelector("#q-" + id), q = Q[id];
      var missing = !q.optional && !has(id);
      var bad = false;
      if (!missing && type(id) === "number" && has(id)) {
        var n = num(id);
        bad = n == null || (q.min != null && n < q.min) || (q.max != null && n > q.max);
      }
      var err = fs.querySelector(".sra-q__err");
      if (bad) err.textContent = "Please enter a number between " + q.min + " and " + q.max + ".";
      fs.classList.toggle("is-missing", missing || bad);
      err.hidden = !(missing || bad);
      if ((missing || bad) && !firstMissing) firstMissing = fs;
    });
    if (firstMissing) { firstMissing.scrollIntoView({ behavior: "smooth", block: "center" }); return false; }
    return true;
  }
  function readDetails() {
    var f = els.card;
    ["firstName", "lastName", "email", "phone", "ageGroup", "gender"].forEach(function (n) { var el = f.querySelector('[name="' + n + '"]'); if (el) state.details[n] = el.value; });
    ["marketingOptIn", "truthful"].forEach(function (n) { var el = f.querySelector('[name="' + n + '"]'); if (el) state.details[n] = el.checked; });
  }
  function validateDetails() {
    readDetails();
    var d = state.details, err = root.querySelector("[data-details-err]"), msg = "";
    if (!(d.firstName || "").trim()) msg = "Please enter your first name.";
    else if (!(d.lastName || "").trim()) msg = "Please enter your last name.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((d.email || "").trim())) msg = "Please enter a valid email address.";
    else if (!d.truthful) msg = "Please confirm your answers are truthful to see your result.";
    err.textContent = msg; err.hidden = !msg;
    if (msg) err.scrollIntoView({ behavior: "smooth", block: "center" });
    return !msg;
  }

  function clearErr(t) { var fs = t.closest(".sra-q"); if (fs) { fs.classList.remove("is-missing"); fs.querySelector(".sra-q__err").hidden = true; } }
  function onAnswer(e) {
    var t = e.target, id = t.name;
    if (Q[id]) {
      var ty = type(id);
      if (ty === "multi") {
        var vals = Array.prototype.filter.call(root.querySelectorAll('input[name="' + id + '"]'), function (x) { return x.checked; }).map(function (x) { return Number(x.value); });
        state.answers[id] = vals;
      } else if (ty === "number" || ty === "text") {
        state.answers[id] = t.value.trim();
      } else {
        state.answers[id] = t.value === "" ? null : Number(t.value);
      }
      clearErr(t);
      // A country change can change budget currencies further on.
      if (A.adaptive && order()[state.step] === A.adaptive.triage) { var sec = SECTIONS[A.adaptive.triage]; els.bar.style.width = Math.max(6, Math.round(answeredIn(sec.q) / sec.q.length * 16)) + "%"; }
      persist();
    } else if (order()[state.step] === "details") { readDetails(); persist(); }
  }
  root.addEventListener("change", onAnswer);
  root.addEventListener("input", function (e) { var t = e.target; if (Q[t.name] && (t.type === "number" || t.type === "text")) onAnswer(e); else if (order()[state.step] === "details") { readDetails(); persist(); } });
  root.addEventListener("click", function (e) {
    if (e.target.closest("[data-back]")) { if (order()[state.step] === "details") readDetails(); state.step = Math.max(0, state.step - 1); render(true); }
    if (e.target.closest("[data-restart]")) { state = fresh(); persist(); render(true); }
  });
  root.querySelector("form").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validateSection()) return;
    var key = order()[state.step];
    if (A.adaptive && key === A.adaptive.triage) state.path = A.adaptive.decide(h);
    if (key === "details") { finish(); return; }
    state.step++;
    render(true);
  });

  // ---- Scoring --------------------------------------------------------------
  function qScore(id) {
    var q = Q[id], t = type(id);
    if (!has(id)) return null;
    if (t === "country") return H.countryFit(answerText(id), q.fit || "developed");
    if (typeof q.score === "function") return q.score(state.answers[id], h);
    if (q.s && typeof state.answers[id] === "number") return q.s[state.answers[id]];
    return null;
  }
  function areaScores() {
    return A.areas.map(function (a) {
      var got = 0, max = 0;
      a[1].forEach(function (id) { var s = qScore(id); if (s != null) { got += s; max += 3; } });
      return { area: a[0], score: max ? Math.round(got / max * 100) : 0 };
    }).filter(function (a, i) { return A.areas[i][1].some(function (id) { return qScore(id) != null; }); });
  }

  function levelFor(score, flags) {
    var lv = score >= 80 ? 3 : score >= 60 ? 2 : score >= 40 ? 1 : 0;
    if (flags.some(function (x) { return x[0] >= 8; })) lv = Math.min(lv, 1);
    return LEVELS[lv];
  }

  // ---- Finish: show result and send -------------------------------------------
  function finish() {
    var scores = areaScores();
    var overall = scores.length ? Math.round(scores.reduce(function (t, a) { return t + a.score; }, 0) / scores.length) : 0;
    var flags = A.flags(h).sort(function (a, b) { return b[0] - a[0]; });
    var level = levelFor(overall, flags);
    var top = flags.slice(0, 4).map(function (x) { return x[1]; });
    var next = A.next(level, h, state.path, LEVELS);
    var answers = {};
    order().forEach(function (k) { if (k !== "details") SECTIONS[k].q.forEach(function (id) { if (has(id)) answers[id] = { question: Q[id].q, answer: answerText(id).slice(0, 600) }; }); });

    showResult({ scores: scores, overall: overall, level: level, top: top, next: next });

    var d = state.details;
    var payload = {
      assessment: A.name, topic: A.topic || null,
      firstName: d.firstName, lastName: d.lastName, email: d.email, phone: d.phone || null,
      ageGroup: d.ageGroup && d.ageGroup !== "Prefer not to say" ? d.ageGroup : null,
      gender: d.gender && d.gender !== "Prefer not to say" ? d.gender : null,
      marketingOptIn: !!d.marketingOptIn, truthful: true, country: A.countryQ ? answerText(A.countryQ) : null,
      path: pathName(), level: level, score: overall, scores: scores, blockers: top,
      nextStep: { title: next.title, text: next.text }, answers: answers
    };
    if (!API) return setSaveStatus(false);
    fetch(API + "/api/assessments", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) { setSaveStatus(res.ok, res.j.reference, res.j.error); })
      .catch(function () { setSaveStatus(false); });
  }

  function setSaveStatus(ok, ref, err) {
    var el = root.querySelector("[data-sra-save]");
    if (!el) return;
    el.className = "sra-saved " + (ok ? "is-ok" : "is-warn");
    el.innerHTML = ok
      ? icon("check-circle") + "<p>Your result has been sent to our team (reference <strong>" + esc(ref) + "</strong>) and a copy is on its way to <strong>" + esc(state.details.email) + "</strong>.</p>"
      : icon("info") + "<p>" + esc(err || "We couldn't send your result just now.") + ' Your result is shown below — please <a href="/contact">contact us</a> if you would like us to review it.</p>';
    if (ok) { try { sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ } }
  }

  function showResult(r) {
    els.progress.hidden = true; els.card.hidden = true; els.nav.hidden = true; els.notice.hidden = true;
    var tone = ["red", "amber", "blue", "green"][LEVELS.indexOf(r.level)] || "blue";
    els.result.hidden = false;
    els.result.innerHTML =
      '<div class="sra-saved" data-sra-save>' + icon("clock") + "<p>Sending your result…</p></div>" +
      '<div class="sra-result">' +
        '<div class="sra-score sra-score--' + tone + '"><div class="sra-ring" style="--p:' + r.overall + '"><span>' + r.overall + "<small>%</small></span></div>" +
        "<div><p class=\"sra-score__label\">" + esc(A.resultLabel || "Your readiness level") + "</p><h2>" + esc(r.level) + "</h2><p>" + (A.adaptive ? "Adaptive path: " : "Assessment: ") + "<strong>" + esc(pathName()) + "</strong></p></div></div>" +
        '<div class="sra-areas">' + r.scores.map(function (a) {
          return '<div class="sra-area"><div class="sra-area__top"><span>' + esc(a.area) + "</span><strong>" + a.score + '%</strong></div><div class="sra-area__bar"><i style="width:' + a.score + '%"></i></div></div>';
        }).join("") + "</div>" +
        (r.top.length ? '<div class="sra-block"><h3>' + icon("shield") + "Fix these first</h3><ol>" + r.top.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ol></div>"
          : '<div class="sra-block sra-block--ok"><h3>' + icon("check-circle") + "No major red flags</h3><p>Your answers show no high-risk blockers. Keep reviewing each step before you commit money.</p></div>") +
        '<div class="sra-next-step"><p class="sra-score__label">Your safest next step</p><h3>' + esc(r.next.title) + "</h3><p>" + esc(r.next.text) + '</p><div class="sra-next-step__btns">' +
          r.next.links.map(function (l) { return '<a class="btn btn--' + l[2] + '" href="' + l[1] + '">' + esc(l[0]) + (l[2] === "accent" ? icon("arrow-right") : "") + "</a>"; }).join("") + "</div></div>" +
        '<p class="sra-disclaimer">' + esc(A.disclaimer || "This assessment is general guidance based on your answers. It is not financial, legal or tax advice and does not predict profit.") + "</p>" +
        '<button type="button" class="sra-restart" data-restart>Start the assessment again</button>' +
      "</div>";
    root.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  render(false);
})();
