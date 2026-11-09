/* ==========================================================================
   Photo cropper (no libraries) — used for review photos in the admin and on
   /leave-review.  window.qaCropPhoto(file) → Promise<File|null>
   Drag to move, slider / mouse wheel / pinch to zoom, rotate. Output: square
   600×600 JPG (shown as a circle on the website).
   ========================================================================== */
(function () {
  "use strict";
  if (window.qaCropPhoto) return;

  var CSS = ".qcrop{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:16px;background:rgba(8,18,38,.72);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);font:15px/1.4 Inter,-apple-system,Segoe UI,Roboto,sans-serif}" +
    ".qcrop__box{width:min(420px,100%);background:#fff;border-radius:20px;padding:20px;box-shadow:0 30px 70px -20px rgba(0,0,0,.5);color:#0B1B36}" +
    ".qcrop__box h2{margin:0 0 4px;font-size:1.1rem}.qcrop__box p{margin:0 0 14px;font-size:.85rem;color:#5F6E85}" +
    ".qcrop__stage{position:relative;width:100%;aspect-ratio:1;border-radius:14px;overflow:hidden;background:#0B1B36;touch-action:none;cursor:grab;user-select:none}" +
    ".qcrop__stage:active{cursor:grabbing}.qcrop__stage canvas{display:block;width:100%;height:100%}" +
    ".qcrop__ring{position:absolute;inset:0;pointer-events:none;border-radius:50%;box-shadow:0 0 0 999px rgba(8,18,38,.55);outline:2px solid rgba(255,255,255,.9);outline-offset:-2px}" +
    ".qcrop__tools{display:flex;align-items:center;gap:10px;margin:14px 0 4px}.qcrop__tools input{flex:1;accent-color:#1F55E0}" +
    ".qcrop__btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:42px;padding:0 16px;border-radius:10px;border:1px solid #D5DCE7;background:#fff;color:#0B1B36;font:600 .9rem/1 inherit;cursor:pointer}" +
    ".qcrop__btn:hover{background:#F2F5FA}.qcrop__btn--primary{background:#1F55E0;border-color:#1F55E0;color:#fff}.qcrop__btn--primary:hover{background:#1846C2}" +
    ".qcrop__icon{min-width:42px;padding:0}.qcrop__actions{display:grid;grid-template-columns:1fr 1.4fr;gap:10px;margin-top:14px}";

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(); };
      img.src = url;
    });
  }

  window.qaCropPhoto = function (file, opts) {
    opts = opts || {};
    var OUT = opts.size || 600;
    if (!document.getElementById("qcrop-css")) {
      var st = document.createElement("style"); st.id = "qcrop-css"; st.textContent = CSS; document.head.appendChild(st);
    }
    return loadImage(file).then(function (img) {
      return new Promise(function (resolve) {
        var wrap = document.createElement("div");
        wrap.className = "qcrop"; wrap.setAttribute("role", "dialog"); wrap.setAttribute("aria-modal", "true"); wrap.setAttribute("aria-label", "Crop photo");
        wrap.innerHTML = '<div class="qcrop__box"><h2>Crop the photo</h2><p>Drag to move \u00b7 zoom with the slider \u00b7 keep the face inside the circle.</p>' +
          '<div class="qcrop__stage"><canvas></canvas><div class="qcrop__ring"></div></div>' +
          '<div class="qcrop__tools"><button type="button" class="qcrop__btn qcrop__icon" data-z="-" aria-label="Zoom out">\u2212</button><input type="range" min="1" max="4" step="0.01" value="1" aria-label="Zoom"><button type="button" class="qcrop__btn qcrop__icon" data-z="+" aria-label="Zoom in">+</button><button type="button" class="qcrop__btn qcrop__icon" data-rot aria-label="Rotate">\u27f3</button></div>' +
          '<div class="qcrop__actions"><button type="button" class="qcrop__btn" data-cancel>Cancel</button><button type="button" class="qcrop__btn qcrop__btn--primary" data-ok>Use this photo</button></div></div>';
        document.body.appendChild(wrap);
        var stage = wrap.querySelector(".qcrop__stage"), canvas = wrap.querySelector("canvas"), ctx = canvas.getContext("2d"), range = wrap.querySelector('input[type="range"]');
        var S, rot = 0, zoom = 1, x = 0, y = 0; // x,y = top-left of the image inside the stage (CSS px)

        function dims() { var r = rot % 180 !== 0; return { w: r ? img.naturalHeight : img.naturalWidth, h: r ? img.naturalWidth : img.naturalHeight }; }
        function scale() { var d = dims(); return S / Math.min(d.w, d.h) * zoom; }
        function clamp() {
          var d = dims(), s = scale();
          x = Math.min(0, Math.max(S - d.w * s, x));
          y = Math.min(0, Math.max(S - d.h * s, y));
        }
        function draw(c, size) {
          var k = size / S, d = dims(), s = scale();
          c.save();
          c.fillStyle = "#fff"; c.fillRect(0, 0, size, size);
          c.translate((x + d.w * s / 2) * k, (y + d.h * s / 2) * k);
          c.rotate(rot * Math.PI / 180);
          c.imageSmoothingQuality = "high";
          c.drawImage(img, -img.naturalWidth * s * k / 2, -img.naturalHeight * s * k / 2, img.naturalWidth * s * k, img.naturalHeight * s * k);
          c.restore();
        }
        function render() { var dpr = window.devicePixelRatio || 1; canvas.width = Math.round(S * dpr); canvas.height = Math.round(S * dpr); draw(ctx, S * dpr); }
        function setZoom(z, cx, cy) {
          var old = scale();
          zoom = Math.min(4, Math.max(1, z));
          var ns = scale();
          cx = cx == null ? S / 2 : cx; cy = cy == null ? S / 2 : cy;
          x = cx - (cx - x) * ns / old; y = cy - (cy - y) * ns / old;
          range.value = String(zoom); clamp(); render();
        }
        function center() { var d = dims(), s = scale(); x = (S - d.w * s) / 2; y = (S - d.h * s) / 2; clamp(); render(); }
        S = stage.getBoundingClientRect().width;
        center();

        // Drag (mouse, touch, pen) and pinch
        var pts = {}, last = null, pinch = null;
        stage.addEventListener("pointerdown", function (e) { stage.setPointerCapture(e.pointerId); pts[e.pointerId] = { x: e.clientX, y: e.clientY }; last = { x: e.clientX, y: e.clientY }; });
        stage.addEventListener("pointermove", function (e) {
          if (!pts[e.pointerId]) return;
          pts[e.pointerId] = { x: e.clientX, y: e.clientY };
          var ids = Object.keys(pts);
          if (ids.length === 2) {
            var a = pts[ids[0]], b = pts[ids[1]], dist = Math.hypot(a.x - b.x, a.y - b.y), r = stage.getBoundingClientRect();
            if (pinch) setZoom(zoom * dist / pinch, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
            pinch = dist; return;
          }
          if (last) { x += e.clientX - last.x; y += e.clientY - last.y; clamp(); render(); }
          last = { x: e.clientX, y: e.clientY };
        });
        function up(e) { delete pts[e.pointerId]; pinch = null; last = null; }
        stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
        stage.addEventListener("wheel", function (e) { e.preventDefault(); var r = stage.getBoundingClientRect(); setZoom(zoom * (e.deltaY < 0 ? 1.08 : 0.93), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
        range.addEventListener("input", function () { setZoom(Number(range.value)); });
        wrap.querySelectorAll("[data-z]").forEach(function (b) { b.addEventListener("click", function () { setZoom(zoom + (b.dataset.z === "+" ? 0.2 : -0.2)); }); });
        wrap.querySelector("[data-rot]").addEventListener("click", function () { rot = (rot + 90) % 360; zoom = 1; range.value = "1"; center(); });

        function close(result) { document.removeEventListener("keydown", onKey); wrap.remove(); URL.revokeObjectURL(img.src); resolve(result); }
        function onKey(e) { if (e.key === "Escape") close(null); }
        document.addEventListener("keydown", onKey);
        wrap.querySelector("[data-cancel]").addEventListener("click", function () { close(null); });
        wrap.addEventListener("click", function (e) { if (e.target === wrap) close(null); });
        wrap.querySelector("[data-ok]").addEventListener("click", function () {
          var out = document.createElement("canvas"); out.width = OUT; out.height = OUT;
          draw(out.getContext("2d"), OUT);
          out.toBlob(function (b) { close(b ? new File([b], "photo.jpg", { type: "image/jpeg" }) : null); }, "image/jpeg", 0.9);
        });
        wrap.querySelector("[data-ok]").focus();
      });
    }).catch(function () {
      window.alert("This photo can't be opened here. Please choose a JPG or PNG photo (or a screenshot of it).");
      return null;
    });
  };
})();
