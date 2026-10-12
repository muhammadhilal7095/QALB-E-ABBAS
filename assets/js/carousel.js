/* ==========================================================================
   Carousel — seamless looping slider used by the hero and testimonials.

   Markup:
     <div class="carousel" data-carousel>
       <div class="carousel__viewport"><div class="carousel__track">
         <div class="carousel__slide">…</div> …
       </div></div>
       <button data-carousel-prev>  <button data-carousel-next>
       <button data-carousel-toggle>  <div data-carousel-dots>
     </div>

   Looping works by cloning `perView` slides onto each end and silently
   jumping back to the real slide after a transition lands on a clone.
   ========================================================================== */
(function () {
  "use strict";

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)");
  var CAN_HOVER = window.matchMedia("(hover: hover) and (pointer: fine)");

  function Carousel(root, opts) {
    this.root = root;
    this.o = Object.assign({
      perView: function () { return 1; },
      interval: 5000,
      duration: 700,
      dotLabel: "Go to slide",
      onChange: null
    }, opts || {});
    this.viewport = root.querySelector(".carousel__viewport");
    this.track = root.querySelector(".carousel__track");
    this.slides = Array.prototype.slice.call(this.track.children);
    this.n = this.slides.length;
    this.per = 0;
    this.k = 0;
    this.index = 0;
    this.real = 0;
    this.timer = null;
    this.pause = { user: REDUCED.matches, hover: false, focus: false, hidden: document.hidden, drag: false, offscreen: false };
    if (this.n < 2) return;
    this.setup();
  }

  Carousel.prototype.setup = function () {
    var self = this;
    this.slides.forEach(function (s, i) {
      s.setAttribute("role", "group");
      s.setAttribute("aria-roledescription", "slide");
      s.setAttribute("aria-label", (i + 1) + " of " + self.n);
    });
    this.buildDots();
    this.build();

    var q = function (sel) { return self.root.querySelector(sel); };
    var prev = q("[data-carousel-prev]"), next = q("[data-carousel-next]");
    this.toggleBtn = q("[data-carousel-toggle]");
    if (prev) prev.addEventListener("click", function () { self.move(-1); });
    if (next) next.addEventListener("click", function () { self.move(1); });
    if (this.toggleBtn) this.toggleBtn.addEventListener("click", function () {
      self.pause.user = !self.pause.user;
      self.syncToggle();
      self.schedule();
    });
    this.syncToggle();

    this.track.addEventListener("transitionend", function (e) {
      if (e.target === self.track && e.propertyName === "transform") self.normalize();
    });

    // Pause on hover (desktop pointers) and while keyboard focus is inside.
    this.root.addEventListener("mouseenter", function () {
      if (CAN_HOVER.matches) { self.pause.hover = true; self.schedule(); }
    });
    this.root.addEventListener("mouseleave", function () { self.pause.hover = false; self.schedule(); });
    this.root.addEventListener("focusin", function (e) {
      var fv = false;
      try { fv = e.target.matches(":focus-visible"); } catch (err) { fv = true; }
      if (fv && e.target !== self.toggleBtn) { self.pause.focus = true; self.schedule(); }
    });
    this.root.addEventListener("focusout", function (e) {
      if (!self.root.contains(e.relatedTarget)) { self.pause.focus = false; self.schedule(); }
    });
    document.addEventListener("visibilitychange", function () {
      self.pause.hidden = document.hidden;
      self.schedule();
    });
    // Don't advance while scrolled out of view.
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        self.pause.offscreen = !entries[0].isIntersecting;
        self.schedule();
      }, { threshold: 0.15 }).observe(this.root);
    }

    this.root.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { e.preventDefault(); self.move(-1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); self.move(1); }
    });

    this.initSwipe();

    var resizeT;
    window.addEventListener("resize", function () {
      clearTimeout(resizeT);
      resizeT = setTimeout(function () {
        if (self.o.perView() !== self.per) self.build();
      }, 120);
    });
    REDUCED.addEventListener("change", function () {
      self.pause.user = REDUCED.matches;
      self.syncToggle();
      self.schedule();
    });

    this.schedule();
  };

  /* Rebuild clones for the current number of visible slides. */
  Carousel.prototype.build = function () {
    var self = this;
    Array.prototype.slice.call(this.track.querySelectorAll(".is-clone")).forEach(function (c) { c.remove(); });
    this.per = Math.min(this.o.perView(), this.n);
    this.k = this.per;
    this.root.style.setProperty("--per-view", this.per);

    function clone(s) {
      var c = s.cloneNode(true);
      c.classList.add("is-clone");
      c.removeAttribute("id");
      c.querySelectorAll("[id]").forEach(function (el) { el.removeAttribute("id"); });
      c.setAttribute("aria-hidden", "true");
      c.inert = true;
      return c;
    }
    for (var i = 0; i < this.k; i++) {
      this.track.insertBefore(clone(this.slides[this.n - 1 - i]), this.track.firstChild);
      this.track.appendChild(clone(this.slides[i]));
    }
    this.index = this.k + this.real;
    this.render(false);
  };

  Carousel.prototype.buildDots = function () {
    var wrap = this.root.querySelector("[data-carousel-dots]");
    if (!wrap) return;
    var self = this, html = "";
    for (var i = 0; i < this.n; i++) {
      html += '<button type="button" class="carousel__dot" aria-label="' + this.o.dotLabel + " " + (i + 1) + '"></button>';
    }
    wrap.innerHTML = html;
    this.dots = Array.prototype.slice.call(wrap.children);
    this.dots.forEach(function (d, i) {
      d.addEventListener("click", function () { self.goTo(i); });
    });
  };

  Carousel.prototype.render = function (animate, dragPx) {
    var dur = animate && !REDUCED.matches ? this.o.duration : 0;
    this.track.style.transition = dur ? "transform " + dur + "ms cubic-bezier(.22,.61,.36,1)" : "none";
    var pct = -this.index * (100 / this.per);
    this.track.style.transform = "translate3d(calc(" + pct + "% + " + (dragPx || 0) + "px),0,0)";
    if (!dur && dragPx == null) this.normalize();
    this.updateState();
  };

  /* If we're sitting on a clone, jump (without animation) to the real slide. */
  Carousel.prototype.normalize = function () {
    var start = this.k, end = this.k + this.n;
    if (this.index >= start && this.index < end) return;
    this.index = this.index >= end ? this.index - this.n : this.index + this.n;
    this.track.style.transition = "none";
    this.track.style.transform = "translate3d(" + (-this.index * (100 / this.per)) + "%,0,0)";
    void this.track.offsetWidth; // commit the jump before any next animation
    this.updateState();
  };

  Carousel.prototype.move = function (delta) {
    this.normalize();
    this.index += delta;
    this.render(true);
    this.schedule();
  };

  Carousel.prototype.goTo = function (i) {
    this.normalize();
    this.index = this.k + i;
    this.render(true);
    this.schedule();
  };

  Carousel.prototype.updateState = function () {
    var self = this;
    this.real = ((this.index - this.k) % this.n + this.n) % this.n;
    var all = this.track.children;
    for (var p = 0; p < all.length; p++) {
      var el = all[p];
      var visible = p >= this.index && p < this.index + this.per;
      el.classList.toggle("is-active", visible);
      if (!el.classList.contains("is-clone")) {
        el.inert = !visible;
        if (visible) el.removeAttribute("aria-hidden"); else el.setAttribute("aria-hidden", "true");
      }
    }
    if (this.dots) this.dots.forEach(function (d, i) {
      if (i === self.real) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current");
    });
    if (this.o.onChange) this.o.onChange(this.real);
  };

  Carousel.prototype.isPaused = function () {
    var p = this.pause;
    return p.user || p.hover || p.focus || p.hidden || p.drag || p.offscreen;
  };

  /* (Re)start the autoplay countdown — called after every interaction. */
  Carousel.prototype.schedule = function () {
    var self = this;
    clearTimeout(this.timer);
    this.viewport.setAttribute("aria-live", this.isPaused() ? "polite" : "off");
    if (this.isPaused()) return;
    this.timer = setTimeout(function () { self.move(1); }, this.o.interval);
  };

  Carousel.prototype.syncToggle = function () {
    if (!this.toggleBtn) return;
    var paused = this.pause.user;
    this.toggleBtn.setAttribute("aria-label", paused ? "Play slideshow" : "Pause slideshow");
    this.toggleBtn.setAttribute("aria-pressed", String(paused));
    var use = this.toggleBtn.querySelector("use");
    if (use) use.setAttribute("href", paused ? "#i-play" : "#i-pause");
  };

  /* Touch swipe. touch-action: pan-y (CSS) leaves vertical scrolling native. */
  Carousel.prototype.initSwipe = function () {
    var self = this, vp = this.viewport;
    var x0 = 0, y0 = 0, t0 = 0, dx = 0, state = "idle", suppressClick = false, pid = null;

    vp.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" || !e.isPrimary) return;
      x0 = e.clientX; y0 = e.clientY; t0 = Date.now(); dx = 0;
      state = "pending"; pid = e.pointerId;
    });
    vp.addEventListener("pointermove", function (e) {
      if (state === "idle" || e.pointerId !== pid) return;
      dx = e.clientX - x0;
      var dy = e.clientY - y0;
      if (state === "pending") {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { state = "idle"; return; }
        if (Math.abs(dx) > 8) {
          state = "drag";
          self.normalize();
          self.pause.drag = true; self.schedule();
          try { vp.setPointerCapture(pid); } catch (err) { /* ignore */ }
        }
      }
      if (state === "drag") self.render(false, dx);
    });
    function end() {
      if (state !== "drag") { state = "idle"; return; }
      state = "idle";
      self.pause.drag = false;
      suppressClick = Math.abs(dx) > 6;
      var w = vp.clientWidth / self.per;
      var fast = Math.abs(dx) / Math.max(1, Date.now() - t0) > 0.45;
      if (Math.abs(dx) > Math.min(70, w * 0.2) || (fast && Math.abs(dx) > 20)) self.move(dx < 0 ? 1 : -1);
      else { self.render(true); self.schedule(); }
    }
    vp.addEventListener("pointerup", end);
    vp.addEventListener("pointercancel", end);
    vp.addEventListener("click", function (e) {
      if (suppressClick) { e.preventDefault(); e.stopPropagation(); suppressClick = false; }
    }, true);
    vp.addEventListener("dragstart", function (e) { e.preventDefault(); });
  };

  window.Carousel = Carousel;
})();
