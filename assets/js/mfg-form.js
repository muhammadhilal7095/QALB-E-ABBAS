/* Popup request forms ([data-mfg-form] inside a <dialog>):
   - /china-sourcing: product manufacturing request (with product picture) → /api/manufacturing.php
   - /stock-exchange: managed investing application → /api/invest.php
   Buttons with data-mfg-open="<dialog id>" open the popup; the close button, Esc or a click outside closes it. */
(function () {
  "use strict";

  function shrink(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
        var ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob(function (b) { resolve(b ? new File([b], "product.jpg", { type: "image/jpeg" }) : null); }, "image/jpeg", 0.88);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }

  document.querySelectorAll("[data-mfg-form]").forEach(function (form) {
    var dialog = form.closest("dialog");
    var status = form.querySelector("[data-mfg-status]");
    var btn = form.querySelector(".mfg-submit");
    var photo = form.querySelector('input[type="file"]');
    var preview = form.querySelector("[data-mfg-preview]");
    var hint = form.querySelector("[data-mfg-file]");
    var emptyHint = hint ? hint.textContent : "";
    var okText = form.getAttribute("data-ok") || "Thank you! Your request has been sent.";
    var ready = null; // picture shrunk in the browser (max 1600px JPG)

    function show(msg, ok) {
      status.hidden = false; status.textContent = msg;
      status.className = "rv-status " + (ok ? "rv-status--ok" : "rv-status--err");
    }
    function clearPhoto() {
      ready = null;
      if (photo) photo.value = "";
      if (preview) preview.innerHTML = "";
      if (hint) hint.textContent = emptyHint;
    }

    // Popup open / close
    function openDialog(e) {
      if (e) e.preventDefault();
      if (!dialog || dialog.open) return;
      if (dialog.showModal) dialog.showModal(); else dialog.setAttribute("open", "");
      document.documentElement.classList.add("mfg-lock");
      setTimeout(function () { var f = form.querySelector("input:not([type=hidden]):not([tabindex='-1'])"); if (f) f.focus(); }, 60);
    }
    function closeDialog() { if (dialog && dialog.open) { if (dialog.close) dialog.close(); else dialog.removeAttribute("open"); } }
    if (dialog) {
      document.querySelectorAll('[data-mfg-open="' + dialog.id + '"]').forEach(function (b) { b.addEventListener("click", openDialog); });
      dialog.querySelectorAll("[data-mfg-close]").forEach(function (b) { b.addEventListener("click", closeDialog); });
      dialog.addEventListener("click", function (e) { if (e.target === dialog) closeDialog(); });
      dialog.addEventListener("close", function () { document.documentElement.classList.remove("mfg-lock"); });
      if (location.hash === "#" + dialog.id) openDialog();
    }

    if (photo) {
      photo.addEventListener("change", function () {
        var f = photo.files && photo.files[0];
        if (!f) return;
        status.hidden = true;
        shrink(f).then(function (small) {
          if (!small) { clearPhoto(); show("This picture can't be opened. Please choose a JPG, PNG or WebP image.", false); return; }
          ready = small;
          if (preview) preview.innerHTML = '<img src="' + URL.createObjectURL(small) + '" alt="Picture preview">';
          if (hint) hint.textContent = f.name;
        });
      });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      if (photo && photo.hasAttribute("data-required") && !ready && !(photo.files && photo.files[0])) { show("Please add a picture of the product.", false); return; }
      btn.disabled = true;
      show("Sending…", true);
      var fd = new FormData(form);
      if (ready) fd.set(photo.name, ready, "product.jpg");
      fetch(form.action, { method: "POST", body: fd })
        .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
        .then(function (res) {
          if (res && res.ok) {
            form.reset(); clearPhoto();
            show(okText + (res.ref ? " Your reference: " + res.ref + "." : ""), true);
          } else {
            show((res && res.error) || "Sorry, something went wrong. Please try again or email contact@qalbeabbas.com.", false);
          }
        })
        .catch(function () { show("Sorry, we couldn't send this. Please check your connection or email contact@qalbeabbas.com.", false); })
        .then(function () { btn.disabled = false; });
    });
  });
})();
