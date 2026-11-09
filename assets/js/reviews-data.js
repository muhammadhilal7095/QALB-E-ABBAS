/* ==========================================================================
   Client and student reviews shown in the moving review rows
   (home page "What Our Students Say" = `students`, service pages = their page key).

   ⚠ These are SAMPLE reviews — placeholders only. Replace each one with a
   real review from a real client or student (with their written permission)
   and set `sample: false`. While `sample` is true the card shows a
   "Sample review" badge. Never publish made-up names, photos or quotes.

   Fields: name, country, flag (2-letter code: gb, us, pk, ae, mt, ca, au,
   de, sa, in), photo (optional — put a square photo, at least 200×200px,
   in assets/img/reviews/ and write e.g. "assets/img/reviews/sara.jpg"),
   rating 1–5, text, service (or role, e.g. "Level 1 student").

   Example of a real student entry:
     { name: "Sara Ahmed", role: "Level 1 student", photo: "assets/img/reviews/sara.jpg",
       rating: 5, text: "Her own words…", sample: false },
   ========================================================================== */
window.QA_REVIEWS = (function () {
  "use strict";
  function s(name, country, flag, text, service, rating) {
    return { name: name, country: country, flag: flag, photo: "", rating: rating || 5, text: text, service: service, sample: true };
  }
  return {
    amazon: [
      s("Client name", "United Kingdom", "gb", "They checked my product idea properly before I spent anything. The supplier and cost breakdown saved me from a bad first order.", "Amazon product research"),
      s("Client name", "United Kingdom", "gb", "My Amazon US account was verified first time. Every document was prepared in the right order.", "Amazon account creation"),
      s("Client name", "United Kingdom", "gb", "PPC was eating my margin. After the restructure my ACoS dropped and sales stayed steady.", "Amazon PPC"),
      s("Client name", "United Kingdom", "gb", "Clear plan of action for my suspension and the account was reinstated. Very professional.", "Amazon reactivation"),
      s("Client name", "United Kingdom", "gb", "The listing rewrite and A+ content made a visible difference to conversion.", "Amazon SEO"),
      s("Client name", "United Kingdom", "gb", "Honest advice — they told me what not to do as well as what to do.", "Amazon consultation"),
      s("Client name", "United Kingdom", "gb", "The quarterly product list gave me real options with numbers, not just ideas.", "Q1–Q4 product research"),
      s("Client name", "United Kingdom", "gb", "Step-by-step support from Brand Registry to my first FBA shipment.", "Amazon FBA launch"),
      s("Client name", "United Kingdom", "gb", "Fast replies and practical guidance whenever I got stuck.", "Amazon growth strategy", 4)
    ],
    ebay: [
      s("Client name", "United Kingdom", "gb", "My MC011 restriction was lifted after they prepared the right invoices and appeal.", "eBay MC011 appeal"),
      s("Client name", "United Kingdom", "gb", "Store set up properly from day one — categories, policies and promoted listings.", "eBay store setup"),
      s("Client name", "United Kingdom", "gb", "Account verified without problems. They explained every document I needed.", "eBay account creation"),
      s("Client name", "United Kingdom", "gb", "The SEO audit fixed my item specifics and my views went up within weeks.", "eBay SEO audit"),
      s("Client name", "United Kingdom", "gb", "MC999 felt impossible until they took over the appeal. Account restored.", "eBay MC999 appeal"),
      s("Client name", "United Kingdom", "gb", "Practical marketing plan with markdowns and promotions that actually sold stock.", "eBay marketing strategy"),
      s("Client name", "United Kingdom", "gb", "Clear growth plan — which products to list and how to price them.", "eBay growth strategy"),
      s("Client name", "United Kingdom", "gb", "Good communication and honest timelines throughout.", "eBay account review", 4)
    ],
    tiktok: [
      s("Client name", "United Kingdom", "gb", "TikTok Shop UK approved first time, and they showed me how to keep shop health high.", "TikTok Shop account creation"),
      s("Client name", "United Kingdom", "gb", "Our first LIVE sale was planned to the minute. Sales from the stream beat a whole week of posts.", "TikTok LIVE selling"),
      s("Client name", "United Kingdom", "gb", "They found creators who actually fit our product. Affiliate sales are now our biggest channel.", "Creator affiliates"),
      s("Client name", "United Kingdom", "gb", "Clear explanation of what TikTok Shop needs for overseas sellers — saved me months.", "TikTok Shop consultation"),
      s("Client name", "United Kingdom", "gb", "Shop reinstated after a deactivation, with a plan so it doesn't happen again.", "TikTok Shop reactivation"),
      s("Client name", "United Kingdom", "gb", "The content plan made posting every day realistic for a small team.", "TikTok growth strategy"),
      s("Client name", "United Kingdom", "gb", "Product titles and keywords fixed — our products now show in TikTok search.", "TikTok SEO audit"),
      s("Client name", "United Kingdom", "gb", "Helpful, quick and very knowledgeable about TikTok Shop rules.", "TikTok Shop account review", 4)
    ],
    walmart: [
      s("Client name", "United Kingdom", "gb", "Walmart approved our application after they rebuilt it properly. Great guidance.", "Walmart account creation"),
      s("Client name", "United Kingdom", "gb", "They set up our US company and Walmart account in the right order.", "Walmart onboarding"),
      s("Client name", "United Kingdom", "gb", "Moving to WFS improved our delivery speed and sales. Clear step-by-step help.", "Walmart Fulfillment Services"),
      s("Client name", "United Kingdom", "gb", "Sponsored Search campaigns finally profitable after their optimisation.", "Walmart PPC"),
      s("Client name", "United Kingdom", "gb", "Listing quality score went up across our catalog after the SEO work.", "Walmart SEO"),
      s("Client name", "United Kingdom", "gb", "Our first Walmart live shopping event was well planned and brought new customers.", "Walmart live streaming"),
      s("Client name", "United Kingdom", "gb", "Account reinstated with a clear plan to keep performance standards up.", "Walmart reactivation"),
      s("Client name", "United Kingdom", "gb", "Honest about what Walmart needs — no false promises.", "Walmart consultation", 4)
    ],
    etsy: [
      s("Client name", "United Kingdom", "gb", "My Etsy shop finally looks professional — policies, sections and photos all set up.", "Etsy shop setup"),
      s("Client name", "United Kingdom", "gb", "Tags and titles rewritten and my listings now appear in Etsy search.", "Etsy SEO"),
      s("Client name", "United Kingdom", "gb", "Shop opened and verified from abroad without any problems.", "Etsy account creation"),
      s("Client name", "United Kingdom", "gb", "Clear growth plan with pricing and Etsy Ads that didn't waste money.", "Etsy growth strategy"),
      s("Client name", "United Kingdom", "gb", "Suspended shop restored after they prepared the right appeal.", "Etsy reactivation"),
      s("Client name", "United Kingdom", "gb", "The quarterly product research gave me new handmade ideas that sell.", "Q1–Q4 product research"),
      s("Client name", "United Kingdom", "gb", "Kind, patient and very knowledgeable about Etsy rules.", "Etsy consultation"),
      s("Client name", "United Kingdom", "gb", "Shop review found problems I didn't know about. Fixed in a week.", "Etsy account review", 4)
    ],
    shopify: [
      s("Client name", "United Kingdom", "gb", "Our new Shopify store is fast, clean and converts far better than the old one.", "Shopify store build"),
      s("Client name", "United Kingdom", "gb", "Meta ads now bring steady sales — they handle the ads, boosting and content for us.", "Meta Ads"),
      s("Client name", "United Kingdom", "gb", "Store built, payments connected and products uploaded in record time.", "Shopify development"),
      s("Client name", "United Kingdom", "gb", "Google Shopping campaigns finally profitable after their setup.", "Google Ads"),
      s("Client name", "United Kingdom", "gb", "TikTok ads brought a younger audience to our store we couldn't reach before.", "TikTok Ads"),
      s("Client name", "United Kingdom", "gb", "SEO work put our product pages on Google's first page.", "Shopify SEO"),
      s("Client name", "United Kingdom", "gb", "Clear growth plan for offers, email flows and upsells.", "Shopify growth strategy"),
      s("Client name", "United Kingdom", "gb", "Great communication and on-time delivery.", "Shopify consultation", 4)
    ],
    "facebook-automation": [
      s("Client name", "United Kingdom", "gb", "Our Facebook page now answers every message instantly. We get more enquiries and spend far less time in Messenger.", "Messenger chatbot"),
      s("Client name", "United Kingdom", "gb", "The comment-to-DM flow on our posts brought in leads from day one, all sent straight to our Google Sheet.", "Comment automation"),
      s("Client name", "United Kingdom", "gb", "Our Click-to-Messenger ads finally convert. The bot qualifies buyers before my team calls them.", "Ad funnel automation"),
      s("Client name", "United Kingdom", "gb", "Clear setup, tested properly and the handover to our team works smoothly.", "Facebook page automation"),
    ],
    "instagram-automation": [
      s("Client name", "United Kingdom", "gb", "Comment-to-DM on our Reels doubled the comments and every buyer gets the link instantly.", "Comment-to-DM"),
      s("Client name", "United Kingdom", "gb", "DM questions about prices and sizes are answered automatically now. Huge time saver for our boutique.", "Instagram DM automation"),
      s("Client name", "United Kingdom", "gb", "Story replies turned into real leads in our CRM. Professional setup from start to finish.", "Lead generation"),
      s("Client name", "United Kingdom", "gb", "Safe, official tools and no spammy tricks — exactly what we wanted for our brand account.", "Instagram chatbot"),
    ],
    "whatsapp-automation": [
      s("Client name", "United Kingdom", "gb", "Bookings and reminders on WhatsApp cut our no-shows. Patients love how quick it is.", "Appointment booking"),
      s("Client name", "United Kingdom", "gb", "Order confirmations and delivery updates go out automatically from our store now.", "Order notifications"),
      s("Client name", "United Kingdom", "gb", "They handled the WhatsApp Business API setup and verification for us without any hassle.", "WhatsApp Business API"),
      s("Client name", "United Kingdom", "gb", "Our whole team works from one WhatsApp number and the bot handles the routine questions.", "WhatsApp chatbot"),
    ],
    "tiktok-automation": [
      s("Client name", "United Kingdom", "gb", "Keyword replies answer our TikTok DMs instantly, and comment filters keep our videos clean.", "TikTok auto-replies"),
      s("Client name", "United Kingdom", "gb", "Content is scheduled weeks ahead now, so we post consistently even in busy months.", "Content scheduling"),
      s("Client name", "United Kingdom", "gb", "Leads from our TikTok forms go straight to our CRM. Follow-up is so much faster.", "Lead generation"),
      s("Client name", "United Kingdom", "gb", "Only official tools, nothing risky for the account. Clear and professional setup.", "TikTok automation"),
    ],
    "seo": [
      s("Client name", "United Kingdom", "gb", "Our main service pages reached Google's first page and enquiries grew steadily month after month.", "On-page SEO"),
      s("Client name", "United Kingdom", "gb", "They fixed speed and indexing problems we didn't even know we had. Clear reporting every month.", "Technical SEO"),
      s("Client name", "United Kingdom", "gb", "Product category pages now bring consistent organic sales for our store.", "E-commerce SEO"),
    ],
    "digital-marketing": [
      s("Client name", "United Kingdom", "gb", "Our Meta ads finally make a profit. Weekly testing made a big difference to our cost per sale.", "Meta Ads"),
      s("Client name", "United Kingdom", "gb", "Google Ads now brings qualified leads instead of random clicks. Very transparent reporting.", "Google Ads"),
      s("Client name", "United Kingdom", "gb", "TikTok ads reached a younger audience and drove real sales for our brand.", "TikTok Ads"),
    ],
    "social-media-marketing": [
      s("Client name", "United Kingdom", "gb", "Consistent posting and great Reels \u2014 our Instagram engagement has never been better.", "Instagram marketing"),
      s("Client name", "United Kingdom", "gb", "They manage all our pages and reply to customers quickly. We get more enquiries every week.", "Social media management"),
      s("Client name", "United Kingdom", "gb", "Clear monthly calendar and reports. Our brand finally looks professional online.", "Content strategy"),
    ],
    "email-marketing": [
      s("Client name", "United Kingdom", "gb", "The abandoned-cart flow recovered sales from day one. Easy to see the revenue in Klaviyo.", "Email automation"),
      s("Client name", "United Kingdom", "gb", "Beautiful, mobile-friendly newsletters that customers actually open.", "Newsletter design"),
      s("Client name", "United Kingdom", "gb", "Our welcome series turns new subscribers into first-time buyers.", "Welcome sequence"),
    ],
    "influencer-marketing": [
      s("Client name", "United Kingdom", "gb", "They found creators who genuinely fit our brand. The TikTok campaign sold out our launch stock.", "TikTok influencer campaign"),
      s("Client name", "United Kingdom", "gb", "Product seeding brought honest reviews and great content we reuse in our ads.", "Product seeding"),
      s("Client name", "United Kingdom", "gb", "Clear briefs, tracked codes and a proper report \u2014 we knew exactly what each creator delivered.", "Campaign management"),
    ],
    "affiliate-marketing": [
      s("Client name", "United Kingdom", "gb", "Our affiliate program is set up properly with reliable tracking and active partners.", "Affiliate program setup"),
      s("Client name", "United Kingdom", "gb", "They recruited relevant review sites and bloggers. Sales from partners grow every month.", "Partner recruitment"),
      s("Client name", "United Kingdom", "gb", "The niche affiliate website they built now ranks and earns commission.", "Affiliate website"),
    ],
    "website-development": [
      s("Client name", "United Kingdom", "gb", "Fast, modern website that works perfectly on mobile. We get far more enquiries now.", "Business website"),
      s("Client name", "United Kingdom", "gb", "Our new online store is easy to manage and checkout is smooth for customers.", "E-commerce website"),
      s("Client name", "United Kingdom", "gb", "Clear process, on-time delivery and great support after launch.", "WordPress website"),
    ],
    "app-development": [
      s("Client name", "United Kingdom", "gb", "They turned our idea into a working app and launched it on both app stores.", "Cross-platform app"),
      s("Client name", "United Kingdom", "gb", "Our booking app is simple for customers and the admin dashboard saves us hours.", "Booking app"),
      s("Client name", "United Kingdom", "gb", "Regular demos kept us involved and the final app is fast and reliable.", "MVP development"),
    ],
    "crm-development": [
      s("Client name", "United Kingdom", "gb", "Finally all our leads and follow-ups in one place. The team uses it every day.", "Custom CRM"),
      s("Client name", "United Kingdom", "gb", "WhatsApp and website leads go straight into the CRM and get assigned automatically.", "Lead management"),
      s("Client name", "United Kingdom", "gb", "The dashboards show exactly where our sales stand each week.", "CRM dashboards"),
    ],
    "uk-ltd-formation": [
      s("Client name", "United Kingdom", "gb", "My UK company was registered quickly and they explained identity verification step by step.", "UK LTD formation"),
      s("Client name", "United Kingdom", "gb", "Company, address and bank account support all handled in the right order.", "Advanced UK LTD plan"),
      s("Client name", "United Kingdom", "gb", "They file our accounts and Corporation Tax every year \u2014 no more deadline stress.", "VAT & tax filing"),
    ],
    "us-llc-formation": [
      s("Client name", "United Kingdom", "gb", "Wyoming LLC, EIN and US address sorted without me needing an SSN. Very clear process.", "US LLC formation"),
      s("Client name", "United Kingdom", "gb", "They explained Form 5472 properly \u2014 I had no idea about the penalty before.", "US LLC + tax filing"),
      s("Client name", "United Kingdom", "gb", "My Stripe account was approved with the documents they prepared.", "Advanced LLC plan"),
    ],
    "uae-company-formation": [
      s("Client name", "United Kingdom", "gb", "They explained mainland versus free zone clearly before we spent anything.", "UAE setup consultation"),
      s("Client name", "United Kingdom", "gb", "Trade license, office and visa guidance all handled in the right order.", "Free zone company"),
      s("Client name", "United Kingdom", "gb", "Helpful support with bank account preparation and tax registration.", "UAE company formation"),
    ],
    "malta-company-formation": [
      s("Client name", "United Kingdom", "gb", "Clear guidance on the right structure and every document we needed for Malta.", "Malta company formation"),
      s("Client name", "United Kingdom", "gb", "Registration with the MBR went smoothly with their help.", "Company registration"),
      s("Client name", "United Kingdom", "gb", "They keep our annual filings up to date so we can focus on the business.", "Ongoing compliance"),
    ],
    "taxation": [
      s("Client name", "United Kingdom", "gb", "They filed my Form 5472 on time and explained everything in simple terms.", "US LLC tax filing"),
      s("Client name", "United Kingdom", "gb", "Accounts and CT600 filed without any stress. Great value for the price.", "UK accounting package"),
      s("Client name", "United Kingdom", "gb", "Our VAT returns are handled every quarter and always on time.", "UK VAT returns"),
    ],
    "trademark-registration": [
      s("Client name", "United Kingdom", "gb", "Our US trademark was filed through a US attorney and Brand Registry was approved.", "US trademark"),
      s("Client name", "United Kingdom", "gb", "The clearance search caught a conflict before we filed \u2014 saved us money.", "Trademark search"),
      s("Client name", "United Kingdom", "gb", "UK trademark registered smoothly with clear updates throughout.", "UK trademark"),
    ],
    "education-consultancy": [
      s("Client name", "United Kingdom", "gb", "They helped me choose the right course and my application was accepted.", "Malta admissions"),
      s("Client name", "United Kingdom", "gb", "Every document for my visa was checked carefully. Very supportive team.", "Student visa guidance"),
      s("Client name", "United Kingdom", "gb", "Clear guidance from course selection to arrival in Malta.", "Study in Malta"),
    ],
    "real-estate": [
      s("Client name", "United Kingdom", "gb", "I bought a house in Lahore while living in the UK. Video tours and regular updates made it stress-free.", "Overseas property purchase"),
      s("Client name", "United Kingdom", "gb", "They checked the society approval and documents before I paid anything. That gave our family real peace of mind.", "Title verification"),
      s("Client name", "United Kingdom", "gb", "Our apartment was listed with proper photos and sold to a serious buyer quickly.", "Property selling"),
    ],
    // Home page — "What Our Students Say". Replace each with a real student (name, photo, course)
    // and set sample: false. Photos go in assets/img/reviews/ (square, at least 200×200px).
    students: [
      { name: "Student name", country: "United Kingdom", flag: "gb", role: "Level 1 student", photo: "", rating: 5, text: "The training is practical from the very first class. I finally understand what to check before buying any stock.", sample: true },
      { name: "Student name", country: "United Kingdom", flag: "gb", role: "Mentorship student", photo: "", rating: 5, text: "Supportive mentorship and clear answers to every question. The one-to-one format made a real difference for me.", sample: true },
      { name: "Student name", country: "United Kingdom", flag: "gb", role: "Amazon seller", photo: "", rating: 5, text: "Step-by-step guidance on product research and supplier checks helped me avoid mistakes I would have made on my own.", sample: true },
      { name: "Student name", country: "United Kingdom", flag: "gb", role: "E-commerce beginner", photo: "", rating: 5, text: "The free YouTube lessons got me started, and the structured classes gave me the confidence to plan my Amazon business properly.", sample: true },
      { name: "Student name", country: "United Kingdom", flag: "gb", role: "Consultation client", photo: "", rating: 5, text: "Help with my account documents was quick and clear. I knew exactly what to prepare and why.", sample: true },
      { name: "Student name", country: "United Kingdom", flag: "gb", role: "Level 1 student", photo: "", rating: 5, text: "Practical, honest and well organised. The classes fit around my schedule, which made it possible to keep learning.", sample: true },
      { name: "Student name", country: "United Kingdom", flag: "gb", role: "Mentorship student", photo: "", rating: 5, text: "I learned how to read the numbers \u2014 fees, margins and landed cost \u2014 before making any decision.", sample: true },
      { name: "Student name", country: "United Kingdom", flag: "gb", role: "E-commerce student", photo: "", rating: 5, text: "Clear explanations and a patient mentor. Every class ended with a practical task I could act on straight away.", sample: true },
    ],
  };
})();
