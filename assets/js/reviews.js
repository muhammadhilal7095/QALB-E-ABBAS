/* ==========================================================================
   Review sections: <div data-page-reviews="ebay"></div>
   Reviews come from assets/js/reviews-data.js (window.QA_REVIEWS).

   Each section is a continuously moving row of review cards (a seamless
   loop). It pauses on hover, while a card has keyboard focus, and with the
   pause button. Visitors who prefer reduced motion get a swipeable row.
   ========================================================================== */
(function () {
  "use strict";
  var DATA = window.QA_REVIEWS || {};
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var COLORS = ["#1F55E0", "#0F766E", "#B45309", "#7C3AED", "#BE185D", "#0369A1", "#16A34A", "#1E3A8A"];
  var PLACEHOLDER = /^(client|student) name$/i;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function star() { return '<svg class="icon" aria-hidden="true"><use href="#i-star"></use></svg>'; }
  function icon(n) { return '<svg class="icon" aria-hidden="true"><use href="#i-' + n + '"></use></svg>'; }
  function flag(code) {
    // Regional-indicator emoji flag from a 2-letter country code.
    if (!/^[a-z]{2}$/i.test(code || "")) return "";
    var A = 0x1F1E6, c = code.toUpperCase();
    return String.fromCodePoint(A + c.charCodeAt(0) - 65, A + c.charCodeAt(1) - 65);
  }

  function card(r, i) {
    var real = r.name && !PLACEHOLDER.test(r.name);
    var initials = real
      ? r.name.split(/\s+/).map(function (p) { return p[0]; }).join("").slice(0, 2)
      : (r.flag ? r.flag.replace("gb", "uk") : "S" + (i + 1));
    var avatar = r.photo
      ? '<img class="avatar avatar--photo" src="' + esc(r.photo) + '" alt="' + esc(r.name) + '" title="' + esc(r.name) + '" width="48" height="48" loading="lazy" decoding="async">'
      : '<span class="avatar" style="--c:' + COLORS[i % COLORS.length] + '" aria-hidden="true">' + esc(initials.toUpperCase()) + "</span>";
    var place = r.country ? (flag(r.flag) + " " + esc(r.country)) : "";
    var sub = [place, esc(r.service || r.role || "")].filter(Boolean).join(" · ");
    var rating = Math.max(1, Math.min(5, r.rating || 5));
    return '<figure class="review rv-card">' +
      (r.sample ? '<span class="review__badge">Sample review</span>' : "") +
      '<div class="stars stars--sm" role="img" aria-label="' + rating + ' out of 5 stars">' + new Array(rating + 1).join(star()) + "</div>" +
      "<blockquote>" + esc(r.text) + "</blockquote>" +
      "<figcaption>" + avatar + "<span><b>" + esc(r.name) + "</b><small>" + sub + "</small></span></figcaption>" +
      "</figure>";
  }

  function render(mount) {
    // Only real, approved reviews are shown. Entries still marked `sample: true` are skipped,
    // and a section with no real reviews hides itself until reviews are added.
    var list = (DATA[mount.getAttribute("data-page-reviews")] || []).filter(function (r) { return r && !r.sample; });
    if (!list.length) { var sec = mount.closest("section"); if (sec) sec.hidden = true; return; }
    var cards = list.map(card);

    // One "loop unit" holds at least 8 cards so the row is always wider than
    // the screen; the unit is then shown twice and the track slides by exactly
    // one unit (-50%), which makes the loop seamless.
    var unit = [];
    while (unit.length < Math.max(8, cards.length)) unit = unit.concat(cards);
    var label = mount.getAttribute("data-reviews-label") || "Client reviews";
    var secs = Math.round(unit.length * 7); // ~7 seconds per card: calm, readable pace

    mount.innerHTML =
      '<div class="rv-marquee' + (REDUCED ? " rv-marquee--static" : "") + '" role="region" aria-label="' + esc(label) + '">' +
        '<div class="rv-marquee__track" style="--rv-dur:' + secs + 's">' +
          '<div class="rv-marquee__group">' + unit.join("") + "</div>" +
          (REDUCED ? "" : '<div class="rv-marquee__group" aria-hidden="true" inert>' + unit.join("") + "</div>") +
        "</div>" +
      "</div>" +
      (REDUCED ? "" :
        '<div class="rv-marquee__controls"><button type="button" class="carousel-btn carousel-btn--solid rv-marquee__toggle" aria-pressed="false" aria-label="Pause reviews">' +
          '<span class="rv-pause">' + icon("pause") + '</span><span class="rv-play">' + icon("play") + "</span></button></div>");

    if (REDUCED) return;
    var box = mount.querySelector(".rv-marquee");
    var btn = mount.querySelector(".rv-marquee__toggle");
    btn.addEventListener("click", function () {
      var paused = box.classList.toggle("is-paused");
      btn.setAttribute("aria-pressed", String(paused));
      btn.setAttribute("aria-label", paused ? "Play reviews" : "Pause reviews");
    });
    // Stop the animation while the section is off-screen (saves battery).
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { box.classList.toggle("is-offscreen", !e.isIntersecting); });
      }).observe(box);
    }
  }

  document.querySelectorAll("[data-page-reviews]").forEach(render);
})();
