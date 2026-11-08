/* ==========================================================================
   Question sets for the free assessments (used by assets/js/assessment.js).

   Each assessment: name, title, intro, topic (consultation preselect),
   questions {id: {q, hint?, type?, o?, s?, ...}}, sections {key: {title, sub?, q:[ids], when?}},
   order [section keys] or adaptive {triage, decide(h), paths}, areas [[label, [ids]]],
   flags(h) → [[severity 0–10, text]], next(level, h, path, LEVELS) → {title, text, links}.

   Question types: radio (default), multi (checkboxes), select (dropdown), country,
   budget (bands shown in the person's local currency), number, text.
   s = score per option, 0 (weakest) … 3 (strongest); score(value, h) for numbers.
   ========================================================================== */
(function () {
  "use strict";

  // ---- Shared helpers ----------------------------------------------------------
  var DEVELOPED = ["United States", "United Kingdom", "Canada", "Australia", "New Zealand", "Germany", "France", "Italy", "Spain", "Netherlands", "Ireland", "Sweden", "Belgium", "Austria", "Switzerland", "Norway", "Denmark", "Finland", "Portugal", "Malta", "Another EU country", "Japan", "Singapore", "South Korea"];
  var GULF = ["United Arab Emirates", "Saudi Arabia", "Qatar", "Kuwait", "Bahrain", "Oman"];

  var MARKET_COUNTRIES = ["United States", "United Kingdom", "Canada", "Australia", "Germany", "France", "Italy", "Spain", "Netherlands", "Ireland", "Another EU country", "New Zealand", "United Arab Emirates", "Saudi Arabia", "Pakistan", "India", "Bangladesh", "Another country or region"];
  var WORLD = ["Pakistan", "India", "Bangladesh", "Nepal", "Sri Lanka", "Afghanistan", "Nigeria", "Ghana", "Kenya", "Egypt", "Morocco", "Philippines", "Indonesia", "Malaysia", "China", "Vietnam", "Iran", "Turkey", "United Arab Emirates", "Saudi Arabia", "Qatar", "Kuwait", "Oman", "Bahrain", "United Kingdom", "United States", "Canada", "Australia", "New Zealand", "Germany", "France", "Italy", "Spain", "Netherlands", "Ireland", "Malta", "Another EU country", "Russia", "Ukraine", "Brazil", "Mexico", "South Africa", "Another country"];

  var CURRENCY = {
    "United States": "USD", "United Kingdom": "GBP", "Canada": "CAD", "Australia": "AUD", "New Zealand": "NZD",
    "Germany": "EUR", "France": "EUR", "Italy": "EUR", "Spain": "EUR", "Netherlands": "EUR", "Ireland": "EUR", "Another EU country": "EUR",
    "Malta": "EUR", "Portugal": "EUR", "Cyprus": "EUR", "Greece": "EUR",
    "United Arab Emirates": "AED", "Saudi Arabia": "SAR", "Qatar": "QAR", "Pakistan": "PKR", "India": "INR", "Bangladesh": "BDT", "Nigeria": "NGN"
  };
  // Approximate units of each currency per 1 USD (bands are rounded, not exact quotes).
  var RATE = { USD: 1, GBP: 0.78, EUR: 0.92, CAD: 1.38, AUD: 1.53, NZD: 1.68, AED: 3.67, SAR: 3.75, QAR: 3.64, PKR: 280, INR: 84, BDT: 120, NGN: 1600 };

  function nice(n) {
    if (n < 1000) return Math.round(n / 50) * 50 || 50;
    var p = Math.pow(10, Math.floor(Math.log10(n)) - 1);
    return Math.round(n / p) * p;
  }
  function fmt(cur, n) { return cur + " " + n.toLocaleString("en-US"); }

  window.QA_ASSESS_HELPERS = {
    countryNames: function (list) { return list || MARKET_COUNTRIES; },
    countryFit: function (country, mode) {
      if (mode === "ukus") {
        if (country === "United States" || country === "United Kingdom") return 3;
        return DEVELOPED.indexOf(country) >= 0 ? 2 : 1;
      }
      if (DEVELOPED.indexOf(country) >= 0) return 3;
      if (GULF.indexOf(country) >= 0) return 2;
      return 1;
    },
    // q.usd = 4 thresholds in USD; q.currency fixes the currency, otherwise it follows q.from (a country question).
    budgetOptions: function (q, h) {
      var cur = q.currency || CURRENCY[h.text(q.from || "Q01")] || "USD";
      var r = RATE[cur] || 1;
      var b = q.usd.map(function (x) { return cur === "USD" ? x : nice(x * r); });
      var per = q.per ? " " + q.per : "";
      return [q.none || "I don't have a budget for this yet", "Under " + fmt(cur, b[0]) + per, fmt(cur, b[0]) + " to " + fmt(cur, b[1]) + per, fmt(cur, b[1]) + " to " + fmt(cur, b[2]) + per, fmt(cur, b[2]) + " to " + fmt(cur, b[3]) + per, "More than " + fmt(cur, b[3]) + per];
    }
  };
  var fit = window.QA_ASSESS_HELPERS.countryFit;
  var S3 = [0, 1, 2, 3];
  var pct = function (v) { var n = parseFloat(v); if (isNaN(n)) return null; return n >= 70 ? 3 : n >= 60 ? 2 : n >= 50 ? 1 : 0; };

  function locationFlag(h, platform, mode) {
    var c = h.text("Q01");
    if (!c) return null;
    var f = fit(c, mode);
    if (mode === "ukus" && f < 3) return [6, platform + " sellers living in the UK or USA are approved most smoothly. From " + c + ", plan to sell through a UK or US company with matching ID, address and bank documents — we can set this up for you."];
    if (f <= 1) return [6, platform + " approves sellers in developed countries (US, UK, EU, Canada, Australia) most smoothly. From " + c + ", plan to register through a US or UK company with matching documents and bank account — we can set this up for you."];
    return null;
  }
  function moneyFlags(h, platform, ids) {
    var f = [];
    if (h.idx(ids.source) === 0) f.push([9, "Don't use household, emergency, borrowed, rent or bill money for your " + platform + " business."]);
    if (h.idx(ids.source) === 1) f.push([8, "Avoid funding your " + platform + " stock or ads with credit or a loan that must be repaid quickly."]);
    if (h.idx(ids.profit) === 0) f.push([8, "Don't rely on " + platform + " to pay current bills — profit usually takes months to build."]);
    if (h.idx(ids.budget) === 0) f.push([7, "Set a separate, safe budget for " + platform + " before buying any stock or paying for ads."]);
    return f;
  }

  // ---- Marketplace assessments (eBay, TikTok Shop, Walmart, Etsy, Shopify) -----
  function marketplace(m) {
    var P = m.platform;
    var q = {
      Q01: { type: "country", q: "Where do you live?", fit: m.fit, hint: m.fitHint },
      Q02: { q: "Which " + P + " market do you want to sell on?", cols: 2, o: m.regions },
      Q03: { q: "Where are you in your " + P + " journey right now?", o: ["Exploring whether " + P + " is right for me", "Learning the basics of " + P, "Choosing products for " + P, "Setting up my " + P + " account and store", "Selling on " + P + " but not yet stable", "Selling on " + P + " and ready to grow"], s: [0, 1, 1, 2, 2, 3] },
      Q04: { q: "What e-commerce experience do you already have?", o: ["None yet", "I have studied or trained but not sold", "I have sold on another marketplace or website", "I sold on " + P + " before but stopped", "I currently sell on " + P], s: [0, 1, 2, 2, 3] },
      Q05: { q: "Is there any urgent issue with " + P + " right now?", o: m.issues },
      Q06: m.account,
      Q07: { q: "For your " + P + " account, how ready are your identity, address, phone and bank documents?", hint: P + " checks that the names and addresses on your ID, bank account and utility bill match.", o: ["Some documents are borrowed, missing or show different names/addresses", "I own them, but several are missing, outdated or don't match", "I have most current originals, with one gap I can explain", "All current originals in my name, and the details match"], s: S3 },
      Q08: { q: "Which business setup will you use for " + P + "?", o: ["Not decided yet", "Personal / individual account", "A company in my home country", "A US LLC or UK LTD company"], s: m.entityScores || [0, 1, 2, 3] },
      Q09: { q: "Which payout / bank account will receive your " + P + " payments?", o: ["I don't have one yet", "My local bank account", "Payoneer / Wise / similar in my name", "A business bank account in the selling country"], s: S3 },
      Q10: { q: "Have you or anyone at your address ever had a " + P + " account suspended or closed?", o: ["No, never", "Not sure", "Yes, but it was reinstated", "Yes, and it is still suspended"], s: [3, 1, 2, 0] },
      Q11: m.what,
      Q12: { q: "What is the status of the products you want to sell on " + P + "?", o: ["I don't have products yet", "I have ideas only", "I'm comparing suppliers or samples", "Products chosen, stock not ordered", "Stock ordered or ready", "Already selling these products"], s: [0, 0, 1, 2, 3, 3] },
      Q13: { q: "How well do you understand " + P + " account creation and verification?", o: ["Not at all — I need it done for me", "I know the basics but haven't done it", "I've started or completed it with some help", "I've done it before without problems"], s: S3 },
      Q14: { q: m.storeQ || ("How well do you understand " + P + " store management — listings, pricing, orders, customer service and performance metrics?"), o: ["Not at all yet", "A little, from videos or reading", "Fairly well, with some hands-on practice", "Very well — I manage a store already"], s: S3 },
      Q20: { type: "budget", q: "After bills and emergency savings, how much could you safely invest in your " + P + " business?", hint: "Choose only money you can afford to put at risk. Bands are approximate local equivalents.", usd: m.budgetUsd || [500, 2000, 10000, 30000], s: [0, 1, 2, 2, 3, 3] },
      Q21: { q: "Where would this " + P + " budget come from?", o: ["Household, emergency, borrowed, rent or bill money", "Credit or a loan that must be repaid quickly", "Savings while keeping my current income", "Protected personal savings or business funds"], s: [0, 0, 2, 3] },
      Q22: { q: "How soon would you need " + P + " to make a profit?", o: ["I need profit for current bills", "I feel strong pressure for quick profit", "I can wait 3–6 months to learn and improve", "I'm building for the long term"], s: S3 },
      Q23: { q: "How much time can you give your " + P + " business each week?", o: ["Under 3 hours", "3–5 hours", "6–10 hours", "More than 10 hours"], s: S3 },
      Q24: { q: "How would you follow a weekly " + P + " work plan?", o: ["I don't have regular time or a plan", "I can work occasionally, not consistently", "I can follow a weekly plan with guidance", "I already follow a weekly plan and review results"], s: S3 },
      Q25: { q: "How do you see a " + P + " business?", o: ["Quick or easy money", "I'm unsure how serious I am", "Willing to learn and follow a process", "A long-term business I want to build properly"], s: S3 },
      Q26: { q: "If a " + P + " listing or product doesn't sell as expected, what would you do?", o: ["Probably quit", "I'd need strong guidance", "Pause, learn and adjust", "Solve it systematically and keep improving"], s: S3 },
      Q27: { q: "When do you want to take your next big step on " + P + "?", o: ["Immediately, without more preparation", "Within a month, but I still need guidance", "In 1–3 months after preparing", "In 3+ months, preparing properly first"], s: S3 },
      Q28: { q: "What would be the most useful " + P + " outcome for you in the next 12 months?", o: ["Decide if " + P + " is right for me", "Get my " + P + " account created and verified", "Set up and manage my " + P + " store properly", "Find products that sell on " + P, "Get consistent " + P + " sales", "Fix or protect my " + P + " account", "Grow and scale my " + P + " store"] },
      Q29: { q: "What is your biggest obstacle with " + P + " right now?", o: ["I don't know where to start", "Account creation or verification", "Store setup and management", "Choosing products", "Budget", "Shipping and fulfilment", "Getting sales / marketing", "Finding consistent time", "An account or listing problem"] }
    };
    var specific = m.specific || {};
    var specIds = Object.keys(specific);
    specIds.forEach(function (id) { q[id] = specific[id]; });

    return {
      name: P + " Seller Assessment", platform: P, topic: m.topic, countryQ: "Q01", minutes: 6,
      title: P + " Seller Readiness Assessment",
      intro: m.intro,
      notice: "Free " + P + " assessment — about 6 minutes. Find out how ready you are to sell on " + P + " and what to fix first.",
      questions: q,
      sections: {
        about: { title: "You and your " + P + " plans", sub: "Where you live and where you are with " + P + " today.", q: ["Q01", "Q02", "Q03", "Q04", "Q05"] },
        account: { title: P + " account creation and documents", sub: "What " + P + " will check when you open or verify your seller account.", q: ["Q06", "Q07", "Q08", "Q09", "Q10", "Q13"] },
        store: { title: P + " store and products", q: ["Q11", "Q12", "Q14"].concat(specIds) },
        money: { title: "Budget and time for " + P, q: ["Q20", "Q21", "Q22", "Q23", "Q24"] },
        goals: { title: "Mindset and " + P + " goals", q: ["Q25", "Q26", "Q27", "Q28", "Q29"] }
      },
      order: ["about", "account", "store", "money", "goals"],
      areas: [
        ["Location and account fit", ["Q01", "Q07", "Q08", "Q09", "Q10"]],
        ["Account creation know-how", ["Q06", "Q13"]],
        ["Store and product readiness", ["Q11", "Q12", "Q14"].concat(specIds)],
        ["Financial safety", ["Q20", "Q21", "Q22"]],
        ["Time and mindset", ["Q03", "Q04", "Q23", "Q24", "Q25", "Q26", "Q27"]]
      ],
      flags: function (h) {
        var f = [];
        var loc = locationFlag(h, P, m.fit); if (loc) f.push(loc);
        if (h.idx("Q05") > 0 && h.idx("Q05") < m.issues.length - 1) f.push([10, "Resolve the active " + P + " issue (" + h.text("Q05").toLowerCase() + ") before spending more or listing new products."]);
        if (h.idx("Q07") === 0) f.push([9, "Never use borrowed or mismatched documents — " + P + " verification can fail and lead to a permanent ban."]);
        if (h.idx("Q07") === 1) f.push([6, "Update your ID, address and bank documents so every name and address matches before you apply to " + P + "."]);
        if (h.idx("Q10") === 3) f.push([9, "An existing " + P + " suspension at your address can block a new account — fix it before opening another one."]);
        if (h.idx("Q09") === 0) f.push([5, "Set up a payout account in your own name (e.g. Payoneer, Wise or a business bank) before applying to " + P + "."]);
        f = f.concat(moneyFlags(h, P, { source: "Q21", profit: "Q22", budget: "Q20" }));
        if (h.idx("Q25") === 0) f.push([5, P + " isn't quick or easy money — plan for months of learning and reinvestment."]);
        if (h.idx("Q27") === 0) f.push([5, "Slow down: rushing onto " + P + " without preparation is the most common way new sellers lose money."]);
        if (h.idx("Q23") === 0) f.push([4, "Block out regular weekly time — " + P + " stores need attention every week."]);
        if (h.idx("Q13") === 0) f.push([4, "Get help with " + P + " account creation so verification succeeds the first time."]);
        return f.concat(m.flags ? m.flags(h) : []);
      },
      next: function (level, h, path, L) {
        var book = ["Book a " + P + " consultation", "/book-consultation?topic=" + m.topic, "outline"];
        if (h.idx("Q05") > 0 && h.idx("Q05") < m.issues.length - 1) return { title: "Fix your " + P + " account issue first", text: "Pause new spending and resolve the active issue with a clear, documented plan. We review your " + P + " account and prepare the right response or appeal.", links: [["Account review & reactivation", m.page + "#pricing", "accent"], book] };
        if (level === L[0]) return { title: "Build your " + P + " foundations first", text: "Set a safe budget, get your documents in order and learn how " + P + " works before you spend on stock. Start with free learning, then one-to-one guidance.", links: [["Explore Level 1 training", "/#level-1", "accent"], book] };
        if (h.idx("Q06") <= 1 || h.idx("Q13") <= 1) return { title: "Get your " + P + " account created and verified properly", text: "We create and verify your " + P + " seller account with you — matching documents, business setup and payout account — so it's approved the first time.", links: [[P + " account creation", m.page + "#pricing", "accent"], book] };
        if (level === L[3]) return { title: "Grow your " + P + " store with a clear plan", text: "Your foundations are strong. Focus on product research, store optimisation and marketing to grow sales steadily on " + P + ".", links: [[P + " growth services", m.page + "#pricing", "accent"], book] };
        return { title: "Set up and manage your " + P + " store step by step", text: "Choose proven products, set up your " + P + " store correctly and follow a weekly management routine before scaling.", links: [[P + " services & pricing", m.page + "#pricing", "accent"], book] };
      }
    };
  }

  var A = {};

  A.ebay = marketplace({
    platform: "eBay", topic: "ebay", page: "/ebay", fit: "developed",
    intro: "Check how ready you are to sell on eBay — eBay account creation, store management, products, budget and time — and get your safest next step.",
    fitHint: "eBay approves and supports sellers in developed countries (US, UK, EU, Canada, Australia) most smoothly.",
    regions: ["eBay US (ebay.com)", "eBay UK (ebay.co.uk)", "eBay Germany (ebay.de)", "eBay Australia", "eBay Canada", "Several eBay sites", "Not sure yet"],
    issues: ["No urgent issue", "eBay account suspended", "MC011 / MC999 restriction", "Selling limits or payment hold", "Listings removed or policy warning", "Identity or document verification problem", "I am not sure"],
    account: { q: "Do you already have an eBay seller account?", o: ["No, I need to create one", "I have a personal eBay account only", "I have an eBay business seller account", "My eBay account is restricted or suspended"], s: [1, 1, 3, 0] },
    what: { q: "What do you plan to sell on eBay?", o: ["New branded products (wholesale / retail)", "My own brand / private label", "Used or refurbished items", "Collectibles, vintage or parts", "Dropshipped products from other retailers", "Not sure yet"], s: [3, 3, 2, 2, 0, 1] },
    storeQ: "How well do you understand eBay store management — store categories, item specifics, promoted listings, markdown sales and seller performance standards?",
    specific: {
      Q15: { q: "How well do you understand eBay selling limits and how they increase?", o: ["I didn't know eBay has selling limits", "I've heard of them", "I understand them and plan around them", "I've already raised my limits"], s: S3 },
      Q16: { q: "How will you handle eBay shipping, handling time and returns?", o: ["I haven't thought about it", "I'll ship myself when an order comes", "A warehouse / 3PL with tracked shipping", "A tested shipping and returns process"], s: S3 }
    },
    flags: function (h) { return h.idx("Q11") === 4 ? [[7, "eBay doesn't allow dropshipping from other retailers (e.g. buying from Amazon to ship to your eBay buyer) — it's a common cause of MC011 restrictions."]] : []; }
  });

  A.tiktok = marketplace({
    platform: "TikTok Shop", topic: "tiktok-shop", page: "/tiktok-shop", fit: "ukus",
    intro: "Check how ready you are to sell on TikTok Shop — TikTok Shop account creation, store management, content, budget and time — and get your safest next step.",
    fitHint: "TikTok Shop is built for sellers in the UK and USA, who are approved most easily.",
    regions: ["TikTok Shop US", "TikTok Shop UK", "Both US and UK", "TikTok Shop EU (Germany, France, Italy, Spain, Ireland)", "TikTok Shop Southeast Asia", "Not sure yet"],
    issues: ["No urgent issue", "TikTok Shop account deactivated", "Products rejected or restricted", "Violation points / shop health warning", "Payouts on hold", "Identity or document verification problem", "I am not sure"],
    account: { q: "Do you already have a TikTok Shop seller account?", o: ["No, I need to create one", "Application started / under review", "Approved and active", "Rejected, deactivated or restricted"], s: [1, 2, 3, 0] },
    what: { q: "What will you sell on TikTok Shop?", o: ["Beauty and personal care", "Fashion and accessories", "Home, kitchen and gadgets", "Health and supplements", "Electronics", "Something else / not sure"] },
    storeQ: "How well do you understand TikTok Shop store management — product approval, orders, shipping deadlines, returns and shop health score?",
    specific: {
      Q15: { q: "Can you create short TikTok videos or go live yourself?", o: ["No, I'm not comfortable on camera", "I could try with guidance", "Yes, I can make simple videos regularly", "Yes, I already create content and go live"], s: S3 },
      Q16: { q: "Will you work with TikTok creators and affiliates?", o: ["I don't know how it works", "Maybe later", "Yes, I plan to send samples to creators", "Yes, I already work with creators"], s: S3 },
      Q17: { q: "How will you fulfil TikTok Shop orders?", o: ["Not decided", "Ship myself from my home country", "A 3PL / Fulfilled by TikTok in the selling country", "An established local warehouse with fast tracked delivery"], s: [0, 0, 2, 3] }
    },
    flags: function (h) { return h.idx("Q17") === 1 ? [[7, "TikTok Shop needs fast local delivery in the selling country — shipping from abroad usually breaks the shipping deadlines. Plan a local 3PL."]] : []; }
  });

  A.walmart = marketplace({
    platform: "Walmart", topic: "walmart", page: "/walmart", fit: "ukus", entityScores: [0, 0, 1, 3],
    intro: "Check how ready you are to sell on Walmart Marketplace — Walmart account creation and approval, store management, products, budget and time — and get your safest next step.",
    fitHint: "Walmart Marketplace favours established sellers based in the USA (and the UK) with a proper business setup.",
    regions: ["Walmart US Marketplace", "Walmart Canada", "Walmart Mexico", "Not sure yet"],
    issues: ["No urgent issue", "Walmart application rejected", "Walmart seller account suspended", "Items unpublished or restricted", "Payment or payout hold", "Identity or document verification problem", "I am not sure"],
    account: { q: "Do you have a Walmart Marketplace seller account?", o: ["No, I need to apply", "Application submitted / pending", "Approved and active", "Application rejected or account suspended"], s: [1, 2, 3, 0] },
    what: { q: "What will you sell on Walmart?", o: ["My own brand / private label", "Wholesale branded products (with authorisation)", "Products I already sell on Amazon", "Bundles or multipacks", "Not sure yet"], s: [3, 3, 3, 2, 0] },
    storeQ: "How well do you understand Walmart store management — Seller Center item setup, pricing rules, performance standards and Walmart Fulfillment Services (WFS)?",
    specific: {
      Q15: { q: "Do you have GS1 UPC / GTIN barcodes for your Walmart products?", o: ["No, I don't know what they are", "No, but I know I need them", "For some products", "Yes, GS1 barcodes for all products"], s: S3 },
      Q16: { q: "What is your marketplace selling history? (Walmart prefers proven sellers.)", o: ["No sales history yet", "Under 6 months on another marketplace", "6–12 months with steady sales", "Over 12 months with strong performance"], s: S3 },
      Q17: { q: "How will you fulfil Walmart orders?", o: ["Not decided", "Ship myself from outside the US", "A US 3PL or my own US warehouse", "Walmart Fulfillment Services (WFS)"], s: [0, 0, 2, 3] }
    },
    flags: function (h) {
      var f = [];
      if (h.idx("Q08") <= 1) f.push([7, "Walmart Marketplace approves registered businesses — plan a US LLC (with EIN) or established company before applying."]);
      if (h.idx("Q15") <= 1) f.push([6, "Walmart requires valid GS1 UPC/GTIN barcodes — buy them from GS1 before listing."]);
      if (h.idx("Q17") === 1) f.push([6, "Walmart customers expect fast US delivery — use a US 3PL or WFS rather than shipping from abroad."]);
      return f;
    }
  });

  A.etsy = marketplace({
    platform: "Etsy", topic: "etsy", page: "/etsy", fit: "developed",
    intro: "Check how ready you are to sell on Etsy — Etsy shop creation, store management, products, photos, budget and time — and get your safest next step.",
    regions: ["Selling mainly to the US", "Selling mainly to the UK", "Selling mainly to Europe", "Worldwide", "Not sure yet"],
    issues: ["No urgent issue", "Etsy shop suspended", "Payment account on reserve", "Listings removed for policy or IP", "Identity or document verification problem", "Low shop rating / case problems", "I am not sure"],
    account: { q: "Do you have an Etsy seller account?", o: ["No, I need to open one", "Opened, but not verified or no sales yet", "Active shop with sales", "Suspended or under review"], s: [1, 1, 3, 0] },
    what: { q: "What will you sell on Etsy?", o: ["Handmade items I make myself", "Items I design, made with a production partner", "Vintage items (20+ years old)", "Craft supplies", "Digital downloads / printables", "Print on demand", "Resold mass-produced items"], s: [3, 3, 3, 3, 2, 2, 0] },
    storeQ: "How well do you understand Etsy shop management — shop sections, policies, Etsy SEO tags, Etsy Ads and Star Seller standards?",
    specific: {
      Q15: { q: "How strong are your Etsy product photos?", o: ["I don't have photos yet", "Phone photos without much styling", "Good, clean photos with some lifestyle shots", "Professional photos and video for every listing"], s: S3 },
      Q16: { q: "How many Etsy orders a week could you make and ship reliably?", o: ["Not sure", "1–5 orders", "6–20 orders", "More than 20, with a reliable process"], s: S3 }
    },
    flags: function (h) { return h.idx("Q11") === 6 ? [[8, "Etsy only allows handmade, vintage, craft supplies or items you design — reselling mass-produced items can get your Etsy shop suspended."]] : []; }
  });

  A.shopify = marketplace({
    platform: "Shopify", topic: "shopify", page: "/shopify-development", fit: "developed", budgetUsd: [1000, 3000, 10000, 30000],
    intro: "Check how ready you are to launch and grow a Shopify store — with a strong focus on your investment budget for the store, ads and stock — and get your safest next step.",
    regions: ["Customers in the US", "Customers in the UK", "Customers in Europe", "Customers in Canada / Australia", "Customers in my own country", "Worldwide"],
    issues: ["No urgent issue", "Shopify store paused or closed", "Payment gateway / Shopify Payments problem", "Ad account disabled", "Chargebacks or payout holds", "Domain or website problem", "I am not sure"],
    account: { q: "Do you already have a Shopify store?", o: ["No store yet", "Store started but not launched", "Live store with few or no sales", "Live store with regular sales"], s: [1, 1, 2, 3] },
    what: { q: "What will your Shopify store sell?", o: ["My own brand products", "Wholesale / branded products", "Print on demand", "Dropshipping", "Digital products or services", "Not decided yet"], s: [3, 2, 2, 1, 2, 0] },
    storeQ: "How well do you understand Shopify store management — theme, apps, products, checkout, payments, shipping and taxes?",
    specific: {
      Q15: { q: "How clear are your Shopify niche, brand and target customer?", o: ["Not decided", "A rough idea", "Clear niche and customer, brand in progress", "Clear niche, brand and offer ready"], s: S3 },
      Q16: { q: "Can you take card payments on Shopify in your target market?", o: ["Not sure", "I need help setting a payment gateway up", "Shopify Payments / Stripe is available for my business", "Set up and tested"], s: S3 }
    }
  });
  // Shopify: an extra "Investment budget" section (more focus on budget).
  (function (S) {
    var B = {
      B01: { type: "budget", q: "How much will you invest in building your Shopify store (theme, design, apps, setup)?", usd: [300, 1000, 3000, 8000], none: "I haven't set a store-build budget", s: [0, 1, 2, 3, 3, 3] },
      B02: { type: "budget", q: "What monthly advertising budget can you commit to your Shopify store for the first 3 months?", hint: "New stores usually need consistent ad spend to test products and audiences.", usd: [300, 1000, 3000, 8000], per: "per month", none: "I have no ad budget yet", s: [0, 1, 2, 3, 3, 3] },
      B03: { type: "budget", q: "How much can you spend on your first stock order?", usd: [500, 2000, 8000, 25000], none: "No stock needed (POD / digital / services)", s: [2, 1, 2, 3, 3, 3] },
      B04: { q: "How many months could you cover Shopify ads and running costs before the store must break even?", o: ["Less than 1 month", "1–2 months", "3–6 months", "More than 6 months"], s: S3 },
      B05: { q: "Have you worked out your break-even ROAS / maximum cost per purchase for your Shopify products?", o: ["I don't know what that means", "Not yet", "Roughly", "Yes, from real numbers"], s: S3 },
      B06: { q: "If your first 30 days of Shopify ads don't make money, what will you do?", o: ["Stop — I can't afford more", "Keep spending the same way and hope", "Pause, review data and test new creatives/offers", "Follow a planned testing budget and kill/scale rules"], s: S3 }
    };
    Object.keys(B).forEach(function (k) { S.questions[k] = B[k]; });
    S.sections.money = { title: "Your Shopify investment budget", sub: "Shopify success depends heavily on budget for the store, ads and stock — please answer carefully.", q: ["Q20", "Q21", "B01", "B02", "B03", "B04", "B05", "B06", "Q22"] };
    S.sections.time = { title: "Time and execution", q: ["Q23", "Q24"] };
    S.order = ["about", "account", "store", "money", "time", "goals"];
    S.areas[3] = ["Investment budget", ["Q20", "Q21", "Q22", "B01", "B02", "B03", "B04", "B05", "B06"]];
    S.areas[0] = ["Business and payment setup", ["Q07", "Q08", "Q09", "Q10"]];
    var base = S.flags;
    S.flags = function (h) {
      var f = base(h).filter(function (x) { return x[1].indexOf("approves sellers in developed countries") < 0; });
      if (h.idx("B02") === 0) f.push([8, "Budget for Shopify advertising — without traffic, a new store gets almost no sales."]);
      if (h.idx("B04") === 0) f.push([7, "Keep at least 3 months of Shopify ad and running costs in reserve — most stores need time to find winning products."]);
      if (h.idx("B05") <= 1) f.push([5, "Work out your break-even ROAS and maximum cost per purchase before spending on ads."]);
      if (h.idx("B06") <= 1) f.push([5, "Plan a structured ad testing budget with clear rules to stop or scale, instead of spending and hoping."]);
      return f;
    };
    S.questions.Q01.hint = "Shopify works worldwide; your location affects payments, taxes and ad accounts.";
  })(A.shopify);

  // ---- Amazon (adaptive) -------------------------------------------------------
  A.amazon = {
    name: "Amazon Seller Assessment", topic: "amazon", countryQ: "Q01",
    title: "Amazon Seller Readiness Assessment",
    intro: "Diagnose your Amazon stage, highest-priority blockers and the safest next step for your Amazon FBA and private label business, through a question path that adapts to your situation.",
    questions: {
      Q01: { type: "country", q: "Where do you live?", fit: "developed", hint: "Amazon approves sellers in developed countries (US, UK, EU, Canada, Australia) most smoothly." },
      Q02: { q: "Which Amazon marketplace are you mainly interested in?", cols: 2, o: ["Amazon United States", "Amazon United Kingdom", "Amazon Canada", "Both Canada and the United States", "Amazon Germany / Europe", "Amazon Australia", "Amazon UAE / Saudi Arabia", "I am not sure yet"] },
      Q07: { q: "Where are you in your Amazon seller journey right now?", o: ["Exploring whether Amazon is right for me", "Building my Amazon foundation", "Validating an Amazon product or sourcing path", "Preparing to launch on Amazon", "Launched on Amazon and working toward stable sales", "Scaling or protecting an active Amazon business"] },
      Q08: { q: "What is the status of the Amazon product you are working on now?", o: ["I do not have a product yet", "I have a product idea only", "I am comparing suppliers, samples, or quotes", "I selected a product but have not ordered inventory", "I ordered inventory or am preparing the Amazon listing", "The product is live on Amazon but not yet stable", "The product is live on Amazon and established", "I am an active Amazon seller evaluating another new product"] },
      Q12: { q: "What experience do you already have with e-commerce?", o: ["None yet", "I have studied or trained but have not sold", "I have sold on another marketplace or my own website", "I sold on Amazon before but am not currently active", "I currently sell on Amazon", "I have worked as a service provider for Amazon sellers"], s: [0, 1, 2, 2, 3, 2] },
      Q15: { q: "Is any urgent Amazon issue active right now?", o: ["No urgent issue", "Amazon account deactivation or suspension", "Amazon listing removal or product restriction", "Intellectual-property complaint or legal notice", "Amazon account-health warning or policy violation", "Payment, identity, or document-verification problem", "I am not sure"] },
      Q09: { q: "Which Amazon business model are you planning to use?", o: ["Amazon FBA private label", "Amazon wholesale", "Handmade or custom products (Amazon Handmade)", "Retail or online arbitrage", "Dropshipping", "Another model", "I am not sure yet"] },
      Q10: { q: "How complete is your Amazon product-cost and profit calculation?", hint: "A complete estimate includes landed cost, Amazon referral and FBA fees, expected PPC, returns, margin and reorder cash. It does not prove profitability.", o: ["I have not calculated the complete economics", "I have only a rough cost or margin estimate", "I completed an estimate including all major costs and reorder cash", "I have actual operating data from a live Amazon product"], s: S3 },
      Q20: { q: "Which statement best describes the supplier and invoice evidence for your Amazon product?", o: ["The supplier will not provide authentic or usable commercial evidence", "I have not checked the supplier evidence yet", "The supplier appears verifiable, but the evidence is incomplete or unconfirmed", "Supplier identity and invoice capability are confirmed in the correct buyer name"], s: S3 },
      Q03: { type: "budget", q: "After paying your bills and keeping emergency savings untouched, how much could you safely invest in your Amazon business?", hint: "Choose only money you can afford to put at risk. Bands are approximate local equivalents and do not estimate profitability.", usd: [750, 2000, 15000, 35000], none: "I do not have a separate safe budget yet", s: [0, 1, 1, 2, 3, 3] },
      Q04: { q: "Where would this Amazon budget come from?", o: ["Household, emergency, borrowed, rent, or bill money", "Credit or a loan that must be repaid quickly", "Savings while continuing current income", "Protected personal savings or business funds"], s: [0, 0, 2, 3] },
      Q05: { q: "How soon would you need your Amazon business to produce profit?", o: ["I need profit for current bills", "I feel strong pressure for quick profit", "I can wait 3–6 months to learn and improve", "I am building for the long term"], s: S3 },
      Q06: { q: "How much time can you consistently give your Amazon business each week?", o: ["Under 3 hours", "3–5 hours", "6–10 hours", "More than 10 hours"], s: S3 },
      Q11: { q: "How would you follow a weekly Amazon work plan?", o: ["I do not currently have regular time or a plan", "I can work occasionally but not consistently", "I can follow a weekly Amazon schedule with guidance", "I already use a consistent weekly plan and review process"], s: S3 },
      Q16: { q: "How do you currently see an Amazon business?", o: ["I want quick or easy money", "I am unsure how serious I am", "I am willing to learn and follow a process", "I think long term and want to build a real Amazon brand"], s: S3 },
      Q17: { q: "If an Amazon product, listing, or PPC campaign does not work as expected, what would you do?", o: ["I would probably quit if things go wrong", "I would need strong guidance", "I can pause, learn, and adjust", "I solve problems systematically and keep improving"], s: S3 },
      Q18: { q: "Before paying a supplier for Amazon stock, what would you do?", o: ["I would buy first and check risk later", "I know risk matters but do not know what to check", "I am willing to check product, IP, and document risk before buying", "I will not buy inventory until risk is reviewed first"], s: S3 },
      Q19: { q: "For your Amazon seller account, how ready are your identity, business, address, and bank documents?", o: ["Some documents are borrowed, missing, or show conflicting information", "I own the documents, but several are missing, outdated, or do not match", "I have most current original documents, with one gap I can explain", "I have all current original documents, and the main names and addresses match"], s: S3 },
      Q21: { q: "How well do you understand supplier and Amazon documents?", o: ["I do not know what documents Amazon may ask for", "I know documents matter but I am not prepared", "I partly understand invoices and supplier documents", "I understand invoice, authorization, category, and compliance-document risks"], s: S3 },
      Q22: { q: "When are you hoping to take your next major Amazon step?", o: ["Immediately, without more preparation", "Within one month, but I still need guidance", "In 1–3 months after preparation", "In more than 3 months, and I am willing to prepare properly"], s: S3 },
      Q13: { q: "What would be the most useful Amazon outcome for you over the next 12 months?", o: ["Decide whether Amazon is right for me", "Build the knowledge and setup needed to start on Amazon properly", "Choose and verify an Amazon product before spending money", "Prepare a selected product for Amazon launch", "Get my first consistent Amazon sales", "Improve or protect my existing Amazon account", "Expand by adding new Amazon products", "Resolve an urgent Amazon listing or account problem"] },
      Q14: { q: "What is the biggest obstacle slowing your Amazon progress right now?", o: ["I do not know where to start", "I do not have a safe budget", "I am unsure how to choose an Amazon product", "I am unsure about suppliers or documents", "I am worried about compliance or intellectual property", "I need help preparing the Amazon listing or launch", "I need help with Amazon PPC, sales, or inventory", "I struggle to find consistent time", "I have an active Amazon listing or account issue", "Something else"] }
    },
    sections: {
      triage: { title: "Your Amazon position and urgent triage", sub: "Your answers here determine which Amazon readiness section comes next.", q: ["Q01", "Q02", "Q07", "Q08", "Q12", "Q15"] },
      product: { title: "Amazon product decision readiness", q: ["Q09", "Q10", "Q20"] },
      financial: { title: "Amazon budget and execution capacity", q: ["Q03", "Q04", "Q05", "Q06", "Q11"] },
      risk: { title: "Amazon risk and document discipline", q: ["Q16", "Q17", "Q18", "Q19", "Q21", "Q22"] },
      goals: { title: "Amazon goals and blockers", q: ["Q13", "Q14"] }
    },
    adaptive: {
      triage: "triage",
      decide: function (h) {
        var urgent = h.idx("Q15"), stage = h.idx("Q07"), product = h.idx("Q08");
        if (urgent >= 1 && urgent <= 5) return "protection";
        if (product >= 5 || stage >= 4) return "growth";
        if (product === 4 || stage === 3) return "launch";
        if (product >= 2 || stage === 2) return "validation";
        return "foundation";
      },
      paths: {
        protection: { name: "Amazon Account Protection", order: ["risk", "goals", "financial", "product"] },
        foundation: { name: "Amazon Foundation", order: ["financial", "goals", "risk", "product"] },
        validation: { name: "Amazon Product Validation", order: ["product", "financial", "risk", "goals"] },
        launch: { name: "Amazon Launch Preparation", order: ["risk", "product", "financial", "goals"] },
        growth: { name: "Amazon Growth & Protection", order: ["goals", "product", "risk", "financial"] }
      }
    },
    areas: [
      ["Location and account fit", ["Q01", "Q19"]],
      ["Financial safety", ["Q03", "Q04", "Q05"]],
      ["Time and execution", ["Q06", "Q11", "Q22"]],
      ["Product and supplier", ["Q10", "Q20"]],
      ["Risk and documents", ["Q18", "Q21"]],
      ["Mindset and experience", ["Q12", "Q16", "Q17"]]
    ],
    flags: function (h) {
      var f = [];
      var loc = locationFlag(h, "Amazon", "developed"); if (loc) f.push(loc);
      var u = h.idx("Q15");
      if (u >= 1 && u <= 5) f.push([10, "Resolve the active Amazon issue (" + h.text("Q15").toLowerCase() + ") before any new spending or launches."]);
      if (u === 6) f.push([6, "Check Account Health in Amazon Seller Central for any active warnings before your next step."]);
      if (h.idx("Q04") === 0) f.push([9, "Don't use household, emergency, borrowed, rent or bill money for your Amazon business."]);
      if (h.idx("Q04") === 1) f.push([8, "Avoid funding Amazon inventory with credit or a loan that must be repaid quickly."]);
      if (h.idx("Q19") === 0) f.push([9, "Never use borrowed or conflicting documents — Amazon verification can fail and lead to account suspension."]);
      if (h.idx("Q19") === 1) f.push([6, "Update your identity, business, address and bank documents so the names and addresses match for Amazon."]);
      if (h.idx("Q05") === 0) f.push([8, "Don't rely on Amazon to pay current bills — Amazon profit usually takes months to build."]);
      if (h.idx("Q20") === 0) f.push([8, "Don't buy from a supplier that won't provide authentic commercial invoices — Amazon may ask for them."]);
      if (h.idx("Q20") === 1) f.push([6, "Verify the supplier's identity and invoice capability before paying for Amazon stock."]);
      if (h.idx("Q03") === 0) f.push([7, "Set a separate, safe Amazon budget before buying any inventory."]);
      if (h.idx("Q18") === 0) f.push([7, "Check product, intellectual-property and document risk before paying any supplier."]);
      if (h.idx("Q09") === 4) f.push([7, "Check Amazon's dropshipping policy carefully — buying from another retailer to ship to your Amazon customers isn't allowed."]);
      if (h.idx("Q10") === 0 && h.idx("Q08") >= 2) f.push([6, "Calculate full Amazon economics — landed cost, Amazon fees, PPC, returns and reorder cash — before ordering."]);
      if (h.idx("Q16") === 0) f.push([5, "Amazon isn't quick or easy money — plan for months of learning and reinvestment."]);
      if (h.idx("Q22") === 0) f.push([5, "Slow down: rushing onto Amazon without preparation is the most common way new sellers lose money."]);
      if (h.idx("Q21") === 0) f.push([5, "Learn which invoices and documents Amazon may request before you start."]);
      if (h.idx("Q06") === 0 || h.idx("Q11") === 0) f.push([4, "Block out regular weekly time — Amazon progress is hard with under 3 consistent hours a week."]);
      return f;
    },
    next: function (level, h, p, L) {
      var book = ["Book an Amazon consultation", "/book-consultation?topic=amazon", "outline"];
      if (p === "protection") return { title: "Resolve the Amazon account issue first", text: "Pause new spending and fix the active issue with a clear, documented plan. Our team reviews your Amazon account and prepares the right appeal or response.", links: [["Amazon account reactivation", "/amazon-fba#pricing", "accent"], book] };
      if (level === L[0] || p === "foundation") return { title: "Build your Amazon foundations before spending", text: "Learn how Amazon works, set a safe budget and prepare your documents before you choose a product. Start with free learning, then structured one-to-one classes.", links: [["Explore Level 1 training", "/#level-1", "accent"], ["Read the Beginner's Guide", "/beginners-guide", "outline"]] };
      if (p === "validation") return { title: "Validate one Amazon product before buying inventory", text: "Confirm demand, competition, full costs and supplier evidence for a single product before you pay for stock. Our researched Amazon high-demand product lists are a safe starting point.", links: [["Amazon high-demand product research", "/amazon-fba#pricing", "accent"], book] };
      if (p === "launch") return { title: "Check documents and listing before your Amazon launch", text: "Make sure your Amazon account, invoices and listing are compliant and your launch plan, PPC and inventory are ready, so the first weeks build momentum instead of risk.", links: [["Amazon account review", "/amazon-fba#pricing", "accent"], book] };
      return { title: "Protect your Amazon account and grow steadily", text: "Strengthen Amazon account health, improve PPC efficiency and add products only after the numbers on your current ones are stable.", links: [["Amazon growth strategy & PPC", "/amazon-fba#pricing", "accent"], book] };
    }
  };

  // ---- Company formation ----------------------------------------------------------
  A.company = {
    name: "Company Formation Assessment", topic: "company-registration", countryQ: "Q01", minutes: 7,
    title: "Company Formation Readiness Assessment",
    intro: "Check how ready you are for company formation — your experience, purpose, e-commerce market, investment budget, documents and tax management — and find the right company structure and next step.",
    notice: "Free company formation assessment — about 7 minutes. All questions are about forming and running your company properly.",
    questions: {
      Q01: { type: "country", q: "Where do you live (your country of residence)?", fit: "developed" },
      Q02: { q: "Which company formation are you considering?", o: ["UK LTD company", "US LLC", "Malta company", "UAE company (free zone or mainland)", "More than one country", "Not sure — I need advice on company formation"] },
      Q03: { q: "What is the main purpose of your new company?", o: ["Selling on Amazon / eBay / Walmart / TikTok Shop", "My own online store (Shopify, website)", "Freelancing or consulting services", "Software, apps or SaaS", "Import / export trading", "Holding company or investments"] },
      Q04: { q: "Which e-commerce market or customers will the company mainly sell to?", o: ["United States", "United Kingdom", "European Union", "Middle East", "Worldwide", "Not decided yet"] },
      Q05: { q: "What is your business experience?", o: ["This will be my first business", "Freelancer / sole trader before", "I have run a company before", "I run or have run several companies"], s: S3 },
      Q06: { q: "What is your e-commerce experience?", o: ["None yet", "Trained / studied but not sold", "Selling as an individual already", "Running an e-commerce business with steady sales"], s: S3 },
      Q07: { q: "How clearly have you chosen your e-commerce market and marketplace?", o: ["Not chosen yet", "A rough idea", "Chosen, still researching products", "Chosen, with products and a launch plan"], s: S3 },
      Q08: { q: "Expected company revenue in the first year (approx. USD)?", o: ["Not sure yet", "Under $50,000", "$50,000 – $250,000", "Over $250,000"] },
      Q09: { q: "Who will own the company?", o: ["Just me", "Me and one partner", "Three or more owners", "Another company will own it"] },
      Q10: { q: "Will the company store stock in a UK, EU or US warehouse (e.g. Amazon FBA)?", o: ["Yes, in the UK", "Yes, in the EU", "Yes, in the US", "No stock (services / dropship / digital)", "Not sure yet"] },
      Q11: { q: "Do you need a business bank account for the company?", o: ["Not sure", "Yes — an online bank (Wise, Payoneer, Mercury etc.)", "Yes — a traditional bank in that country", "I already have one arranged"], s: [0, 2, 2, 3] },
      Q12: { type: "budget", q: "What is your budget for company formation plus the first year of compliance (registered agent, address, accounts, tax filing)?", usd: [300, 700, 1500, 3000], none: "I haven't budgeted for company formation yet", s: [0, 1, 2, 3, 3, 3] },
      Q13: { type: "budget", q: "How much will you invest in the business itself (stock, ads, website) in year one?", usd: [1000, 5000, 20000, 50000], none: "I don't have an investment budget yet", s: [0, 1, 2, 2, 3, 3] },
      Q14: { q: "Where will the business investment come from?", o: ["Household, emergency or borrowed money", "Credit or a short-term loan", "Savings while keeping my income", "Protected savings or existing business funds"], s: [0, 0, 2, 3] },
      Q15: { q: "Do you know a company has yearly running costs (registered agent, address, annual return, accounts, tax filing)?", o: ["No, I thought formation was a one-off cost", "I've heard, but don't know the amounts", "Yes, roughly", "Yes, and I've budgeted for them"], s: S3 },
      Q16: { q: "How well do you understand the tax management for the company you're forming? (e.g. US Form 5472/1120, UK Corporation Tax and VAT, Malta tax refunds, UAE corporate tax)", o: ["Not at all", "I know taxes exist but not the details", "I understand the main filings", "I understand the filings and deadlines in detail"], s: S3 },
      Q17: { q: "Who will keep the company's books and file its tax returns?", o: ["Not decided", "Myself, without accounting experience", "Myself, with software and guidance", "A qualified accountant / your firm"], s: S3 },
      Q18: { q: "Do you understand how the company affects your personal tax where you live?", o: ["No", "A little", "Mostly", "Yes, I've had advice"], s: S3 },
      Q19: { q: "Have you had company or tax problems before (late filings, penalties, company struck off)?", o: ["No, never", "Not applicable — first company", "Yes, but resolved", "Yes, still unresolved"], s: [3, 3, 2, 0] },
      Q20: { q: "How ready are your documents for company formation (passport, proof of address, ID of all owners)?", o: ["Missing or expired", "Some missing", "Mostly ready", "All current and in my name"], s: S3 },
      Q21: { q: "Do you have a business address in the country of formation?", o: ["No — I'll need one", "A virtual address with mail forwarding", "A registered agent address only", "A physical office"], s: [1, 3, 2, 3] },
      Q22: { q: "When do you want the company formed?", o: ["As soon as possible (this week)", "Within a month", "In 1–3 months", "Just exploring for now"] }
    },
    sections: {
      profile: { title: "Your experience and purpose", sub: "Who you are and why you need a company.", q: ["Q01", "Q02", "Q03", "Q05", "Q06"] },
      market: { title: "Your e-commerce market and business plan", q: ["Q04", "Q07", "Q08", "Q09", "Q10", "Q11"] },
      budget: { title: "Company formation and investment budget", q: ["Q12", "Q13", "Q14", "Q15"] },
      tax: { title: "Tax management and compliance", sub: "Running a company properly means keeping up with tax and filings every year.", q: ["Q16", "Q17", "Q18", "Q19"] },
      docs: { title: "Documents and timeline", q: ["Q20", "Q21", "Q22"] }
    },
    order: ["profile", "market", "budget", "tax", "docs"],
    areas: [
      ["Experience and purpose", ["Q05", "Q06", "Q07"]],
      ["Budget and investment", ["Q12", "Q13", "Q14", "Q15"]],
      ["Tax management", ["Q16", "Q17", "Q18", "Q19"]],
      ["Documents and setup", ["Q20", "Q21", "Q11"]]
    ],
    flags: function (h) {
      var f = [], j = h.idx("Q02");
      if (h.idx("Q10") === 0) f.push([8, "Non-UK companies storing stock in a UK warehouse (e.g. Amazon FBA UK) must register for UK VAT from day one — plan this into your company formation."]);
      if (j === 1 && h.idx("Q16") <= 1) f.push([8, "US LLCs owned by non-residents must file IRS Form 5472 with a pro-forma 1120 every year — missing it can trigger a $25,000 penalty."]);
      if (h.idx("Q19") === 3) f.push([9, "Resolve the unresolved company or tax issue before forming a new company — it can affect banking and approvals."]);
      if (h.idx("Q14") <= 1) f.push([8, "Don't fund a new company with household, borrowed or short-term loan money."]);
      if (h.idx("Q12") === 0) f.push([7, "Budget for formation and the first year of compliance — a company has yearly running costs."]);
      if (h.idx("Q20") <= 1) f.push([7, "Get all owners' passports and proof of address current before company formation — banks and agents check them."]);
      if (h.idx("Q17") <= 1) f.push([6, "Arrange an accountant or a clear bookkeeping process before the company starts trading."]);
      if (h.idx("Q07") === 0) f.push([5, "Choose your e-commerce market first — it decides which country your company should be formed in."]);
      if (j === 5) f.push([4, "Get advice on the right jurisdiction before forming — UK, US, Malta and UAE companies suit different businesses."]);
      return f;
    },
    next: function (level, h, p, L) {
      var pages = ["/uk-ltd-formation", "/us-llc-formation", "/malta-company-formation", "/uae-company-formation"];
      var page = pages[h.idx("Q02")] || "/services#formation";
      var book = ["Book a company formation consultation", "/book-consultation?topic=company-registration", "outline"];
      if (level === L[0]) return { title: "Plan your company formation before registering", text: "Clarify your market, budget and tax obligations first. A consultation helps you choose the right country and structure so you don't pay for the wrong company.", links: [["Book a company formation consultation", "/book-consultation?topic=company-registration", "accent"], ["Compare UK LTD and US LLC", "/blog-us-llc-vs-uk-ltd", "outline"]] };
      if (h.idx("Q02") >= 4) return { title: "Choose the right company formation", text: "Your answers show you need advice on which country to form in. We compare UK, US, Malta and UAE options for your market and tax position.", links: [["Book a company formation consultation", "/book-consultation?topic=company-registration", "accent"], ["Compare UK LTD and US LLC", "/blog-us-llc-vs-uk-ltd", "outline"]] };
      return { title: "Go ahead with your company formation", text: "You're well prepared. Form your company with the right address, bank and tax setup from day one, and plan your yearly tax management.", links: [["View company formation plans", page + "#plans", "accent"], book] };
    }
  };

  // ---- Company taxation ---------------------------------------------------------------
  A.tax = {
    name: "Company Taxation Assessment", topic: "taxation", countryQ: "Q01", minutes: 6,
    title: "Company Taxation Health Check",
    intro: "Check your company taxation — tax filing history, previous returns, bookkeeping, VAT / sales tax and deadlines — and find out what needs fixing before penalties arrive.",
    notice: "Free company taxation assessment — about 6 minutes. All questions are about your company's tax management and filings.",
    levels: ["High risk — act now", "Needs attention", "Mostly compliant", "In good standing"],
    resultLabel: "Your company taxation health",
    disclaimer: "This assessment is general guidance on company taxation based on your answers. It is not tax advice; we confirm your position before any filing.",
    questions: {
      Q01: { type: "country", q: "Where do you live (your personal tax residence)?", fit: "developed" },
      Q02: { q: "Where is your company registered for taxation?", o: ["US LLC — single member", "US LLC — multi-member or US corporation", "UK LTD", "Malta company", "UAE company", "Another country / I'm a sole trader"] },
      Q03: { q: "When was the company formed?", o: ["Less than 12 months ago", "1–2 years ago", "3–5 years ago", "More than 5 years ago"] },
      Q04: { q: "What does the company do?", o: ["Sells on marketplaces (Amazon, eBay, Walmart, TikTok Shop)", "Own online store", "Services / freelancing", "Trading / import-export", "Holding company / no activity yet"] },
      Q05: { q: "Approximate company revenue last year (USD equivalent)?", o: ["No revenue / dormant", "Under $50,000", "$50,000 – $250,000", "Over $250,000"] },
      Q06: { q: "Have you filed every required company tax return since the company was formed?", o: ["Nothing has been filed yet", "Some filed, some missed", "All filed, but some late", "All filed on time"], s: S3 },
      Q07: { q: "Have you received a penalty, notice or letter from the tax authority (IRS, HMRC or other)?", o: ["Yes — still unresolved", "Yes — resolved or on a payment plan", "No"], s: [0, 2, 3] },
      Q08: { q: "Are your company's annual filings up to date (annual accounts, confirmation statement, state annual report / franchise tax)?", o: ["No / I don't know what these are", "Behind on some", "Up to date, but done at the last minute", "Fully up to date and planned"], s: S3 },
      Q09: { q: "Do you know your company's next tax filing deadlines?", o: ["No", "Roughly", "Yes, for the main return", "Yes, every deadline is in my calendar"], s: S3 },
      Q10: { q: "Who prepared your previous company tax returns?", o: ["No one — none filed", "Myself", "A freelancer / unqualified preparer", "A qualified accountant or firm"], s: S3 },
      Q11: { q: "How are your company's books kept?", o: ["Not kept at all", "Occasionally in a spreadsheet", "A spreadsheet updated monthly", "Accounting software, reconciled monthly"], s: S3 },
      Q12: { q: "Do you have the company's bank and marketplace/payment statements for the whole year?", o: ["No", "Some months missing", "Yes, but not organised", "Yes, complete and organised"], s: S3 },
      Q13: { q: "Are payments between you and the company recorded (money you put in, money you took out)?", o: ["No", "Partly", "Mostly", "Yes, every transaction"], s: S3 },
      Q14: { q: "Do you keep receipts and invoices for company expenses and stock?", o: ["Rarely", "Sometimes", "Usually", "Always, stored digitally"], s: S3 },
      Q15: { q: "What is the company's VAT / sales tax status?", o: ["Not registered, and not sure if it's needed", "Not registered — confirmed not needed", "Registered, but behind on returns", "Registered and returns up to date"], s: [0, 3, 0, 3] },
      Q16: { q: "Does the company store stock in warehouses abroad (e.g. Amazon FBA)?", o: ["Yes, in the UK", "Yes, in the EU", "Yes, in the US", "No", "Not sure"] },
      Q17: { q: "How well do you understand your company's main tax filing? (US Form 5472 + pro-forma 1120 / Form 1065, UK CT600 Corporation Tax, Malta or UAE tax return)", o: ["Not at all", "I know it exists", "I understand what's filed", "I understand it and the penalties for missing it"], s: S3 },
      Q18: { q: "Does the company pay salaries or dividends?", o: ["No", "I take money out without a formal method", "Dividends with records", "Salary through payroll and/or documented dividends"], s: [3, 0, 2, 3] },
      Q19: { q: "How urgent is your next company tax filing?", o: ["The deadline has already passed", "Due within 30 days", "Due in 1–3 months", "More than 3 months away / not sure"] },
      Q20: { type: "budget", q: "What is your yearly budget for company accounting and tax filing?", usd: [150, 300, 800, 2000], none: "I haven't budgeted for company taxation", s: [0, 1, 2, 3, 3, 3] },
      Q21: { q: "What do you need most with company taxation?", o: ["Catch up on missed years", "This year's annual tax filing", "Ongoing bookkeeping", "Tax planning / structure advice", "Responding to a tax notice"] }
    },
    sections: {
      company: { title: "Your company", q: ["Q01", "Q02", "Q03", "Q04", "Q05"] },
      history: { title: "Company tax filing history", sub: "Your previous company tax filings and any notices.", q: ["Q06", "Q07", "Q08", "Q09", "Q10"] },
      books: { title: "Bookkeeping and records", q: ["Q11", "Q12", "Q13", "Q14"] },
      oblig: { title: "VAT, sales tax and other obligations", q: ["Q15", "Q16", "Q17", "Q18"] },
      support: { title: "Deadlines, budget and support", q: ["Q19", "Q20", "Q21"] }
    },
    order: ["company", "history", "books", "oblig", "support"],
    areas: [
      ["Filing history", ["Q06", "Q07", "Q08", "Q09"]],
      ["Records and bookkeeping", ["Q11", "Q12", "Q13", "Q14"]],
      ["Tax compliance knowledge", ["Q10", "Q15", "Q17", "Q18"]],
      ["Budget and support", ["Q20"]]
    ],
    flags: function (h) {
      var f = [], co = h.idx("Q02");
      if (h.idx("Q19") === 0) f.push([10, "Your company tax deadline has passed — file as soon as possible to limit penalties and interest."]);
      if (h.idx("Q07") === 0) f.push([10, "Respond to the unresolved tax notice before its deadline — ignoring it makes penalties grow."]);
      if (h.idx("Q06") <= 1) f.push([9, "File the missed company tax returns — catching up voluntarily is far cheaper than waiting for enforcement."]);
      if (co <= 1 && h.idx("Q17") <= 1) f.push([9, "A foreign-owned US LLC must file Form 5472 with a pro-forma 1120 every year, even with no profit — missing it can mean a $25,000 penalty."]);
      if (h.idx("Q16") === 0 && h.idx("Q15") !== 3) f.push([9, "Overseas companies storing stock in the UK must be registered for UK VAT from day one and file returns."]);
      if (h.idx("Q15") === 2) f.push([8, "Bring your VAT / sales tax returns up to date — late returns add penalties every period."]);
      if (h.idx("Q15") === 0) f.push([6, "Confirm whether your company needs VAT or sales tax registration."]);
      if (h.idx("Q08") <= 1) f.push([7, "Bring annual company filings up to date — late filings can lead to fines or the company being struck off."]);
      if (h.idx("Q11") <= 1) f.push([6, "Start proper bookkeeping (monthly, in accounting software) so tax filings are accurate."]);
      if (h.idx("Q18") === 1) f.push([6, "Record how you take money out of the company (salary or dividends) — undocumented withdrawals cause tax problems."]);
      if (h.idx("Q19") === 1) f.push([6, "Your next filing is due within 30 days — start preparing now."]);
      return f;
    },
    next: function (level, h, p, L) {
      var book = ["Book a tax consultation", "/book-consultation?topic=taxation", "outline"];
      if (level === L[0] || h.idx("Q19") === 0 || h.idx("Q07") === 0) return { title: "Get your company taxation back on track now", text: "Your answers show missed filings, a passed deadline or an open notice. We prepare catch-up filings and handle responses so penalties stop growing.", links: [["Book a tax consultation", "/book-consultation?topic=taxation", "accent"], ["View tax filing prices", "/taxation#pricing", "outline"]] };
      if (level === L[1]) return { title: "Fix the gaps before your next filing", text: "Tidy up your bookkeeping and records, and confirm every filing and deadline for your company. We can take over the annual filings for you.", links: [["View tax filing prices", "/taxation#pricing", "accent"], book] };
      return { title: "Keep your company tax compliant every year", text: "You're in good shape. Let us handle your annual company tax filing and accounts so every deadline is met on time.", links: [["View tax filing prices", "/taxation#pricing", "accent"], book] };
    }
  };

  // ---- Digital marketing (a page per platform) --------------------------------------
  function platformQs(prefix, name, objectiveOpts, extra) {
    var q = {};
    q[prefix + "01"] = { q: "Are you running " + name + " ads now?", o: ["Never run " + name + " ads", "Tried a few / boosted posts only", "Running campaigns occasionally", "Running ongoing campaigns with tracking"], s: S3 };
    q[prefix + "02"] = { type: "budget", q: "What monthly budget would you give to " + name + " ads?", usd: [100, 500, 2000, 6000], per: "per month", none: "No budget for " + name + " yet", s: [0, 1, 2, 3, 3, 3] };
    q[prefix + "03"] = { q: "What is your main goal on " + name + "?", o: objectiveOpts };
    q[prefix + "04"] = { q: "How many people do you want to reach on " + name + " each month?", o: ["Under 10,000", "10,000 – 50,000", "50,000 – 250,000", "More than 250,000"] };
    q[prefix + "05"] = { q: "What results have you had from " + name + " ads so far?", o: ["No data yet", "Lost money", "Roughly break-even", "Profitable / good cost per lead"], s: [1, 0, 2, 3] };
    Object.keys(extra).forEach(function (k) { q[k] = extra[k]; });
    return q;
  }
  var meta = platformQs("M", "Meta (Facebook & Instagram)", ["Online sales", "Leads / enquiries", "Messages (WhatsApp / Messenger)", "Reach and brand awareness", "Followers and engagement"], {
    M06: { q: "Is the Meta Pixel and Conversions API set up on your website?", o: ["I don't know what that is", "Not installed", "Pixel only", "Pixel + Conversions API, events verified"], s: S3 },
    M07: { q: "What is your Meta Business Manager and ad account status?", o: ["No Business Manager", "Personal ad account only", "Business Manager set up", "Verified business with ad account history"], s: S3 },
    M08: { q: "Can you supply Meta ad creatives (images, videos, UGC)?", o: ["Nothing yet", "A few photos", "Regular photos and some videos", "A steady flow of videos / UGC"], s: S3 }
  });
  var tiktok = platformQs("T", "TikTok", ["TikTok Shop sales", "Website sales", "Leads", "Reach and brand awareness", "Followers"], {
    T06: { q: "Can you produce native TikTok videos every week?", o: ["No", "Occasionally", "Yes, simple videos weekly", "Yes, plus creators / UGC"], s: S3 },
    T07: { q: "Is the TikTok Pixel / Events API set up on your website?", o: ["I don't know what that is", "Not installed", "Pixel only", "Pixel + Events API, events verified"], s: S3 },
    T08: { q: "Will you use creators or Spark Ads on TikTok?", o: ["I don't know what they are", "Maybe later", "Yes, planning to", "Already using them"], s: S3 }
  });
  var google = platformQs("G", "Google (Search, Shopping & YouTube)", ["Online sales", "Leads / calls", "Local store visits", "Brand awareness (YouTube)", "App installs"], {
    G06: { type: "multi", q: "Which Google campaigns do you want?", o: ["Search", "Shopping / Performance Max", "YouTube", "Display", "Local / Google Maps", "Not sure"] },
    G07: { q: "Do people already search on Google for what you sell?", o: ["I don't know", "Very little", "Moderate search demand", "Strong search demand"], s: S3 },
    G08: { q: "Is conversion tracking set up (GA4 and Google Ads conversions)?", o: ["I don't know what that is", "Not set up", "GA4 only", "GA4 + Google Ads conversions verified"], s: S3 },
    G09: { q: "Google Merchant Center / Business Profile status?", o: ["Don't know / not needed", "Not set up", "Set up with issues", "Approved and active"], s: [1, 0, 1, 3] }
  });
  var dmQ = {
    Q01: { type: "country", q: "Where is your business based?", fit: "developed" },
    Q02: { q: "What type of business is your digital marketing for?", o: ["E-commerce / online store", "Amazon or marketplace seller", "Local business (shop, clinic, restaurant)", "Services / coaching", "App or software", "Personal brand / creator"] },
    Q03: { q: "Do you have a website or landing page ready for ads?", o: ["No website", "A basic page", "A working website, not optimised", "A fast website built for conversions"], s: S3 },
    Q04: { q: "What is the main purpose of your digital marketing?", o: ["More online sales", "More leads / enquiries", "Brand awareness and reach", "App installs", "Followers and engagement"] },
    Q05: { q: "Where are your target customers?", o: ["My city / local area", "My whole country", "Several countries", "Worldwide"] },
    Q06: { type: "multi", q: "Which digital platforms do you want to advertise on?", hint: "You'll get one page of questions for each platform you choose.", o: ["Meta (Facebook & Instagram)", "TikTok", "Google (Search, Shopping & YouTube)"] },
    Q07: { type: "budget", q: "What is your total monthly digital marketing budget (ad spend, all platforms)?", usd: [300, 1000, 3000, 10000], per: "per month", none: "I don't have an ad budget yet", s: [0, 1, 2, 3, 3, 3] },
    Q08: { q: "Who will manage your campaigns?", o: ["Me, with no experience", "Me, with some experience", "An in-house marketer", "Qalb-E-Abbas (you)"], s: [0, 1, 2, 3] },
    Q09: { q: "When do you want to start advertising?", o: ["Immediately", "Within a month", "In 1–3 months", "Just exploring"] }
  };
  [meta, tiktok, google].forEach(function (o) { Object.keys(o).forEach(function (k) { dmQ[k] = o[k]; }); });
  A.marketing = {
    name: "Digital Marketing Assessment", topic: "digital-marketing", countryQ: "Q01", minutes: 8,
    title: "Digital Marketing Readiness Assessment",
    intro: "Check how ready your business is for digital marketing on Meta (Facebook & Instagram), TikTok and Google — budget, purpose, reach and tracking for each platform — and get a clear plan.",
    notice: "Free digital marketing assessment — one page of questions for each platform you choose (Meta, TikTok, Google).",
    levels: ["Not ready to advertise", "Building foundations", "Ready to test", "Ready to scale"],
    resultLabel: "Your digital marketing readiness",
    questions: dmQ,
    sections: {
      biz: { title: "Your business, budget and purpose", q: ["Q01", "Q02", "Q03", "Q04", "Q05", "Q06", "Q07", "Q08", "Q09"] },
      meta: { title: "Meta — Facebook & Instagram", sub: "Budget, purpose, reach and setup for Meta ads.", q: ["M01", "M02", "M03", "M04", "M05", "M06", "M07", "M08"], when: function (h) { return h.picked("Q06", 0); } },
      tiktok: { title: "TikTok", sub: "Budget, purpose, reach and setup for TikTok ads.", q: ["T01", "T02", "T03", "T04", "T05", "T06", "T07", "T08"], when: function (h) { return h.picked("Q06", 1); } },
      google: { title: "Google — Search, Shopping & YouTube", sub: "Budget, purpose, reach and setup for Google ads.", q: ["G01", "G02", "G03", "G04", "G05", "G06", "G07", "G08", "G09"], when: function (h) { return h.picked("Q06", 2); } }
    },
    order: ["biz", "meta", "tiktok", "google"],
    areas: [
      ["Foundations and budget", ["Q03", "Q07", "Q08"]],
      ["Meta readiness", ["M01", "M02", "M05", "M06", "M07", "M08"]],
      ["TikTok readiness", ["T01", "T02", "T05", "T06", "T07", "T08"]],
      ["Google readiness", ["G01", "G02", "G05", "G07", "G08", "G09"]]
    ],
    flags: function (h) {
      var f = [];
      var n = (h.answers().Q06 || []).length;
      if (h.idx("Q03") === 0 && h.idx("Q04") <= 1) f.push([8, "Build a website or landing page first — ads for sales or leads need somewhere to send people."]);
      if (h.idx("Q07") === 0) f.push([8, "Set a monthly ad budget — digital marketing needs consistent spend to learn what works."]);
      if (h.idx("Q07") === 1 && n >= 2) f.push([6, "With a small budget, start on one platform instead of spreading it across " + n + "."]);
      if (h.idx("M06") >= 0 && h.idx("M06") <= 1) f.push([6, "Install the Meta Pixel and Conversions API before running Meta sales or lead ads."]);
      if (h.idx("T07") >= 0 && h.idx("T07") <= 1) f.push([6, "Install the TikTok Pixel / Events API before running TikTok conversion campaigns."]);
      if (h.idx("G08") >= 0 && h.idx("G08") <= 1) f.push([6, "Set up GA4 and Google Ads conversion tracking before spending on Google."]);
      if (h.idx("M08") === 0) f.push([5, "Prepare Meta ad creatives (photos, short videos or UGC) — creative is the biggest driver of results."]);
      if (h.idx("T06") === 0) f.push([5, "TikTok ads need native short videos every week — plan content or creators before launching."]);
      if (h.idx("G07") === 1) f.push([4, "Search demand for your product is low — Meta or TikTok may suit you better than Google Search."]);
      if (h.idx("M05") === 1 || h.idx("T05") === 1 || h.idx("G05") === 1) f.push([5, "Previous campaigns lost money — fix tracking, offer and creatives before increasing budget."]);
      return f;
    },
    next: function (level, h, p, L) {
      var book = ["Book a marketing consultation", "/book-consultation?topic=digital-marketing", "outline"];
      if (level === L[0]) return { title: "Build your marketing foundations first", text: "Get your website, tracking and budget ready before spending on ads. A consultation helps you plan the first steps on the right platform.", links: [["Book a marketing consultation", "/book-consultation?topic=digital-marketing", "accent"], ["Website development", "/website-development", "outline"]] };
      if (level === L[3]) return { title: "Scale your best-performing platform", text: "Your setup is strong. Increase budget on what's working, expand creatives and add the next platform with proper tracking.", links: [["Digital marketing plans", "/digital-marketing#pricing", "accent"], book] };
      return { title: "Launch structured test campaigns", text: "Start with one or two platforms, a clear testing budget and tracking in place, then scale what works. We set up and manage Meta, TikTok and Google campaigns.", links: [["Digital marketing plans", "/digital-marketing#pricing", "accent"], book] };
    }
  };

  // ---- Study in Malta (international student assessment) --------------------------------
  var ageStudy = function (v) { var n = parseFloat(v); if (isNaN(n)) return null; return n >= 17 && n <= 30 ? 3 : n <= 35 ? 2 : n <= 45 ? 1 : 0; };
  var engScore = function (v, h) {
    var n = parseFloat(v), t = h.idx("S21");
    if (isNaN(n)) return null;
    if (t === 2) return n >= 6 ? 3 : n >= 5.5 ? 2 : n >= 5 ? 1 : 0;      // IELTS
    if (t === 3) return n >= 59 ? 3 : n >= 50 ? 2 : n >= 43 ? 1 : 0;     // PTE
    if (t === 4) return n >= 80 ? 3 : n >= 60 ? 2 : n >= 45 ? 1 : 0;     // TOEFL iBT
    if (t === 5) return n >= 105 ? 3 : n >= 95 ? 2 : n >= 85 ? 1 : 0;    // Duolingo
    return null;
  };
  A.malta = {
    name: "Study in Malta Assessment", topic: "education-consultancy", countryQ: "S03", minutes: 12, noAgeInDetails: true,
    title: "Study in Malta Eligibility Assessment",
    intro: "A complete international-student assessment for studying in Malta — your full study history and marks, English, finances and budget, visa history, accommodation and hostel needs — so we can match you to the right course and university.",
    notice: "Free study abroad assessment — about 12 minutes. Please have your marks and test scores ready; the more accurate your answers, the better our advice.",
    levels: ["Not eligible yet", "Needs preparation", "Good candidate", "Strong candidate"],
    resultLabel: "Your study-in-Malta profile",
    disclaimer: "This assessment is general guidance based on your answers. Final admission depends on the university, and visas are decided by Identity Malta.",
    questions: {
      S01: { type: "number", q: "How old are you?", min: 15, max: 70, step: 1, unit: "years", placeholder: "e.g. 22", score: ageStudy },
      S02: { type: "country", select: true, list: WORLD, q: "What is your nationality?" },
      S03: { type: "country", select: true, list: WORLD, q: "Which country do you currently live in?" },
      S04: { q: "What is your passport status?", o: ["I don't have a passport yet", "Expires within 12 months", "Valid for 1–2 more years", "Valid for more than 2 years"], s: S3 },
      S05: { q: "What is your marital status?", o: ["Single", "Married", "Married with children", "Prefer not to say"] },
      S06: { q: "Will any family members travel with you to Malta?", o: ["No, only me", "My spouse", "My spouse and children"] },
      S07: { q: "What is your international travel history?", o: ["Never travelled abroad", "Visited non-Schengen countries", "Held a Schengen, UK, US, Canada or Australia visa", "Studied or lived abroad before"], s: S3 },
      S08: { q: "Have you ever been refused a visa for any country?", o: ["No, never", "Once, and I can explain why", "More than once"], s: [3, 1, 0] },
      S09: { q: "What is your highest completed qualification?", o: ["Matric / O-Levels / SSC (10 years)", "Intermediate / A-Levels / HSSC (12 years)", "Diploma / DAE", "Bachelor's degree (2 or 3 years)", "Bachelor's degree (4 years)", "Master's degree", "Other"] },
      S10: { type: "number", q: "In which year did you complete your highest qualification?", min: 1975, max: 2027, step: 1, placeholder: "e.g. 2024" },
      S11: { type: "number", q: "Secondary school result (Matric / O-Level / SSC) — percentage", min: 0, max: 100, unit: "%", placeholder: "e.g. 78", score: pct },
      S12: { type: "number", optional: true, q: "Higher secondary result (Intermediate / A-Level / HSSC) — percentage", hint: "Leave blank if you haven't completed it. Convert A-Level grades to an approximate percentage.", min: 0, max: 100, unit: "%", placeholder: "e.g. 70", score: pct },
      S13: { type: "number", optional: true, q: "Bachelor's degree result — percentage (or CGPA × 25 for a 4.0 scale)", hint: "Leave blank if you don't have a bachelor's degree.", min: 0, max: 100, unit: "%", placeholder: "e.g. 65", score: pct },
      S14: { type: "number", optional: true, q: "Master's degree result — percentage", hint: "Leave blank if you don't have a master's degree.", min: 0, max: 100, unit: "%", score: pct },
      S15: { type: "text", q: "What subject / field was your last qualification in?", placeholder: "e.g. Pre-Engineering, BBA, Computer Science" },
      S16: { q: "How long is your study gap since your last qualification?", o: ["No gap", "Less than 1 year", "1–2 years", "3–5 years", "More than 5 years"], s: [3, 3, 2, 1, 0] },
      S17: { q: "If you have a study gap, what did you do during it?", o: ["No gap", "Worked in a related field (with letters)", "Worked in an unrelated field", "Short courses or certificates", "Nothing I can document"], s: [3, 3, 2, 2, 0] },
      S18: { q: "How much work experience do you have?", o: ["None", "Less than 1 year", "1–3 years", "More than 3 years"] },
      S19: { q: "Are your academic documents ready and verified?", o: ["Not yet", "I have some originals", "All originals (certificates and transcripts)", "All originals, attested (e.g. HEC / IBCC / Ministry)"], s: S3 },
      S20: { q: "Have you had any academic failures or supplementary exams?", o: ["No", "Yes, once", "Yes, more than once"], s: [3, 2, 0] },
      S21: { q: "Which English language test have you taken?", o: ["None yet", "Planning to take one", "IELTS Academic", "PTE Academic", "TOEFL iBT", "Duolingo English Test", "Medium of Instruction (MOI) letter only"] },
      S22: { type: "number", optional: true, q: "Your overall English test score", hint: "IELTS band (e.g. 6.0), PTE (e.g. 58), TOEFL iBT (e.g. 80) or Duolingo (e.g. 105). Leave blank if not taken.", min: 0, max: 160, placeholder: "e.g. 6.0", score: engScore },
      S23: { q: "How confident are you studying and writing in English?", o: ["Not confident", "Basic", "Good", "Fluent"], s: S3 },
      S24: { q: "Which level do you want to study in Malta?", o: ["Foundation year", "Diploma / Higher Diploma (MQF 4–5)", "Bachelor's degree", "Master's degree", "MBA", "PhD", "English language course"] },
      S25: { q: "Which field do you want to study?", o: ["Business & management", "IT, computing & software", "Data science & AI", "Engineering", "Health, nursing & care", "Tourism & hospitality", "Finance & accounting", "Law", "Other"] },
      S26: { q: "Which type of institution do you prefer?", o: ["University of Malta (public)", "MCAST (public, vocational)", "Private university or college", "No preference — advise me"] },
      S27: { q: "Which intake do you want?", o: ["February 2027", "September 2027", "February 2028", "Flexible"] },
      S28: { q: "Why do you want to study in Malta?", o: ["English-speaking EU country", "Affordable tuition and living costs", "Career opportunities in Europe", "Family or friends in Malta", "Recommended by someone", "Not sure yet"] },
      S29: { q: "What is your career plan after your studies?", o: ["Return home with an EU qualification", "Work in Malta", "Move elsewhere in Europe", "Further study", "Not decided"] },
      S30: { q: "Have you prepared a Statement of Purpose (SOP)?", o: ["No — I don't know how", "Not yet", "A draft", "Yes, final and tailored to the course"], s: S3 },
      S31: { q: "How many reference / recommendation letters can you get?", o: ["None", "One", "Two or more"], s: [0, 2, 3] },
      S32: { type: "budget", currency: "EUR", q: "What is your tuition budget per year?", usd: [3000, 6000, 10000, 15000], none: "I haven't set a tuition budget", s: [0, 1, 2, 3, 3, 3] },
      S33: { type: "budget", currency: "EUR", q: "What is your living budget per year in Malta (excluding tuition)?", hint: "Most students need roughly €8,000–€10,000 a year for rent, food and transport.", usd: [5000, 8000, 10000, 14000], none: "I haven't set a living budget", s: [0, 0, 2, 3, 3, 3] },
      S34: { q: "Who will fund your studies?", o: ["Myself", "Parents / family", "Bank or education loan", "Scholarship", "Employer", "Not decided"], s: [3, 3, 2, 3, 3, 0] },
      S35: { type: "budget", currency: "EUR", q: "How much can your sponsor show in a bank account for the visa?", usd: [5000, 10000, 20000, 35000], none: "No funds available yet", s: [0, 0, 1, 2, 3, 3] },
      S36: { q: "How long have these funds been in the account?", o: ["Not deposited yet", "Less than 3 months", "3–6 months", "More than 6 months"], s: S3 },
      S37: { q: "Can your sponsor show a legal source of income (salary slips, tax returns, business documents)?", o: ["No", "Partly", "Mostly", "Yes, fully documented"], s: S3 },
      S38: { q: "Do you need to work part-time to cover your costs in Malta?", o: ["Yes — I must work to survive", "It would help a lot", "Nice to have", "No need"], s: [0, 1, 2, 3] },
      S39: { q: "What type of accommodation do you prefer?", o: ["University residence / student hostel", "Shared apartment with other students", "Private studio apartment", "Homestay with a local family", "Staying with family or friends"] },
      S40: { type: "budget", currency: "EUR", q: "What is your monthly accommodation budget?", hint: "Typical: residence / hostel €300–€550, shared room €350–€500, studio €700+.", usd: [250, 400, 600, 900], per: "per month", none: "Not sure yet", s: [0, 0, 2, 3, 3, 3] },
      S41: { q: "Which area of Malta do you prefer to live in?", o: ["Near campus (Msida / Paola)", "Sliema / St Julian's", "Valletta area", "Wherever is cheapest", "No preference"] },
      S42: { q: "Would you like a room in a student residence (hostel) arranged before you arrive?", o: ["Yes, please arrange it", "I'll arrange it myself", "Not sure"] },
      S43: { q: "Meals preference", o: ["Self-catering (cook myself)", "Catered / meal plan", "Not sure"] },
      S44: { q: "Do you need airport pickup and arrival support?", o: ["Yes", "No"] },
      S45: { q: "Health insurance for your stay", o: ["I didn't know it's needed", "I'll buy it when required", "I already have international health insurance"], s: [0, 2, 3] },
      S46: { type: "text", optional: true, q: "Any medical needs, dietary needs or disabilities we should know about?", placeholder: "Optional" },
      S47: { q: "Do you have a police character certificate?", o: ["Not applied", "Applying now", "Yes, valid"], s: [0, 2, 3] },
      S48: { q: "Do you have any criminal convictions?", o: ["No", "Yes"], s: [3, 0] },
      S49: { q: "Do you have family or relatives in Malta or the EU?", o: ["No", "Yes, in Malta", "Yes, elsewhere in the EU"] },
      S50: { q: "When can you start your application?", o: ["Immediately", "Within 1 month", "In 1–3 months", "In more than 3 months"] }
    },
    sections: {
      personal: { title: "Personal profile and visa history", sub: "Standard questions asked by universities and visa officers.", q: ["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08"] },
      edu: { title: "Complete study history and marks", sub: "Enter your marks as percentages. Use the CGPA conversion where asked.", q: ["S09", "S10", "S11", "S12", "S13", "S14", "S15", "S16", "S17", "S18", "S19", "S20"] },
      english: { title: "English language", q: ["S21", "S22", "S23"] },
      plan: { title: "Your study plan in Malta", q: ["S24", "S25", "S26", "S27", "S28", "S29", "S30", "S31"] },
      money: { title: "Budget and finances", sub: "Amounts are in euros (€), the currency used in Malta.", q: ["S32", "S33", "S34", "S35", "S36", "S37", "S38"] },
      living: { title: "Residence, hostel and living in Malta", q: ["S39", "S40", "S41", "S42", "S43", "S44", "S45", "S46"] },
      docs: { title: "Documents and timeline", q: ["S47", "S48", "S49", "S50"] }
    },
    order: ["personal", "edu", "english", "plan", "money", "living", "docs"],
    areas: [
      ["Academic record", ["S11", "S12", "S13", "S14", "S16", "S17", "S19", "S20"]],
      ["English language", ["S22", "S23"]],
      ["Finances and budget", ["S32", "S33", "S34", "S35", "S36", "S37", "S38"]],
      ["Visa profile", ["S01", "S04", "S07", "S08", "S45", "S47", "S48"]],
      ["Study plan and documents", ["S30", "S31", "S40"]]
    ],
    flags: function (h) {
      var f = [], marks = ["S11", "S12", "S13", "S14"].map(h.num).filter(function (x) { return x != null; });
      var last = marks.length ? marks[marks.length - 1] : null;
      if (h.idx("S48") === 1) f.push([10, "A criminal conviction can lead to visa refusal — we need to review this with you before applying."]);
      if (h.idx("S08") === 2) f.push([9, "Several visa refusals weaken a new application — prepare a strong file that addresses each refusal reason."]);
      if (h.idx("S04") <= 1) f.push([8, "Get a passport valid for at least the length of your course plus 6 months before applying."]);
      if (last != null && last < 50) f.push([8, "Your latest marks are below 50% — consider a foundation or diploma route first."]);
      if (h.idx("S35") <= 1) f.push([9, "You'll need to show enough funds for tuition and living costs (about €10,000+ a year) for the student visa."]);
      if (h.idx("S36") <= 1) f.push([6, "Keep visa funds in the bank account for at least 3–6 months before applying."]);
      if (h.idx("S37") <= 1) f.push([7, "Your sponsor should be able to show a legal, documented source of income."]);
      if (h.idx("S38") === 0) f.push([7, "Don't plan to rely on part-time work to cover basic costs — student work hours are limited."]);
      if (h.idx("S16") === 4 && h.idx("S17") === 4) f.push([7, "A study gap of more than 5 years with no documented activity needs a strong explanation and evidence."]);
      if (h.idx("S21") <= 1) f.push([6, "Book an English test (IELTS, PTE, TOEFL or Duolingo) — most Malta courses need IELTS 6.0 or equivalent."]);
      if (engScore(h.answers().S22, h) === 0 || engScore(h.answers().S22, h) === 1) f.push([6, "Your English score is below most course requirements — plan a retake or an English pathway course."]);
      if (h.idx("S19") <= 1) f.push([5, "Get all certificates and transcripts together and attested before applying."]);
      if (h.idx("S30") <= 1) f.push([4, "Prepare a Statement of Purpose tailored to your course — we can help."]);
      if (h.idx("S33") <= 1) f.push([5, "Budget at least €8,000–€10,000 a year for living costs in Malta."]);
      return f;
    },
    next: function (level, h, p, L) {
      var book = ["Book an education consultation", "/book-consultation?topic=education-consultancy", "outline"];
      if (level === L[0]) return { title: "Prepare your profile before applying", text: "Work on the issues listed above — marks, English, finances or visa history — before applying. We can plan a foundation or pathway route that fits your profile.", links: [["Book an education consultation", "/book-consultation?topic=education-consultancy", "accent"], ["Study in Malta services", "/education-consultancy", "outline"]] };
      return { title: level === L[3] ? "Apply to study in Malta with confidence" : "Start your Malta application with expert support", text: "We shortlist courses and universities for your profile, prepare your application, SOP and visa file, and arrange your student residence or hostel before you arrive.", links: [["Malta university application service", "/education-consultancy#pricing", "accent"], book] };
    }
  };

  // ---- Real estate: foreigners buying property --------------------------------------------
  var ageBuyer = function (v) { var n = parseFloat(v); if (isNaN(n)) return null; return n >= 25 && n <= 60 ? 3 : n < 25 ? 2 : n <= 70 ? 2 : 1; };
  var TARGET = ["United Kingdom", "United Arab Emirates", "Malta", "Spain", "Portugal", "Cyprus", "Greece", "United States", "Pakistan", "Another country"];
  A.realestate = {
    name: "Property Buying Assessment", topic: "real-estate", countryQ: "R02", minutes: 8, noAgeInDetails: true,
    title: "Foreign Buyer Real Estate Assessment",
    intro: "An international-standard assessment for foreigners buying property abroad — your budget, age, financing, target country and city, legal and tax readiness — so you buy safely and at the right price.",
    notice: "Free real estate assessment for foreign buyers — about 8 minutes.",
    levels: ["Not ready to buy", "Early research", "Nearly ready", "Ready to buy"],
    resultLabel: "Your property buying readiness",
    disclaimer: "This assessment is general guidance based on your answers. It is not legal, tax or mortgage advice — always use an independent lawyer before buying property.",
    questions: {
      R01: { type: "country", select: true, list: WORLD, q: "What is your nationality?" },
      R02: { type: "country", select: true, list: WORLD, q: "Which country do you currently live in?" },
      R03: { type: "number", q: "How old are you?", hint: "Age affects mortgage terms in most countries.", min: 18, max: 95, step: 1, unit: "years", score: ageBuyer },
      R04: { q: "Who will own the property?", o: ["Me alone", "Me and my spouse / partner", "Family members together", "Through a company"] },
      R05: { q: "Have you bought property before?", o: ["Never", "Yes, in my home country", "Yes, abroad once", "Yes, several properties abroad"], s: S3 },
      R06: { q: "In which country do you want to buy property?", o: TARGET },
      R07: { type: "text", q: "Which city or area are you interested in?", placeholder: "e.g. Manchester, Dubai Marina, Sliema" },
      R08: { q: "What is the main purpose of buying?", o: ["A home to live in", "A holiday home", "Buy-to-let rental income", "Capital growth / investment", "Residency visa / golden visa / citizenship", "Retirement"] },
      R09: { q: "What type of property?", o: ["Apartment / flat", "Villa / detached house", "Townhouse / semi-detached", "Off-plan (under construction)", "Commercial property", "Land / plot"] },
      R10: { q: "How many bedrooms?", o: ["Studio", "1", "2", "3", "4 or more", "Not applicable"] },
      R11: { q: "Have you visited the city or area?", o: ["Not yet", "Once, as a tourist", "Several times", "I live there now"], s: S3 },
      R12: { q: "When do you want to buy?", o: ["Within 3 months", "In 3–6 months", "In 6–12 months", "More than a year / just researching"] },
      R13: { type: "budget", from: "R06", q: "What is your total property budget?", hint: "Shown in the currency of the country you want to buy in (approximate).", usd: [100000, 250000, 500000, 1000000], none: "I haven't set a budget yet", s: [0, 2, 2, 3, 3, 3] },
      R14: { q: "How will you pay for the property?", o: ["Cash", "A mortgage in that country", "A loan from my home country", "Part cash, part mortgage", "Not sure yet"], s: [3, 2, 2, 2, 0] },
      R15: { q: "What deposit can you pay?", hint: "Foreign buyers usually need 25–50% deposit for a mortgage.", o: ["Under 10%", "10–25%", "25–50%", "More than 50% / full cash"], s: S3 },
      R16: { q: "Can you prove the source of your funds (bank statements, salary, business income, sale of property)?", hint: "Banks, lawyers and agents must check this under anti-money-laundering rules.", o: ["No", "Partly", "Mostly", "Yes, fully documented"], s: S3 },
      R17: { q: "Have you budgeted for buying costs on top of the price (purchase taxes / stamp duty, legal and agent fees — often 5–12%)?", o: ["I didn't know about these", "Not yet", "Partly", "Yes, fully budgeted"], s: S3 },
      R18: { q: "How will you transfer the money?", o: ["Not sure", "Cash or informal channels", "Normal bank transfer", "Bank or FX specialist with a full documented trail"], s: [0, 0, 2, 3] },
      R19: { q: "Have you budgeted for yearly costs (service charges, property tax, maintenance, insurance)?", o: ["No", "Not yet", "Roughly", "Yes"], s: S3 },
      R20: { q: "Do you know the rules for foreigners buying in that country? (e.g. Malta AIP permit / SDA areas, UAE freehold zones, UK stamp duty surcharge, Spain NIE)", o: ["Not at all", "A little", "Mostly", "Yes, in detail"], s: S3 },
      R21: { q: "Will you use an independent lawyer or notary?", o: ["No", "The developer's / agent's lawyer", "Yes, independent", "Yes, already appointed"], s: [0, 1, 3, 3] },
      R22: { q: "Do you understand the taxes — purchase tax, rental income tax, capital gains and inheritance — in that country and at home?", o: ["No", "A little", "Mostly", "Yes, with professional advice"], s: S3 },
      R23: { q: "If you'll rent the property out, how will it be managed?", o: ["I won't rent it out", "I'll manage it myself from abroad", "A local letting / property manager", "Short-term holiday lets with the right licence"] },
      R24: { q: "Are you interested in residency or a visa through the purchase?", o: ["No", "Yes", "Not sure"] },
      R25: { q: "Are your ID documents ready (valid passport, proof of address)?", o: ["Expired or missing", "Some missing", "Mostly ready", "All valid and current"], s: S3 },
      R26: { q: "Will you attend the purchase in person?", o: ["Yes, I'll travel", "No — I'll need a power of attorney", "Not sure"] },
      R27: { q: "How important is it to see the property in person before buying?", o: ["I'll buy without seeing it", "A video tour is enough", "I'll visit before deciding", "I'll visit several times"], s: [0, 1, 3, 3] }
    },
    sections: {
      you: { title: "About you as a foreign buyer", q: ["R01", "R02", "R03", "R04", "R05", "R25"] },
      where: { title: "Country, city and property", q: ["R06", "R07", "R08", "R09", "R10", "R11", "R12", "R27"] },
      money: { title: "Budget and financing", sub: "Amounts are shown in the currency of the country you want to buy in.", q: ["R13", "R14", "R15", "R16", "R17", "R18", "R19"] },
      legal: { title: "Legal, tax and ownership", q: ["R20", "R21", "R22", "R23", "R24", "R26"] }
    },
    order: ["you", "where", "money", "legal"],
    areas: [
      ["Buyer profile", ["R03", "R05", "R11", "R25", "R27"]],
      ["Budget and financing", ["R13", "R14", "R15", "R16", "R17", "R18", "R19"]],
      ["Legal and tax readiness", ["R20", "R21", "R22"]]
    ],
    flags: function (h) {
      var f = [];
      if (h.idx("R18") === 1) f.push([10, "Never transfer property money in cash or through informal channels — it can block the purchase and break money-laundering rules."]);
      if (h.idx("R16") <= 1) f.push([9, "Prepare documents proving where your money comes from — lawyers and banks must check this before you can buy."]);
      if (h.idx("R21") === 0) f.push([9, "Always use an independent lawyer or notary — never rely on the seller's or developer's lawyer alone."]);
      if (h.idx("R21") === 1) f.push([6, "Use your own independent lawyer, not the developer's or agent's."]);
      if (h.idx("R13") === 0) f.push([7, "Set a clear budget, including buying costs, before viewing properties."]);
      if (h.idx("R17") <= 1) f.push([7, "Budget an extra 5–12% for purchase taxes, legal and agent fees."]);
      if (h.idx("R14") >= 1 && h.idx("R14") <= 3 && h.idx("R15") <= 1) f.push([7, "Most banks lend to foreign buyers with a 25–50% deposit — check mortgage eligibility early."]);
      if (h.idx("R20") <= 1) f.push([6, "Check the foreign ownership rules for " + (h.text("R06") || "your target country") + " before choosing a property."]);
      if (h.idx("R27") === 0) f.push([6, "Don't buy property abroad without seeing it — at least arrange an independent inspection."]);
      if (h.idx("R09") === 3) f.push([5, "Off-plan purchases need extra checks — developer track record, escrow protection and completion guarantees."]);
      var age = h.num("R03");
      if (age != null && age > 65 && h.idx("R14") >= 1 && h.idx("R14") <= 3) f.push([6, "Mortgages for buyers over 65 are limited — plan more cash or a shorter term."]);
      if (h.idx("R25") <= 1) f.push([5, "Make sure your passport and proof of address are valid before you make an offer."]);
      return f;
    },
    next: function (level, h, p, L) {
      var book = ["Book a property consultation", "/book-consultation?topic=real-estate", "outline"];
      if (level === L[0] || level === L[1]) return { title: "Plan your purchase before you view properties", text: "Set your full budget, prepare your proof of funds and learn the foreign-buyer rules for your target country. A consultation gives you a clear buying plan and a safe step-by-step route.", links: [["Book a property consultation", "/book-consultation?topic=real-estate", "accent"], ["Contact us", "/contact", "outline"]] };
      return { title: "Move forward with your property purchase", text: "You're well prepared. We help shortlist areas and properties, connect you with independent lawyers and guide you through tax and ownership steps.", links: [["Book a property consultation", "/book-consultation?topic=real-estate", "accent"], ["Contact us", "/contact", "outline"]] };
    }
  };

  window.QA_ASSESSMENTS = A;
})();
