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
    home: "index.html",
    services: "services.html",
    team: "team.html",
    about: "about.html",
    contact: "contact.html",
    blog: "blog.html",
    // Online booking & payment system (the Next.js app in /booking).
    // Change to the live booking URL when deployed, e.g. "https://book.qalbeabbas.com".
    bookingApp: "http://localhost:3000",
    // Header / menu "Book Consultation" button. book-consultation.html forwards
    // each ?topic= to the matching meeting type in the booking app.
    book: "book-consultation.html",
    university: "university.html",
    level1: "index.html#level-1",
    mentorship: "index.html#level-1",
    assessment: "assessment.html",
    beginnersGuide: "beginners-guide.html",
    support: "contact.html#support",
    finance: "finance.html",
    privacy: "privacy.html",
    terms: "terms.html",
    disclaimer: "disclaimer.html",

    // "Apply Now" destinations for the University course cards.
    // Replace with each course's real application form URL when available.
    applyDigitalBusinessLaunch: "book-consultation.html?topic=digital-business-launch",
    applyLocalAgentsFlagship: "book-consultation.html?topic=local-agents-flagship",
    applyAiVideoCreatorPro: "book-consultation.html?topic=ai-video-creator-pro"
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

  contact: {
    location: "Oldham, Manchester, United Kingdom",
    mapUrl: "https://www.google.com/maps/search/?api=1&query=Oldham%2C%20Manchester%2C%20United%20Kingdom",
    phoneDisplay: "+44 7862 605011",
    phoneHref: "tel:+447862605011",
    // USA phone number — not supplied yet. Fill both to show it in the footer.
    phoneUSDisplay: "",
    phoneUSHref: "",       // e.g. "tel:+1XXXXXXXXXX"
    email: "contact@qalbeabbas.com"
  },

  /* Main navigation (same data drives desktop nav and the mobile drawer). */
  nav: [
    { label: "Home", link: "home", match: ["index.html", ""] },
    { label: "Services", link: "services", match: ["services.html"], mega: true },
    { label: "Qalb-E-Abbas University", link: "university", match: ["university.html"] },
    { label: "Team", link: "team", match: ["team.html"] },
    { label: "About Us", link: "about", match: ["about.html"] },
    { label: "Contact Us", link: "contact", match: ["contact.html"] },
    { label: "Blog", link: "blog", match: ["blog.html", "beginners-guide.html"] }
  ],

  /* Services mega menu / mobile accordion. href values point at sections of
     services.html until dedicated service pages exist. */
  services: [
    {
      id: "ecommerce", title: "E-commerce Services", icon: "cart", desc: "Launch and scale on the world's top marketplaces.",
      items: [
        ["Amazon", "amazon", "amazon-fba.html", "amazon"], ["TikTok Shop", "tiktok-shop", "tiktok-shop.html", "tiktok"], ["eBay", "ebay", "ebay.html", "ebay"],
        ["Walmart", "walmart", "walmart.html", "walmart"], ["Etsy", "etsy", "etsy.html", "etsy"], ["Shopify", "shopify", "shopify-development.html", "shopify"]
      ]
    },
    {
      id: "automation", title: "AI & Business Automation", icon: "bot", desc: "Chatbots and workflows that save hours every week.",
      items: [
        ["Facebook", "facebook-automation", "facebook-automation.html", "facebook"], ["TikTok", "tiktok-automation", "tiktok-automation.html", "tiktok"],
        ["WhatsApp", "whatsapp-automation", "whatsapp-automation.html", "whatsapp"], ["Instagram", "instagram-automation", "instagram-automation.html", "instagram"]
      ]
    },
    {
      id: "development", title: "Web & Software Development", icon: "code", desc: "Websites, stores, apps and CRMs built to convert.",
      items: [
        ["Shopify", "shopify-development", "shopify-development.html", "shopify"], ["Websites", "website-development", "website-development.html", "icon:monitor"],
        ["CRM Systems", "crm-development", "crm-development.html", "icon:users"], ["Mobile Apps", "app-development", "app-development.html", "icon:smartphone"]
      ]
    },
    {
      id: "marketing", title: "Marketing & Business Growth", icon: "megaphone", desc: "Paid ads, SEO and campaigns that drive sales.",
      items: [
        ["Influencers", "influencer-marketing", "influencer-marketing.html", "instagram"], ["Social Media", "social-media-marketing", "social-media-marketing.html", "meta"],
        ["Paid Ads", "digital-marketing", "digital-marketing.html", "googleads"], ["Email", "email-marketing", "email-marketing.html", "mailchimp"],
        ["SEO", "seo", "seo.html", "google"], ["Affiliates", "affiliate-marketing", "affiliate-marketing.html", "affiliate"]
      ]
    },
    {
      id: "formation", title: "Company Formation & Business Setup", icon: "building", desc: "Register your company and stay compliant.",
      items: [
        ["UK", "uk-company-formation", "uk-ltd-formation.html", "flag-uk"], ["USA", "usa-company-formation", "us-llc-formation.html", "flag-us"],
        ["UAE", "uae-company-formation", "uae-company-formation.html", "flag-ae"], ["Malta", "malta-company-formation", "malta-company-formation.html", "flag-mt"]
      ]
    },
    {
      id: "education", title: "Education Consultancy", icon: "graduation", desc: "Study in Malta: admissions, visas and pre-departure support.",
      items: [["Study in Malta", "education-consultancy", "education-consultancy.html", "icon:graduation"]]
    }
  ],

  footer: {
    description: "Empowering entrepreneurs through e-commerce education, mentorship, business consultancy, and digital growth solutions.",
    commitment: "Practical learning first — so you can make informed decisions and grow your business with confidence.",
    quickLinks: [
      ["Home", "home"], ["Services", "services"], ["Qalb-E-Abbas University", "university"],
      ["About Us", "about"], ["Contact Us", "contact"], ["Blog", "blog"]
    ],
    serviceLinks: [
      ["E-commerce Services", "services.html#ecommerce"],
      ["AI & Business Automation", "services.html#automation"],
      ["Web & Software Development", "services.html#development"],
      ["Digital Marketing", "digital-marketing.html"],
      ["Company Formation", "services.html#formation"],
      ["Taxation Services", "taxation.html"],
      ["Education Consultancy", "services.html#education"],
      ["Support", "support"], ["Team", "team"], ["Finance", "finance"]
    ],
    legal: [["Privacy Policy", "privacy"], ["Terms and Conditions", "terms"], ["Disclaimer", "disclaimer"]]
  }
};
