/** Origins of the marketing website allowed to call the public order API (no DB imports — used by middleware). */
export function siteOrigins(): Set<string> {
  const set = new Set<string>();
  const add = (u: string) => { if (u) set.add(u.replace(/\/$/, "")); };
  const main = (process.env.MAIN_SITE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
  add(main);
  // The same local site is often opened as localhost or 127.0.0.1.
  add(main.replace("://127.0.0.1", "://localhost"));
  add(main.replace("://localhost", "://127.0.0.1"));
  for (const o of (process.env.ALLOWED_ORIGINS || "").split(",")) add(o.trim());
  return set;
}
