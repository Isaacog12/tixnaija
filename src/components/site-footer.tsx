import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/40 bg-card/30 py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 px-4 md:flex-row">
        <Link to="/" className="flex items-baseline gap-0 hover:opacity-80 transition-opacity">
          <span className="font-display text-2xl leading-none tracking-wide text-foreground">TIX</span>
          <span className="font-display text-2xl leading-none tracking-wide font-light text-gradient-sunset">NAIJA</span>
        </Link>
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-sm font-semibold text-muted-foreground">
          <Link to="/how-it-works" className="hover:text-primary transition-colors">Guide</Link>
          <Link to="/about" className="hover:text-primary transition-colors">Contact</Link>
          <Link to="/terms" className="hover:text-primary transition-colors">Terms</Link>
          <Link to="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
          <Link to="/careers" className="hover:text-primary transition-colors">Careers</Link>
        </div>
        <p className="text-sm font-medium text-muted-foreground/70">
          © {new Date().getFullYear()} — Buy tickets. Turn up. Repeat.
        </p>
      </div>
    </footer>
  );
}
