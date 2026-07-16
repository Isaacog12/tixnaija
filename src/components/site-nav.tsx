import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LogOut, LayoutDashboard, User as UserIcon, Mail } from "lucide-react";
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

  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <Link to="/" className="group relative flex items-baseline">
          <span className="font-display text-3xl leading-none tracking-[0.02em] text-foreground">
            TIX
          </span>
          <span className="font-display text-3xl leading-none tracking-[0.02em] font-light text-gradient-sunset">
            NAIJA
          </span>
          <span
            aria-hidden
            className="absolute -bottom-1 left-0 h-[2px] w-8 gradient-sunset transition-all duration-300 group-hover:w-full"
          />
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link to="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Discover
          </Link>
          <Link to="/browse" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Browse events
          </Link>
          <Link to="/how-it-works" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            How it works
          </Link>
          {user && (
            <Link to="/dashboard" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Dashboard
            </Link>
          )}
          <Link to="/contact" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Contact
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {loading ? null : user ? (
            <div className="flex items-center">
              <Button asChild variant="ghost" size="icon" className="relative mr-2">
                <Link to="/inbox">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  {unreadCount > 0 && (
                    <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                      {(user.email ?? "?").slice(0, 1).toUpperCase()}
                    </span>
                    <span className="hidden max-w-[140px] truncate text-sm md:inline">{user.email}</span>
                  </Button>
                </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/dashboard">
                    <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/account">
                    <UserIcon className="mr-2 h-4 w-4" /> Account
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link to="/auth">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="gradient-sunset text-primary-foreground shadow-glow hover:opacity-90">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Get started
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
