/* ==========================================================================
   Service cart: "Add to cart" buttons, header cart count, and the cart page
   (cart.html) with checkout through the booking app.

   Prices shown here come from data-* attributes generated from the booking
   app's catalog. The booking app re-prices every order on the server, so the
   amount charged never depends on what the browser sends.
   ========================================================================== */
(function () {
  "use strict";

  var KEY = "qa_cart_v1";
  var MAX_QTY = 50;
  var SYMBOL = { USD: "$", GBP: "£", EUR: "€" };
  var memory = [];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function icon(n) { return '<svg class="icon" aria-hidden="true"><use href="#i-' + n + '"></use></svg>'; }
  function money(n, cur) {
    var v = Math.round(n * 100) / 100;
    return (SYMBOL[cur] || cur + " ") + v.toLocaleString("en-US", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
  }

  // ---- Storage (localStorage can be unavailable: private mode, blocked storage) ----
  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.filter(function (i) { return i && i.sku && i.price > 0; }) : [];
    } catch (e) { return memory.slice(); }
  }
  function save(list) {
    memory = list.slice();
    try { window.localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* keep in memory */ }
    updateBadge();
    document.dispatchEvent(new CustomEvent("cart:change"));
  }
  function count(list) { return list.reduce(function (t, i) { return t + (i.multi ? i.qty : 1); }, 0); }

  function updateBadge() {
    var n = count(load());
    document.querySelectorAll("[data-cart-count]").forEach(function (el) {
      el.textContent = n > 99 ? "99+" : String(n);
      el.hidden = n === 0;
    });
    document.querySelectorAll("[data-cart-link]").forEach(function (a) {
      a.setAttribute("aria-label", n ? "Your cart, " + n + " item" + (n === 1 ? "" : "s") : "Your cart");
    });
  }

  function addItem(d) {
    var list = load();
    var found = list.filter(function (i) { return i.sku === d.sku; })[0];
    if (found) {
      if (!found.multi) return "exists";
      found.qty = Math.min(MAX_QTY, found.qty + 1);
    } else {
      list.push({ sku: d.sku, name: d.name, price: Number(d.price), currency: d.currency, unit: d.unit || "", note: d.note || "", multi: !!d.multi, qty: 1 });
    }
    save(list);
    return "added";
  }

  // ---- Toast with a link to the cart ----
  var toastEl, toastT;
  function toast(html) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "cart-toast";
      toastEl.setAttribute("role", "status");
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML = html;
    toastEl.classList.add("is-visible");
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove("is-visible"); }, 4200);
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-add-to-cart]");
    if (!btn) return;
    e.preventDefault();
    var d = btn.dataset;
    var result = addItem({ sku: d.sku, name: d.name, price: d.price, currency: d.currency, unit: d.unit, note: d.note, multi: d.multi === "1" });
    toast(icon("check-circle") + "<span><strong>" + esc(d.name) + "</strong> " +
      (result === "exists" ? "is already in your cart." : "added to your cart.") +
      '</span><a href="cart.html">View cart</a>');
    if (!btn.dataset.label) btn.dataset.label = btn.innerHTML;
    btn.classList.add("is-added");
    btn.innerHTML = icon("check") + "<span>" + (btn.classList.contains("pr-q__add") ? "Added" : "Added to cart") + "</span>";
    clearTimeout(btn._t);
    btn._t = setTimeout(function () { btn.classList.remove("is-added"); btn.innerHTML = btn.dataset.label; }, 2200);
  });

  // ======================================================================
  // Cart page
  // ======================================================================
  var app = document.getElementById("cart-app");
  var CFG = window.SITE_CONFIG || {};
  var API = String((CFG.links && CFG.links.bookingApp) || "").replace(/\/$/, "");
  var gateways = null; // null = loading, [] = none available
  var gatewayError = false;
  var chosenCurrency = null;
  var busy = false;
  var formState = { name: "", email: "", phone: "", notes: "", gateway: "", terms: false };
  var GATEWAY_LABEL = {
    STRIPE: ["Card payment", "Visa, Mastercard, Amex, Apple Pay & Google Pay — processed securely by Stripe."],
    BANK_TRANSFER: ["Bank transfer", "We'll email our bank details. Work starts once the transfer arrives."],
    MOCK: ["Test payment", "Development only — no real money is taken."]
  };

  function groups(list) {
    var out = {};
    list.forEach(function (i) { (out[i.currency] = out[i.currency] || []).push(i); });
    return out;
  }

  function render() {
    if (!app) return;
    var list = load();
    if (!list.length) {
      app.innerHTML = '<div class="cart-empty">' + icon("cart") +
        "<h2>Your cart is empty</h2><p>Browse our services and add what you need — prices are shown on each service page.</p>" +
        '<a class="btn btn--primary" href="services.html">Browse services</a></div>';
      return;
    }
    var byCur = groups(list);
    var currencies = Object.keys(byCur);
    if (!chosenCurrency || !byCur[chosenCurrency]) chosenCurrency = currencies[0];

    var itemsHtml = currencies.map(function (cur) {
      var rows = byCur[cur].map(function (i) {
        var qty = i.multi
          ? '<div class="cart-qty" role="group" aria-label="Quantity for ' + esc(i.name) + '">' +
            '<button type="button" data-qty="-1" data-sku="' + esc(i.sku) + '" aria-label="Decrease quantity"' + (i.qty <= 1 ? " disabled" : "") + ">−</button>" +
            "<span>" + i.qty + "</span>" +
            '<button type="button" data-qty="1" data-sku="' + esc(i.sku) + '" aria-label="Increase quantity"' + (i.qty >= MAX_QTY ? " disabled" : "") + ">+</button></div>"
          : '<span class="cart-qty cart-qty--fixed">1</span>';
        return '<li class="cart-line">' +
          '<div class="cart-line__info"><p class="cart-line__name">' + esc(i.name) + "</p>" +
          '<p class="cart-line__meta">' + money(i.price, cur) + (i.unit ? " " + esc(i.unit) : "") + (i.note ? " · " + esc(i.note) : "") + "</p></div>" +
          qty +
          '<p class="cart-line__total">' + money(i.price * (i.multi ? i.qty : 1), cur) + "</p>" +
          '<button type="button" class="cart-line__remove" data-remove="' + esc(i.sku) + '" aria-label="Remove ' + esc(i.name) + '">' + icon("close") + "</button>" +
          "</li>";
      }).join("");
      var total = byCur[cur].reduce(function (t, i) { return t + i.price * (i.multi ? i.qty : 1); }, 0);
      return '<div class="cart-group">' +
        (currencies.length > 1 ? '<h3 class="cart-group__title">Services in ' + cur + "</h3>" : "") +
        '<ul class="cart-lines">' + rows + "</ul>" +
        '<p class="cart-group__total"><span>Subtotal</span><strong>' + money(total, cur) + "</strong></p></div>";
    }).join("");

    var multiNote = currencies.length > 1
      ? '<div class="cart-notice">' + icon("info") + "<p>Your cart has services priced in different currencies (" + currencies.join(", ") +
        "). Each currency is paid separately — choose which one to pay for now. The rest stay in your cart.</p></div>"
      : "";

    var curPick = currencies.length > 1
      ? '<fieldset class="cart-field"><legend>Pay for</legend><div class="cart-options">' + currencies.map(function (c) {
          var t = byCur[c].reduce(function (s, i) { return s + i.price * (i.multi ? i.qty : 1); }, 0);
          return '<label class="cart-option"><input type="radio" name="cur" value="' + c + '"' + (c === chosenCurrency ? " checked" : "") + "><span><strong>" + c + " services</strong><small>" + money(t, c) + "</small></span></label>";
        }).join("") + "</div></fieldset>"
      : "";

    var payTotal = byCur[chosenCurrency].reduce(function (t, i) { return t + i.price * (i.multi ? i.qty : 1); }, 0);

    var gw;
    if (gateways === null) gw = '<p class="cart-muted">Loading payment options…</p>';
    else if (!gateways.length) gw = '<div class="cart-notice cart-notice--warn">' + icon("info") + "<p>" +
      (gatewayError ? "We couldn't reach our secure checkout just now. Please try again in a moment, or " : "Online payment isn't available right now. Please ") +
      '<a href="contact.html">contact us</a> to complete your order.</p></div>';
    else {
      if (gateways.indexOf(formState.gateway) < 0) formState.gateway = gateways[0];
      gw = '<div class="cart-options">' + gateways.map(function (g) {
        var l = GATEWAY_LABEL[g] || [g, ""];
        return '<label class="cart-option"><input type="radio" name="gateway" value="' + g + '"' + (g === formState.gateway ? " checked" : "") + "><span><strong>" + l[0] + "</strong><small>" + l[1] + "</small></span></label>";
      }).join("") + "</div>";
    }

    app.innerHTML =
      '<div class="cart-layout">' +
        '<div class="cart-panel"><div class="cart-panel__head"><h2>Your services</h2><button type="button" class="cart-clear" data-clear>Clear cart</button></div>' + multiNote + itemsHtml +
        '<p class="cart-hint">' + icon("info") + "Government, state and university fees noted on a service are paid separately and are not included.</p></div>" +
        '<form class="cart-panel cart-checkout" novalidate>' +
          "<h2>Checkout</h2>" + curPick +
          '<div class="cart-field"><label for="c-name">Full name *</label><input id="c-name" name="name" autocomplete="name" required value="' + esc(formState.name) + '"></div>' +
          '<div class="cart-field"><label for="c-email">Email *</label><input id="c-email" name="email" type="email" autocomplete="email" required value="' + esc(formState.email) + '"></div>' +
          '<div class="cart-field"><label for="c-phone">Phone / WhatsApp</label><input id="c-phone" name="phone" type="tel" autocomplete="tel" value="' + esc(formState.phone) + '"></div>' +
          '<div class="cart-field"><label for="c-notes">Anything we should know?</label><textarea id="c-notes" name="notes" rows="3" placeholder="Store link, account details, deadlines…">' + esc(formState.notes) + "</textarea></div>" +
          '<fieldset class="cart-field"><legend>Payment method</legend>' + gw + "</fieldset>" +
          '<label class="cart-terms"><input type="checkbox" name="terms"' + (formState.terms ? " checked" : "") + '> <span>I agree to the <a href="terms.html" target="_blank" rel="noopener">Terms &amp; Conditions</a> and <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a>.</span></label>' +
          '<div class="cart-pay"><p><span>Total to pay</span><strong>' + money(payTotal, chosenCurrency) + "</strong></p>" +
          '<button type="submit" class="btn btn--accent btn--block"' + (busy || !gateways || !gateways.length ? " disabled" : "") + ">" +
            (busy ? "Please wait…" : icon("shield") + "Continue to secure payment") + "</button></div>" +
          '<p class="cart-error" role="alert" hidden></p>' +
        "</form>" +
      "</div>";
  }

  function readForm(form) {
    formState.name = form.name.value; formState.email = form.email.value; formState.phone = form.phone.value;
    formState.notes = form.notes.value; formState.terms = form.terms.checked;
    var g = form.querySelector('input[name="gateway"]:checked'); if (g) formState.gateway = g.value;
  }

  function showError(form, msg) {
    var el = form.querySelector(".cart-error");
    el.textContent = msg; el.hidden = false;
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function loadGateways() {
    if (!API) { gateways = []; render(); return; }
    fetch(API + "/api/orders/options", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (j) { gateways = Array.isArray(j.gateways) ? j.gateways : []; })
      .catch(function () { gateways = []; gatewayError = true; })
      .then(render);
  }

  if (app) {
    app.addEventListener("click", function (e) {
      var t = e.target.closest("button");
      if (!t) return;
      var form = app.querySelector("form"); if (form) readForm(form);
      var list = load();
      if (t.dataset.remove) { save(list.filter(function (i) { return i.sku !== t.dataset.remove; })); render(); }
      else if (t.dataset.qty) {
        list.forEach(function (i) { if (i.sku === t.dataset.sku) i.qty = Math.max(1, Math.min(MAX_QTY, i.qty + Number(t.dataset.qty))); });
        save(list); render();
      } else if (t.hasAttribute("data-clear")) {
        if (window.confirm("Remove all services from your cart?")) { save([]); render(); }
      }
    });
    app.addEventListener("change", function (e) {
      var form = app.querySelector("form"); if (form) readForm(form);
      if (e.target.name === "cur") { chosenCurrency = e.target.value; render(); }
    });
    app.addEventListener("submit", function (e) {
      e.preventDefault();
      var form = e.target;
      readForm(form);
      if (formState.name.trim().length < 2) return showError(form, "Please enter your full name.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.email.trim())) return showError(form, "Please enter a valid email address.");
      if (!formState.gateway) return showError(form, "Please choose a payment method.");
      if (!formState.terms) return showError(form, "Please accept the Terms & Conditions to continue.");
      var payItems = load().filter(function (i) { return i.currency === chosenCurrency; });
      busy = true; render();
      fetch(API + "/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          items: payItems.map(function (i) { return { sku: i.sku, quantity: i.multi ? i.qty : 1 }; }),
          customer: { name: formState.name, email: formState.email, phone: formState.phone || null, notes: formState.notes || null },
          gateway: formState.gateway, acceptTerms: true
        })
      })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (res.ok && res.j.redirectUrl) {
            // The order now holds these services; keep anything in other currencies.
            save(load().filter(function (i) { return i.currency !== chosenCurrency; }));
            window.location.href = res.j.redirectUrl;
            return;
          }
          busy = false; render();
          showError(app.querySelector("form"), res.j.error || "Something went wrong. Please try again.");
        })
        .catch(function () {
          busy = false; render();
          showError(app.querySelector("form"), "We couldn't reach our secure checkout. Please check your connection and try again.");
        });
    });
    render();
    loadGateways();
  }

  // Keep the count in sync across tabs and after the header is drawn.
  window.addEventListener("storage", function (e) { if (e.key === KEY) { updateBadge(); render(); } });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", updateBadge); else updateBadge();
  setTimeout(updateBadge, 0);
})();
