import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LogOut,
  LayoutDashboard,
  User as UserIcon,
  Ticket as TicketIcon,
  Menu,
  Bell,
  Compass,
  Search,
  HelpCircle,
  Sun,
  Moon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

export function SiteNav() {
  // ── Auth (untouched) ────────────────────────────────────────────────────────
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  // ── Unread count query (untouched) ──────────────────────────────────────────
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread-messages"],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("is_read", false);
      if (error) return 0;
      return count ?? 0;
    },
    enabled: !!user,
  });

  // ── Nav pill hover tracking ─────────────────────────────────────────────────
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);

  // ── Scroll-aware header border ──────────────────────────────────────────────
  // Adds a subtle separator only when the user has scrolled away from the top,
  // matching Apple's pattern of chrome that only appears when needed.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handler, { passive: true });
    handler(); // sync on mount
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // ── Dark / light mode toggle ────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(() => {
    if (typeof document === "undefined") return true;
    return document.documentElement.classList.contains("dark");
  });

  // ── Pointer-capability guard ────────────────────────────────────────────────
  // Only activate the hover pill on fine-pointer devices (mouse, trackpad, pen).
  // On touch-primary devices (phone, iPad) skip it — no sticky hover state.
  const supportsHover =
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("tixnaija-theme", next ? "dark" : "light");
    } catch {
      // Private browsing: silently fail — the toggle still works for the session.
    }
  }

  // ── Nav links (existing logic untouched) ────────────────────────────────────
  const links = [
    { name: "Browse", to: "/browse", icon: Search },
    ...(user ? [{ name: "Dashboard", to: "/dashboard", icon: LayoutDashboard }] : []),
    { name: "About Us", to: "/about", icon: Compass },
    { name: "How it works", to: "/how-it-works", icon: HelpCircle },
  ];

  return (
    <header
      className={cn(
        // Glass material: translucent surface, content scrolls underneath.
        // Using Tailwind's native backdrop utilities avoids stacking-context
        // issues that can make elements below the header unclickable.
        "sticky top-0 z-50 w-full",
        "backdrop-blur-2xl backdrop-saturate-[180%] bg-background/80 dark:bg-background/75",
        "transition-[border-color,box-shadow] duration-[350ms] ease-out",
        scrolled
          ? "border-b border-border/40 shadow-sm"
          : "border-b border-transparent shadow-none",
      )}
    >
      <div className="mx-auto flex h-16 sm:h-20 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

        {/* ── Logo + Desktop Nav ─────────────────────────────────────────── */}
        <div className="flex items-center gap-4 lg:gap-8">
          <Link to="/" className="group relative flex items-baseline mr-2 shrink-0">
            <span className="font-display text-3xl sm:text-4xl leading-none tracking-wider text-foreground">
              TIX
            </span>
            <span className="font-display text-3xl sm:text-4xl leading-none tracking-wider font-light text-gradient-sunset">
              NAIJA
            </span>
            {/* Underline: 8px → full width on hover, spring-eased */}
            <span
              aria-hidden
              className={cn(
                "absolute -bottom-1 left-0 h-[2px] w-8 gradient-sunset rounded-full shadow-[0_0_8px_rgba(234,88,12,0.55)]",
                "transition-[width] duration-[var(--duration-slow)] [transition-timing-function:var(--ease-snappy)]",
                "group-hover:w-full",
              )}
            />
          </Link>

          {/* Desktop navigation with Motion-powered sliding pill */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onMouseEnter={() => supportsHover && setHoveredPath(link.to)}
                onMouseLeave={() => supportsHover && setHoveredPath(null)}
                className={cn(
                  "relative flex items-center gap-2 px-3.5 py-2 text-sm font-medium z-10",
                  "text-muted-foreground hover:text-foreground",
                  "transition-colors duration-[var(--duration-micro)]",
                )}
                activeProps={{ className: "text-foreground font-semibold" }}
              >
                <link.icon className="w-4 h-4 opacity-70 shrink-0" />
                <span className="relative z-10">{link.name}</span>

                {/*
                 * Motion shared-layout pill: when the user moves between links,
                 * this element animates from the old link's position to the new
                 * one via a critically-damped spring — no visible jump or stutter.
                 * layoutId ties instances across conditional renders.
                 */}
                {hoveredPath === link.to && (
                  <motion.div
                    layoutId="nav-pill"
                    transition={{ type: "spring", bounce: 0, duration: 0.35 }}
                    className="absolute inset-0 rounded-full bg-secondary/80 dark:bg-secondary/60 -z-10"
                  />
                )}
              </Link>
            ))}
          </nav>
        </div>

        {/* ── Right-side Controls ────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 sm:gap-2">

          {/* Dark / light toggle — always visible */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="rounded-full h-10 w-10 sm:h-11 sm:w-11 hover:bg-secondary/60 press-sm transition-colors duration-[var(--duration-micro)]"
          >
            {isDark ? (
              <Sun className="h-4 w-4 sm:h-[18px] sm:w-[18px] text-muted-foreground" />
            ) : (
              <Moon className="h-4 w-4 sm:h-[18px] sm:w-[18px] text-muted-foreground" />
            )}
          </Button>

          {/* Auth-state controls */}
          {loading ? null : user ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Notification bell */}
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="relative rounded-full h-10 w-10 sm:h-11 sm:w-11 hover:bg-secondary/60 press-sm transition-colors duration-[var(--duration-micro)]"
              >
                <Link to="/notifications">
                  <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  {unreadCount > 0 && (
                    <span
                      className={cn(
                        "absolute right-1 top-1 flex h-[18px] w-[18px] sm:h-5 sm:w-5",
                        "items-center justify-center rounded-full",
                        "bg-primary text-[9px] sm:text-[10px] font-bold text-primary-foreground",
                        "border-2 border-background shadow-sm",
                        // Scale-in keyframe only runs once when the badge first appears.
                        "[animation:scale-in_var(--duration-fast)_var(--ease-spring)_forwards]",
                      )}
                    >
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Link>
              </Button>

              {/* User dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 sm:gap-3 rounded-full pl-1.5 sm:pl-2 pr-3 sm:pr-4 h-10 sm:h-11 press-sm border border-transparent hover:bg-secondary/60 hover:border-border/40 transition-all duration-[var(--duration-micro)]"
                  >
                    <span className="grid h-7 w-7 sm:h-8 sm:w-8 place-items-center rounded-full bg-primary/10 text-xs sm:text-sm font-bold text-primary shrink-0">
                      {(user.email ?? "?").slice(0, 1).toUpperCase()}
                    </span>
                    <span className="hidden max-w-[120px] sm:max-w-[160px] truncate text-sm md:inline font-semibold">
                      {user.email}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-64 rounded-2xl shadow-xl border-border/50 bg-popover/95 backdrop-blur-xl p-2"
                >
                  <DropdownMenuLabel className="truncate font-normal px-3 py-2.5">
                    <span className="block text-xs text-muted-foreground font-medium mb-1">Signed in as</span>
                    <span className="block text-sm font-semibold">{user.email}</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="mx-2" />
                  <DropdownMenuItem asChild className="cursor-pointer rounded-xl px-3 py-2.5 focus:bg-secondary">
                    <Link to="/tickets">
                      <TicketIcon className="mr-3 h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium">My Tickets</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer rounded-xl px-3 py-2.5 focus:bg-secondary">
                    <Link to="/dashboard">
                      <LayoutDashboard className="mr-3 h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium">Dashboard</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer rounded-xl px-3 py-2.5 focus:bg-secondary">
                    <Link to="/account">
                      <UserIcon className="mr-3 h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium">Account Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="mx-2" />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="cursor-pointer rounded-xl px-3 py-2.5 text-destructive focus:text-destructive focus:bg-destructive/10"
                  >
                    <LogOut className="mr-3 h-4 w-4 shrink-0" />
                    <span className="font-medium">Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            // Guest CTAs: Log in hidden on mobile (sheet covers it), Get started always visible
            <div className="flex items-center gap-2">
              <Button
                asChild
                variant="ghost"
                className="hidden sm:flex rounded-full hover:bg-secondary/60 font-medium px-5 sm:px-6 h-10 sm:h-11 press-sm transition-colors duration-[var(--duration-micro)]"
              >
                <Link to="/auth">Log in</Link>
              </Button>
              <Button
                asChild
                className="rounded-full gradient-sunset text-primary-foreground font-semibold px-5 sm:px-7 h-10 sm:h-11 press-sm shadow-lg shadow-primary/20 hover:shadow-primary/35 hover:-translate-y-0.5 transition-all duration-[var(--duration-fast)] [transition-timing-function:var(--ease-snappy)]"
              >
                <Link to="/auth" search={{ mode: "signup" }}>
                  Get started
                </Link>
              </Button>
            </div>
          )}

          {/* Mobile hamburger menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="lg:hidden rounded-full h-10 w-10 sm:h-11 sm:w-11 border-[var(--glass-border)] bg-[var(--glass-bg)] [backdrop-filter:var(--glass-blur)] press-sm"
              >
                <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>

            <SheetContent
              side="right"
              className="w-[300px] sm:w-[350px] p-0 shadow-2xl border-l border-border/50 bg-background/98 backdrop-blur-xl"
            >
              <div className="flex flex-col h-full">
                {/* Sheet header: logo + theme toggle */}
                <div className="flex items-center justify-between p-6 pb-4 border-b border-border/40">
                  <Link to="/" className="flex items-baseline w-fit">
                    <span className="font-display text-3xl leading-none tracking-wide text-foreground">TIX</span>
                    <span className="font-display text-3xl leading-none tracking-wide font-light text-gradient-sunset">NAIJA</span>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleTheme}
                    aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                    className="rounded-full h-10 w-10 hover:bg-secondary/60 press-sm"
                  >
                    {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </Button>
                </div>

                {/* Sheet nav links — staggered fade-up on open */}
                <div className="flex-1 overflow-y-auto px-4 py-6">
                  <nav className="flex flex-col gap-1.5">
                    {links.map((link, i) => (
                      <motion.div
                        key={link.to}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          delay: i * 0.04,
                          duration: 0.22,
                          ease: [0.25, 1, 0.5, 1], // ease-snappy
                        }}
                      >
                        <Link
                          to={link.to}
                          className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-medium text-muted-foreground transition-all duration-[var(--duration-micro)] hover:bg-secondary/40 active:scale-[0.97] hover:text-foreground"
                          activeProps={{ className: "text-foreground bg-secondary/80 font-semibold" }}
                        >
                          <link.icon className="w-5 h-5 opacity-70 shrink-0" />
                          {link.name}
                        </Link>
                      </motion.div>
                    ))}
                  </nav>
                </div>

                {/* Sheet footer: guest sign-up CTA — staggered in last */}
                {!user && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.18, duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
                    className="p-6 border-t border-border/40"
                  >
                    <div className="flex flex-col gap-3">
                      <Button
                        asChild
                        className="w-full justify-center h-12 rounded-full gradient-sunset text-primary-foreground text-base font-semibold shadow-lg shadow-primary/20 press-md"
                      >
                        <Link to="/auth" search={{ mode: "signup" }}>Sign up free</Link>
                      </Button>
                      <Button
                        asChild
                        variant="outline"
                        className="w-full justify-center h-12 rounded-full text-base font-medium border-[var(--glass-border)] press-md"
                      >
                        <Link to="/auth">Log in</Link>
                      </Button>
                    </div>
                  </motion.div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
