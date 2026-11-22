/* Course enrolment (/enroll): choose a course, enter student details and pay the course fee
   through the same secure checkout as the cart (/api/checkout.php, Stripe or manual payment). */
(function () {
  "use strict";
  var form = document.querySelector("[data-enrol]");
  if (!form) return;
  var CFG = window.QA_CONFIG || window.SITE_CONFIG || {};
  var API = String((CFG.links && CFG.links.api) || "/api").replace(/\/$/, "");
  var sumEl = form.querySelector("[data-en-sum]"), totalEl = form.querySelector("[data-en-total]");
  var gwEl = form.querySelector("[data-en-gw]"), btn = form.querySelector("[data-en-submit]"), errEl = form.querySelector(".cart-error");
  var LABEL = {
    STRIPE: ["Card payment", "Visa, Mastercard, Amex, Apple Pay & Google Pay, processed securely by Stripe."],
    MANUAL: ["Request now, pay by secure link", "We email you a secure payment link or bank details within one working day."],
    TEST: ["Test payment", "Development only, no real money is taken."]
  };
  var gateways = null, busy = false;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(n) { return "$" + Number(n).toLocaleString("en-US"); }
  function chosen() { return form.querySelector('input[name="course"]:checked'); }

  // Phones & tablets: a bar fixed at the bottom of the form repeats the fee and the pay button.
  var bar = form.querySelector("[data-en-bar]");
  var barTotal = bar && bar.querySelector("[data-en-bar-total]"), barBtn = bar && bar.querySelector("button");
  function syncBar() {
    if (!bar) return;
    barTotal.textContent = totalEl.textContent;
    barBtn.disabled = btn.disabled; barBtn.textContent = btn.disabled && chosen() && !busy ? "Pay & enrol" : btn.textContent;
  }

  function update() {
    _update(); syncBar();
  }
  function _update() {
    var c = chosen();
    if (!c) {
      sumEl.innerHTML = '<p class="cart-muted">Choose a course to see the fee.</p>';
      totalEl.textContent = "—"; btn.disabled = true; btn.textContent = "Choose a course"; return;
    }
    var price = Number(c.getAttribute("data-price"));
    sumEl.innerHTML = '<p class="en-sum__name">' + c.getAttribute("data-name") + "</p>" +
      '<ul class="en-sum__list"><li>24 live online classes</li><li>1 hour a day, 5 days a week</li><li>About 5 weeks · English &amp; Urdu</li></ul>';
    totalEl.textContent = money(price);
    btn.disabled = busy || !gateways || !gateways.length;
    btn.textContent = busy ? "Please wait…" : "Pay " + money(price) + " & enrol";
  }

  function renderGateways() {
    if (!gateways || !gateways.length) {
      gwEl.innerHTML = '<div class="cart-notice cart-notice--warn"><p>Online payment isn\'t available right now. Please <a href="/contact">contact us</a> to enrol.</p></div>';
    } else {
      gwEl.innerHTML = '<div class="cart-options">' + gateways.map(function (g, i) {
        var l = LABEL[g] || [g, ""];
        return '<label class="cart-option"><input type="radio" name="gateway" value="' + esc(g) + '"' + (i === 0 ? " checked" : "") + "><span><strong>" + l[0] + "</strong><small>" + l[1] + "</small></span></label>";
      }).join("") + "</div>";
    }
    update();
  }

  function showError(msg) { errEl.textContent = msg; errEl.hidden = false; errEl.scrollIntoView({ block: "nearest", behavior: "smooth" }); }

  // With a course chosen from its "Apply Now" button (or ?course=…), only that course is shown.
  var courseTitle = form.querySelector("#en-course-title");
  function pick(slug) {
    var r = slug && form.querySelector('input[name="course"][value="' + String(slug).replace(/[^a-z0-9-]/g, "") + '"]');
    if (r) r.checked = true;
    form.classList.toggle("is-one-course", !!r);
    if (courseTitle) courseTitle.textContent = r ? "1. Your course" : "1. Choose your course";
    update();
  }

  // On the University page the form sits in a popup opened by the "Apply Now" buttons.
  var dialog = form.closest("dialog");
  if (dialog) {
    var openDialog = function (slug) {
      if (slug) pick(slug);
      if (!dialog.open) { if (dialog.showModal) dialog.showModal(); else dialog.setAttribute("open", ""); }
      document.documentElement.classList.add("mfg-lock");
      dialog.scrollTop = 0;
    };
    var closeDialog = function () { if (dialog.open) { if (dialog.close) dialog.close(); else dialog.removeAttribute("open"); } };
    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-enrol-open]"); if (!b) return;
      e.preventDefault(); pick(b.getAttribute("data-enrol-open")); openDialog(b.getAttribute("data-enrol-open"));
    });
    dialog.querySelectorAll("[data-enrol-close]").forEach(function (b) { b.addEventListener("click", closeDialog); });
    dialog.addEventListener("click", function (e) { if (e.target === dialog) closeDialog(); });
    dialog.addEventListener("close", function () { document.documentElement.classList.remove("mfg-lock"); });
  }

  // Pre-select a course from ?course=…, fill the time zone, show a note after a cancelled payment.
  var q = new URLSearchParams(location.search);
  if (q.get("course")) pick(q.get("course"));
  if (dialog && (location.hash === "#admission" || q.get("apply") === "1")) openDialog(q.get("course"));
  try { form.timezone.value = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { /* type it in */ }
  if (q.get("cancelled") === "1") showError("Your payment was cancelled and nothing was charged. You can try again below.");

  // Course fees follow Admin → Prices.
  document.addEventListener("qa:prices", function (e) {
    var items = (e.detail && e.detail.items) || {};
    form.querySelectorAll('input[name="course"]').forEach(function (r) {
      var v = items[r.getAttribute("data-sku")];
      if (v != null) { r.setAttribute("data-price", v); var f = r.parentNode.querySelector("[data-fee]"); if (f) f.textContent = money(v); }
    });
    update();
  });

  form.addEventListener("change", function (e) { if (e.target.name === "course") { errEl.hidden = true; update(); } });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    errEl.hidden = true;
    var c = chosen();
    if (!c) return showError("Please choose a course.");
    if (!form.reportValidity()) return;
    var g = form.querySelector('input[name="gateway"]:checked');
    if (!g) return showError("Please choose a payment method.");
    var f = form;
    var notes = "Course enrolment\nPreferred class time: " + f.classTime.value + " (" + f.timezone.value + ")\nExperience: " + f.level.value +
      "\nLanguage: " + f.language.value + (f.notes.value.trim() ? "\n\n" + f.notes.value.trim() : "");
    busy = true; update();
    fetch(API + "/checkout.php", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        submission: {
          kind: "order",
          items: [{ sku: c.getAttribute("data-sku"), quantity: 1 }],
          customer: { name: f.name.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim(), country: f.country.value.trim() },
          notes: notes.slice(0, 1000),
          enrolment: { course: c.value, classTime: f.classTime.value, timezone: f.timezone.value, level: f.level.value, language: f.language.value }
        },
        acceptTerms: true,
        gateway: g.value
      })
    })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok && res.j.redirectUrl) { window.location.href = res.j.redirectUrl; return; }
        busy = false; update(); showError(res.j.error || "Something went wrong. Please try again.");
      })
      .catch(function () { busy = false; update(); showError("We couldn't reach our secure checkout. Please check your connection and try again."); });
  });

  update();
  fetch(API + "/checkout-options.php", { headers: { Accept: "application/json" } })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
    .then(function (j) { gateways = Array.isArray(j.gateways) ? j.gateways : []; })
    .catch(function () { gateways = []; })
    .then(renderGateways);
})();
