/* ==========================================================================
   Website assistant — the chat box on the side of every page.
   Free and instant: answers come from the website's own content
   (assets/js/assistant-data.js, built by `npm run assistant:build`) plus the
   extra answers written in Admin → Assistant. Questions it can't answer are
   passed to the team through the contact form and listed in the admin.
   Loaded on demand by site.js (initAssistant) the first time it is opened.
   ========================================================================== */
(function () {
  "use strict";
  if (window.qaAssistant) return;

  var D = window.QA_ASSIST_DATA || { areas: [], services: [], general: [], courses: [], consult: [], contact: {}, links: {} };
  var CFG = window.SITE_CONFIG || {};
  var API = String((CFG.links && CFG.links.api) || "/api").replace(/\/$/, "");
  var KEY = "qa-assistant";
  var R = { name: "Qalb-E-Abbas", welcome: "", answers: [] };
  var LIVE = {}; // live prices from Admin → Prices
  var el, log, chips, input, state;

  /* ---------- Small helpers ---------------------------------------------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  // Brand mark (the Qalb-E-Abbas heart) used as the chat avatar.
  var MARK = '<svg class="qai__mark" viewBox="0 0 44 44" aria-hidden="true" focusable="false"><path d="M22 32.5s-9.5-5.6-9.5-12.4A5.6 5.6 0 0 1 22 16.4a5.6 5.6 0 0 1 9.5 3.7c0 6.8-9.5 12.4-9.5 12.4Z" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/><path d="M18 22.5l3 3 5.5-6" fill="none" stroke="#7DB3FF" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function icon(n) { return '<svg class="icon" aria-hidden="true" focusable="false"><use href="#i-' + n + '"></use></svg>'; }
  function para(t) { return esc(t).split(/\n{2,}/).map(function (p) { return "<p>" + p.replace(/\n/g, "<br>") + "</p>"; }).join(""); }
  function svc(id) { for (var i = 0; i < D.services.length; i++) if (D.services[i].id === id) return D.services[i]; return null; }
  function area(id) { for (var i = 0; i < D.areas.length; i++) if (D.areas[i].id === id) return D.areas[i]; return null; }
  function money(p) {
    var v = LIVE[p.sku] != null ? LIVE[p.sku] : p.price;
    if (v == null) return "Price on request";
    var sym = { USD: "$", GBP: "£", EUR: "€", PKR: "Rs " }[p.currency] || p.currency + " ";
    return sym + Number(v).toLocaleString("en-US") + (p.unit ? " " + p.unit : "");
  }
  function link(href, label, cls) { return '<a class="qai__link' + (cls ? " " + cls : "") + '" href="' + esc(href) + '">' + esc(label) + icon("arrow-right") + "</a>"; }
  function bookHref(topic) { return (D.links.book || "/book-consultation") + (topic ? "?topic=" + encodeURIComponent(topic) : ""); }
  function save() {
    try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode */ }
  }
  function sid() {
    if (!state.sid) { state.sid = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); save(); }
    return state.sid;
  }
  function track(q, hit, hitTitle, kind) {
    try {
      fetch(API + "/assistant.php", { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
        body: JSON.stringify({ q: q, hit: hit || "", hitTitle: hitTitle || "", kind: kind || "typed", page: location.pathname, sid: sid() }) }).catch(function () {});
    } catch (e) { /* ignore */ }
  }

  /* ---------- Rendering --------------------------------------------------- */
  function add(who, html) {
    state.log.push({ w: who, h: html });
    if (state.log.length > 60) state.log = state.log.slice(-60);
    paint(who, html);
    save();
  }
  function paint(who, html) {
    var m = document.createElement("div");
    m.className = "qai__msg qai__msg--" + who;
    m.innerHTML = who === "bot" ? '<span class="qai__av">' + MARK + '</span><div class="qai__bubble">' + html + "</div>" : '<div class="qai__bubble">' + html + "</div>";
    var t = log.querySelector(".qai__typing");
    log.insertBefore(m, t || null);
    requestAnimationFrame(function () {
      if (who === "bot" && m.offsetHeight > log.clientHeight - 40) log.scrollTop = m.offsetTop - 12;
      else log.scrollTop = log.scrollHeight;
    });
  }
  // Quick-reply buttons under the conversation: [[label, action, arg], …]
  function options(list) {
    state.opts = list;
    chips.innerHTML = list.map(function (o, i) { return '<button type="button" class="qai__chip' + (o[3] ? " qai__chip--" + o[3] : "") + '" data-i="' + i + '">' + esc(o[0]) + "</button>"; }).join("");
    save();
  }
  // Bot replies appear after a short "typing" pause, like a real chat.
  var busy = 0;
  function typing(on) {
    var t = log.querySelector(".qai__typing");
    if (on && !t) {
      t = document.createElement("div");
      t.className = "qai__msg qai__msg--bot qai__typing";
      t.setAttribute("aria-label", "Typing");
      t.innerHTML = '<span class="qai__av">' + MARK + '</span><div class="qai__bubble"><i></i><i></i><i></i></div>';
      log.appendChild(t);
      log.scrollTop = log.scrollHeight;
    } else if (!on && t) t.remove();
  }
  function bot(html, opts, after, withTiles) {
    if (withTiles) html += tiles();
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    busy++;
    chips.classList.add("is-wait");
    typing(true);
    setTimeout(function () {
      busy--;
      typing(false);
      add("bot", html);
      options(opts || homeOpts());
      chips.classList.remove("is-wait");
      if (after) after();
    }, reduce ? 0 : Math.min(1500, 650 + html.length / 6 + Math.random() * 250));
  }

  function homeOpts() {
    return [["How it works", "process"], ["Prices", "prices"], ["University courses", "university"], ["Book a consultation", "book", "", "accent"], ["Email us", "email"], ["Talk to our team", "human"]];
  }
  // Service-area tiles inside a message (buttons work from the conversation history too).
  function tiles() {
    return '<div class="qai__tiles">' + D.areas.map(function (a) {
      return '<button type="button" class="qai__tile" data-act="area" data-arg="' + esc(a.id) + '" data-label="' + esc(a.title) + '"><span>' + icon(a.icon || "layers") + "</span>" + esc(a.title.replace(/ Services$/, "")) + "</button>";
    }).join("") + "</div>";
  }
  function backOpts(extra) { return (extra || []).concat([["← Main menu", "home", "", "ghost"]]); }

  /* ---------- Answers ----------------------------------------------------- */
  var A = {
    home: function () {
      bot("<p>Sure, what can I help you with? Choose an area below, or just type your question.</p>" + tiles());
    },
    area: function (id) {
      var a = area(id); if (!a) return A.home();
      var list = a.items.map(svc).filter(Boolean);
      bot("<p>Great choice! In <b>" + esc(a.title.replace(/ Services$/, "")) + "</b> we help with: " + esc(a.desc.charAt(0).toLowerCase() + a.desc.slice(1)) + "</p><p>Which one are you interested in?</p>",
        backOpts(list.map(function (s) { return [s.short, "service", s.id]; }).concat([["All " + a.title.replace(/ Services$/, "").toLowerCase() + " services", "go", a.link]])));
    },
    service: function (id) {
      var s = svc(id); if (!s) return A.home();
      var h = "<p>Sure! Here's an overview of our <b>" + esc(s.label) + "</b> service.</p><p>" + esc(s.desc) + "</p>";
      if (s.steps.length) {
        h += '<p class="qai__sub">' + esc(s.howTitle || "How it works") + "</p><ol class=\"qai__steps\">" +
          s.steps.map(function (st) { return "<li><b>" + esc(st[0]) + "</b><span>" + esc(st[1]) + "</span></li>"; }).join("") + "</ol>";
      }
      h += '<div class="qai__links">' + link(s.link, "Open the " + s.label + " page") + "</div>";
      var o = [];
      if (s.prices.length) o.push(["Prices", "price", id]);
      if (s.faqs.length) o.push(["Common questions", "faqs", id]);
      o.push(["Book a consultation", "book", id, "accent"]);
      if (s.area) o.push(["More " + (area(s.area) || {}).title, "area", s.area]);
      bot(h, backOpts(o));
    },
    price: function (id) {
      var s = svc(id); if (!s) return A.prices();
      if (!s.prices.length) {
        return bot("<p>Prices for <b>" + esc(s.label) + "</b> depend on your project, so we quote after a short consultation.</p>" + consultLine(), backOpts([["Book a consultation", "book", id, "accent"], ["How it works", "service", id]]));
      }
      var h = "<p>Here are our <b>" + esc(s.label) + "</b> prices:</p><ul class=\"qai__prices\">" + s.prices.map(function (p) {
        return "<li><span>" + esc(p.name) + (p.note ? "<small>" + esc(p.note) + "</small>" : "") + "</span><b>" + esc(money(p)) + "</b></li>";
      }).join("") + "</ul>";
      h += '<div class="qai__links">' + link(s.pricing || s.link, "See the full price list") + "</div>";
      bot(h, backOpts([["How it works", "service", id], ["Book a consultation", "book", id, "accent"]]));
    },
    prices: function () {
      var withPrices = D.services.filter(function (s) { return s.prices.length; });
      bot("<p>Which service would you like prices for?</p>", backOpts(withPrices.map(function (s) { return [s.label, "price", s.id]; })));
    },
    faqs: function (id) {
      var s = svc(id); if (!s) return A.home();
      bot("<p>Common questions about <b>" + esc(s.label) + "</b>:</p>", backOpts(s.faqs.slice(0, 8).map(function (f, i) { return [f[0], "faq", id + "|" + i]; })));
    },
    faq: function (arg) {
      var p = String(arg).split("|"), s = svc(p[0]), f = s && s.faqs[+p[1]];
      if (!f) return A.home();
      bot("<p><b>" + esc(f[0]) + "</b></p>" + para(f[1]) + '<div class="qai__links">' + link(s.link, "More about " + s.label) + "</div>",
        backOpts([["More " + s.label + " questions", "faqs", s.id], ["How it works", "service", s.id], ["Book a consultation", "book", s.id, "accent"]]));
    },
    process: function () {
      var h = "<p><b>How working with us works</b></p><ol class=\"qai__steps\">" + D.general.map(function (st) { return "<li><b>" + esc(st[0]) + "</b><span>" + esc(st[1]) + "</span></li>"; }).join("") + "</ol>" +
        "<p>Every service starts with a 1-to-1 consultation, so we can plan the right steps for you. Pick a service to see its exact process.</p>";
      bot(h + tiles(), homeOpts().filter(function (o) { return o[1] !== "process"; }));
    },
    book: function (id) {
      var s = id && svc(id);
      var h = s ? "<p>Book a consultation about <b>" + esc(s.label) + "</b>. You choose the date and time, pay securely, and get a confirmation by email.</p>"
                : "<p>You can book a 1-to-1 consultation online: choose the topic, date and time, pay securely and get a confirmation by email.</p>";
      if (!s) h += '<ul class="qai__prices">' + D.consult.map(function (c) { return "<li><span>" + esc(c.name) + "<small>" + c.minutes + " minutes</small></span></li>"; }).join("") + "</ul>";
      h += '<div class="qai__links">' + link(bookHref(s ? s.id : ""), "Book a consultation", "qai__link--btn") + "</div>";
      bot(h, backOpts([["Free assessment", "go", D.links.assessment || "/assessment"], ["Talk to our team", "human"]]));
    },
    university: function () {
      var h = "<p><b>Qalb-E-Abbas University</b>: live online courses with 1-to-1 guidance:</p><ul class=\"qai__list\">" +
        D.courses.map(function (c) { return "<li><b>" + esc(c.name) + "</b><span>" + esc(c.desc) + "</span></li>"; }).join("") + "</ul>" +
        "<p>Enrolment starts with a short 1-to-1 consultation to choose the right course.</p>" +
        '<div class="qai__links">' + link(D.links.university || "/university", "See all courses") + link(bookHref("university"), "Book a course consultation") + "</div>";
      bot(h, backOpts([["Free assessment", "go", D.links.assessment || "/assessment"]]));
    },
    human: function () {
      var c = D.contact || {};
      var h = "<p>Our team is happy to help. Email us and we'll reply within one working day" + (c.hours ? " (" + esc(c.hours) + ")" : "") + ".</p>" + emailCard() +
        '<p class="qai__small">Or leave your question here and we\'ll email you back:</p>' + form();
      bot(h, backOpts([["Book a consultation", "book", "", "accent"]]), function () {
        if (state.lastQ && !/\b(contact|e-?mail|mail|reach|talk|team|number|phone|call|whatsapp|human|person|agent)\b/i.test(state.lastQ)) prefill(state.lastQ);
      });
    },
    email: function () {
      bot("<p>You can email our team any time. We reply within one working day" + (D.contact && D.contact.hours ? " (" + esc(D.contact.hours) + ")" : "") + ".</p>" + emailCard(),
        backOpts([["Leave a message here", "human"], ["Book a consultation", "book", "", "accent"]]));
    },
    go: function (href) { if (href) location.href = href; },
    custom: function (id) {
      var x = null;
      R.answers.forEach(function (a) { if (a.id === id) x = a; });
      if (!x) return A.home();
      bot("<p><b>" + esc(x.q) + "</b></p>" + para(x.a) + (x.link ? '<div class="qai__links">' + link(x.link, x.label || "Learn more") + "</div>" : ""), backOpts([["Book a consultation", "book", "", "accent"], ["Talk to our team", "human"]]));
    }
  };
  function emailAddr() { return (D.contact && D.contact.email) || "contact@qalbeabbas.com"; }
  function emailCard() {
    var e = esc(emailAddr()), subj = encodeURIComponent("Question from the website");
    return '<div class="qai__mail"><span class="qai__mail-ic">' + icon("mail") + '</span><div><small>Email us at</small><a href="mailto:' + e + "?subject=" + subj + '">' + e + "</a></div>" +
      '<button type="button" class="qai__copy" data-copy="' + e + '" aria-label="Copy email address">Copy</button></div>';
  }
  function prefill(text) {
    var fs = log.querySelectorAll(".qai__form2"), m = fs.length && fs[fs.length - 1].querySelector("textarea");
    if (m && text) m.value = text;
  }
  function consultLine() { return "<p>A consultation is 30–60 minutes, 1-to-1, and you get a clear plan for your next steps.</p>"; }
  function form() {
    return '<form class="qai__form2" novalidate><input name="name" placeholder="Your name" autocomplete="name" required maxlength="120">' +
      '<input name="email" type="email" placeholder="Your email" autocomplete="email" required maxlength="200">' +
      '<textarea name="message" rows="3" placeholder="Your question" required maxlength="2000"></textarea>' +
      '<input name="website" tabindex="-1" autocomplete="off" class="qai__hp" aria-hidden="true">' +
      '<button class="qai__send2" type="submit">Send to the team</button><p class="qai__status" role="status"></p></form>';
  }

  /* ---------- Understanding typed questions ------------------------------- */
  var STOP = ("a an the is are am be to of in on at for and or with my me i you your we our us it this that do does did can could would should will " +
    "please pls plz hi hello hey salam aoa assalam alaikum want need know tell about get have has how what which who when where why " +
    "kya hai hain ka ki ke ko se mein mai main mujhe hum ap aap apka apki ye yeh wo woh karna karne karni kar kr bhi tha thi " +
    "help helps offer offers offering provide provides service services management manage account accounts business online like any some " +
    "also just really very much more get got give anything something im ive dont").split(" ");
  var INTENTS = {
    price: "price prices pricing cost costs fee fees charge charges rate rates package packages plan plans much budget kitna kitne kitni qeemat qimat paisa paise rupees dollar pound",
    process: "process steps step procedure start started begin works working work how tarika tareeqa kaise kese kaisay method timeline long time days weeks",
    book: "book booking consultation consult appointment meeting call schedule session slot",
    human: "contact email phone number human agent person team talk speak support baat",
    university: "course courses university class classes training learn learning teach teaching seekhna seekhain mentorship programme program enrol enroll"
  };
  var intentOf = {};
  Object.keys(INTENTS).forEach(function (k) { INTENTS[k].split(" ").forEach(function (w) { (intentOf[w] = intentOf[w] || []).push(k); }); });

  function words(s) {
    return String(s || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9؀-ۿ]+/g, " ").split(" ").filter(function (w) { return w && w.length > 1 && STOP.indexOf(w) < 0; })
      .map(function (w) { return w.length > 4 ? w.replace(/(ies)$/, "y").replace(/(es|s)$/, "") : w; });
  }
  function bag(s) { var o = {}; words(s).forEach(function (w) { o[w] = 1; }); return o; }
  function hits(q, b) {
    var n = 0;
    q.forEach(function (w) {
      if (b[w]) n += 1;
      else if (w.length >= 4) for (var k in b) if (k.length >= 4 && (k.indexOf(w) === 0 || w.indexOf(k) === 0)) { n += 0.6; break; }
    });
    return n;
  }
  var INDEX = null;
  function index() {
    if (INDEX) return INDEX;
    INDEX = { svc: [], faq: [] };
    D.services.forEach(function (s) {
      INDEX.svc.push({ s: s, b: bag(s.short + " " + s.label + " " + s.name + " " + s.keywords), own: bag(s.short + " " + s.label + " " + s.keywords) });
      s.faqs.forEach(function (f, i) { INDEX.faq.push({ s: s, i: i, q: bag(f[0]), a: bag(f[1]) }); });
    });
    return INDEX;
  }

  function understand(text) {
    var q = words(text);
    var intents = {};
    q.forEach(function (w) { (intentOf[w] || []).forEach(function (k) { intents[k] = 1; }); });
    var topic = q.filter(function (w) { return !intentOf[w]; });
    var ix = index();

    // 1) Answers written in the admin come first.
    var bestC = null, bestCs = 0;
    R.answers.forEach(function (a) {
      var sc = hits(q, bag(a.q + " " + a.keywords)) / Math.max(1.5, Math.sqrt(q.length));
      if (sc > bestCs) { bestCs = sc; bestC = a; }
    });
    if (bestC && bestCs >= 0.7) return { act: "custom", arg: bestC.id, title: bestC.q, id: "custom:" + bestC.id };

    // Short "what's your email / contact" questions go straight to the email answer.
    if (/\b(e-?mail|mail|gmail)\b/i.test(text) && q.length <= 6) return { act: "email", title: "Email us", id: "email" };
    if (/\b(contact|reach)\b/i.test(text) && q.length <= 5 && !bestC) return { act: "human", title: "Talk to our team", id: "human" };

    // 2) Which service is this about?
    var bestS = null, bestSs = 0;
    ix.svc.forEach(function (x) { var sc = hits(topic, x.b); if (sc > bestSs) { bestSs = sc; bestS = x.s; } });
    if (bestSs < 1) bestS = null;

    // 3) Best matching FAQ.
    var bestF = null, bestFs = 0;
    ix.faq.forEach(function (x) {
      var sc = hits(q, x.q) * 1.4 + hits(q, x.a) * 0.35 + (bestS && x.s === bestS ? 0.8 : 0);
      if (sc > bestFs) { bestFs = sc; bestF = x; }
    });
    var faqStrong = bestF && bestFs / Math.max(2, q.length) >= 0.75 && bestFs >= 2.4;

    // A question that only names a service ("dubai company", "amazon fba process") gets the service
    // overview with its step-by-step process; a more specific question gets the matching FAQ.
    if (bestS && faqStrong) {
      var own = ix.svc.filter(function (x) { return x.s === bestS; })[0].own;
      var extra = q.filter(function (w) { return !own[w] && !intentOf[w]; });
      if (hits(extra, bestF.q) < 1) faqStrong = false;
    }
    if (bestS && intents.price) return { act: "price", arg: bestS.id, title: bestS.label + " prices", id: "price:" + bestS.id };
    if (bestS && intents.book) return { act: "book", arg: bestS.id, title: "Book: " + bestS.label, id: "book:" + bestS.id };
    if (faqStrong) return { act: "faq", arg: bestF.s.id + "|" + bestF.i, title: bestF.s.faqs[bestF.i][0], id: "faq:" + bestF.s.id + ":" + bestF.i };
    if (bestS) return { act: "service", arg: bestS.id, title: bestS.label, id: "service:" + bestS.id };
    if (bestF && bestFs >= 1.4 && hits(topic, bestF.q) >= 1) return { act: "faq", arg: bestF.s.id + "|" + bestF.i, title: bestF.s.faqs[bestF.i][0], id: "faq:" + bestF.s.id + ":" + bestF.i };
    if (intents.university) return { act: "university", title: "University courses", id: "university" };
    if (intents.book) return { act: "book", title: "Book a consultation", id: "book" };
    if (intents.price) return { act: "prices", title: "Prices", id: "prices" };
    if (/\b(e-?mail|mail|gmail)\b/i.test(text)) return { act: "email", title: "Email us", id: "email" };
    if (intents.human) return { act: "human", title: "Talk to our team", id: "human" };
    if (intents.process) return { act: "process", title: "How it works", id: "process" };
    if (bestF && bestFs >= 2) return { act: "faq", arg: bestF.s.id + "|" + bestF.i, title: bestF.s.faqs[bestF.i][0], id: "faq:" + bestF.s.id + ":" + bestF.i };
    return null;
  }

  /* ---------- Everyday conversation (English + Roman Urdu) ---------------- */
  var GREETING = /^(hi+|hello+|helo|hey+|hiya|a?s+ala+m(\s*[ou])?(\s*w?\s*[ae]?l[ae]i?kum)?|sala+m|aoa|slam|good (morning|afternoon|evening)|greetings)\b[\s,!.]*/i;
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function smallTalk(raw) {
    var t = raw.toLowerCase().replace(/[^a-z0-9\s']/g, " ").replace(/\s+/g, " ").trim();
    var salam = /\b(salam|salaam|assalam|asalam|aoa|slam)\b/.test(t);
    var greeted = GREETING.test(t);
    var rest = t.replace(GREETING, "").replace(/^(there|sir|madam|team|bro|dear|ji)\b\s*/, "").trim();
    var hello = salam ? "Wa alaikum assalam! " : (greeted ? pick(["Hello! ", "Hi there! ", "Hey! "]) : "");
    var howAreYou = /^(how (are|r) (you|u)|how're you|how you doing|how is it going|how's it going|kaise? ho|kese ho|kaisay ho|kia haal|kya haal|kya hal|kia hal|haal chaal|ap kaise|aap kaise|aap kaisay|ap kese)/;
    if (!rest && greeted) return hello + "\u{1F44B} How can I help you today?";
    if (howAreYou.test(rest)) return hello + pick(["I'm doing well, thank you for asking! \u{1F60A}", "All good here, thanks for asking! \u{1F60A}"]) + " How can I help you today?";
    if (/^(i'?m |i am |me )?(fine|good|great|well|theek|thik|alhamdulillah|alhamdolillah)( too| also| thanks| thank you| hun| hoon)*$/.test(rest)) return "Glad to hear that! \u{1F60A} What can I help you with today?";
    if (/^(thanks|thank you|thank u|thx|ty|shukriya|shukria|jazakallah|jazak allah|meherbani|bohat shukriya)( so much| a lot| very much)?$/.test(rest)) return pick(["You're very welcome! Is there anything else I can help with?", "My pleasure! Anything else you'd like to know?"]);
    if (/^(bye|goodbye|good bye|allah hafiz|khuda hafiz|see you|take care|ok bye)$/.test(rest)) return "Allah Hafiz! Thanks for stopping by, feel free to come back any time. \u{1F44B}";
    if (/^(ok|okay|k|alright|great|nice|cool|good|perfect|got it|theek hai|thik hai|acha|achha|accha)$/.test(rest)) return "Great! What would you like to know next?";
    if (/^(yes|yeah|yep|haan|han|ji|jee|ji haan)$/.test(rest)) return "Sure, what would you like to know? You can pick a topic below or type your question.";
    if (/^(no|nope|nahi|nahin|no thanks|nothing)$/.test(rest)) return "No problem at all. I'm here if you need anything. \u{1F60A}";
    if (/(are you|r u|ru|is this|am i (talking|chatting) (to|with)) (a |an )?(bot|robot|ai|human|real|person|machine|chatbot)|\b(bot|robot|ai) (ho|hai|hain)\b|insaan ho/.test(rest)) return "I'm Qalb-E-Abbas's automated assistant, so I can answer straight away, any time. For anything personal to your case, our real team is right behind me, tap <b>Talk to our team</b> and they'll reply by email within one working day.";
    if (/^(who are you|what('s| is) your name|your name|ap kon|aap kon|tum kon|ap ka naam|aap ka naam)/.test(rest)) return "I'm the Qalb-E-Abbas assistant. I can explain our services, prices and the step-by-step process — and pass your message to our team whenever you'd like to talk to a person.";
    if (/\b(where are you|location|located|address|office|kahan ho|kahan hai|kidhar)\b/.test(rest) && !/\b(company|llc|ltd|formation)\b/.test(rest)) return "We're based in " + esc((D.contact && D.contact.location) || "the United Kingdom") + ", and we work with clients worldwide online. Most consultations happen by video call.";
    if (/\b(timing|timings|hours|open|opening|working hours|available|kab tak|kab)\b/.test(rest) && rest.split(" ").length <= 8) return "Our team works " + esc((D.contact && D.contact.hours) || "Monday–Friday, 10:00–18:00 UK time") + ". I'm here 24/7 for quick answers, and you can book a consultation online any time.";
    if (/^(help|madad|help me|i need help|mujhe madad chahiye)$/.test(rest)) return "Of course! Tell me what you're looking for, or choose an area below. \u{1F447}";
    return greeted ? { hello: hello, rest: rest } : null;
  }

  var misses = 0;
  function ask(text) {
    text = String(text || "").trim().slice(0, 300);
    if (!text) return;
    add("user", esc(text));
    var st = smallTalk(text), prefix = "";
    if (typeof st === "string") {
      track(text, "smalltalk", "Small talk", "typed");
      return bot("<p>" + st + "</p>", /help|madad|Of course/.test(st) ? homeOpts() : null, null, /Of course/.test(st));
    }
    if (st && st.rest) { prefix = st.hello; text = st.rest; }
    state.lastQ = text;
    var r = understand(text);
    track(text, r ? r.id : "", r ? r.title : "", "typed");
    if (!r) {
      misses++;
      if (misses < 2) {
        bot("<p>" + esc(prefix) + "Hmm, I'm not completely sure I understood that. Could you tell me a little more: for example, which service it's about?</p><p>Or, if you prefer, email our team directly and they'll reply to you personally:</p>" + emailCard(),
          backOpts([["Pass it to the team", "human"], ["Book a consultation", "book", "", "accent"]]));
      } else {
        bot("<p>I'd rather not guess on this one, let me get our team to answer you properly. Email them directly, or add your name and email below and they'll reply within one working day.</p>" + emailCard() + form(),
          backOpts([["Book a consultation", "book", "", "accent"]]), function () { prefill(text); });
      }
      return;
    }
    misses = 0;
    A[r.act](r.arg);
  }

  /* ---------- Panel ------------------------------------------------------- */
  function build() {
    el = document.createElement("div");
    el.className = "qai";
    el.id = "qa-assistant";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", R.name);
    el.hidden = true;
    el.innerHTML = '<header class="qai__head"><span class="qai__logo">' + MARK + '<i aria-hidden="true"></i></span><div class="qai__title"><b>' + esc(R.name) + '</b><small>Online now · instant replies</small></div>' +
      '<button type="button" class="qai__icon" data-reset aria-label="Start again" title="Start again"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
      '<button type="button" class="qai__icon" data-close aria-label="Close">' + icon("close") + "</button></header>" +
      '<div class="qai__log" aria-live="polite"></div><div class="qai__chips"></div>' +
      '<form class="qai__ask"><input type="text" name="q" placeholder="Type your question…" autocomplete="off" maxlength="300" aria-label="Your question"><button type="submit" aria-label="Send">' + icon("arrow-right") + "</button></form>" +
      '<p class="qai__foot">' + icon("info") + '<span>Instant replies are automated · our team: <a href="mailto:' + esc(emailAddr()) + '">' + esc(emailAddr()) + '</a></span></p>';
    document.body.appendChild(el);
    log = el.querySelector(".qai__log"); chips = el.querySelector(".qai__chips"); input = el.querySelector(".qai__ask input");

    el.querySelector("[data-close]").addEventListener("click", close);
    el.querySelector("[data-reset]").addEventListener("click", function () { state.log = []; log.innerHTML = ""; greet(); input.focus(); });
    el.querySelector(".qai__ask").addEventListener("submit", function (e) { e.preventDefault(); if (busy) return; var v = input.value; input.value = ""; ask(v); });
    chips.addEventListener("click", function (e) {
      var b = e.target.closest(".qai__chip"); if (!b || busy) return;
      var o = state.opts[+b.dataset.i]; if (!o) return;
      if (o[1] !== "go") { add("user", esc(o[0])); track(o[0], o[1] + (o[2] ? ":" + o[2] : ""), o[0], "button"); }
      A[o[1]](o[2]);
    });
    log.addEventListener("submit", sendForm);
    log.addEventListener("click", function (e) {
      var b = e.target.closest(".qai__copy"); if (!b) return;
      var v = b.getAttribute("data-copy"), done = function () { b.textContent = "Copied"; setTimeout(function () { b.textContent = "Copy"; }, 1800); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(done, function () { window.prompt("Copy the email address:", v); });
      else window.prompt("Copy the email address:", v);
    });
    log.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]"); if (!b || busy || !A[b.dataset.act]) return;
      add("user", esc(b.dataset.label || b.textContent));
      track(b.dataset.label || b.textContent, b.dataset.act + ":" + (b.dataset.arg || ""), b.dataset.label || b.textContent, "button");
      A[b.dataset.act](b.dataset.arg);
    });
    // Phones: keep the panel above the on-screen keyboard.
    if (window.visualViewport) {
      var fit = function () {
        if (el.hidden || !window.matchMedia("(max-width: 639px)").matches) { el.style.height = ""; el.style.top = ""; return; }
        el.style.height = window.visualViewport.height + "px";
        el.style.top = window.visualViewport.offsetTop + "px";
        log.scrollTop = log.scrollHeight;
      };
      window.visualViewport.addEventListener("resize", fit);
      window.visualViewport.addEventListener("scroll", fit);
      el.__fit = fit;
    }
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !el.hidden) close(); });
  }
  function greet() {
    var w = R.welcome || "Hi there! \u{1F44B} Welcome to Qalb-E-Abbas. How can we help you today? Ask me anything about our services, prices or how to get started.";
    bot(para(w) + tiles());
  }
  function sendForm(e) {
    var f = e.target.closest(".qai__form2"); if (!f) return;
    e.preventDefault();
    var st = f.querySelector(".qai__status"), btn = f.querySelector("button");
    var fd = new FormData(f);
    if (String(fd.get("name") || "").trim().length < 2) { st.textContent = "Please enter your name."; return; }
    if (!/^\S+@\S+\.\S+$/.test(String(fd.get("email") || ""))) { st.textContent = "Please enter a valid email address."; return; }
    if (String(fd.get("message") || "").trim().length < 5) { st.textContent = "Please write your question."; return; }
    fd.append("source", "Website assistant"); fd.append("subject", "Question from the website assistant"); fd.append("topic", location.pathname);
    btn.disabled = true; st.textContent = "Sending…";
    fetch(API + "/enquiry.php", { method: "POST", body: fd, headers: { Accept: "application/json" } })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .then(function (j) {
        if (j.ok) {
          f.outerHTML = '<p class="qai__done">' + icon("check-circle") + "Thank you! Your question was sent" + (j.ref ? " (ref " + esc(j.ref) + ")" : "") + ". We'll reply by email within one working day.</p>";
          state.log[state.log.length - 1].h = log.lastElementChild.querySelector(".qai__bubble").innerHTML; save();
        } else { btn.disabled = false; st.textContent = j.error || "Sorry, that didn't send. Please email us instead."; }
      })
      .catch(function () { btn.disabled = false; st.textContent = "Sorry, that didn't send. Please email us instead."; });
  }

  function open() {
    if (!el) build();
    if (!log.childNodes.length) {
      if (state.log.length) { state.log.forEach(function (m) { paint(m.w, m.h); }); options(state.opts && state.opts.length ? state.opts : homeOpts()); }
      else greet();
    }
    el.hidden = false;
    if (el.__fit) el.__fit();
    document.documentElement.classList.add("qai-open");
    state.open = true; save();
    var launch = document.querySelector(".qai-launch"); if (launch) launch.setAttribute("aria-expanded", "true");
    setTimeout(function () { log.scrollTop = log.scrollHeight; if (window.matchMedia("(min-width: 640px)").matches) input.focus(); }, 30);
  }
  function close() {
    if (!el) return;
    el.hidden = true;
    document.documentElement.classList.remove("qai-open");
    state.open = false; save();
    var launch = document.querySelector(".qai-launch"); if (launch) { launch.setAttribute("aria-expanded", "false"); launch.focus(); }
  }

  try { state = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (e) { state = null; }
  if (!state || !Array.isArray(state.log)) state = { log: [], opts: [], open: false };

  window.qaAssistant = {
    open: open, close: close,
    toggle: function () { if (el && !el.hidden) close(); else open(); },
    isOpen: function () { return !!(el && !el.hidden); },
    match: function (q) { return understand(q); },
    talk: function (q) { return smallTalk(q); },
    configure: function (r) {
      if (!r) return;
      if (r.name) R.name = r.name;
      if (r.welcome) R.welcome = r.welcome;
      if (Array.isArray(r.answers)) R.answers = r.answers;
    }
  };

  // Live prices (if changed in Admin → Prices).
  try {
    fetch(API + "/prices.php", { headers: { Accept: "application/json" } }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (p) { if (p && p.ok && p.items) LIVE = p.items; }).catch(function () {});
  } catch (e) { /* ignore */ }
})();
