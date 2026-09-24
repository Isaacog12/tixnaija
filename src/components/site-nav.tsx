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
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

export function SiteNav() {
  // ── Auth & Menu State ───────────────────────────────────────────────────────
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();

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
          <nav className="hidden xl:flex items-center gap-0.5">
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
            aria-label="Toggle theme"
            className="rounded-full h-10 w-10 sm:h-11 sm:w-11 hover:bg-secondary/60 press-sm transition-colors duration-[var(--duration-micro)]"
          >
            {isDark ? (
              <Sun className="h-4 w-4 sm:h-[18px] sm:w-[18px] text-muted-foreground" />
            ) : (
              <Moon className="h-4 w-4 sm:h-[18px] sm:w-[18px] text-muted-foreground" />
            )}
          </Button>

          {/* Unified Auth & Menu Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {!loading && user && (
              <Button
                asChild
                variant="ghost"
                size="icon"
                aria-label="Notifications"
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
                        "[animation:scale-in_var(--duration-fast)_var(--ease-spring)_forwards]",
                      )}
                    >
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Link>
              </Button>
            )}

            {!loading && (
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Account menu"
                    className="rounded-full h-10 w-10 sm:h-11 sm:w-11 press-sm border border-transparent hover:bg-secondary/60 hover:border-border/40 transition-all duration-[var(--duration-micro)] overflow-hidden"
                  >
                    {user ? (
                      <span className="grid h-full w-full place-items-center bg-primary/10 text-xs sm:text-sm font-bold text-primary shrink-0">
                        {(user.email ?? "?").slice(0, 1).toUpperCase()}
                      </span>
                    ) : (
                      <span className="grid h-full w-full place-items-center bg-secondary/50 text-muted-foreground shrink-0">
                        <UserIcon className="h-5 w-5 sm:h-6 sm:w-6 opacity-70" />
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                
                <AnimatePresence>
                  {menuOpen && (
                    <DropdownMenuContent
                      forceMount
                      asChild
                      align="end"
                      sideOffset={8}
                      className="w-64 rounded-2xl shadow-xl border-border/50 bg-popover/95 backdrop-blur-xl p-2"
                    >
                      <motion.div
                        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
                        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
                        transition={
                          prefersReducedMotion
                            ? { duration: 0.2 }
                            : { type: "spring", bounce: 0, duration: 0.3 }
                        }
                      >
                        {user ? (
                          <DropdownMenuLabel className="truncate font-normal px-3 py-2.5">
                            <span className="block text-xs text-muted-foreground font-medium mb-1">Signed in as</span>
                            <span className="block text-sm font-semibold">{user.email}</span>
                          </DropdownMenuLabel>
                        ) : (
                          <div className="px-2 py-3 flex flex-col gap-2">
                            <Button asChild className="w-full rounded-xl gradient-sunset font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/35 transition-all">
                              <Link to="/auth" search={{ mode: "signup" }} onClick={() => setMenuOpen(false)}>Get started</Link>
                            </Button>
                            <Button asChild variant="outline" className="w-full rounded-xl border-[var(--glass-border)]">
                              <Link to="/auth" onClick={() => setMenuOpen(false)}>Log in</Link>
                            </Button>
                          </div>
                        )}

                        {/* Nav Links (hidden on desktop where they are visible in top bar) */}
                        <div className="xl:hidden">
                          {user && <DropdownMenuSeparator className="mx-2" />}
                          {links.filter(link => link.name !== "Dashboard").map((link) => (
                            <DropdownMenuItem asChild key={link.to} className="cursor-pointer rounded-xl px-3 py-2.5 focus:bg-secondary">
                              <Link to={link.to} onClick={() => setMenuOpen(false)}>
                                <link.icon className="mr-3 h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="font-medium">{link.name}</span>
                              </Link>
                            </DropdownMenuItem>
                          ))}
                        </div>

                        {user && (
                          <>
                            <DropdownMenuSeparator className="mx-2" />
                            <DropdownMenuItem asChild className="cursor-pointer rounded-xl px-3 py-2.5 focus:bg-secondary">
                              <Link to="/tickets" onClick={() => setMenuOpen(false)}>
                                <TicketIcon className="mr-3 h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="font-medium">My Tickets</span>
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild className="cursor-pointer rounded-xl px-3 py-2.5 focus:bg-secondary">
                              <Link to="/dashboard" onClick={() => setMenuOpen(false)}>
                                <LayoutDashboard className="mr-3 h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="font-medium">Dashboard</span>
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild className="cursor-pointer rounded-xl px-3 py-2.5 focus:bg-secondary">
                              <Link to="/account" onClick={() => setMenuOpen(false)}>
                                <UserIcon className="mr-3 h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="font-medium">Account Settings</span>
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="mx-2" />
                            <DropdownMenuItem
                              onClick={() => { setMenuOpen(false); handleSignOut(); }}
                              className="cursor-pointer rounded-xl px-3 py-2.5 text-destructive focus:text-destructive focus:bg-destructive/10"
                            >
                              <LogOut className="mr-3 h-4 w-4 shrink-0" />
                              <span className="font-medium">Sign out</span>
                            </DropdownMenuItem>
                          </>
                        )}
                      </motion.div>
                    </DropdownMenuContent>
                  )}
                </AnimatePresence>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
