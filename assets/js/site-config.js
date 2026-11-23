/* ==========================================================================
   SITE CONFIGURATION — edit this file to change branding, links and menus.
   Every page reads from here, so a change applies site-wide.

   Placeholder links: any URL left as an empty string ("") is rendered as a
   clearly marked placeholder (it shows a "link not configured yet" notice
   instead of navigating). Fill in the real URL when it is available.
   ========================================================================== */
window.SITE_CONFIG = {
  brand: {
    name: "Qalb-E-Abbas",
    // Logo: replace assets/img/logo.svg with your own file (SVG or PNG/WebP),
    // or point this path at a different file. The aspect ratio is preserved.
    logo: "assets/img/logo-wordmark.png",
    logoOnDark: "assets/img/logo-wordmark-light.png", // version used on the navy footer
    logoAlt: "Qalb-E-Abbas: home",
    // Brand colours (applied as CSS custom properties at runtime).
    colors: {
      primary: "#1F55E0",   // links, active states, accents
      accent: "#1F55E0",    // Book Consultation button
      accentInk: "#FFFFFF", // text on the accent colour
      navy: "#0B1B36"       // headings, footer background
    }
  },

  /* Internal page destinations. */
  links: {
    home: "/",
    services: "/services",
    team: "/team",
    about: "/about",
    contact: "/contact",
    blog: "/blog",
    // Booking, checkout, contact, assessment & review API (PHP in /api on Hostinger).
    // Managed from the admin dashboard at /admin.
    api: "/api",
    // Header / menu "Book Consultation" button. book-consultation.html forwards
    // each ?topic= to the matching meeting type in the booking app.
    book: "/book-consultation",
    university: "/university",
    level1: "/#level-1",
    mentorship: "/#level-1",
    assessment: "/assessment",
    beginnersGuide: "/beginners-guide",
    support: "/contact#support",
    finance: "/finance",
    privacy: "/privacy",
    terms: "/terms",
    disclaimer: "/disclaimer",

    // "Apply Now" destinations for the University course cards.
    // Replace with each course's real application form URL when available.
    applyDigitalBusinessLaunch: "/book-consultation?topic=digital-business-launch",
    applyLocalAgentsFlagship: "/book-consultation?topic=local-agents-flagship",
    applyAiVideoCreatorPro: "/book-consultation?topic=ai-video-creator-pro"
  },

  /* Official social profiles — empty ones are hidden on the site. */
  social: {
    facebook: "https://www.facebook.com/CHAUDHARYQALBEABBAS",
    instagram: "https://www.instagram.com/chqalb_e_abbas/",
    tiktok: "",
    youtube: "",   // Qalb-E-Abbas University YouTube channel
    linkedin: "https://www.linkedin.com/in/ch-qalb-e-abbas-business-consultant-821784356/",
    x: "",
    reddit: "",
    whatsapp: ""   // e.g. https://wa.me/<number> once confirmed
  },

  /* Analytics. Paste your Google Analytics 4 Measurement ID (e.g. "G-ABC123XYZ") to turn it on.
     Visitors are asked for consent first (UK GDPR); analytics only loads after they accept. */
  analytics: {
    ga4Id: ""
  },

  contact: {
    location: "Manchester, United Kingdom",
    mapUrl: "https://www.google.com/maps/search/?api=1&query=Manchester%2C%20United%20Kingdom",
    // Phone numbers are not shown on the website (visitors book a consultation instead).
    // Fill these only if you want a phone number in the footer again.
    phoneDisplay: "",
    phoneHref: "",
    phoneUSDisplay: "",
    phoneUSHref: "",       // e.g. "tel:+1XXXXXXXXXX"
    email: "contact@qalbeabbas.com"
  },

  /* Main navigation (same data drives desktop nav and the mobile drawer). */
  nav: [
    { label: "Home", link: "home", match: ["/", ""] },
    { label: "Services", link: "services", match: ["/services"], mega: true },
    { label: "Qalb-E-Abbas University", link: "university", match: ["/university"], highlight: { icon: "graduation", promo: "Learn Amazon & e-commerce", sub: "Amazon & e-commerce courses with live mentorship" } },
    { label: "Team", link: "team", match: ["/team"] },
    { label: "About Us", link: "about", match: ["/about"] },
    { label: "Contact Us", link: "contact", match: ["/contact"] },
    { label: "Blog", link: "blog", match: ["/blog", "/beginners-guide"] }
  ],

  /* Services mega menu / mobile accordion. href values point at sections of
     services.html until dedicated service pages exist. */
  services: [
    {
      id: "ecommerce", title: "E-commerce Services", icon: "cart", desc: "Launch and scale on the world's top marketplaces.",
      items: [
        ["Amazon", "amazon", "/amazon-fba", "amazon"], ["TikTok Shop", "tiktok-shop", "/tiktok-shop", "tiktok"], ["eBay", "ebay", "/ebay", "ebay"],
        ["Walmart", "walmart", "/walmart", "walmart"], ["Etsy", "etsy", "/etsy", "etsy"], ["Shopify", "shopify", "/shopify-development", "shopify"],
        ["Ali Expo", "aliexpo", "/aliexpo", "aliexpo"]
      ]
    },
    {
      id: "formation", title: "Company Formation", icon: "building", desc: "Register your company and stay compliant.",
      items: [
        ["UK", "uk-company-formation", "/uk-ltd-formation", "flag-uk"], ["USA", "usa-company-formation", "/us-llc-formation", "flag-us"],
        ["UAE", "uae-company-formation", "/uae-company-formation", "flag-ae"], ["Malta", "malta-company-formation", "/malta-company-formation", "flag-mt"],
        ["Pakistan", "pakistan-company-formation", "/pakistan-company-formation", "flag-pk"]
      ]
    },
    {
      id: "tax", title: "Tax Filing", icon: "receipt", desc: "Tax returns and compliance in the UK, USA and Pakistan.",
      items: [
        ["UK", "uk-tax-filing", "/taxation", "flag-uk"], ["USA", "usa-tax-filing", "/taxation", "flag-us"],
        ["Pakistan", "pakistan-tax-filing", "/pakistan-tax-filing", "flag-pk"]
      ]
    },
    {
      id: "education", title: "Education Consultancy", icon: "graduation", desc: "Study in Malta: admissions, visas and pre-departure support.",
      items: [["Study in Malta", "education-consultancy", "/education-consultancy", "icon:graduation"]]
    },
    {
      id: "sourcing", title: "Product Sourcing", icon: "box", desc: "Source products from China, Pakistan and Turkey: suppliers, quality checks and shipping.",
      items: [["China", "china-sourcing", "/china-sourcing", "flag-cn"], ["Pakistan", "pakistan-sourcing", "/pakistan-sourcing", "flag-pk"], ["Turkey", "turkey-sourcing", "/turkey-sourcing", "flag-tr"]]
    },
    {
      id: "stock-exchange", title: "Stock Exchange & Investing", icon: "trending-up", desc: "Learn, open an account and invest in US & UK markets.",
      items: [["US · UK Stocks", "stock-exchange", "/stock-exchange", "icon:trending-up"]]
    },
    {
      id: "real-estate", title: "Real Estate", icon: "building", desc: "Buy, sell, rent and invest in property in Pakistan.",
      items: [["Pakistan Property", "real-estate", "/real-estate", "flag-pk"]]
    },
    {
      id: "marketing", title: "Marketing & Business Growth", icon: "megaphone", desc: "Paid ads, SEO and campaigns that drive sales.",
      items: [
        ["Influencers", "influencer-marketing", "/influencer-marketing", "instagram"], ["Social Media", "social-media-marketing", "/social-media-marketing", "meta"],
        ["Paid Ads", "digital-marketing", "/digital-marketing", "googleads"], ["Email", "email-marketing", "/email-marketing", "mailchimp"],
        ["SEO", "seo", "/seo", "google"], ["Affiliates", "affiliate-marketing", "/affiliate-marketing", "affiliate"]
      ]
    },
    {
      id: "automation", title: "AI & Business Automation", icon: "bot", desc: "Chatbots and workflows that save hours every week.",
      items: [
        ["Facebook", "facebook-automation", "/facebook-automation", "facebook"], ["TikTok", "tiktok-automation", "/tiktok-automation", "tiktok"],
        ["WhatsApp", "whatsapp-automation", "/whatsapp-automation", "whatsapp"], ["Instagram", "instagram-automation", "/instagram-automation", "instagram"]
      ]
    },
    {
      id: "development", title: "Web & Software Development", icon: "code", desc: "Websites, stores, apps and CRMs built to convert.",
      items: [
        ["Shopify Stores", "shopify-development", "/shopify-development", "icon:code"], ["Websites", "website-development", "/website-development", "icon:monitor"],
        ["CRM Systems", "crm-development", "/crm-development", "icon:users"], ["Mobile Apps", "app-development", "/app-development", "icon:smartphone"]
      ]
    }
  ],

  footer: {
    description: "Empowering entrepreneurs through e-commerce education, mentorship, business consultancy, and digital growth solutions.",
    commitment: "Practical learning first, so you can make informed decisions and grow your business with confidence.",
    // "Services" column
    serviceLinks: [
      ["E-commerce Services", "/services#ecommerce"],
      ["Ali Expo", "/aliexpo"],
      ["Product Sourcing (China)", "/china-sourcing"],
      ["Product Sourcing (Pakistan)", "/pakistan-sourcing"],
      ["Product Sourcing (Turkey)", "/turkey-sourcing"],
      ["Company Formation", "/services#formation"],
      ["Company Formation (Pakistan)", "/pakistan-company-formation"],
      ["Taxation Services (UK & USA)", "/taxation"],
      ["Tax Filing (Pakistan)", "/pakistan-tax-filing"],
      ["Education Consultancy", "/services#education"],
      ["Real Estate (Pakistan)", "/real-estate"],
      ["Stock Exchange & Investing", "/stock-exchange"],
      ["Digital Marketing", "/digital-marketing"],
      ["AI & Business Automation", "/services#automation"],
      ["Web & Software Development", "/services#development"]
    ],
    // "Company" column
    quickLinks: [
      ["About Us", "about"], ["Our Team", "team"], ["Qalb-E-Abbas University", "university"],
      ["Blog", "blog"], ["Contact Us", "contact"], ["Leave a Review", "/leave-review"], ["Support", "support"], ["Finance", "finance"]
    ],
    legal: [["Privacy Policy", "privacy"], ["Terms and Conditions", "terms"], ["Disclaimer", "disclaimer"]]
  }
};
