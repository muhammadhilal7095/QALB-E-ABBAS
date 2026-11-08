import { env } from "@/lib/env";

export function SiteHeader() {
  const main = env.mainSiteUrl();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="container-x flex h-16 items-center gap-4">
        <a href={`${main}/`} className="flex shrink-0 items-center" aria-label="Qalb-E-Abbas — main website">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Qalb-E-Abbas" width={170} height={40} className="h-9 w-auto" />
        </a>
        <a href={`${main}/`} className="btn-ghost ml-auto">Back to website</a>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-navy text-sm text-white/75">
      <div className="container-x flex flex-wrap items-center justify-between gap-3 py-6">
        <p>© {new Date().getFullYear()} Qalb-E-Abbas · Manchester, United Kingdom</p>
        <p><a className="hover:text-white" href="mailto:contact@qalbeabbas.com">contact@qalbeabbas.com</a></p>
      </div>
    </footer>
  );
}
