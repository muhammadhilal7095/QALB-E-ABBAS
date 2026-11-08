/* ==========================================================================
   US LLC page — "Choose the state for your LLC"
   State fees come from the JSON block written by `npm run pricing:build`
   (booking/src/lib/service-catalog.json → usStateFees), the same data checkout charges from.
   Each package's Add to Cart button then adds the package + that state's filing fee
   (cart.js reads the data-with-* attributes set here).
   ========================================================================== */
(function () {
  "use strict";
  var root = document.querySelector("[data-llc-states]");
  var dataEl = document.getElementById("us-state-fees");
  if (!root || !dataEl) return;
  var states;
  try { states = JSON.parse(dataEl.textContent); } catch (e) { return; }
  var byCode = {};
  states.forEach(function (s) { byCode[s.code] = s; });

  var select = root.querySelector("[data-llc-select]");
  var nameEl = root.querySelector("[data-llc-name]");
  var feeEl = root.querySelector("[data-llc-fee]");
  var noteEl = root.querySelector("[data-llc-note]");
  var chips = root.querySelectorAll("[data-llc-chip]");
  var money = function (n) { return "$" + Number(n).toLocaleString("en-US"); };

  function apply(code, updateUrl) {
    var s = byCode[code];
    if (!s) return;
    select.value = code;
    nameEl.textContent = s.name;
    feeEl.textContent = money(s.fee);
    noteEl.textContent = s.note || "";
    noteEl.hidden = !s.note;
    chips.forEach(function (c) { c.setAttribute("aria-pressed", String(c.dataset.llcChip === code)); });
    document.querySelectorAll("[data-llc-total]").forEach(function (el) {
      var base = Number(el.dataset.llcTotal);
      el.innerHTML = "+ " + money(s.fee) + " " + s.name + " fee = <b>" + money(base + s.fee) + "</b> total";
    });
    document.querySelectorAll("[data-llc-package]").forEach(function (btn) {
      btn.dataset.withSku = "us-state-fee-" + s.code.toLowerCase();
      btn.dataset.withName = "US LLC state filing fee — " + s.name;
      btn.dataset.withPrice = String(s.fee);
      btn.dataset.withCurrency = "USD";
      btn.dataset.withNote = s.note || "";
    });
    if (updateUrl) {
      try {
        var u = new URL(window.location.href);
        u.searchParams.set("state", s.code);
        window.history.replaceState(null, "", u.pathname + u.search + "#plans");
      } catch (e) { /* older browsers: skip */ }
    }
  }

  select.addEventListener("change", function () { apply(select.value, true); });
  chips.forEach(function (c) { c.addEventListener("click", function () { apply(c.dataset.llcChip, true); }); });

  // Start with ?state=TX (or #state-texas style links), otherwise the default selected option.
  var start = select.value;
  try {
    var q = (new URLSearchParams(window.location.search).get("state") || "").toUpperCase();
    if (byCode[q]) start = q;
    var h = (window.location.hash.match(/state-([a-z-]+)/) || [])[1];
    if (h) states.forEach(function (s) { if (s.name.toLowerCase().replace(/\s+/g, "-") === h) start = s.code; });
  } catch (e) { /* ignore */ }
  apply(start, false);
})();
