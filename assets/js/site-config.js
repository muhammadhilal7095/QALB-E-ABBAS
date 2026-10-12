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
      id: "ecommerce", title: "E-commerce Services", icon: "cart",
      items: [
        ["Amazon", "amazon", "amazon-fba.html"], ["TikTok Shop", "tiktok-shop", "tiktok-shop.html"], ["eBay", "ebay", "ebay.html"],
        ["Walmart", "walmart", "walmart.html"], ["Etsy", "etsy", "etsy.html"], ["Shopify", "shopify", "shopify-development.html"]
      ]
    },
    {
      id: "automation", title: "AI & Business Automation", icon: "bot",
      items: [
        ["Facebook Automation", "facebook-automation"], ["TikTok Automation", "tiktok-automation"],
        ["WhatsApp Automation", "whatsapp-automation"], ["Instagram Automation", "instagram-automation"]
      ]
    },
    {
      id: "development", title: "Web & Software Development", icon: "code",
      items: [
        ["Shopify Development", "shopify-development", "shopify-development.html"], ["Website Development", "website-development"],
        ["CRM Development", "crm-development"], ["App Development", "app-development"]
      ]
    },
    {
      id: "marketing", title: "Marketing & Business Growth", icon: "megaphone",
      items: [
        ["Influencer Marketing", "influencer-marketing"], ["Social Media Marketing", "social-media-marketing", "digital-marketing.html"],
        ["Digital Marketing", "digital-marketing", "digital-marketing.html"], ["Email Marketing", "email-marketing"],
        ["SEO", "seo", "digital-marketing.html#seo"], ["Affiliate Marketing", "affiliate-marketing"]
      ]
    },
    {
      id: "formation", title: "Company Formation & Business Setup", icon: "building",
      items: [
        ["UK Company Formation", "uk-company-formation", "uk-ltd-formation.html"], ["USA Company Formation", "usa-company-formation", "us-llc-formation.html"],
        ["UAE Company Formation", "uae-company-formation"], ["Malta Company Formation", "malta-company-formation"]
      ]
    },
    {
      id: "education", title: "Education Consultancy", icon: "graduation",
      items: [["Education Consultancy", "education-consultancy"]]
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
