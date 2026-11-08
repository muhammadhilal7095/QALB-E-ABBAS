/* ==========================================================================
   Book a Consultation (book-consultation.html)
   Form → booking app (/api/checkout) → secure card payment (Stripe) →
   after a successful payment the details are emailed to the team and the client.
   Consultation prices come from the <option data-*> values, which are generated
   from the booking app's catalog; the server re-prices every booking itself.
   ========================================================================== */
(function () {
  "use strict";
  var form = document.getElementById("bk-form");
  if (!form) return;

  var SYMBOL = { USD: "$", GBP: "£", EUR: "€" };
  var KEY = "qa_booking_draft_v1";
  var CFG = window.SITE_CONFIG || {};
  var API = String((CFG.links && CFG.links.bookingApp) || "").replace(/\/$/, "");
  var type = form.elements.consultation, date = form.elements.date, time = form.elements.time;
  var errEl = form.querySelector(".bk-error"), submitBtn = form.querySelector("[data-bk-submit]");
  var tz = (Intl.DateTimeFormat().resolvedOptions().timeZone) || "";

  function money(n, cur) { return (SYMBOL[cur] || cur + " ") + Number(n).toLocaleString("en-US"); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function today() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }

  // ---- Booking hours (from the price catalog via data-availability) ----
  var AV = { timezone: "Europe/London", days: [1, 2, 3, 4, 5], start: "10:00", end: "18:00", slotMinutes: 30, minNoticeHours: 24 };
  try { AV = Object.assign(AV, JSON.parse(form.getAttribute("data-availability") || "{}")); } catch (e) { /* defaults */ }
  var DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  function mins(hhmm) { var p = hhmm.split(":"); return +p[0] * 60 + +p[1]; }
  function hhmm(m) { return pad(Math.floor(m / 60)) + ":" + pad(m % 60); }
  // Date + time in the business time zone → the real moment (Date).
  function zoned(dateStr, t) {
    var d = dateStr.split("-").map(Number), h = mins(t);
    var guess = Date.UTC(d[0], d[1] - 1, d[2], Math.floor(h / 60), h % 60);
    var p = {}; new Intl.DateTimeFormat("en-US", { timeZone: AV.timezone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(guess)).forEach(function (x) { p[x.type] = x.value; });
    var asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
    return new Date(guess - (asUtc - guess));
  }
  function weekday(dateStr) { var d = dateStr.split("-").map(Number); var w = new Date(Date.UTC(d[0], d[1] - 1, d[2])).getUTCDay(); return w === 0 ? 7 : w; }
  var local = tz && tz !== AV.timezone;
  function fillTimes() {
    var keep = time.value || time.dataset.want || "", o = type.options[type.selectedIndex], len = o ? +o.dataset.minutes || 30 : 30;
    var opts = ['<option value="">' + (date.value ? "Choose a time" : "Choose a date first") + "</option>"];
    var note = "";
    if (date.value) {
      if (AV.days.indexOf(weekday(date.value)) < 0) {
        note = "We're not available on " + DAY_NAMES[weekday(date.value)] + "s. Please choose " + AV.days.map(function (x) { return DAY_NAMES[x]; }).join(", ").replace(/, ([^,]*)$/, " or $1") + ".";
      } else {
        var earliest = Date.now() + AV.minNoticeHours * 3600e3, n = 0;
        for (var m = mins(AV.start); m + len <= mins(AV.end); m += AV.slotMinutes) {
          var t = hhmm(m), at = zoned(date.value, t);
          if (at.getTime() < earliest) continue;
          var label = t + " UK time" + (local ? " (" + new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(at) + " your time)" : "");
          opts.push('<option value="' + t + '"' + (t === keep ? " selected" : "") + ">" + label + "</option>"); n++;
        }
        if (!n) note = "No times left on this date — please choose a later date (we need " + AV.minNoticeHours + " hours' notice).";
      }
    }
    time.innerHTML = opts.join("");
    time.disabled = !date.value || !!note;
    if (tzEl) tzEl.textContent = note || ("We're available " + DAY_NAMES[AV.days[0]] + " to " + DAY_NAMES[AV.days[AV.days.length - 1]] + ", " + AV.start + "–" + AV.end + " UK time." + (local ? " Times also show in your time zone (" + tz + ")." : ""));
    if (tzEl) tzEl.classList.toggle("bk-closed", !!note);
  }
  var tzEl = form.querySelector("[data-bk-tz]");
  date.min = today();
  // Preselect from ?topic= (every service page links here with its topic).
  var params = new URLSearchParams(location.search);
  var topic = params.get("topic") || "";
  if (topic) {
    for (var i = 0; i < type.options.length; i++) {
      if ((" " + (type.options[i].dataset.topics || "") + " ").indexOf(" " + topic + " ") >= 0) { type.selectedIndex = i; break; }
    }
  }

  // Restore a draft (e.g. after a cancelled payment).
  try {
    var draft = JSON.parse(sessionStorage.getItem(KEY) || "null");
    if (draft) ["name", "email", "phone", "country", "message", "date", "time"].forEach(function (n) { if (draft[n] && form.elements[n]) form.elements[n].value = draft[n]; });
    if (draft && draft.consultation && !topic) type.value = draft.consultation;
    if (draft && draft.time) time.dataset.want = draft.time;
  } catch (e) { /* ignore */ }
  if (params.get("cancelled") === "1") form.querySelector("[data-bk-cancelled]").hidden = false;

  function update() {
    var o = type.options[type.selectedIndex];
    if (!o) return;
    form.querySelector("[data-bk-total]").textContent = money(o.dataset.price, o.dataset.currency);
    form.querySelector("[data-bk-desc]").textContent = o.dataset.desc || "";
  }
  type.addEventListener("change", function () { update(); fillTimes(); });
  date.addEventListener("change", fillTimes);
  update();
  fillTimes();

  function saveDraft() {
    var d = {};
    ["consultation", "name", "email", "phone", "country", "message", "date", "time"].forEach(function (n) { d[n] = form.elements[n].value; });
    try { sessionStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
  }
  form.addEventListener("input", saveDraft);
  form.addEventListener("change", saveDraft);

  function showError(msg, field) {
    errEl.textContent = msg; errEl.hidden = false;
    (field || errEl).scrollIntoView({ behavior: "smooth", block: "center" });
    if (field) field.focus({ preventScroll: true });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    errEl.hidden = true;
    var f = form.elements;
    if (!f.date.value || f.date.value < today()) return showError("Please choose a preferred date from today onwards.", f.date);
    if (AV.days.indexOf(weekday(f.date.value)) < 0) return showError("Please choose a day when we're available (" + AV.days.map(function (x) { return DAY_NAMES[x]; }).join(", ") + ").", f.date);
    if (!f.time.value) return showError("Please choose an available time.", f.time);
    if (f.name.value.trim().length < 2) return showError("Please enter your full name.", f.name);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.value.trim())) return showError("Please enter a valid email address.", f.email);
    if (f.phone.value.trim().length < 6) return showError("Please enter a phone or WhatsApp number so we can confirm your time.", f.phone);
    if (!f.message.value.trim()) return showError("Please tell us how we can help.", f.message);
    if (!f.terms.checked) return showError("Please accept the Terms & Conditions to continue.", f.terms);
    if (!API) return showError("Online booking isn't available right now. Please email contact@qalbeabbas.com and we'll arrange your consultation.");

    submitBtn.disabled = true; submitBtn.dataset.label = submitBtn.innerHTML; submitBtn.textContent = "Please wait…";
    fetch(API + "/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        submission: {
          kind: "booking", consultation: f.consultation.value, topic: topic || null,
          customer: { name: f.name.value, email: f.email.value, phone: f.phone.value, country: f.country.value || null },
          date: f.date.value, time: f.time.value, timezone: AV.timezone, message: f.message.value
        },
        acceptTerms: true
      })
    })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok && res.j.redirectUrl) { window.location.href = res.j.redirectUrl; return; }
        submitBtn.disabled = false; submitBtn.innerHTML = submitBtn.dataset.label;
        showError(res.j.error || "Something went wrong. Please try again.");
      })
      .catch(function () {
        submitBtn.disabled = false; submitBtn.innerHTML = submitBtn.dataset.label;
        showError("We couldn't reach our secure payment page. Please check your connection and try again, or email contact@qalbeabbas.com.");
      });
  });
})();
