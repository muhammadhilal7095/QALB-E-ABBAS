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
    logo: "assets/img/logo.svg",
    logoOnDark: "assets/img/logo-light.svg", // version used on the navy footer
    logoAlt: "Qalb-E-Abbas — home",
    // Brand colours (applied as CSS custom properties at runtime).
    colors: {
      primary: "#1F55E0",   // links, active states, accents
      accent: "#F5B12E",    // Book Consultation button
      accentInk: "#0B1B36", // text on the accent colour
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

  /* Official social profiles — NOT supplied yet. Paste the real URLs here. */
  social: {
    facebook: "",
    instagram: "",
    tiktok: "",
    youtube: "",   // Qalb-E-Abbas University YouTube channel
    linkedin: "",
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
        ["Walmart", "walmart", "/walmart", "walmart"], ["Etsy", "etsy", "/etsy", "etsy"], ["Shopify", "shopify", "/shopify-development", "shopify"]
      ]
    },
    {
      id: "formation", title: "Company Formation", icon: "building", desc: "Register your company and stay compliant.",
      items: [
        ["UK", "uk-company-formation", "/uk-ltd-formation", "flag-uk"], ["USA", "usa-company-formation", "/us-llc-formation", "flag-us"],
        ["UAE", "uae-company-formation", "/uae-company-formation", "flag-ae"], ["Malta", "malta-company-formation", "/malta-company-formation", "flag-mt"]
      ]
    },
    {
      id: "education", title: "Education Consultancy", icon: "graduation", desc: "Study in Malta: admissions, visas and pre-departure support.",
      items: [["Study in Malta", "education-consultancy", "/education-consultancy", "icon:graduation"]]
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
    commitment: "Practical learning first — so you can make informed decisions and grow your business with confidence.",
    // "Services" column
    serviceLinks: [
      ["E-commerce Services", "/services#ecommerce"],
      ["Digital Marketing", "/digital-marketing"],
      ["AI & Business Automation", "/services#automation"],
      ["Web & Software Development", "/services#development"],
      ["Company Formation", "/services#formation"],
      ["Taxation Services", "/taxation"],
      ["Education Consultancy", "/services#education"],
      ["Real Estate (Pakistan)", "/real-estate"]
    ],
    // "Company" column
    quickLinks: [
      ["About Us", "about"], ["Our Team", "team"], ["Qalb-E-Abbas University", "university"],
      ["Blog", "blog"], ["Contact Us", "contact"], ["Leave a Review", "/leave-review"], ["Support", "support"], ["Finance", "finance"]
    ],
    legal: [["Privacy Policy", "privacy"], ["Terms and Conditions", "terms"], ["Disclaimer", "disclaimer"]]
  }
};
