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

  const NavLinks = () => (
    <>
      <Link to="/" className="text-sm font-medium text-muted-foreground transition-all hover:text-foreground px-3 py-2 rounded-md hover:bg-accent/40" activeProps={{ className: "text-foreground bg-accent/40" }}>
        Discover
      </Link>
      <Link to="/browse" className="text-sm font-medium text-muted-foreground transition-all hover:text-foreground px-3 py-2 rounded-md hover:bg-accent/40" activeProps={{ className: "text-foreground bg-accent/40" }}>
        Browse
      </Link>
      {user && (
        <>
          <Link to="/tickets" className="text-sm font-medium text-muted-foreground transition-all hover:text-foreground px-3 py-2 rounded-md hover:bg-accent/40" activeProps={{ className: "text-foreground bg-accent/40" }}>
            Tickets
          </Link>
          <Link to="/dashboard" className="text-sm font-medium text-muted-foreground transition-all hover:text-foreground px-3 py-2 rounded-md hover:bg-accent/40" activeProps={{ className: "text-foreground bg-accent/40" }}>
            Dashboard
          </Link>
        </>
      )}
      <Link to="/how-it-works" className="text-sm font-medium text-muted-foreground transition-all hover:text-foreground px-3 py-2 rounded-md hover:bg-accent/40" activeProps={{ className: "text-foreground bg-accent/40" }}>
        How it works
      </Link>
      <Link to="/contact" className="text-sm font-medium text-muted-foreground transition-all hover:text-foreground px-3 py-2 rounded-md hover:bg-accent/40" activeProps={{ className: "text-foreground bg-accent/40" }}>
        Contact
      </Link>
    </>
  );

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link to="/" className="group relative flex items-baseline mr-4">
            <span className="font-display text-3xl leading-none tracking-wide text-foreground">
              TIX
            </span>
            <span className="font-display text-3xl leading-none tracking-wide font-light text-gradient-sunset">
              NAIJA
            </span>
            <span
              aria-hidden
              className="absolute -bottom-1 left-0 h-[2px] w-8 gradient-sunset transition-all duration-300 group-hover:w-full"
            />
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <NavLinks />
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {loading ? null : user ? (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="icon" className="relative rounded-full h-9 w-9 hover:bg-accent/40">
                <Link to="/inbox">
                  <Mail className="h-[18px] w-[18px] text-muted-foreground" />
                  {unreadCount > 0 && (
                    <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground border-2 border-background">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 rounded-full pl-2 pr-3 hover:bg-accent/40 h-9">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {(user.email ?? "?").slice(0, 1).toUpperCase()}
                    </span>
                    <span className="hidden max-w-[140px] truncate text-sm md:inline font-medium">{user.email}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-lg border-border/50">
                  <DropdownMenuLabel className="truncate font-normal">
                    <span className="block text-xs text-muted-foreground">Signed in as</span>
                    <span className="block text-sm font-medium">{user.email}</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="cursor-pointer rounded-md">
                    <Link to="/tickets">
                      <TicketIcon className="mr-2 h-4 w-4 text-muted-foreground" /> Tickets
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer rounded-md">
                    <Link to="/dashboard">
                      <LayoutDashboard className="mr-2 h-4 w-4 text-muted-foreground" /> Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer rounded-md">
                    <Link to="/account">
                      <UserIcon className="mr-2 h-4 w-4 text-muted-foreground" /> Account Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer rounded-md text-destructive focus:text-destructive focus:bg-destructive/10">
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm" className="hidden sm:flex rounded-full hover:bg-accent/40 font-medium">
                <Link to="/auth">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="rounded-full gradient-sunset text-primary-foreground shadow-glow hover:opacity-90 font-semibold px-5">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Get started
                </Link>
              </Button>
            </div>
          )}

          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden rounded-full h-9 w-9">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[350px] pr-0">
              <div className="flex flex-col gap-6 pt-6 pb-8 h-full overflow-y-auto pr-6">
                <Link to="/" className="group relative flex items-baseline w-fit">
                  <span className="font-display text-3xl leading-none tracking-wide text-foreground">
                    TIX
                  </span>
                  <span className="font-display text-3xl leading-none tracking-wide font-light text-gradient-sunset">
                    NAIJA
                  </span>
                </Link>
                <nav className="flex flex-col gap-2">
                  <NavLinks />
                </nav>
                {!user && (
                  <div className="flex flex-col gap-2 mt-auto">
                    <Button asChild variant="outline" className="w-full justify-center">
                      <Link to="/auth">Sign in</Link>
                    </Button>
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
