/* ==========================================================================
   Homepage: hero slider, testimonials carousel, Level 1 curriculum modal.
   ========================================================================== */
(function () {
  "use strict";

  var icon = window.Site.icon, esc = window.Site.esc;

  /* ---------- Hero visuals ------------------------------------------------
     Each slide is illustrated with a lightweight, on-brand UI composition
     (no image download). To use a photograph instead, add
     data-image="assets/img/hero/amazon.webp" (and optional data-image-alt)
     to the slide's .hero-slide__visual element.                             */
  var VIZ = {
    amazon: { v: "dashboard", t: "Seller dashboard — research", kpi: [["Learn", "Done"], ["Prepare", "Done"], ["Check", "Next"]], a: ["search", "Product research", "Demand & competition"], b: ["box", "Inventory", "Only after checks"], extra: "boxes" },
    ebay: { v: "store", t: "Marketplace listings", a: ["list", "Listings", "Drafted & reviewed"], b: ["box", "Inventory", "Planned in order"], extra: "boxes" },
    tiktok: { v: "dashboard", t: "Shop analytics", kpi: [["Content", "Ready"], ["Listing", "Live"], ["Orders", "Tracked"]], a: ["video", "Short-form video", "Content plan ready"], b: ["store", "Shop listing", "Product approved"], extra: "phone" },
    walmart: { v: "dashboard", t: "Marketplace dashboard", kpi: [["Research", "Done"], ["Pricing", "Set"], ["Stock", "Planned"]], a: ["chart", "Market research", "Category reviewed"], b: ["box", "Warehouse", "Fulfilment plan"], extra: "boxes" },
    etsy: { v: "store", t: "Handmade storefront", a: ["heart", "Handmade products", "Personalised orders"], b: ["box", "Packaging", "Ready to ship"] },
    shopify: { v: "store", t: "Your online store", a: ["store", "Storefront", "Live & organised"], b: ["smartphone", "Mobile shopping", "Smooth checkout"], extra: "phone" },
    company: { v: "docs", t: "Company registration", a: ["globe", "UK · USA · Malta", "Jurisdiction guidance"], b: ["file-check", "Documents", "Prepared & checked"] },
    tax: { v: "docs", t: "Tax filing overview", a: ["receipt", "Tax filing", "UK · USA · Malta"], b: ["shield", "Compliance", "Deadlines tracked"] },
    marketing: { v: "dashboard", t: "Campaign performance", kpi: [["Meta Ads", "Active"], ["TikTok Ads", "Active"], ["YouTube", "Planned"]], a: ["megaphone", "Paid social", "Facebook · Instagram · TikTok"], b: ["search", "Google SEO", "Visibility growth"] },
    education: { v: "docs", t: "Malta study plan", a: ["graduation", "Study in Malta", "Course selection"], b: ["book-open", "Application", "Requirements checklist"] },
    growth: { v: "dashboard", t: "Business growth plan", kpi: [["Goals", "Defined"], ["Plan", "Drafted"], ["Actions", "Ready"]], a: ["users", "1:1 consultation", "Expert guidance"], b: ["trending-up", "Growth plan", "Clear next steps"] }
  };

  function screenHTML(d) {
    if (d.v === "store") {
      var tiles = "";
      for (var i = 0; i < 6; i++) tiles += '<div class="viz__tile"><span class="viz__thumb"></span><span class="viz__ln"></span><span class="viz__ln viz__ln--s"></span></div>';
      return '<div class="viz__store">' + tiles + "</div>";
    }
    if (d.v === "docs") {
      var rows = "";
      ["Details", "Documents", "Review", "Submit"].forEach(function (r, i) {
        rows += '<div class="viz__row' + (i < 2 ? " is-done" : "") + '">' + icon(i < 2 ? "check-circle" : "clock") + "<span>" + r + '</span><span class="viz__ln"></span></div>';
      });
      return '<div class="viz__docs"><div class="viz__paper"><span class="viz__ln viz__ln--h"></span><span class="viz__ln"></span><span class="viz__ln"></span><span class="viz__ln viz__ln--s"></span></div><div class="viz__rows">' + rows + "</div></div>";
    }
    var kpis = (d.kpi || []).map(function (k) { return "<div><small>" + esc(k[0]) + "</small><b>" + esc(k[1]) + "</b></div>"; }).join("");
    var bars = [38, 52, 46, 64, 58, 76, 70, 88].map(function (h) { return '<i style="height:' + h + '%"></i>'; }).join("");
    return '<div class="viz__kpis">' + kpis + '</div><div class="viz__chart">' + bars + "</div>";
  }

  function cardHTML(c, mod) {
    return '<div class="viz__card viz__card--' + mod + '"><span class="viz__card-icon">' + icon(c[0]) + "</span><span><b>" + esc(c[1]) + "</b><small>" + esc(c[2]) + "</small></span></div>";
  }

  function renderVisuals() {
    document.querySelectorAll(".hero-slide__visual[data-viz]").forEach(function (el) {
      var img = el.getAttribute("data-image");
      if (img) {
        var eager = el.closest(".hero-slide") === document.querySelector(".hero-slide");
        el.innerHTML = '<img src="' + esc(img) + '" alt="' + esc(el.getAttribute("data-image-alt") || "") + '" width="1200" height="900"' +
          (eager ? ' fetchpriority="high"' : ' loading="lazy"') + ' decoding="async">';
        return;
      }
      var d = VIZ[el.getAttribute("data-viz")];
      if (!d) return;
      var extra = "";
      if (d.extra === "boxes") extra = '<div class="viz__boxes"><span></span><span></span><span></span></div>';
      if (d.extra === "phone") extra = '<div class="viz__phone"><span class="viz__phone-media">' + icon("play") + '</span><span class="viz__ln"></span><span class="viz__ln viz__ln--s"></span></div>';
      el.innerHTML =
        '<div class="viz viz--' + d.v + '" aria-hidden="true">' +
        '<div class="viz__laptop"><div class="viz__screen">' +
        '<div class="viz__bar"><i></i><i></i><i></i><span>' + esc(d.t) + "</span></div>" +
        screenHTML(d) + '</div><div class="viz__base"></div></div>' +
        cardHTML(d.a, "a") + cardHTML(d.b, "b") + extra + "</div>";
    });
  }

  /* ---------- Carousels -------------------------------------------------- */
  function initCarousels() {
    var hero = document.querySelector("[data-hero-carousel]");
    if (hero) {
      var counter = hero.querySelector("[data-hero-count]");
      var total = hero.querySelectorAll(".hero-slide").length;
      new window.Carousel(hero, {
        interval: 5000,
        duration: 700,
        dotLabel: "Go to slide",
        onChange: function (i) {
          if (counter) counter.textContent = String(i + 1).padStart(2, "0") + " / " + String(total).padStart(2, "0");
        }
      });
    }
    var reviews = document.querySelector("[data-reviews-carousel]");
    if (reviews) {
      new window.Carousel(reviews, {
        interval: 5000,
        duration: 550,
        dotLabel: "Show review",
        perView: function () {
          var w = window.innerWidth;
          return w >= 1024 ? 4 : w >= 768 ? 2 : 1;
        }
      });
    }
  }

  /* ---------- Level 1 curriculum (DRAFT) --------------------------------- */
  // Proposed outline only — replace with the officially approved syllabus.
  var CURRICULUM = [
    {
      title: "Module 1 — Foundation", range: "Classes 1–8", lessons: [
        ["How e-commerce works", "Understand how online marketplaces generate sales and where a seller fits in.", ["Marketplaces vs. your own store", "Common business models (private label, wholesale, handmade, arbitrage)", "Setting realistic expectations"], "Write down your goals, weekly time and starting budget."],
        ["Choosing the right marketplace", "Compare major marketplaces and choose a sensible starting point.", ["Amazon, eBay, Walmart, Etsy, TikTok Shop and Shopify compared", "Eligibility and supported regions", "Fee structures at a glance"], "Shortlist one marketplace and justify the choice."],
        ["Marketplace rules & policies", "Learn the rules that protect your account from day one.", ["Restricted and prohibited categories", "Account health basics", "Intellectual property and brand rights"], "Create a policy checklist for your chosen marketplace."],
        ["Account preparation & documents", "Prepare the information typically needed to open a seller account.", ["Seller account types", "Identity, address and bank documents", "Common verification issues"], "Complete a document-readiness checklist."],
        ["Business setup basics", "Understand the setup questions to research before you trade.", ["Sole trader vs. limited company (overview)", "Registrations to look into", "Record keeping from the start"], "List the setup questions for your country of residence."],
        ["Understanding costs & fees", "Identify every cost that affects your profit.", ["Referral, fulfilment and storage fees", "Shipping and returns", "VAT / sales tax awareness"], "Build your first cost sheet."],
        ["Profit, margin & budget planning", "Calculate whether a product can make money.", ["Landed cost and break-even", "Margin and return on investment", "Cash-flow planning"], "Calculate the margin on a sample product."],
        ["Foundation review & Q&A", "Consolidate the foundation and plan the next phase.", ["Recap of classes 1–7", "Open Q&A", "Personal 30-day learning plan"], "Foundation checkpoint quiz."]
      ]
    },
    {
      title: "Module 2 — Product Research", range: "Classes 9–16", lessons: [
        ["Product research principles", "Learn what makes a product worth investigating.", ["Viability criteria", "Seasonality, fragility, size and regulation", "Common beginner traps"], "Score three example products against the criteria."],
        ["Niche & market research", "Explore categories and customer needs systematically.", ["Category exploration", "Trends vs. fads", "Customer problems and needs"], "Shortlist three niches."],
        ["Demand analysis", "Estimate whether there is consistent demand.", ["Sales estimates", "Search interest", "Demand consistency over time"], "Complete a demand worksheet for five products."],
        ["Competition analysis", "Judge how hard it will be to compete.", ["Number and strength of sellers", "Review counts and listing quality", "Brand dominance"], "Competitor comparison table."],
        ["Pricing & profitability check", "Confirm the numbers work before going further.", ["Price ranges", "Fee calculators", "Minimum margin thresholds"], "Profitability check on your shortlist."],
        ["Customer reviews & differentiation", "Use customer feedback to find improvement opportunities.", ["Mining reviews for complaints", "Differentiation ideas", "Bundles and variations"], "List three improvement ideas for one product."],
        ["Risk & compliance check", "Spot products that carry hidden risk.", ["Certifications and safety requirements", "Restricted products", "IP and trademark checks"], "Risk checklist for your shortlist."],
        ["Product validation & shortlist", "Make an evidence-based product decision.", ["Scoring matrix", "Final shortlist", "Presenting your evidence"], "Present your shortlist with supporting evidence."]
      ]
    },
    {
      title: "Module 3 — Supplier Evidence", range: "Classes 17–24", lessons: [
        ["Sourcing models & supplier types", "Understand where products can come from.", ["Manufacturers, wholesalers and distributors", "Local vs. overseas sourcing", "Pros and cons of each"], "Choose a sourcing model for your product."],
        ["Finding suppliers", "Build a list of potential suppliers.", ["Supplier directories and wholesale platforms", "Trade shows", "Outreach approach"], "Compile a list of ten potential suppliers."],
        ["Supplier verification", "Check that a supplier is genuine and reliable.", ["Business registration checks", "Track record and references", "Red flags"], "Verify three suppliers from your list."],
        ["Supplier evidence & documentation", "Understand the documents marketplaces may request.", ["Invoices and their requirements", "Authorisation letters", "Certificates and test reports"], "Prepare a supplier evidence folder."],
        ["Communication & negotiation", "Request quotes and negotiate professionally.", ["Requests for quotation (RFQ)", "MOQs, pricing and payment terms", "Message templates"], "Send an RFQ to two suppliers."],
        ["Samples & quality control", "Check quality before committing to stock.", ["Ordering samples", "Inspection checklists", "Handling quality issues"], "Create a sample inspection checklist."],
        ["Shipping, logistics & landed cost", "Plan how products reach the customer.", ["Incoterms basics", "Freight options", "Marketplace prep requirements"], "Calculate the full landed cost of your product."],
        ["Final review & next steps", "Confirm readiness and plan what comes next.", ["Readiness review", "Launch prerequisites", "Your personal next-steps plan"], "Final readiness review with your mentor."]
      ]
    }
  ];

  function renderCurriculum(target) {
    var n = 0;
    target.innerHTML = CURRICULUM.map(function (m, mi) {
      var lessons = m.lessons.map(function (l) {
        n++;
        return '<li class="lesson"><span class="lesson__num">' + String(n).padStart(2, "0") + "</span>" +
          '<div class="lesson__body"><h4 class="lesson__title">Class ' + n + ": " + esc(l[0]) + "</h4>" +
          '<p class="lesson__obj"><strong>Objective:</strong> ' + esc(l[1]) + "</p>" +
          '<ul class="lesson__topics">' + l[2].map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" +
          '<p class="lesson__task">' + icon("check-circle") + "<span><strong>Activity:</strong> " + esc(l[3]) + "</span></p></div></li>";
      }).join("");
      return '<details class="module"' + (mi === 0 ? " open" : "") + "><summary>" +
        '<span class="module__title">' + esc(m.title) + '</span><span class="module__range">' + esc(m.range) + "</span>" +
        icon("chevron-down", "module__chev") + '</summary><ol class="lessons">' + lessons + "</ol></details>";
    }).join("");
  }

  function initCurriculum() {
    var dlg = document.getElementById("curriculum-dialog");
    var openers = document.querySelectorAll("[data-open-curriculum]");
    if (!dlg || !openers.length) return;
    var rendered = false, opener = null;

    function open(e) {
      opener = e.currentTarget;
      if (!rendered) { renderCurriculum(dlg.querySelector("[data-curriculum-body]")); rendered = true; }
      if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
      document.documentElement.classList.add("modal-open");
      dlg.querySelector(".dialog__scroll").scrollTop = 0;
    }
    openers.forEach(function (b) { b.addEventListener("click", open); });

    dlg.addEventListener("close", function () {
      document.documentElement.classList.remove("modal-open");
      if (opener) opener.focus();
    });
    dlg.querySelectorAll("[data-close-dialog]").forEach(function (b) {
      b.addEventListener("click", function () { dlg.close(); });
    });
    // Clicking the backdrop (outside the panel) closes the dialog.
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
  }

  /* ---------- Entrance animation for sections ---------------------------- */
  function initReveal() {
    var els = document.querySelectorAll("[data-reveal]");
    if (!("IntersectionObserver" in window) || window.Site.reducedMotion.matches) {
      els.forEach(function (el) { el.classList.add("is-revealed"); });
      return;
    }
    document.documentElement.classList.add("js-reveal");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-revealed"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    els.forEach(function (el) { io.observe(el); });
  }

  renderVisuals();
  initCarousels();
  initCurriculum();
  initReveal();
})();
