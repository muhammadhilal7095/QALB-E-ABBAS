/* Qalb-E-Abbas admin — blog post editor (rich text, images, SEO helpers). */
(function () {
  "use strict";
  var form = document.getElementById("post-form");
  if (!form) return;
  var ed = document.getElementById("ed");
  var src = document.getElementById("ed-src");
  var hidden = form.querySelector('textarea[name="content"]');
  var csrf = form.querySelector('input[name="csrf"]').value;
  var sourceMode = false;

  function $(s) { return form.querySelector(s); }
  function exec(cmd, val) { ed.focus(); document.execCommand(cmd, false, val || null); }

  // ---------- Toolbar ----------
  document.getElementById("ed-bar").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-cmd]");
    if (!b) return;
    e.preventDefault();
    if (sourceMode && b.dataset.cmd !== "source") return;
    var c = b.dataset.cmd;
    if (c === "h2" || c === "h3" || c === "p" || c === "blockquote") exec("formatBlock", c === "p" ? "P" : c.toUpperCase());
    else if (c === "link") {
      var url = window.prompt("Link address (for example /amazon-fba or https://sell.amazon.com):", "https://");
      if (url) exec("createLink", url.trim());
    } else if (c === "image") pickImage(function (u, alt) {
      exec("insertHTML", '<figure><img src="' + u + '" alt="' + alt.replace(/"/g, "&quot;") + '"><figcaption>' + (alt || "") + "</figcaption></figure><p><br></p>");
    });
    else if (c === "video") {
      var v = window.prompt("YouTube or Vimeo link:");
      var id = v && (v.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/) || [])[1];
      var vm = v && (v.match(/vimeo\.com\/(\d+)/) || [])[1];
      if (id) exec("insertHTML", '<p><iframe src="https://www.youtube-nocookie.com/embed/' + id + '" title="Video"></iframe></p><p><br></p>');
      else if (vm) exec("insertHTML", '<p><iframe src="https://player.vimeo.com/video/' + vm + '" title="Video"></iframe></p><p><br></p>');
      else if (v) window.alert("Please paste a YouTube or Vimeo link.");
    } else if (c === "table") {
      exec("insertHTML", "<table><thead><tr><th>Column 1</th><th>Column 2</th></tr></thead><tbody><tr><td>…</td><td>…</td></tr><tr><td>…</td><td>…</td></tr></tbody></table><p><br></p>");
    } else if (c === "source") {
      sourceMode = !sourceMode;
      if (sourceMode) { src.value = ed.innerHTML; } else { ed.innerHTML = src.value; }
      ed.hidden = sourceMode; src.hidden = !sourceMode;
      b.classList.toggle("is-on", sourceMode);
    } else exec(c);
    checks();
  });

  // Paste as clean text + basic structure (no fonts/colours from Word or Google Docs).
  ed.addEventListener("paste", function (e) {
    var html = e.clipboardData && e.clipboardData.getData("text/html");
    if (!html) return;
    e.preventDefault();
    var box = document.createElement("div");
    box.innerHTML = html;
    box.querySelectorAll("style,script,meta,link,title").forEach(function (n) { n.remove(); });
    box.querySelectorAll("*").forEach(function (n) {
      ["style", "class", "id", "face", "color", "size", "dir", "lang"].forEach(function (a) { n.removeAttribute(a); });
      if (n.tagName === "H1") { var h = document.createElement("h2"); h.innerHTML = n.innerHTML; n.replaceWith(h); }
    });
    document.execCommand("insertHTML", false, box.innerHTML);
  });

  // ---------- Image upload (inline images and the cover) ----------
  function upload(file, done) {
    var fd = new FormData();
    fd.append("do", "blog_upload"); fd.append("csrf", csrf); fd.append("image", file);
    var status = document.getElementById("ed-status");
    status.textContent = "Uploading image…";
    fetch("/admin/", { method: "POST", body: fd, credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (j) { status.textContent = j.ok ? "" : (j.error || "Upload failed."); if (j.ok) done(j.url); })
      .catch(function () { status.textContent = "Upload failed. Please try again."; });
  }
  function pickImage(done) {
    var inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/jpeg,image/png,image/webp,image/gif";
    inp.onchange = function () {
      if (!inp.files[0]) return;
      var alt = window.prompt("Describe the image in a few words (alt text — helps Google and blind visitors):", "") || "";
      upload(inp.files[0], function (u) { done(u, alt.trim()); });
    };
    inp.click();
  }
  var coverBtn = document.getElementById("cover-btn");
  if (coverBtn) coverBtn.addEventListener("click", function (e) {
    e.preventDefault();
    var inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/jpeg,image/png,image/webp";
    inp.onchange = function () {
      if (inp.files[0]) upload(inp.files[0], function (u) {
        $('input[name="cover"]').value = u;
        var img = document.getElementById("cover-img");
        img.src = u; img.hidden = false;
        document.getElementById("cover-remove").hidden = false;
        checks();
      });
    };
    inp.click();
  });
  var coverRemove = document.getElementById("cover-remove");
  if (coverRemove) coverRemove.addEventListener("click", function (e) {
    e.preventDefault();
    $('input[name="cover"]').value = "";
    document.getElementById("cover-img").hidden = true; coverRemove.hidden = true;
    checks();
  });

  // ---------- FAQ rows ----------
  var faqs = document.getElementById("faqs");
  document.getElementById("faq-add").addEventListener("click", function (e) {
    e.preventDefault();
    var row = document.createElement("div");
    row.className = "faq-row";
    row.innerHTML = '<input name="faq_q[]" placeholder="Question" maxlength="200"><textarea name="faq_a[]" rows="2" placeholder="Answer" maxlength="1000"></textarea><button type="button" class="linkbtn linkbtn--danger" data-faq-del>Remove</button>';
    faqs.appendChild(row);
    row.querySelector("input").focus();
  });
  faqs.addEventListener("click", function (e) { if (e.target.matches("[data-faq-del]")) e.target.closest(".faq-row").remove(); });

  // ---------- Slug, counters, Google preview, live checklist ----------
  var title = $('input[name="title"]'), slug = $('input[name="slug"]'), seoT = $('input[name="seoTitle"]'), seoD = $('textarea[name="seoDescription"]'),
      excerpt = $('textarea[name="excerpt"]'), kw = $('input[name="keyword"]');
  var slugTouched = !!slug.value;
  function slugify(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80); }
  slug.addEventListener("input", function () { slugTouched = true; });
  title.addEventListener("input", function () { if (!slugTouched) slug.value = slugify(title.value); });

  function counter(el, min, max) {
    var n = el.value.length || (el.placeholder || "").length;
    var out = el.parentNode.querySelector(".count");
    if (out) { out.textContent = n + " / " + max; out.className = "count " + (n >= min && n <= max ? "is-ok" : "is-warn"); }
  }
  function text() { return (sourceMode ? src.value : ed.innerHTML).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(); }
  function checks() {
    seoT.placeholder = title.value ? title.value + " | Qalb-E-Abbas" : "";
    seoD.placeholder = excerpt.value;
    counter(seoT, 30, 62); counter(seoD, 120, 160);
    var t = seoT.value || seoT.placeholder, d = seoD.value || seoD.placeholder, k = kw.value.trim().toLowerCase();
    document.getElementById("g-title").textContent = t || "Your SEO title";
    document.getElementById("g-url").textContent = "qalbeabbas.com › blog › " + (slug.value || "your-post");
    document.getElementById("g-desc").textContent = d || "Your meta description shows here.";
    var body = text(), words = body ? body.split(" ").length : 0, html = sourceMode ? src.value : ed.innerHTML, lower = body.toLowerCase();
    var list = [
      [t.length >= 30 && t.length <= 62, "SEO title 50–60 characters"],
      [d.length >= 120 && d.length <= 160, "Meta description 140–160 characters"],
      [words >= 600, "600+ words (now " + words + ")"],
      [(html.match(/<h[23]/gi) || []).length >= 2, "At least 2 subheadings"],
      [!!$('input[name="cover"]').value, "Cover image"],
      [/href="(\/|https?:\/\/(www\.)?qalbeabbas\.com)/.test(html), "Link to one of your pages"],
      [/href="https?:\/\/(?!(www\.)?qalbeabbas\.com)/.test(html), "Link to a trusted outside source"]
    ];
    if (k) list.push(
      [t.toLowerCase().indexOf(k) >= 0, "Keyword in SEO title"],
      [d.toLowerCase().indexOf(k) >= 0, "Keyword in description"],
      [slug.value.indexOf(slugify(k)) >= 0, "Keyword in URL"],
      [lower.slice(0, 600).indexOf(k) >= 0, "Keyword in first paragraph"]
    ); else list.push([false, "Set a focus keyword"]);
    var ok = list.filter(function (x) { return x[0]; }).length, score = Math.round(ok / list.length * 100);
    var box = document.getElementById("seo-live");
    box.innerHTML = '<div class="seo-score seo-score--' + (score >= 80 ? "good" : score >= 50 ? "mid" : "low") + '"><b>' + score + "</b><span>SEO score</span></div><ul>" +
      list.map(function (x) { return '<li class="' + (x[0] ? "is-ok" : "is-no") + '">' + x[1] + "</li>"; }).join("") + "</ul>";
  }
  form.addEventListener("input", checks);
  ed.addEventListener("input", checks);
  checks();

  // ---------- Save ----------
  var dirty = false;
  form.addEventListener("input", function () { dirty = true; });
  ed.addEventListener("input", function () { dirty = true; });
  window.addEventListener("beforeunload", function (e) { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
  form.addEventListener("submit", function () {
    hidden.value = sourceMode ? src.value : ed.innerHTML;
    dirty = false;
  });
  document.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.submit(); }
  });
})();
