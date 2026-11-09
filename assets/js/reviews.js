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


  // ---- Illustrated avatars for sample reviews (flat drawings, chosen from the review text) ----
  function hashOf(t) { var h = 2166136261; for (var k = 0; k < t.length; k++) { h ^= t.charCodeAt(k); h = Math.imul(h, 16777619); } return h >>> 0; }
  function pick(list, h, salt) { return list[(h >>> salt) % list.length]; }
  function drawnAvatar(seed) {
    var h = hashOf(String(seed || "")); 
    var bg = pick(["#DCE7FF", "#FFE9C7", "#DDF4E7", "#F8E1EF", "#E7E3FF", "#FDE4D9", "#D9F1F7"], h, 0);
    var skin = pick(["#F6D5BC", "#EDBE98", "#DDA57C", "#C58560", "#A86B47", "#7E4E33"], h, 3);
    var hair = pick(["#2A1B13", "#4A2F1D", "#1E1E1E", "#7A4B26", "#B98A52", "#5B3A2E"], h, 6);
    var shirt = pick(["#1F55E0", "#0F766E", "#B45309", "#7C3AED", "#BE185D", "#334155", "#0369A1"], h, 9);
    var style = (h >>> 12) % 7;          // 0 short · 1 side part · 2 curly · 3 long · 4 bun · 5 hijab · 6 buzz
    var beard = (style === 0 || style === 1 || style === 6) && ((h >>> 16) % 3 === 0);
    var glasses = (h >>> 19) % 5 === 0 && style !== 5;
    var p = [];
    p.push('<rect width="64" height="64" fill="' + bg + '"/>');
    if (style === 3) p.push('<path d="M17.5 30c0-12 6.5-19 14.5-19s14.5 7 14.5 19v17h-29z" fill="' + hair + '"/>');
    if (style === 5) p.push('<path d="M16 64c1-9 4-14 8-16l-3-10c0-14 5-24 11-24s11 10 11 24l-3 10c4 2 7 7 8 16z" fill="' + shirt + '"/>');
    else p.push('<path d="M9 64c2-12 11.5-18 23-18s21 6 23 18z" fill="' + shirt + '"/><rect x="27" y="37" width="10" height="10" rx="4" fill="' + skin + '"/>');
    if (style !== 5) p.push('<circle cx="20.6" cy="29" r="2.6" fill="' + skin + '"/><circle cx="43.4" cy="29" r="2.6" fill="' + skin + '"/>');
    p.push('<ellipse cx="32" cy="28.5" rx="' + (style === 5 ? 9.6 : 11.2) + '" ry="' + (style === 5 ? 11 : 12.6) + '" fill="' + skin + '"/>');
    if (style === 0) p.push('<path d="M20.6 27c-.4-9.5 4.6-14.6 11.4-14.6S43.8 17.5 43.4 27c-1.8-4.4-5-6.3-11.4-6.3S22.4 22.6 20.6 27z" fill="' + hair + '"/>');
    if (style === 1) p.push('<path d="M20.4 28c-1.4-10.4 4.8-15.8 12-15.8 7.4 0 12.2 4.6 11.2 14-3.8-5.2-9.8-4.8-14-7.6-2 3.6-5.8 5.8-9.2 9.4z" fill="' + hair + '"/>');
    if (style === 2) p.push('<g fill="' + hair + '"><circle cx="22" cy="22" r="5"/><circle cx="27" cy="17" r="5.4"/><circle cx="33" cy="15.6" r="5.6"/><circle cx="39" cy="17.4" r="5.2"/><circle cx="43" cy="22.6" r="4.6"/><circle cx="20.6" cy="27" r="3.4"/><circle cx="43.6" cy="27.4" r="3.2"/></g>');
    if (style === 3) p.push('<path d="M20.6 28c-.6-10 4.6-15.6 11.4-15.6s12 5.6 11.4 15.6c-3-5.4-7.6-7.6-11.4-7.6-4.4 0-8.6 2.4-11.4 7.6z" fill="' + hair + '"/>');
    if (style === 4) p.push('<circle cx="32" cy="12.6" r="5.4" fill="' + hair + '"/><path d="M20.6 27.6c-.4-9.6 4.8-14.8 11.4-14.8s11.8 5.2 11.4 14.8c-2-4.8-5.4-7-11.4-7s-9.4 2.2-11.4 7z" fill="' + hair + '"/>');
    if (style === 5) p.push('<path d="M20.6 30c0-10 4.8-16.4 11.4-16.4S43.4 20 43.4 30c-2-6-6-9-11.4-9s-9.4 3-11.4 9z" fill="' + shirt + '" opacity=".92"/>');
    if (style === 6) p.push('<path d="M20.8 25.6c.6-7.6 5.2-12 11.2-12s10.6 4.4 11.2 12c-2.6-3.2-6.4-4.6-11.2-4.6s-8.6 1.4-11.2 4.6z" fill="' + hair + '" opacity=".85"/>');
    if (beard) p.push('<path d="M21.2 30.6c.6 7.8 5 12.4 10.8 12.4s10.2-4.6 10.8-12.4c-1.6 3-3.6 4.4-6 4.6-1.6-1.4-3-2-4.8-2s-3.2.6-4.8 2c-2.4-.2-4.4-1.6-6-4.6z" fill="' + hair + '"/>');
    p.push('<circle cx="27.6" cy="28.6" r="1.35" fill="#1F2430"/><circle cx="36.4" cy="28.6" r="1.35" fill="#1F2430"/>');
    p.push('<path d="M26.4 25.4q1.2-1 2.6-.4M35 25q1.4-.6 2.6.4" stroke="' + hair + '" stroke-width="1.1" fill="none" stroke-linecap="round"/>');
    if (glasses) p.push('<g fill="none" stroke="#1F2430" stroke-width="1.1"><circle cx="27.6" cy="28.6" r="3.4"/><circle cx="36.4" cy="28.6" r="3.4"/><path d="M31 28.4h2"/></g>');
    p.push('<path d="M28.4 34q3.6 2.8 7.2 0" stroke="' + (beard ? "#F3E9E1" : "#9A4D3A") + '" stroke-width="1.4" fill="none" stroke-linecap="round"/>');
    return '<svg viewBox="0 0 64 64" width="48" height="48" aria-hidden="true">' + p.join("") + "</svg>";
  }

  function card(r, i) {
    var real = r.name && !PLACEHOLDER.test(r.name);
    var initials = real
      ? r.name.split(/\s+/).map(function (p) { return p[0]; }).join("").slice(0, 2)
      : (r.flag ? r.flag.replace("gb", "uk") : "S" + (i + 1));
    // Real reviews show the person's photo (or their initials). Sample reviews use an
    // illustrated (drawn) avatar — never a photo of a real person.
    var avatar = r.photo
      ? '<img class="avatar avatar--photo" src="' + esc(r.photo) + '" alt="' + esc(r.name) + '" title="' + esc(r.name) + '" width="48" height="48" loading="lazy" decoding="async">'
      : (real
        ? '<span class="avatar" style="--c:' + COLORS[i % COLORS.length] + '" aria-hidden="true">' + esc(initials.toUpperCase()) + "</span>"
        : '<span class="avatar avatar--drawn" aria-hidden="true">' + drawnAvatar(r.text + r.service) + "</span>");
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

  // Approved real reviews from the admin dashboard (/api/reviews.php).
  var LIVE = null;
  function listFor(key) {
    var samples = DATA[key] || [];
    if (!LIVE) return samples;
    var real = (LIVE.reviews && LIVE.reviews[key]) || [];
    // Samples disappear once a section has 3 real reviews, or when hidden in Admin → Settings.
    return real.concat(LIVE.hideSamples || real.length >= 3 ? [] : samples);
  }

  function render(mount) {
    // Sample reviews (sample: true) show a "Sample review" badge until replaced with real ones.
    var list = listFor(mount.getAttribute("data-page-reviews"));
    var section = mount.closest("section");
    if (section && list.length) section.hidden = false;
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
      '<div class="rv-marquee__controls">' +
        (REDUCED ? "" : '<button type="button" class="carousel-btn carousel-btn--solid rv-marquee__toggle" aria-pressed="false" aria-label="Pause reviews">' +
          '<span class="rv-pause">' + icon("pause") + '</span><span class="rv-play">' + icon("play") + "</span></button>") +
        '<a class="btn btn--outline rv-leave" href="/leave-review">' + icon("star") + "Share your experience — Leave a Review</a>" +
      "</div>";

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

  var mounts = document.querySelectorAll("[data-page-reviews]");
  mounts.forEach(render);

  if (mounts.length && window.fetch) {
    var api = String(((window.SITE_CONFIG || {}).links || {}).api || "/api").replace(/\/$/, "");
    fetch(api + "/reviews.php", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.ok) return;
        var any = j.hideSamples || Object.keys(j.reviews || {}).length;
        LIVE = j;
        if (any) mounts.forEach(render);
      })
      .catch(function () { /* keep the built-in reviews */ });
  }
})();
