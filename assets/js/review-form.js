/* "Leave a review" form: photo preview, character count and sending to /api/review.php. */
(function () {
  "use strict";
  var form = document.querySelector("[data-review-form]");
  if (!form) return;
  var status = form.querySelector("[data-review-status]");
  var photo = form.querySelector("#rv-photo");
  var preview = form.querySelector("[data-photo-preview]");
  var text = form.querySelector("#rv-text");
  var count = form.querySelector("[data-review-count]");
  var btn = form.querySelector(".rv-submit");
  var MAX = 3 * 1024 * 1024;

  function show(msg, ok) {
    status.hidden = false; status.textContent = msg;
    status.className = "rv-status " + (ok ? "rv-status--ok" : "rv-status--err");
  }
  text.addEventListener("input", function () { count.textContent = text.value.length + " / 1200"; });
  photo.addEventListener("change", function () {
    var f = photo.files && photo.files[0];
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { show("Please choose a JPG, PNG or WebP photo.", false); photo.value = ""; return; }
    if (f.size > MAX) { show("The photo must be 3 MB or smaller.", false); photo.value = ""; return; }
    status.hidden = true;
    var url = URL.createObjectURL(f);
    preview.innerHTML = '<img src="' + url + '" alt="Your photo preview" width="64" height="64">';
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!form.reportValidity()) return;
    if (!form.querySelector('input[name="rating"]:checked')) { show("Please choose a star rating.", false); return; }
    btn.disabled = true; btn.classList.add("is-loading");
    show("Sending your review…", true);
    fetch(form.action, { method: "POST", body: new FormData(form) })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .then(function (res) {
        if (res && res.ok) {
          form.reset(); count.textContent = "0 / 1200";
          preview.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-users"></use></svg>';
          show("Thank you! Your review has been sent to our team. We'll check it and publish it on the website soon.", true);
        } else {
          show((res && res.error) || "Sorry, something went wrong. Please try again or email contact@qalbeabbas.com.", false);
        }
      })
      .catch(function () { show("Sorry, we couldn't send your review. Please check your connection or email contact@qalbeabbas.com.", false); })
      .then(function () { btn.disabled = false; btn.classList.remove("is-loading"); });
  });
})();
