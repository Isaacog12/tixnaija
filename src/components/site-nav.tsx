import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LogOut,
  LayoutDashboard,
  User as UserIcon,
  Ticket as TicketIcon,
  Bell,
  Sun,
  Moon,
  Smartphone,
  Headset,
  ShieldCheck,
  Search,
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

  // ── Role check (Admin & Customer Care) ──────────────────────────────────────
  const { data: userRoles = [] } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      return (data ?? []).map((r: any) => r.role as string);
    },
    enabled: !!user,
  });

  const isAdmin = userRoles.includes("admin");
  const isCustomerCare = userRoles.includes("customer_care");

  // ── Scroll-aware header rule ────────────────────────────────────────────────
  // The hairline only appears once the page has scrolled, so the landing view
  // stays edge-to-edge.
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
    { name: "About Us", to: "/about", icon: UserIcon },
    { name: "How it works", to: "/how-it-works", icon: TicketIcon },
    ...(isAdmin ? [{ name: "Download App", to: "/download", icon: Smartphone }] : []),
  ];

  return (
    <header
      className={cn(
        // Glass material: translucent surface, content scrolls underneath.
        // Using Tailwind's native backdrop utilities avoids stacking-context
        // issues that can make elements below the header unclickable.
        "sticky top-0 z-50 w-full",
        "backdrop-blur-2xl backdrop-saturate-[180%] bg-background/80 dark:bg-background/75",
        "transition-[border-color] duration-[350ms] ease-out",
        scrolled ? "border-b border-border/50" : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:h-20 sm:px-6 lg:px-8">
        {/* ── Wordmark ──────────────────────────────────────────────────── */}
        <Link
          to="/"
          aria-label="TixNaija home"
          className="group flex shrink-0 items-baseline"
        >
          <span className="font-display text-[26px] leading-none tracking-[0.06em] text-foreground sm:text-[30px]">
            TIX
          </span>
          <span className="font-display text-[26px] leading-none font-light tracking-[0.06em] text-gradient-sunset sm:text-[30px]">
            NAIJA
          </span>
        </Link>

        {/* ── Desktop navigation ────────────────────────────────────────── */}
        <nav aria-label="Primary" className="hidden items-center gap-7 xl:flex">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                "group relative inline-flex items-center py-2",
                "text-[11px] font-semibold uppercase tracking-[0.14em]",
                "text-muted-foreground transition-colors duration-[var(--duration-micro)] hover:text-foreground",
              )}
              activeProps={{ className: "text-foreground [&>span.rule]:w-full" }}
            >
              <span className="relative z-10">{link.name}</span>
              <span
                aria-hidden
                className="rule absolute inset-x-0 -bottom-0.5 h-px w-0 rounded-full bg-primary transition-[width] duration-[var(--duration-slow)] [transition-timing-function:var(--ease-snappy)] group-hover:w-full"
              />
            </Link>
          ))}

          {/* Guests can still retrieve tickets bought without an account */}
          {!loading && !user && (
            <Link
              to="/my-tickets"
              className={cn(
                "group relative inline-flex items-center py-2",
                "text-[11px] font-semibold uppercase tracking-[0.14em]",
                "text-muted-foreground transition-colors duration-[var(--duration-micro)] hover:text-foreground",
              )}
              activeProps={{ className: "text-foreground [&>span.rule]:w-full" }}
            >
              <span className="relative z-10">My Tickets</span>
              <span
                aria-hidden
                className="rule absolute inset-x-0 -bottom-0.5 h-px w-0 rounded-full bg-primary transition-[width] duration-[var(--duration-slow)] [transition-timing-function:var(--ease-snappy)] group-hover:w-full"
              />
            </Link>
          )}
        </nav>

        {/* ── Right-side Controls ────────────────────────────────────────── */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Dark / light toggle — always visible */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="h-9 w-9 rounded-full text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground press-sm sm:h-10 sm:w-10"
          >
            {isDark ? (
              <Sun className="h-[17px] w-[17px]" aria-hidden />
            ) : (
              <Moon className="h-[17px] w-[17px]" aria-hidden />
            )}
          </Button>

          {/* Hairline divider: utility controls vs. account */}
          <span aria-hidden className="mx-1 hidden h-5 w-px bg-border/70 sm:block" />

          <div className="flex items-center gap-1 sm:gap-1.5">
            {!loading && user && (
              <Button
                asChild
                variant="ghost"
                size="icon"
                aria-label="Notifications"
                className="relative h-9 w-9 rounded-full text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground press-sm sm:h-10 sm:w-10"
              >
                <Link to="/notifications">
                  <Bell className="h-[17px] w-[17px]" aria-hidden />
                  {unreadCount > 0 && (
                    <span
                      className={cn(
                        "absolute right-0.5 top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1",
                        "bg-primary text-[9px] font-bold text-primary-foreground",
                        "border-2 border-background",
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
                    className="h-9 w-9 overflow-hidden rounded-full border border-border/60 bg-card/60 transition-colors hover:border-border hover:bg-secondary/60 press-sm sm:h-10 sm:w-10"
                  >
                    {user ? (
                      <span className="grid h-full w-full place-items-center bg-primary/10 text-[11px] font-bold text-primary sm:text-xs">
                        {(user.email ?? "?").slice(0, 1).toUpperCase()}
                      </span>
                    ) : (
                      <span className="grid h-full w-full place-items-center text-muted-foreground">
                        <UserIcon className="h-4 w-4" aria-hidden />
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
                      sideOffset={10}
                      className="w-64 rounded-xl border-border/60 bg-popover/95 p-1.5 shadow-xl backdrop-blur-xl"
                    >
                      <motion.div
                        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                        transition={
                          prefersReducedMotion
                            ? { duration: 0.2 }
                            : { type: "spring", bounce: 0, duration: 0.3 }
                        }
                      >
                        {user ? (
                          <DropdownMenuLabel className="truncate px-3 py-2.5 font-normal">
                            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                              Signed in as
                            </span>
                            <span className="block text-sm font-semibold">{user.email}</span>
                          </DropdownMenuLabel>
                        ) : (
                          <div className="flex flex-col gap-2 px-2 py-3">
                            <Button
                              asChild
                              className="w-full rounded-xl text-[14px] font-semibold"
                            >
                              <Link
                                to="/auth"
                                search={{ mode: "signup" }}
                                onClick={() => setMenuOpen(false)}
                              >
                                Get started
                              </Link>
                            </Button>
                            <Button
                              asChild
                              variant="outline"
                              className="w-full rounded-xl border-border/70 text-[14px]"
                            >
                              <Link to="/auth" onClick={() => setMenuOpen(false)}>
                                Log in
                              </Link>
                            </Button>
                            <Button
                              asChild
                              variant="ghost"
                              className="w-full justify-center rounded-xl text-[13px] font-medium text-muted-foreground"
                            >
                              <Link to="/my-tickets" onClick={() => setMenuOpen(false)}>
                                <TicketIcon className="mr-2 h-4 w-4" aria-hidden />
                                Find my tickets
                              </Link>
                            </Button>
                          </div>
                        )}

                        {/* Nav Links (hidden on desktop where they are visible in top bar) */}
                        <div className="xl:hidden">
                          {user && <DropdownMenuSeparator className="mx-2 bg-border/60" />}
                          {links
                            .filter((link) => link.name !== "Dashboard")
                            .map((link) => (
                              <DropdownMenuItem
                                asChild
                                key={link.to}
                                className="cursor-pointer rounded-lg px-3 py-2.5 focus:bg-secondary"
                              >
                                <Link to={link.to} onClick={() => setMenuOpen(false)}>
                                  <link.icon
                                    className="mr-3 h-4 w-4 shrink-0 text-muted-foreground"
                                    aria-hidden
                                  />
                                  <span className="text-[13px] font-medium">{link.name}</span>
                                </Link>
                              </DropdownMenuItem>
                            ))}
                        </div>

                        {user && (
                          <>
                            <DropdownMenuSeparator className="mx-2 bg-border/60" />
                            <DropdownMenuItem
                              asChild
                              className="cursor-pointer rounded-lg px-3 py-2.5 focus:bg-secondary"
                            >
                              <Link to="/tickets" onClick={() => setMenuOpen(false)}>
                                <TicketIcon
                                  className="mr-3 h-4 w-4 shrink-0 text-muted-foreground"
                                  aria-hidden
                                />
                                <span className="text-[13px] font-medium">My Tickets</span>
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              asChild
                              className="cursor-pointer rounded-lg px-3 py-2.5 focus:bg-secondary"
                            >
                              <Link to="/dashboard" onClick={() => setMenuOpen(false)}>
                                <LayoutDashboard
                                  className="mr-3 h-4 w-4 shrink-0 text-muted-foreground"
                                  aria-hidden
                                />
                                <span className="text-[13px] font-medium">Dashboard</span>
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              asChild
                              className="cursor-pointer rounded-lg px-3 py-2.5 focus:bg-secondary"
                            >
                              <Link to="/account" onClick={() => setMenuOpen(false)}>
                                <UserIcon
                                  className="mr-3 h-4 w-4 shrink-0 text-muted-foreground"
                                  aria-hidden
                                />
                                <span className="text-[13px] font-medium">Account Settings</span>
                              </Link>
                            </DropdownMenuItem>
                            {(isCustomerCare || isAdmin) && (
                              <DropdownMenuItem
                                asChild
                                className="cursor-pointer rounded-lg px-3 py-2.5 focus:bg-secondary"
                              >
                                <Link to="/support" onClick={() => setMenuOpen(false)}>
                                  <Headset
                                    className="mr-3 h-4 w-4 shrink-0 text-muted-foreground"
                                    aria-hidden
                                  />
                                  <span className="text-[13px] font-medium">Support Portal</span>
                                </Link>
                              </DropdownMenuItem>
                            )}
                            {isAdmin && (
                              <DropdownMenuItem
                                asChild
                                className="cursor-pointer rounded-lg px-3 py-2.5 focus:bg-secondary"
                              >
                                <Link to="/admin" onClick={() => setMenuOpen(false)}>
                                  <ShieldCheck
                                    className="mr-3 h-4 w-4 shrink-0 text-muted-foreground"
                                    aria-hidden
                                  />
                                  <span className="text-[13px] font-medium">Admin Panel</span>
                                </Link>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator className="mx-2 bg-border/60" />
                            <DropdownMenuItem
                              onClick={() => {
                                setMenuOpen(false);
                                handleSignOut();
                              }}
                              className="cursor-pointer rounded-lg px-3 py-2.5 text-destructive focus:bg-destructive/10 focus:text-destructive"
                            >
                              <LogOut className="mr-3 h-4 w-4 shrink-0" aria-hidden />
                              <span className="text-[13px] font-medium">Sign out</span>
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

