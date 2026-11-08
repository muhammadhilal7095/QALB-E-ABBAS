# Deploying the website: GitHub → Hostinger

Every push to the `main` branch on GitHub uploads the website to Hostinger automatically
(GitHub Actions workflow: `.github/workflows/deploy-hostinger.yml`).

## One-time setup

1. **Hostinger — get the FTP details.** hPanel → *Websites* → your site → *Files* → *FTP Accounts*.
   Note the **FTP host** (e.g. `ftp.qalbeabbas.com`), **username** and set/copy the **password**.
   Also note the folder the website is served from (usually `public_html`).
2. **GitHub — add them as secrets.** Repository → *Settings* → *Secrets and variables* → *Actions*:
   - *Secrets* tab → **New repository secret**: `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`
   - *Variables* tab (optional) → `FTP_SERVER_DIR` = the website folder ending in `/`
     (default `public_html/`; if your FTP account already opens inside public_html, use `./`)
3. **Run it.** Repository → *Actions* → *Deploy website to Hostinger* → **Run workflow**
   (or just push to `main`). The first upload sends every file; later ones only changed files.
4. **Hostinger — turn on SSL.** hPanel → *Security* → *SSL* → install the free SSL certificate.
   `.htaccess` already redirects every visitor to `https://www.` and serves clean URLs and the 404 page.

## What gets uploaded

The HTML pages, `/assets`, `sitemap.xml`, `robots.txt` and `.htaccess`.
Not uploaded: `booking/` (the payment app), `docs/`, `.github/`, Markdown files and `serve.py`.

## Before you push changes

Run the site build so minified CSS/JS, WebP images, SEO tags and schema are up to date:

```
cd booking
npm run site:build
```

## The booking / payment app

`booking/` is a Node.js (Next.js) app and is deployed separately (it needs Node.js hosting —
e.g. a Hostinger plan with Node.js apps, a VPS, or any Node host). See `booking/docs/DEPLOYMENT.md`.
Once it has a public address, set `links.bookingApp` in `assets/js/site-config.js` to that address.
