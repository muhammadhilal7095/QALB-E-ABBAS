/* ==========================================================================
   Seller Readiness Assessment (assessment.html)

   1. Triage questions decide an adaptive path and the order of the next
      sections.
   2. Answers are scored per area (0–3 per question) and checked for red flags.
   3. The result shows a readiness level, area scores, top blockers and the
      safest next step, and is saved to the booking app (Admin → Assessments).

   Progress is kept in sessionStorage so a refresh doesn't lose answers.
   ========================================================================== */
(function () {
  "use strict";

  var root = document.getElementById("sra");
  if (!root) return;

  // ---- Questions ----------------------------------------------------------
  // s = score per option (0 weakest … 3 strongest); omitted = not scored.
  var Q = {
    Q01: { q: "Where are you based?", cols: 2, o: ["Canada", "United States", "United Kingdom", "Australia", "Germany", "France", "Italy", "Spain", "Netherlands", "India", "Pakistan", "United Arab Emirates", "Another country or region"] },
    Q02: { q: "Which Amazon marketplace are you primarily interested in?", cols: 2, o: ["Amazon Canada", "Amazon United States", "Both Canada and the United States", "Amazon United Kingdom", "Amazon Australia", "Another European Amazon marketplace", "Another Amazon marketplace", "I am not sure yet"] },
    Q07: { q: "Which statement best describes where you are in your Amazon seller journey right now?", o: ["Exploring whether Amazon is right for me", "Building my foundation", "Validating a product or sourcing path", "Preparing to launch", "Launched and working toward stable sales", "Scaling or protecting an active business"] },
    Q08: { q: "What is the status of the product you are working on now?", o: ["I do not have a product yet", "I have a product idea only", "I am comparing suppliers, samples, or quotes", "I selected a product but have not ordered inventory", "I ordered inventory or am preparing the listing", "The product is live but not yet stable", "The product is live and established", "I am an active seller evaluating another new product"] },
    Q12: { q: "What experience do you already have with e-commerce?", o: ["None yet", "I have studied or trained but have not sold", "I have sold on another marketplace or my own website", "I sold on Amazon before but am not currently active", "I currently sell on Amazon", "I have worked as a service provider for sellers"], s: [0, 1, 2, 2, 3, 2] },
    Q15: { q: "Is any urgent issue active right now?", o: ["No urgent issue", "Account deactivation or suspension", "Listing removal or product restriction", "Intellectual-property complaint or legal notice", "Account-health warning or policy violation", "Payment, identity, or document-verification problem", "I am not sure"] },

    Q09: { q: "Which Amazon business model are you currently planning to use?", o: ["Private label", "Wholesale", "Handmade or custom products", "Retail or online arbitrage", "Dropshipping", "Another model", "I am not sure yet"] },
    Q10: { q: "How complete is your product-cost and profit calculation?", hint: "A complete estimate includes landed cost, marketplace fees, expected advertising, returns or allowances, margin, and reorder cash. It does not prove profitability.", o: ["I have not calculated the complete economics", "I have only a rough cost or margin estimate", "I completed an estimate including all major costs and reorder cash", "I have actual operating data from a live product"], s: [0, 1, 2, 3] },
    Q20: { q: "Which statement best describes the supplier and invoice evidence available for your current product or sourcing path?", o: ["The supplier will not provide authentic or usable commercial evidence", "I have not checked the supplier evidence yet", "The supplier appears verifiable, but the evidence is incomplete or unconfirmed", "Supplier identity and invoice capability are confirmed in the correct buyer name"], s: [0, 1, 2, 3] },

    Q03: { q: "After paying your bills and keeping emergency savings untouched, how much separate money could you safely invest in this business?", hint: "Choose only money you can afford to put at risk. Budget bands are approximate local equivalents and do not estimate profitability.", o: "budget", s: [0, 1, 1, 2, 3, 3] },
    Q04: { q: "Where would this business budget come from?", o: ["Household, emergency, borrowed, rent, or bill money", "Credit or a loan that must be repaid quickly", "Savings while continuing current income", "Protected personal savings or business funds"], s: [0, 0, 2, 3] },
    Q05: { q: "How soon would you need this business to produce profit?", o: ["I need profit for current bills", "I feel strong pressure for quick profit", "I can wait 3–6 months to learn and improve", "I am building for the long term"], s: [0, 1, 2, 3] },
    Q06: { q: "How much time can you consistently give this business each week?", o: ["Under 3 hours", "3–5 hours", "6–10 hours", "More than 10 hours"], s: [0, 1, 2, 3] },
    Q11: { q: "Which statement best describes how you would follow a weekly Amazon work plan?", o: ["I do not currently have regular time or a plan", "I can work occasionally but not consistently", "I can follow a weekly schedule with guidance", "I already use a consistent weekly plan and review process"], s: [0, 1, 2, 3] },

    Q16: { q: "Which statement best describes how you currently see an Amazon business?", o: ["I want quick or easy money", "I am unsure how serious I am", "I am willing to learn and follow a process", "I think long term and want to build a real business"], s: [0, 1, 2, 3] },
    Q17: { q: "If a product, listing, or campaign does not work as expected, what are you most likely to do?", o: ["I would probably quit if things go wrong", "I would need strong guidance", "I can pause, learn, and adjust", "I solve problems systematically and keep improving"], s: [0, 1, 2, 3] },
    Q18: { q: "Before paying a supplier, which statement best describes what you would do?", o: ["I would buy first and check risk later", "I know risk matters but do not know what to check", "I am willing to check product, IP, and document risk before buying", "I will not buy inventory until risk is reviewed first"], s: [0, 1, 2, 3] },
    Q19: { q: "For the Amazon seller account you plan to use, how ready are your identity, business, address, and bank documents?", o: ["Some documents are borrowed, missing, or show conflicting information", "I own the documents, but several are missing, outdated, or do not match", "I have most current original documents, with one gap I can explain", "I have all current original documents, and the main names and addresses match"], s: [0, 1, 2, 3] },
    Q21: { q: "Which statement best describes your understanding of supplier and Amazon documents?", o: ["I do not know what documents Amazon may ask for", "I know documents matter but I am not prepared", "I partly understand invoices and supplier documents", "I understand invoice, authorization, category, and compliance-document risks"], s: [0, 1, 2, 3] },
    Q22: { q: "When are you hoping to take your next major step?", o: ["Immediately, without more preparation", "Within one month, but I still need guidance", "In 1–3 months after preparation", "In more than 3 months, and I am willing to prepare properly"], s: [0, 1, 2, 3] },

    Q13: { q: "What would be the most useful outcome for you over the next 12 months?", o: ["Decide whether Amazon is right for me", "Build the knowledge and setup needed to start properly", "Choose and verify a product before spending money", "Prepare a selected product for launch", "Get my first consistent sales and stable operations", "Improve or protect my existing account", "Expand by adding new products", "Resolve an urgent listing or account problem"] },
    Q14: { q: "What is the biggest obstacle slowing you down right now?", o: ["I do not know where to start", "I do not have a safe budget", "I am unsure how to choose a product", "I am unsure about suppliers or documents", "I am worried about compliance or intellectual property", "I need help preparing the listing or launch", "I need help with sales, advertising, or inventory", "I struggle to find consistent time", "I have an active listing or account issue", "Something else"] }
  };

  var SECTIONS = {
    triage: { title: "Current position and urgent triage", sub: "Your answers here determine which readiness section comes next.", q: ["Q01", "Q02", "Q07", "Q08", "Q12", "Q15"] },
    product: { title: "Product decision readiness", q: ["Q09", "Q10", "Q20"] },
    financial: { title: "Financial and execution capacity", q: ["Q03", "Q04", "Q05", "Q06", "Q11"] },
    risk: { title: "Risk and document discipline", q: ["Q16", "Q17", "Q18", "Q19", "Q21", "Q22"] },
    goals: { title: "Goals and blockers", q: ["Q13", "Q14"] },
    details: { title: "Your details and consent", q: [] }
  };

  var PATHS = {
    protection: { name: "Account Protection", order: ["risk", "goals", "financial", "product"] },
    foundation: { name: "Foundation", order: ["financial", "goals", "risk", "product"] },
    validation: { name: "Product Validation", order: ["product", "financial", "risk", "goals"] },
    launch: { name: "Launch Preparation", order: ["risk", "product", "financial", "goals"] },
    growth: { name: "Growth & Protection", order: ["goals", "product", "risk", "financial"] }
  };

  var AREAS = [
    ["Financial safety", ["Q03", "Q04", "Q05"]],
    ["Time and execution", ["Q06", "Q11", "Q22"]],
    ["Product and supplier", ["Q10", "Q20"]],
    ["Risk and documents", ["Q18", "Q19", "Q21"]],
    ["Mindset and experience", ["Q12", "Q16", "Q17"]]
  ];

  // Budget bands in the local currency of the country chosen in Q01 (approximate equivalents).
  var CUR = {
    "Canada": ["CAD", [1000, 3000, 20000, 50000]],
    "United States": ["USD", [750, 2000, 15000, 35000]],
    "United Kingdom": ["GBP", [600, 1700, 12000, 30000]],
    "Australia": ["AUD", [1100, 3300, 22000, 55000]],
    "Germany": ["EUR", [700, 2000, 14000, 34000]], "France": ["EUR", [700, 2000, 14000, 34000]], "Italy": ["EUR", [700, 2000, 14000, 34000]],
    "Spain": ["EUR", [700, 2000, 14000, 34000]], "Netherlands": ["EUR", [700, 2000, 14000, 34000]],
    "India": ["INR", [60000, 180000, 1200000, 3000000]],
    "Pakistan": ["PKR", [200000, 600000, 4000000, 10000000]],
    "United Arab Emirates": ["AED", [2750, 7500, 55000, 130000]]
  };
  function budgetOptions() {
    var c = CUR[answerText("Q01")] || ["USD", [750, 2000, 15000, 35000]];
    var f = function (n) { return c[0] + " " + n.toLocaleString("en-US"); };
    var b = c[1];
    return ["I do not have a separate safe budget yet", "Under " + f(b[0]), f(b[0]) + " to " + f(b[1]), f(b[1]) + " to " + f(b[2]), f(b[2]) + " to " + f(b[3]), "More than " + f(b[3])];
  }

  // ---- State ----------------------------------------------------------------
  var KEY = "qa_sra_v1";
  var state = { answers: {}, step: 0, path: null, details: {} };
  try { var saved = JSON.parse(sessionStorage.getItem(KEY) || "null"); if (saved && saved.answers) state = saved; } catch (e) { /* ignore */ }
  function persist() { try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } }

  function opts(id) { return Q[id].o === "budget" ? budgetOptions() : Q[id].o; }
  function idx(id) { return state.answers[id] == null ? -1 : state.answers[id]; }
  function answerText(id) { var i = idx(id); return i < 0 ? "" : opts(id)[i]; }

  function decidePath() {
    var urgent = idx("Q15"), stage = idx("Q07"), product = idx("Q08");
    if (urgent >= 1 && urgent <= 5) return "protection";
    if (product >= 5 || stage >= 4) return "growth";
    if (product === 4 || stage === 3) return "launch";
    if (product >= 2 || stage === 2) return "validation";
    return "foundation";
  }
  function order() {
    var p = state.path ? PATHS[state.path].order : [];
    return ["triage"].concat(p, ["details"]);
  }

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
    var q = Q[id], list = opts(id), cur = idx(id);
    var cols = q.cols === 2 ? " sra-opts--2" : "";
    return '<fieldset class="sra-q" id="q-' + id + '" data-q="' + id + '">' +
      '<legend class="sra-q__title"><span class="sra-q__id">' + id + "</span>" + esc(q.q) + "</legend>" +
      (q.hint ? '<p class="sra-q__hint">' + esc(q.hint) + "</p>" : "") +
      '<div class="sra-opts' + cols + '">' + list.map(function (label, i) {
        return '<label class="sra-opt"><input type="radio" name="' + id + '" value="' + i + '"' + (cur === i ? " checked" : "") + "><span>" + esc(label) + "</span></label>";
      }).join("") + "</div>" +
      '<p class="sra-q__err" role="alert" hidden>Please choose an answer to continue.</p></fieldset>';
  }

  function detailsHTML() {
    var d = state.details;
    var sel = function (name, list) {
      return '<select id="d-' + name + '" name="' + name + '">' + list.map(function (o) { return "<option" + (d[name] === o ? " selected" : "") + ">" + esc(o) + "</option>"; }).join("") + "</select>";
    };
    return '<div class="sra-grid">' +
      '<div class="sra-field"><label for="d-firstName">First name</label><input id="d-firstName" name="firstName" autocomplete="given-name" required value="' + esc(d.firstName) + '"></div>' +
      '<div class="sra-field"><label for="d-lastName">Last name</label><input id="d-lastName" name="lastName" autocomplete="family-name" required value="' + esc(d.lastName) + '"></div>' +
      '<div class="sra-field sra-field--full"><label for="d-email">Email</label><input id="d-email" name="email" type="email" autocomplete="email" required value="' + esc(d.email) + '"></div>' +
      '<div class="sra-field"><label for="d-phone">Phone <span>(optional)</span></label><input id="d-phone" name="phone" type="tel" autocomplete="tel" value="' + esc(d.phone) + '"></div>' +
      '<div class="sra-field"><label for="d-ageGroup">Age group <span>(optional)</span></label>' + sel("ageGroup", ["Prefer not to say", "18–24", "25–34", "35–44", "45–54", "55–64", "65 or over"]) + "</div>" +
      '<div class="sra-field"><label for="d-gender">Gender <span>(optional)</span></label>' + sel("gender", ["Prefer not to say", "Female", "Male", "Another identity"]) + "</div>" +
      "</div>" +
      '<div class="sra-save">' + icon("shield") + "<p><strong>How we use your answers:</strong> When you see your result, your answers and contact details are saved securely so our team can review them before any consultation, and we email you a copy of your result. This does not subscribe you to marketing.</p></div>" +
      '<label class="sra-check"><input type="checkbox" name="marketingOptIn"' + (d.marketingOptIn ? " checked" : "") + "><span>I would like to receive relevant educational updates. This is optional.</span></label>" +
      '<label class="sra-check"><input type="checkbox" name="truthful"' + (d.truthful ? " checked" : "") + "><span>I confirm these answers are truthful and that altered, borrowed, or fabricated evidence must not be used.</span></label>" +
      '<p class="sra-q__err" data-details-err role="alert" hidden></p>';
  }

  function render(focus) {
    var o = order();
    if (state.step >= o.length) state.step = o.length - 1;
    var key = o[state.step], sec = SECTIONS[key];
    var total = 6;
    var isTriage = key === "triage";
    els.result.hidden = true;
    els.progress.hidden = false; els.card.hidden = false; els.nav.hidden = false; els.notice.hidden = false;
    els.stepLabel.textContent = isTriage ? "Triage" : "Section " + (state.step + 1) + " of " + total;
    els.stepTitle.textContent = sec.title;
    var pct = isTriage ? Math.max(6, Math.round(answeredIn(sec.q) / sec.q.length * 16)) : Math.round((state.step + 1) / total * 100);
    els.bar.style.width = pct + "%";
    els.bar.parentNode.setAttribute("aria-valuenow", String(pct));
    els.notice.innerHTML = isTriage
      ? icon("compass") + "<span>Complete this triage section to create your adaptive question path.</span>"
      : icon("layers") + "<span><strong>Adaptive path: " + esc(PATHS[state.path].name) + ".</strong> Section order is now based on your triage answers.</span>";
    els.card.innerHTML = '<h2 class="sra-card__title">' + (state.step + 1) + ". " + esc(sec.title) + "</h2>" +
      (sec.sub ? '<p class="sra-card__sub">' + esc(sec.sub) + "</p>" : "") +
      (key === "details" ? detailsHTML() : sec.q.map(questionHTML).join(""));
    els.nav.innerHTML = (state.step > 0 ? '<button type="button" class="btn btn--outline sra-back" data-back>Back</button>' : "<span></span>") +
      '<button type="submit" class="btn btn--accent sra-next">' + (key === "details" ? "See my readiness result" : "Continue") + icon("arrow-right") + "</button>";
    persist();
    if (focus) root.querySelector(".sra-progress").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function answeredIn(list) { return list.filter(function (id) { return idx(id) >= 0; }).length; }

  // ---- Validation & navigation ---------------------------------------------
  function validateSection() {
    var key = order()[state.step];
    if (key === "details") return validateDetails();
    var firstMissing = null;
    SECTIONS[key].q.forEach(function (id) {
      var fs = root.querySelector("#q-" + id), missing = idx(id) < 0;
      fs.classList.toggle("is-missing", missing);
      fs.querySelector(".sra-q__err").hidden = !missing;
      if (missing && !firstMissing) firstMissing = fs;
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

  root.addEventListener("change", function (e) {
    var t = e.target;
    if (t.type === "radio" && Q[t.name]) {
      state.answers[t.name] = Number(t.value);
      var fs = t.closest(".sra-q"); fs.classList.remove("is-missing"); fs.querySelector(".sra-q__err").hidden = true;
      if (order()[state.step] === "triage") { var pct = Math.max(6, Math.round(answeredIn(SECTIONS.triage.q) / 6 * 16)); els.bar.style.width = pct + "%"; }
      persist();
    } else if (order()[state.step] === "details") { readDetails(); persist(); }
  });
  root.addEventListener("input", function () { if (order()[state.step] === "details") { readDetails(); persist(); } });
  root.addEventListener("click", function (e) {
    if (e.target.closest("[data-back]")) { if (order()[state.step] === "details") readDetails(); state.step = Math.max(0, state.step - 1); render(true); }
    if (e.target.closest("[data-restart]")) { state = { answers: {}, step: 0, path: null, details: {} }; persist(); render(true); }
  });
  root.querySelector("form").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validateSection()) return;
    var key = order()[state.step];
    if (key === "triage") {
      var p = decidePath();
      if (p !== state.path) state.path = p;
    }
    if (key === "details") { finish(); return; }
    state.step++;
    render(true);
  });

  // ---- Scoring --------------------------------------------------------------
  function areaScores() {
    return AREAS.map(function (a) {
      var got = 0, max = 0;
      a[1].forEach(function (id) { var i = idx(id); if (i >= 0 && Q[id].s) { got += Q[id].s[i]; max += 3; } });
      return { area: a[0], score: max ? Math.round(got / max * 100) : 0 };
    });
  }

  function blockers() {
    var f = [];
    var add = function (sev, text) { f.push([sev, text]); };
    var u = idx("Q15");
    if (u >= 1 && u <= 5) add(10, "Resolve the active issue (" + answerText("Q15").toLowerCase() + ") before any new spending or launches.");
    if (u === 6) add(6, "Check Account Health in Seller Central for any active warnings before your next step.");
    if (idx("Q04") === 0) add(9, "Don't use household, emergency, borrowed, rent or bill money for this business.");
    if (idx("Q04") === 1) add(8, "Avoid funding inventory with credit or a loan that must be repaid quickly.");
    if (idx("Q19") === 0) add(9, "Never use borrowed or conflicting documents — verification can fail and lead to account suspension.");
    if (idx("Q19") === 1) add(6, "Update your identity, business, address and bank documents so the names and addresses match.");
    if (idx("Q05") === 0) add(8, "Don't rely on this business to pay current bills — Amazon profit usually takes months to build.");
    if (idx("Q20") === 0) add(8, "Don't buy from a supplier that won't provide authentic commercial invoices.");
    if (idx("Q20") === 1) add(6, "Verify the supplier's identity and invoice capability before paying.");
    if (idx("Q03") === 0) add(7, "Set a separate, safe budget before buying any inventory.");
    if (idx("Q18") === 0) add(7, "Check product, intellectual-property and document risk before paying any supplier.");
    if (idx("Q09") === 4) add(7, "Check Amazon's dropshipping policy carefully — buying from another retailer to ship to your customers isn't allowed.");
    if (idx("Q10") === 0 && idx("Q08") >= 2) add(6, "Calculate the full product economics — landed cost, fees, ads, returns and reorder cash — before ordering.");
    if (idx("Q16") === 0) add(5, "Amazon isn't quick or easy money — plan for months of learning and reinvestment.");
    if (idx("Q22") === 0) add(5, "Slow down: moving immediately without preparation is the most common way new sellers lose money.");
    if (idx("Q21") === 0) add(5, "Learn which invoices and documents Amazon may request before you start.");
    if (idx("Q06") === 0 || idx("Q11") === 0) add(4, "Block out regular weekly time — progress is hard with less than 3 consistent hours a week.");
    f.sort(function (a, b) { return b[0] - a[0]; });
    return f;
  }

  function levelFor(score, flags) {
    var lv = score >= 80 ? 3 : score >= 60 ? 2 : score >= 40 ? 1 : 0;
    if (flags.some(function (x) { return x[0] >= 8; })) lv = Math.min(lv, 1);
    return ["Not ready yet", "Building foundations", "Nearly ready", "Ready to proceed"][lv];
  }

  function nextStep(level) {
    var p = state.path;
    if (p === "protection") return { title: "Resolve the account issue first", text: "Pause new spending and fix the active issue with a clear, documented plan. Our team reviews your account situation and prepares the right appeal or response.", links: [["Book a consultation", "book-consultation.html?topic=amazon", "accent"], ["Account reactivation service", "amazon-fba.html#pricing", "outline"]] };
    if (level === "Not ready yet" || p === "foundation") return { title: "Build your foundations before spending", text: "Learn how Amazon works, set a safe budget and prepare your documents before you choose a product. Start with free learning, then structured one-to-one classes.", links: [["Explore Level 1 training", "index.html#level-1", "accent"], ["Read the Beginner's Guide", "beginners-guide.html", "outline"]] };
    if (p === "validation") return { title: "Validate one product before buying inventory", text: "Confirm demand, competition, full costs and supplier evidence for a single product before you pay for stock. Our researched high-demand product lists are a safe starting point.", links: [["High-demand product research", "amazon-fba.html#pricing", "accent"], ["Book a consultation", "book-consultation.html?topic=amazon", "outline"]] };
    if (p === "launch") return { title: "Check documents and listing before launch", text: "Make sure your account, invoices and listing are compliant and your launch plan, PPC and inventory are ready, so the first weeks build momentum instead of risk.", links: [["Account review", "amazon-fba.html#pricing", "accent"], ["Book a consultation", "book-consultation.html?topic=amazon", "outline"]] };
    return { title: "Protect your account and grow steadily", text: "Strengthen account health, improve advertising efficiency and add products only after the numbers on your current ones are stable.", links: [["Growth strategy & PPC", "amazon-fba.html#pricing", "accent"], ["Book a consultation", "book-consultation.html?topic=amazon", "outline"]] };
  }

  // ---- Finish: show result and save -----------------------------------------
  function finish() {
    var scores = areaScores();
    var overall = Math.round(scores.reduce(function (t, a) { return t + a.score; }, 0) / scores.length);
    var flags = blockers();
    var level = levelFor(overall, flags);
    var top = flags.slice(0, 3).map(function (x) { return x[1]; });
    var next = nextStep(level);
    var answers = {};
    order().forEach(function (k) { SECTIONS[k].q.forEach(function (id) { if (idx(id) >= 0) answers[id] = { question: Q[id].q, answer: answerText(id) }; }); });

    showResult({ scores: scores, overall: overall, level: level, top: top, next: next, saving: true });

    var d = state.details;
    var payload = {
      firstName: d.firstName, lastName: d.lastName, email: d.email, phone: d.phone || null,
      ageGroup: d.ageGroup && d.ageGroup !== "Prefer not to say" ? d.ageGroup : null,
      gender: d.gender && d.gender !== "Prefer not to say" ? d.gender : null,
      marketingOptIn: !!d.marketingOptIn, truthful: true, country: answerText("Q01"),
      path: PATHS[state.path].name, level: level, score: overall, scores: scores, blockers: top,
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
      ? icon("check-circle") + "<p>Your result has been saved (reference <strong>" + esc(ref) + "</strong>) and a copy is on its way to <strong>" + esc(state.details.email) + "</strong>.</p>"
      : icon("info") + "<p>" + esc(err || "We couldn't save your result just now.") + ' Your result is shown below — please <a href="contact.html">contact us</a> if you would like us to review it.</p>';
    if (ok) { try { sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ } }
  }

  function showResult(r) {
    els.progress.hidden = true; els.card.hidden = true; els.nav.hidden = true; els.notice.hidden = true;
    var tone = { "Not ready yet": "red", "Building foundations": "amber", "Nearly ready": "blue", "Ready to proceed": "green" }[r.level];
    els.result.hidden = false;
    els.result.innerHTML =
      '<div class="sra-saved" data-sra-save>' + icon("clock") + "<p>Saving your result…</p></div>" +
      '<div class="sra-result">' +
        '<div class="sra-score sra-score--' + tone + '"><div class="sra-ring" style="--p:' + r.overall + '"><span>' + r.overall + "<small>%</small></span></div>" +
        "<div><p class=\"sra-score__label\">Your readiness level</p><h2>" + esc(r.level) + "</h2><p>Adaptive path: <strong>" + esc(PATHS[state.path].name) + "</strong></p></div></div>" +
        '<div class="sra-areas">' + r.scores.map(function (a) {
          return '<div class="sra-area"><div class="sra-area__top"><span>' + esc(a.area) + "</span><strong>" + a.score + '%</strong></div><div class="sra-area__bar"><i style="width:' + a.score + '%"></i></div></div>';
        }).join("") + "</div>" +
        (r.top.length ? '<div class="sra-block"><h3>' + icon("shield") + "Fix these first</h3><ol>" + r.top.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ol></div>"
          : '<div class="sra-block sra-block--ok"><h3>' + icon("check-circle") + "No major red flags</h3><p>Your answers show no high-risk blockers. Keep reviewing each step before you spend.</p></div>") +
        '<div class="sra-next-step"><p class="sra-score__label">Your safest next step</p><h3>' + esc(r.next.title) + "</h3><p>" + esc(r.next.text) + '</p><div class="sra-next-step__btns">' +
          r.next.links.map(function (l) { return '<a class="btn btn--' + l[2] + '" href="' + l[1] + '">' + esc(l[0]) + (l[2] === "accent" ? icon("arrow-right") : "") + "</a>"; }).join("") + "</div></div>" +
        '<p class="sra-disclaimer">This assessment is general guidance based on your answers. It is not financial, legal or tax advice and does not predict profit.</p>' +
        '<button type="button" class="sra-restart" data-restart>Start the assessment again</button>' +
      "</div>";
    root.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  render(false);
})();
