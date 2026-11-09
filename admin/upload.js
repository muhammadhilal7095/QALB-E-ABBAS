/* Admin: photos are shrunk in the browser before upload (max 1200px, JPG).
   Big phone photos and iPhone HEIC photos (on Safari) then always upload fine. */
(function () {
  "use strict";
  function resize(file, max) {
    return new Promise(function (resolve) {
      if (!file || !/^image\//.test(file.type || "") && !/\.(heic|heif)$/i.test(file.name)) return resolve(file);
      if (file.type === "image/gif") return resolve(file);
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
        var ctx = c.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) {
          if (!b) return resolve(file);
          resolve(new File([b], (file.name || "photo").replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }));
        }, "image/jpeg", 0.88);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }
  window.qaResizeImage = resize;

  document.addEventListener("change", function (e) {
    var input = e.target;
    if (!input.matches || !input.matches('input[type="file"][name="photo"]') || !input.files[0] || input.dataset.resized === "1") return;
    var form = input.form, btns = form ? form.querySelectorAll("button") : [];
    btns.forEach(function (b) { b.disabled = true; });
    var note = input.parentNode.querySelector(".up-note");
    if (!note) { note = document.createElement("small"); note.className = "up-note"; input.parentNode.appendChild(note); }
    note.textContent = "Preparing photo…";
    resize(input.files[0], 1200).then(function (f) {
      try { var dt = new DataTransfer(); dt.items.add(f); input.files = dt.files; input.dataset.resized = "1"; } catch (err) { /* old browser: upload original */ }
      var prev = input.parentNode.querySelector(".up-prev");
      if (!prev) { prev = document.createElement("img"); prev.className = "up-prev"; prev.alt = ""; input.parentNode.appendChild(prev); }
      prev.src = URL.createObjectURL(f);
      note.textContent = "Ready — " + Math.max(1, Math.round(f.size / 1024)) + " KB. Press Save / Approve to upload it.";
      btns.forEach(function (b) { b.disabled = false; });
    });
  });
  document.addEventListener("click", function (e) {
    var i = e.target.matches && e.target.matches('input[type="file"][name="photo"]') ? e.target : null;
    if (i) i.dataset.resized = "";
  });
})();
