/* ==========================================================================
   Stock exchange page — illustrative trading charts (no libraries).
   The drawn charts are illustrative only: they are NOT live or
   historical market data. Live prices come from TradingView widgets ([data-tv]).
     [data-se-chart]      main chart (candles / line / area, volume, 20-day average)
     [data-se-mini="…"]   small teaching charts: candle, ma, sr, volume, trend
   ========================================================================== */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var UP = "#22C55E", DOWN = "#EF4444", MA = "#60A5FA", GRID = "rgba(255,255,255,.07)";

  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function gauss(r) { return (r() + r() + r() + r() - 2) / 1.15; }
  function series(n, seed, drift, vol) {
    var r = rng(seed), out = [], c = 100;
    for (var i = 0; i < n; i++) {
      var o = c, ch = drift + vol * gauss(r);
      c = Math.max(5, o * (1 + ch));
      var hi = Math.max(o, c) * (1 + Math.abs(gauss(r)) * vol * .6), lo = Math.min(o, c) * (1 - Math.abs(gauss(r)) * vol * .6);
      out.push({ o: o, h: hi, l: lo, c: c, v: .35 + r() * .65 + Math.abs(ch) * 18 });
    }
    return out;
  }
  function ma(d, k) { return d.map(function (x, i) { if (i < k - 1) return null; var s = 0; for (var j = i - k + 1; j <= i; j++) s += d[j].c; return s / k; }); }
  function el(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var a in attrs) e.setAttribute(a, attrs[a]); if (parent) parent.appendChild(e); return e; }
  function svg(w, h, label) { var s = el("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": label, preserveAspectRatio: "none" }); return s; }
  function path(pts) { return pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" "); }

  /* ---------- Main chart ---------- */
  var RANGES = { "1m": [24, 11, .004, .018], "3m": [48, 23, .003, .016], "1y": [80, 37, .0025, .014] };
  function mainChart(box) {
    var W = 640, H = 300, top = 14, ph = 200, vy = 228, vh = 60, pad = 6;
    var type = "candle", range = "3m";
    var term = box.closest(".se-term"), read = term && term.querySelector(".se-term__read");
    function draw() {
      var cfg = RANGES[range], d = series(cfg[0], cfg[1], cfg[2], cfg[3]), avg = ma(d, Math.min(20, Math.round(d.length / 3)));
      var hi = Math.max.apply(null, d.map(function (x) { return x.h; })), lo = Math.min.apply(null, d.map(function (x) { return x.l; }));
      var vmax = Math.max.apply(null, d.map(function (x) { return x.v; }));
      var step = (W - pad * 2) / d.length, cw = Math.max(3, step * .62);
      var y = function (p) { return top + (hi - p) / (hi - lo) * ph; };
      var x = function (i) { return pad + step * i + step / 2; };
      var s = svg(W, H, "Illustrative " + (type === "candle" ? "candlestick" : type) + " chart with volume and moving average");
      var defs = el("defs", {}, s), g = el("linearGradient", { id: "seArea", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      el("stop", { offset: 0, "stop-color": UP, "stop-opacity": .32 }, g); el("stop", { offset: 1, "stop-color": UP, "stop-opacity": 0 }, g);
      for (var k = 0; k <= 4; k++) el("line", { x1: 0, x2: W, y1: top + ph / 4 * k, y2: top + ph / 4 * k, stroke: GRID }, s);
      el("line", { x1: 0, x2: W, y1: vy - 6, y2: vy - 6, stroke: "rgba(255,255,255,.12)" }, s);
      // volume
      d.forEach(function (c, i) { var h = c.v / vmax * vh; el("rect", { x: x(i) - cw / 2, y: vy + vh - h, width: cw, height: h, rx: 1, fill: c.c >= c.o ? UP : DOWN, opacity: .35 }, s); });
      // price
      var plot = el("g", { class: "se-plot" }, s);
      if (type === "candle") {
        d.forEach(function (c, i) {
          var col = c.c >= c.o ? UP : DOWN;
          el("line", { x1: x(i), x2: x(i), y1: y(c.h), y2: y(c.l), stroke: col, "stroke-width": 1.2 }, plot);
          el("rect", { x: x(i) - cw / 2, y: y(Math.max(c.o, c.c)), width: cw, height: Math.max(1.2, Math.abs(y(c.o) - y(c.c))), rx: 1, fill: col }, plot);
        });
      } else {
        var pts = d.map(function (c, i) { return [x(i), y(c.c)]; });
        if (type === "area") el("path", { d: path(pts) + " L" + x(d.length - 1) + " " + (top + ph) + " L" + x(0) + " " + (top + ph) + " Z", fill: "url(#seArea)" }, plot);
        el("path", { d: path(pts), fill: "none", stroke: UP, "stroke-width": 2.2, "stroke-linejoin": "round", class: "se-draw", pathLength: 1 }, plot);
      }
      var mpts = []; avg.forEach(function (m, i) { if (m != null) mpts.push([x(i), y(m)]); });
      el("path", { d: path(mpts), fill: "none", stroke: MA, "stroke-width": 1.6, "stroke-dasharray": "5 4", opacity: .9 }, s);
      // last price marker
      var last = d[d.length - 1];
      el("line", { x1: 0, x2: W, y1: y(last.c), y2: y(last.c), stroke: last.c >= last.o ? UP : DOWN, "stroke-dasharray": "2 4", opacity: .6 }, s);
      // crosshair
      var cross = el("g", { class: "se-cross", opacity: 0 }, s);
      var vline = el("line", { y1: 0, y2: H, stroke: "rgba(255,255,255,.35)", "stroke-dasharray": "3 3" }, cross);
      var hline = el("line", { x1: 0, x2: W, stroke: "rgba(255,255,255,.2)", "stroke-dasharray": "3 3" }, cross);
      var dot = el("circle", { r: 4, fill: "#fff" }, cross);
      var hit = el("rect", { x: 0, y: 0, width: W, height: H, fill: "transparent" }, s);
      function at(evt) {
        var b = s.getBoundingClientRect(), cx = ((evt.touches ? evt.touches[0].clientX : evt.clientX) - b.left) / b.width * W;
        var i = Math.max(0, Math.min(d.length - 1, Math.floor((cx - pad) / step))), c = d[i], m = avg[i];
        cross.setAttribute("opacity", 1);
        vline.setAttribute("x1", x(i)); vline.setAttribute("x2", x(i));
        hline.setAttribute("y1", y(c.c)); hline.setAttribute("y2", y(c.c));
        dot.setAttribute("cx", x(i)); dot.setAttribute("cy", y(c.c));
        if (read) {
          var up = c.c >= c.o, wick = (c.h - c.l) / Math.max(1e-6, Math.abs(c.c - c.o));
          read.innerHTML = '<span class="se-term__pill se-term__pill--' + (up ? "up" : "down") + '">' + (up ? "Bullish candle" : "Bearish candle") + "</span>" +
            (up ? "Closed higher than it opened." : "Closed lower than it opened.") +
            (m != null ? " Price is " + (c.c >= m ? "<b>above</b>" : "<b>below</b>") + " the moving average" + (c.c >= m ? " — a sign of an uptrend." : " — a sign of weakness.") : "") +
            (wick > 3 ? " Long wicks show buyers and sellers fighting." : "");
        }
      }
      hit.addEventListener("mousemove", at); hit.addEventListener("touchstart", at, { passive: true }); hit.addEventListener("touchmove", at, { passive: true });
      hit.addEventListener("mouseleave", function () { cross.setAttribute("opacity", 0); });
      box.innerHTML = ""; box.appendChild(s);
    }
    draw();
    if (term) {
      term.addEventListener("click", function (e) {
        var b = e.target.closest("button[data-type],button[data-range]"); if (!b) return;
        var grp = b.parentNode.querySelectorAll("button");
        Array.prototype.forEach.call(grp, function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        if (b.dataset.type) type = b.dataset.type; else range = b.dataset.range;
        draw();
      });
    }
  }

  /* ---------- Teaching mini charts ---------- */
  var MINI = {
    candle: function (s) {
      // One bullish and one bearish candle, labelled.
      [[70, UP, 40, 110, 25, 130, "Bullish"], [190, DOWN, 45, 105, 20, 135, "Bearish"]].forEach(function (c) {
        el("line", { x1: c[0], x2: c[0], y1: c[4], y2: c[5], stroke: c[1], "stroke-width": 2 }, s);
        el("rect", { x: c[0] - 18, y: c[2], width: 36, height: c[3] - c[2], rx: 3, fill: c[1] }, s);
        var t = el("text", { x: c[0], y: 152, "text-anchor": "middle", fill: "rgba(255,255,255,.75)", "font-size": 12, "font-weight": 600 }, s); t.textContent = c[6];
      });
      [["High", 25], ["Close", 40], ["Open", 110], ["Low", 130]].forEach(function (l) {
        el("line", { x1: 92, x2: 112, y1: l[1], y2: l[1], stroke: "rgba(255,255,255,.3)", "stroke-dasharray": "2 2" }, s);
        var t = el("text", { x: 116, y: l[1] + 4, fill: "rgba(255,255,255,.6)", "font-size": 11 }, s); t.textContent = l[0];
      });
    },
    ma: function (s) {
      var d = series(40, 5, .003, .02), a = ma(d, 8), hi = Math.max.apply(null, d.map(function (x) { return x.c; })), lo = Math.min.apply(null, d.map(function (x) { return x.c; }));
      var X = function (i) { return 10 + i * 240 / 39; }, Y = function (p) { return 15 + (hi - p) / (hi - lo) * 125; };
      el("path", { d: path(d.map(function (c, i) { return [X(i), Y(c.c)]; })), fill: "none", stroke: "rgba(255,255,255,.55)", "stroke-width": 1.5 }, s);
      var m = []; a.forEach(function (v, i) { if (v != null) m.push([X(i), Y(v)]); });
      el("path", { d: path(m), fill: "none", stroke: MA, "stroke-width": 2.5 }, s);
    },
    sr: function (s) {
      el("line", { x1: 0, x2: 260, y1: 30, y2: 30, stroke: DOWN, "stroke-dasharray": "6 4", "stroke-width": 1.5 }, s);
      el("line", { x1: 0, x2: 260, y1: 125, y2: 125, stroke: UP, "stroke-dasharray": "6 4", "stroke-width": 1.5 }, s);
      el("path", { d: "M10 110 L40 34 L70 120 L100 38 L130 122 L160 33 L190 118 L220 40 L250 70", fill: "none", stroke: "rgba(255,255,255,.75)", "stroke-width": 2, "stroke-linejoin": "round" }, s);
      var a = el("text", { x: 256, y: 24, "text-anchor": "end", fill: DOWN, "font-size": 11, "font-weight": 700 }, s); a.textContent = "Resistance";
      var b = el("text", { x: 256, y: 145, "text-anchor": "end", fill: UP, "font-size": 11, "font-weight": 700 }, s); b.textContent = "Support";
    },
    volume: function (s) {
      var d = series(30, 9, .002, .025), vmax = Math.max.apply(null, d.map(function (x) { return x.v; }));
      var hi = Math.max.apply(null, d.map(function (x) { return x.c; })), lo = Math.min.apply(null, d.map(function (x) { return x.c; }));
      d.forEach(function (c, i) { var h = c.v / vmax * 55; el("rect", { x: 10 + i * 8.2, y: 150 - h, width: 6, height: h, rx: 1, fill: c.c >= c.o ? UP : DOWN, opacity: .6 }, s); });
      el("path", { d: path(d.map(function (c, i) { return [13 + i * 8.2, 15 + (hi - c.c) / (hi - lo) * 70]; })), fill: "none", stroke: "rgba(255,255,255,.75)", "stroke-width": 2 }, s);
    },
    trend: function (s) {
      el("path", { d: "M10 140 L45 105 L70 118 L110 78 L135 92 L175 52 L200 66 L245 22", fill: "none", stroke: UP, "stroke-width": 2.5, "stroke-linejoin": "round" }, s);
      el("line", { x1: 10, y1: 148, x2: 250, y2: 52, stroke: MA, "stroke-width": 1.5, "stroke-dasharray": "6 4" }, s);
      [[45, 105], [110, 78], [175, 52], [245, 22]].forEach(function (p) { el("circle", { cx: p[0], cy: p[1], r: 3.5, fill: UP }, s); });
      [[70, 118], [135, 92], [200, 66]].forEach(function (p) { el("circle", { cx: p[0], cy: p[1], r: 3.5, fill: MA }, s); });
    }
  };

  /* ---------- Live market widgets (TradingView, loaded when scrolled into view) ---------- */
  var TV = "https://s3.tradingview.com/external-embedding/embed-widget-";
  var GREEN = "rgba(34, 197, 94, 1)", RED = "rgba(239, 68, 68, 1)";
  var US = [{ s: "NASDAQ:AAPL", d: "Apple" }, { s: "NASDAQ:MSFT", d: "Microsoft" }, { s: "NASDAQ:NVDA", d: "Nvidia" }, { s: "NASDAQ:AMZN", d: "Amazon" }, { s: "NASDAQ:GOOGL", d: "Alphabet" }, { s: "NASDAQ:TSLA", d: "Tesla" }];
  var INDICES = [{ s: "FOREXCOM:SPXUSD", d: "S&P 500" }, { s: "FOREXCOM:NSXUSD", d: "NASDAQ 100" }, { s: "FOREXCOM:DJI", d: "Dow 30" }, { s: "FOREXCOM:UKXGBP", d: "FTSE 100" }];
  var FX = [{ s: "FX:GBPUSD", d: "GBP / USD" }, { s: "FX:EURUSD", d: "EUR / USD" }, { s: "FX:USDJPY", d: "USD / JPY" }, { s: "OANDA:XAUUSD", d: "Gold" }];
  var WIDGETS = {
    tape: function () {
      return ["ticker-tape", { symbols: INDICES.concat(US.slice(0, 4), FX.slice(0, 2), [FX[3]]).map(function (x) { return { proName: x.s, title: x.d }; }), showSymbolLogo: true, isTransparent: true, displayMode: "adaptive", colorTheme: "dark", locale: "en" }];
    },
    chart: function (box) {
      return ["advanced-chart", { autosize: true, symbol: box.getAttribute("data-symbol") || "FOREXCOM:SPXUSD", interval: "D", timezone: "Etc/UTC", theme: "dark", style: "1", locale: "en", backgroundColor: "rgba(9, 16, 30, 1)", gridColor: "rgba(255, 255, 255, 0.06)", hide_side_toolbar: true, allow_symbol_change: true, calendar: false, support_host: "https://www.tradingview.com" }];
    },
    overview: function () {
      return ["market-overview", { colorTheme: "dark", dateRange: "12M", showChart: true, locale: "en", width: "100%", height: "100%", isTransparent: true, showSymbolLogo: true, showFloatingTooltip: true,
        plotLineColorGrowing: GREEN, plotLineColorFalling: RED, gridLineColor: "rgba(255, 255, 255, 0.06)", scaleFontColor: "rgba(180, 192, 211, 1)",
        belowLineFillColorGrowing: "rgba(34, 197, 94, 0.12)", belowLineFillColorFalling: "rgba(239, 68, 68, 0.12)", belowLineFillColorGrowingBottom: "rgba(34, 197, 94, 0)", belowLineFillColorFallingBottom: "rgba(239, 68, 68, 0)", symbolActiveColor: "rgba(34, 197, 94, 0.12)",
        tabs: [{ title: "Indices", symbols: INDICES }, { title: "US stocks", symbols: US }, { title: "Currencies & gold", symbols: FX }] }];
    },
    movers: function () {
      return ["hotlists", { colorTheme: "dark", dateRange: "1D", exchange: "US", showChart: true, locale: "en", width: "100%", height: "100%", isTransparent: true, showSymbolLogo: true, showFloatingTooltip: true,
        plotLineColorGrowing: GREEN, plotLineColorFalling: RED, gridLineColor: "rgba(255, 255, 255, 0.06)", scaleFontColor: "rgba(180, 192, 211, 1)",
        belowLineFillColorGrowing: "rgba(34, 197, 94, 0.12)", belowLineFillColorFalling: "rgba(239, 68, 68, 0.12)", belowLineFillColorGrowingBottom: "rgba(34, 197, 94, 0)", belowLineFillColorFallingBottom: "rgba(239, 68, 68, 0)", symbolActiveColor: "rgba(34, 197, 94, 0.12)" }];
    },
    alert: function () {
      var syms = [{ s: "FOREXCOM:SPXUSD", d: "S&P 500" }, { s: "FOREXCOM:NSXUSD", d: "NASDAQ 100" }, { s: "FOREXCOM:DJI", d: "Dow 30" }, { s: "FOREXCOM:UKXGBP", d: "FTSE 100" },
        { s: "OANDA:XAUUSD", d: "Gold" }, { s: "BLACKBULL:WTI", d: "Crude oil" }, { s: "BINANCE:BTCUSDT", d: "Bitcoin" }, { s: "FX:EURUSD", d: "EUR/USD" }, { s: "FX:GBPUSD", d: "GBP/USD" }];
      return ["ticker-tape", { symbols: syms.map(function (x) { return { proName: x.s, title: x.d }; }), showSymbolLogo: true, isTransparent: true, displayMode: "adaptive", colorTheme: "dark", locale: "en" }];
    },
    calendar: function () {
      return ["events", { colorTheme: "dark", isTransparent: true, width: "100%", height: "100%", locale: "en", importanceFilter: "0,1", countryFilter: "us,eu,gb,jp,cn,ca,au" }];
    },
    mini: function (box) {
      return ["mini-symbol-overview", { symbol: box.getAttribute("data-symbol"), width: "100%", height: "100%", locale: "en", dateRange: "1D", colorTheme: "dark", isTransparent: true, autosize: true, largeChartUrl: "", chartOnly: false, noTimeScale: false,
        trendLineColor: "rgba(41, 98, 255, 1)", underLineColor: "rgba(41, 98, 255, 0.18)", underLineBottomColor: "rgba(41, 98, 255, 0)" }];
    },
    heatmap: function () {
      return ["stock-heatmap", { exchanges: [], dataSource: "SPX500", grouping: "sector", blockSize: "market_cap_basic", blockColor: "change", locale: "en", symbolUrl: "", colorTheme: "dark", hasTopBar: false, isDataSetEnabled: false, isZoomEnabled: true, hasSymbolTooltip: true, isMonoSize: false, width: "100%", height: "100%" }];
    }
  };
  function loadWidget(box) {
    var make = WIDGETS[box.getAttribute("data-tv")]; if (!make) return;
    var w = make(box);
    box.innerHTML = '<div class="tradingview-widget-container"><div class="tradingview-widget-container__widget"></div><div class="tradingview-widget-copyright"><a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank">Market data by TradingView</a></div></div>';
    var sc = document.createElement("script");
    sc.src = TV + w[0] + ".js"; sc.async = true; sc.textContent = JSON.stringify(w[1]);
    sc.onerror = function () { box.classList.add("is-failed"); };
    box.firstChild.appendChild(sc);
    box.classList.add("is-loaded");
    // The static tape stays visible until the live one has drawn.
    var tape = box.closest(".se-tape");
    if (tape) { var tries = 0, t = setInterval(function () { if (box.querySelector("iframe")) { tape.classList.add("is-live"); clearInterval(t); } else if (++tries > 40) clearInterval(t); }, 250); }
  }
  function initWidgets() {
    var boxes = document.querySelectorAll("[data-tv]");
    if (!boxes.length) return;
    if (!("IntersectionObserver" in window)) { Array.prototype.forEach.call(boxes, loadWidget); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); loadWidget(e.target); } });
    }, { rootMargin: "400px 0px" });
    Array.prototype.forEach.call(boxes, function (b) { io.observe(b); });
    // Symbol buttons above the live chart
    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-tv-symbol]"); if (!b) return;
      var panel = b.closest(".se-panel"), box = panel && panel.querySelector('[data-tv="chart"]'); if (!box) return;
      Array.prototype.forEach.call(b.parentNode.querySelectorAll("button"), function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      box.setAttribute("data-symbol", b.getAttribute("data-tv-symbol"));
      loadWidget(box);
    });
  }

  // Live price boxes: All / Commodities / Crypto / Big companies filter.
  function initQuoteFilter() {
    var bar = document.querySelector(".se-qfilter"); if (!bar) return;
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("[data-qf]"); if (!b) return;
      var v = b.getAttribute("data-qf");
      Array.prototype.forEach.call(bar.querySelectorAll("[data-qf]"), function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      Array.prototype.forEach.call(document.querySelectorAll("[data-qgroup]"), function (g) { g.hidden = v !== "all" && g.getAttribute("data-qgroup") !== v; });
    });
  }

  // Club joining fee shown on the page follows Admin → Prices.
  function initClubPrice() {
    if (!document.querySelector("[data-club-price]") || !window.fetch) return;
    fetch("/api/prices.php", { headers: { Accept: "application/json" } }).then(function (r) { return r.ok ? r.json() : null; }).then(function (p) {
      var v = p && p.ok && p.items && p.items["stock-club-membership"];
      if (v != null) Array.prototype.forEach.call(document.querySelectorAll("[data-club-price]"), function (el) { el.textContent = "$" + Number(v).toLocaleString("en-US"); });
    }).catch(function () {});
  }

  function init() {
    initClubPrice();
    initWidgets();
    initQuoteFilter();
    Array.prototype.forEach.call(document.querySelectorAll("[data-se-chart]"), mainChart);
    Array.prototype.forEach.call(document.querySelectorAll("[data-se-mini]"), function (box) {
      var f = MINI[box.getAttribute("data-se-mini")]; if (!f) return;
      var s = svg(260, 160, box.getAttribute("data-label") || "Illustrative chart");
      s.setAttribute("preserveAspectRatio", "xMidYMid meet");
      f(s); box.appendChild(s);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
