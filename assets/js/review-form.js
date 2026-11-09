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
  var ready = null; // photo shrunk in the browser (max 1000px JPG), sent instead of the original

  function shrink(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var s = Math.min(1, 1000 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
        var ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob(function (b) { resolve(b ? new File([b], "photo.jpg", { type: "image/jpeg" }) : null); }, "image/jpeg", 0.88);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }

  function show(msg, ok) {
    status.hidden = false; status.textContent = msg;
    status.className = "rv-status " + (ok ? "rv-status--ok" : "rv-status--err");
  }
  text.addEventListener("input", function () { count.textContent = text.value.length + " / 1200"; });
  photo.addEventListener("change", function () {
    var f = photo.files && photo.files[0];
    if (!f) return;
    ready = null; status.hidden = true;
    shrink(f).then(function (small) {
      if (!small) { show("This photo can't be opened. Please choose a JPG or PNG photo (or a screenshot of it).", false); photo.value = ""; return; }
      ready = small;
      preview.innerHTML = '<img src="' + URL.createObjectURL(small) + '" alt="Your photo preview" width="64" height="64">';
    });
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!form.reportValidity()) return;
    if (!form.querySelector('input[name="rating"]:checked')) { show("Please choose a star rating.", false); return; }
    btn.disabled = true; btn.classList.add("is-loading");
    show("Sending your review…", true);
    var fd = new FormData(form);
    if (ready) fd.set("photo", ready, "photo.jpg");
    fetch(form.action, { method: "POST", body: fd })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .then(function (res) {
        if (res && res.ok) {
          form.reset(); ready = null; count.textContent = "0 / 1200";
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
