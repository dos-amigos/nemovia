/**
 * Site footer shown on every page.
 *
 * - "Aplicaxion realixà con ❤️ in Veneto" credit line
 * - Unsplash attribution link with UTM params (API compliance)
 * - Dynamic copyright year
 * - Extra bottom padding on mobile to clear the fixed BottomNav (h-16 = 4rem)
 *
 * Server component -- no "use client" directive.
 */
export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 pb-24 pt-8 sm:px-6 lg:px-8 lg:pb-8">
        {/* Credit line */}
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          Aplicaxion realixà con ❤️ in Veneto
        </p>

        {/* Media attribution — in dialetto veneto */}
        <p className="text-xs text-muted-foreground/60">
          Ghemo usà un fia de foto bèe da{" "}
          <a
            href="https://unsplash.com/?utm_source=nemovia&utm_medium=referral"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Unsplash
          </a>
          {" "}e ciavà dei video emossionanti da{" "}
          <a
            href="https://www.pexels.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Pexels
          </a>
          .
        </p>

        {/* Copyright */}
        <p className="text-xs text-muted-foreground/40">
          &copy; {new Date().getFullYear()} Nemovia
        </p>
      </div>
    </footer>
  );
}
