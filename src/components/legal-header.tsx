import { BackButton } from "@/components/back-button";

/**
 * Editorial header for policy pages (Terms, Privacy, Refunds, Cookies).
 *
 * Matches the About / How it works treatment: hairline rule and a micro
 * overline above a Cinzel heading, with the effective date as quiet metadata.
 */
export function LegalHeader({
  eyebrow,
  title,
  updated,
}: {
  eyebrow: string;
  title: string;
  updated: string;
}) {
  return (
    <section className="border-b border-border/60">
      <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6 sm:px-6 md:pb-14 lg:px-8">
        <BackButton />

        <div className="mt-8 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          <span className="h-px w-10 bg-border" aria-hidden />
          {eyebrow}
        </div>

        <h1 className="mt-5 max-w-3xl font-display text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.05] tracking-[-0.03em] text-foreground">
          {title}
        </h1>

        <p className="mt-4 text-[13px] text-muted-foreground">
          Effective <span className="font-medium text-foreground">{updated}</span>
        </p>
      </div>
    </section>
  );
}
