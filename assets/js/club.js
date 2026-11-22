/* ==========================================================================
   Stock Market Club sign-up (stock-exchange-join.html)
   Step 1: details form → POST /api/membership.php
   Step 2: Stripe Checkout (or "we'll email a payment link" if cards are off)
   Step 3: back on this page → GET /api/membership.php confirms the payment
           and shows the Member ID + WhatsApp group link.
   ========================================================================== */
(function () {
  "use strict";
  var form = document.getElementById("club-form");
  if (!form) return;
  var status = document.getElementById("club-status");
  var err = form.querySelector(".club-error");
  var btn = form.querySelector(".club-submit");
  var API = "/api";
  var q = new URLSearchParams(location.search);
  var gateways = [];

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function icon(n) { return '<svg class="icon" aria-hidden="true"><use href="#i-' + n + '"></use></svg>'; }
  function step(n) {
    document.querySelectorAll(".club-steps li").forEach(function (li) {
      var k = +li.getAttribute("data-step");
      li.classList.toggle("is-done", k < n);
      li.classList.toggle("is-current", k === n);
    });
  }
  function show(html) {
    form.hidden = true; status.hidden = false; status.innerHTML = html;
    status.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Live price (Admin → Prices) and available payment methods
  fetch(API + "/prices.php", { headers: { Accept: "application/json" } }).then(function (r) { return r.ok ? r.json() : null; }).then(function (p) {
    var v = p && p.ok && p.items && p.items["stock-club-membership"];
    if (v != null) document.querySelectorAll("[data-club-price]").forEach(function (el) { el.textContent = "$" + Number(v).toLocaleString("en-US"); });
  }).catch(function () {});
  fetch(API + "/checkout-options.php", { headers: { Accept: "application/json" } }).then(function (r) { return r.ok ? r.json() : null; }).then(function (o) {
    gateways = (o && o.gateways) || [];
    if (gateways.length && gateways.indexOf("STRIPE") < 0) {
      form.querySelector("[data-pay-label]").textContent = "Sign up, we'll email a payment link";
      form.querySelector(".club-secure").hidden = true;
    }
  }).catch(function () {});

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    err.hidden = true;
    var fd = new FormData(form);
    var data = {
      name: String(fd.get("name") || "").trim(), email: String(fd.get("email") || "").trim(), whatsapp: String(fd.get("whatsapp") || "").trim(),
      country: String(fd.get("country") || ""), city: String(fd.get("city") || "").trim(), experience: String(fd.get("experience") || ""),
      markets: fd.getAll("markets"), goal: String(fd.get("goal") || "").trim(), acceptTerms: fd.get("acceptTerms") === "on"
    };
    var problem = data.name.length < 2 ? "Please enter your full name." :
      !/^\S+@\S+\.\S+$/.test(data.email) ? "Please enter a valid email address." :
      data.whatsapp.replace(/\D/g, "").length < 8 ? "Please enter your WhatsApp number with country code (e.g. +92 300 1234567)." :
      !data.country ? "Please choose your country." :
      !data.acceptTerms ? "Please accept the terms to continue." : "";
    if (problem) { err.textContent = problem; err.hidden = false; return; }
    if (gateways.indexOf("STRIPE") >= 0) data.gateway = "STRIPE";
    btn.disabled = true; btn.classList.add("is-loading");
    try { sessionStorage.setItem("qa-club-email", data.email); } catch (x) { /* private mode */ }
    fetch(API + "/membership.php", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .then(function (j) {
        if (j.ok && j.redirectUrl) { step(2); location.href = j.redirectUrl; return; }
        btn.disabled = false; btn.classList.remove("is-loading");
        err.textContent = j.error || "Sorry, something went wrong. Please try again or email contact@qalbeabbas.com.";
        err.hidden = false;
      })
      .catch(function () {
        btn.disabled = false; btn.classList.remove("is-loading");
        err.textContent = "Sorry, we couldn't connect. Please check your internet and try again.";
        err.hidden = false;
      });
  });

  // ---------- Returning from payment ----------
  if (q.get("cancelled")) {
    var c = document.createElement("p");
    c.className = "club-info";
    c.textContent = "Payment was cancelled, so nothing was charged. You can try again below.";
    form.insertBefore(c, form.firstChild.nextSibling);
  }
  var ref = q.get("ref");
  if (!ref) return;
  step(2);
  show('<div class="club-wait"><span class="club-spin" aria-hidden="true"></span><h2>Confirming your payment…</h2><p class="club-muted">This only takes a moment.</p></div>');
  var email = "";
  try { email = sessionStorage.getItem("qa-club-email") || ""; } catch (x) { /* private mode */ }
  var tries = 0;
  (function check() {
    var url = API + "/membership.php?ref=" + encodeURIComponent(ref) + (q.get("session_id") ? "&session_id=" + encodeURIComponent(q.get("session_id")) : "") + (email ? "&email=" + encodeURIComponent(email) : "");
    fetch(url, { headers: { Accept: "application/json" } }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.ok) { show('<h2>We couldn\'t find this sign-up</h2><p class="club-muted">' + esc(j.error || "") + ' Email <a href="mailto:contact@qalbeabbas.com">contact@qalbeabbas.com</a> and we\'ll sort it out.</p>'); return; }
      if (j.payment === "paid") {
        step(3);
        var first = esc(String(j.name || "").split(" ")[0]);
        var h = '<div class="club-done"><span class="club-done__ic">' + icon("check-circle") + '</span><h2>Welcome to the club' + (first ? ", " + first : "") + '!</h2>' +
          '<p class="club-muted">Your payment of ' + esc(j.total) + ' is confirmed and your member account is active.</p>' +
          '<dl class="club-id"><div><dt>Member ID</dt><dd>' + esc(j.memberId || "") + '</dd></div><div><dt>Reference</dt><dd>' + esc(j.ref) + "</dd></div></dl>";
        if (j.whatsapp) {
          h += '<a class="club-wa" href="' + esc(j.whatsapp) + '" target="_blank" rel="noopener">' + icon("whatsapp") + '<span>Join our WhatsApp group</span></a>' +
            '<p class="club-muted club-small">Join with the WhatsApp number you gave us. We\'ve also emailed you this link and your Member ID.</p>';
        } else if (j.linkPending) {
          h += '<p class="club-info">Our team will add you to the WhatsApp group within one working day using the number you gave us. We\'ve emailed you your Member ID.</p>';
        } else {
          h += '<p class="club-info">We\'ve emailed you the WhatsApp group link and your Member ID. Check your inbox (and spam folder).</p>';
        }
        show(h + "</div>");
        return;
      }
      if (j.payment === "awaiting" || q.get("manual")) {
        show('<div class="club-done"><span class="club-done__ic club-done__ic--wait">' + icon("mail") + '</span><h2>You\'re signed up</h2><p class="club-muted">Your Member ID is <b>' + esc(j.memberId || "") + '</b>. We\'ll email you a secure payment link for the ' + esc(j.total) + ' joining fee within one working day. As soon as it\'s paid, you\'ll receive the WhatsApp group link.</p></div>');
        return;
      }
      if (++tries < 8) { setTimeout(check, 2500); return; }
      show('<h2>Your payment is still being confirmed</h2><p class="club-muted">This can take a minute. We\'ll email you your Member ID and the WhatsApp link as soon as it\'s confirmed. Questions? Email <a href="mailto:contact@qalbeabbas.com">contact@qalbeabbas.com</a> with reference <b>' + esc(ref) + "</b>.</p>");
    }).catch(function () {
      if (++tries < 8) { setTimeout(check, 2500); return; }
      show('<h2>We couldn\'t check your payment</h2><p class="club-muted">Please refresh this page. If you paid, we\'ll email you your Member ID and WhatsApp link.</p>');
    });
  })();
})();
