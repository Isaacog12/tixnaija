import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LogOut, LayoutDashboard, User as UserIcon, Mail, Ticket as TicketIcon, Menu } from "lucide-react";
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
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export function SiteNav() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  // Fetch unread count if user is logged in
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread-messages"],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from("messages" as any)
        .select("*", { count: "exact", head: true })
        .eq("is_read", false);
      if (error) return 0;
      return count ?? 0;
    },
    enabled: !!user,
  });

  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  
  const links = [
    { name: "Discover", to: "/" },
    { name: "Browse", to: "/browse" },
    ...(user ? [
      { name: "Tickets", to: "/tickets" },
      { name: "Dashboard", to: "/dashboard" },
    ] : []),
    { name: "How it works", to: "/how-it-works" },
    { name: "Contact", to: "/contact" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/70 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/50">
      <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link to="/" className="group relative flex items-baseline mr-2">
            <span className="font-display text-4xl leading-none tracking-wider text-foreground">
              TIX
            </span>
            <span className="font-display text-4xl leading-none tracking-wider font-light text-gradient-sunset">
              NAIJA
            </span>
            <span
              aria-hidden
              className="absolute -bottom-1 left-0 h-[3px] w-8 gradient-sunset rounded-full transition-all duration-500 ease-out group-hover:w-full shadow-[0_0_10px_rgba(234,88,12,0.5)]"
            />
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onMouseEnter={() => setHoveredPath(link.to)}
                onMouseLeave={() => setHoveredPath(null)}
                className="relative px-4 py-2.5 text-sm font-medium transition-colors hover:text-foreground text-muted-foreground z-10"
                activeProps={{ className: "text-foreground font-semibold" }}
              >
                <span className="relative z-10">{link.name}</span>
                {hoveredPath === link.to && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-secondary/80 -z-10"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {loading ? null : user ? (
            <div className="flex items-center gap-3">
              <Button asChild variant="ghost" size="icon" className="relative rounded-full h-11 w-11 hover:bg-secondary/80 transition-colors">
                <Link to="/inbox">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <AnimatePresence>
                    {unreadCount > 0 && (
                      <motion.span 
                        initial={{ scale: 0 }} 
                        animate={{ scale: 1 }} 
                        exit={{ scale: 0 }}
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground border-2 border-background shadow-sm"
                      >
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-3 rounded-full pl-2 pr-4 hover:bg-secondary/80 h-11 border border-transparent hover:border-border/50 transition-all">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {(user.email ?? "?").slice(0, 1).toUpperCase()}
                    </span>
                    <span className="hidden max-w-[160px] truncate text-sm md:inline font-semibold">{user.email}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 rounded-2xl shadow-xl border-border/50 p-2">
                  <DropdownMenuLabel className="truncate font-normal px-3 py-2.5">
                    <span className="block text-xs text-muted-foreground font-medium mb-1">Signed in as</span>
                    <span className="block text-sm font-semibold">{user.email}</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="mx-2" />
                  <DropdownMenuItem asChild className="cursor-pointer rounded-xl px-3 py-2.5 focus:bg-secondary">
                    <Link to="/tickets">
                      <TicketIcon className="mr-3 h-4 w-4 text-muted-foreground" /> 
                      <span className="font-medium">My Tickets</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer rounded-xl px-3 py-2.5 focus:bg-secondary">
                    <Link to="/dashboard">
                      <LayoutDashboard className="mr-3 h-4 w-4 text-muted-foreground" /> 
                      <span className="font-medium">Dashboard</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer rounded-xl px-3 py-2.5 focus:bg-secondary">
                    <Link to="/account">
                      <UserIcon className="mr-3 h-4 w-4 text-muted-foreground" /> 
                      <span className="font-medium">Account Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="mx-2" />
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer rounded-xl px-3 py-2.5 text-destructive focus:text-destructive focus:bg-destructive/10">
                    <LogOut className="mr-3 h-4 w-4" /> 
                    <span className="font-medium">Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Button asChild variant="ghost" className="hidden sm:flex rounded-full hover:bg-secondary/80 font-medium px-6 h-11">
                <Link to="/auth">Log in</Link>
              </Button>
              <Button asChild className="rounded-full gradient-sunset text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all font-semibold px-7 h-11">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Get started
                </Link>
              </Button>
            </div>
          )}

          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden rounded-full h-11 w-11 border-border/60 bg-background/50 backdrop-blur-md">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:w-[400px] border-l-border/50 p-0">
              <div className="flex flex-col h-full bg-background/95 backdrop-blur-2xl">
                <div className="p-6 pb-2 border-b border-border/40">
                  <Link to="/" className="group relative flex items-baseline w-fit">
                    <span className="font-display text-4xl leading-none tracking-wide text-foreground">
                      TIX
                    </span>
                    <span className="font-display text-4xl leading-none tracking-wide font-light text-gradient-sunset">
                      NAIJA
                    </span>
                  </Link>
                </div>
                
                <div className="flex-1 overflow-y-auto px-4 py-6">
                  <nav className="flex flex-col gap-2">
                    {links.map((link) => (
                      <Link 
                        key={link.to}
                        to={link.to} 
                        className="flex items-center px-4 py-4 rounded-2xl text-lg font-medium text-muted-foreground transition-all active:scale-95" 
                        activeProps={{ className: "text-foreground bg-secondary/80 font-semibold" }}
                      >
                        {link.name}
                      </Link>
                    ))}
                  </nav>
                </div>
                
                {!user && (
                  <div className="p-6 border-t border-border/40 bg-card/50">
                    <div className="flex flex-col gap-3">
                      <Button asChild className="w-full justify-center h-12 rounded-full gradient-sunset text-lg font-semibold shadow-lg shadow-primary/25">
                         <Link to="/auth" search={{ mode: "signup" }}>Sign up free</Link>
                      </Button>
                      <Button asChild variant="outline" className="w-full justify-center h-12 rounded-full text-lg font-medium border-border/60">
                        <Link to="/auth">Log in</Link>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
