import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import type { ComponentType } from "react";
import {
  LayoutDashboard,
  Search,
  ShoppingBag,
  RotateCcw,
  Inbox,
  Calendar,
  BookOpen,
  ShieldCheck,
  Menu,
  ArrowLeft,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SupportOverviewTab } from "@/components/support/SupportOverviewTab";
import { SupportLookupTab } from "@/components/support/SupportLookupTab";
import { SupportOrdersTab } from "@/components/support/SupportOrdersTab";
import { SupportRefundsTab } from "@/components/support/SupportRefundsTab";
import { SupportCasesTab } from "@/components/support/SupportCasesTab";
import { SupportEventsTab } from "@/components/support/SupportEventsTab";
import { SupportMacrosTab } from "@/components/support/SupportMacrosTab";

export const Route = createFileRoute("/_authenticated/support")({
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });

    const { data: staffRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .in("role", ["customer_care", "admin"]);

    if (!staffRoles || staffRoles.length === 0) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: SupportPortal,
});

type TabKey = "overview" | "lookup" | "orders" | "refunds" | "cases" | "events" | "macros";

interface NavItem {
  key: TabKey;
  label: string;
  icon: ComponentType<{ className?: string }>;
  description: string;
}

/**
 * Grouped by what the agent is doing, not by which table the data lives in.
 * A flat list of seven equally-weighted tabs gave no clue where to start a
 * shift; "Queues" is the work, "Records" is what you consult mid-call, "Tools"
 * is for configuring the console itself.
 */
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Queues",
    items: [
      {
        key: "overview",
        label: "Overview",
        icon: LayoutDashboard,
        description: "Today's snapshot and payment exceptions",
      },
      {
        key: "cases",
        label: "Cases",
        icon: Inbox,
        description: "Customer inquiries and message threads",
      },
      {
        key: "refunds",
        label: "Refunds",
        icon: RotateCcw,
        description: "Requests awaiting a recommendation",
      },
    ],
  },
  {
    label: "Records",
    items: [
      {
        key: "lookup",
        label: "Lookup",
        icon: Search,
        description: "Find a buyer by email, phone or ticket",
      },
      {
        key: "orders",
        label: "Orders & Tickets",
        icon: ShoppingBag,
        description: "Deliveries, resends and order edits",
      },
      {
        key: "events",
        label: "Events",
        icon: Calendar,
        description: "Read-only schedule and venue index",
      },
    ],
  },
  {
    label: "Tools",
    items: [
      {
        key: "macros",
        label: "Macros",
        icon: BookOpen,
        description: "Standard replies and templates",
      },
    ],
  },
];

const ALL_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

function findItem(tab: TabKey): NavItem {
  return ALL_ITEMS.find((item) => item.key === tab) ?? ALL_ITEMS[0];
}

function SupportNavList({
  activeTab,
  onSelect,
}: {
  activeTab: TabKey;
  onSelect: (tab: TabKey) => void;
}) {
  return (
    <nav className="space-y-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="space-y-1">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
            {group.label}
          </p>
          {group.items.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelect(item.key)}
                aria-current={isActive ? "page" : undefined}
                className={`flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive
                    ? "bg-emerald-500/10 text-foreground ring-1 ring-inset ring-emerald-500/30"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                }`}
              >
                <Icon
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    isActive ? "text-emerald-500" : "text-muted-foreground"
                  }`}
                />
                <span className="min-w-0">
                  <span
                    className={`block text-xs leading-tight ${
                      isActive ? "font-semibold" : "font-medium"
                    }`}
                  >
                    {item.label}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] leading-tight text-muted-foreground">
                    {item.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function SupportPortal() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [lookupQuery, setLookupQuery] = useState<string>("");
  const [targetOrderId, setTargetOrderId] = useState<string | null>(null);
  const [targetCaseId, setTargetCaseId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [agentEmail, setAgentEmail] = useState<string>("");
  const [search, setSearch] = useState("");

  // Sync with window location search params if present
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab") as TabKey;
      if (tabParam && ALL_ITEMS.some((n) => n.key === tabParam)) {
        setActiveTab(tabParam);
      }
      const qParam = params.get("q");
      if (qParam) setLookupQuery(qParam);
      const orderParam = params.get("orderId");
      if (orderParam) setTargetOrderId(orderParam);
      const caseParam = params.get("caseId");
      if (caseParam) setTargetCaseId(caseParam);
    }
  }, []);

  // Who is working the console. Every action here is audited, so the screen
  // should say whose name the audit trail will carry.
  useEffect(() => {
    let cancelled = false;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!cancelled) setAgentEmail(data.user?.email ?? "");
      })
      .catch(() => {
        // Identity is a convenience label here; the guard in beforeLoad is what
        // actually controls access.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectTab = (tab: TabKey, param?: string) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);

    if (tab === "lookup" && param) {
      setLookupQuery(param);
    }
    if (tab === "orders" && param) {
      setTargetOrderId(param);
    }
    if (tab === "cases" && param) {
      setTargetCaseId(param);
    }

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      if (param && tab === "lookup") url.searchParams.set("q", param);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const handleOpenOrder = (orderId: string) => {
    setTargetOrderId(orderId);
    setActiveTab("orders");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "orders");
      url.searchParams.set("orderId", orderId);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const handleOpenCase = (caseId: string) => {
    setTargetCaseId(caseId);
    setActiveTab("cases");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "cases");
      url.searchParams.set("caseId", caseId);
      window.history.replaceState({}, "", url.toString());
    }
  };

  /**
   * One search box for the whole console. It routes into Universal Lookup —
   * the only place that runs the audited, rate-limited query — rather than
   * becoming a second query path that could drift from it.
   */
  const submitSearch = () => {
    const value = search.trim();
    if (value.length < 3) return;
    setSearch("");
    handleSelectTab("lookup", value);
  };

  const current = findItem(activeTab);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop Sidebar Navigation */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border/60 bg-card/40 p-4 md:flex">
        {/*
          The nav scrolls independently and the session footer stays pinned.
          With `justify-between` the two blocks shared one non-scrolling column,
          so on a short laptop screen the signed-in footer was pushed past the
          bottom edge and the scrolling happened on the page behind it.
        */}
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
          <div className="flex items-center gap-3 px-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-foreground">Support Console</div>
              <div className="truncate text-[11px] text-muted-foreground">TixNaija Customer Care</div>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitSearch();
              }}
              placeholder="Email, phone or ticket code"
              aria-label="Search customers"
              className="h-9 rounded-xl pl-8 text-xs"
            />
          </div>

          <SupportNavList activeTab={activeTab} onSelect={handleSelectTab} />
        </div>

        <div className="shrink-0 space-y-2 border-t border-border/40 pt-4">
          <div className="rounded-xl border border-border/40 bg-secondary/30 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              Audited session
            </p>
            <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
              Lookups, resends and refund notes are logged for NDPA compliance.
            </p>
            {agentEmail && (
              <p className="mt-2 truncate border-t border-border/40 pt-2 text-[10px] text-muted-foreground">
                Signed in as <span className="text-foreground">{agentEmail}</span>
              </p>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/dashboard" })}
            className="w-full justify-start gap-2 rounded-xl text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to dashboard
          </Button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col md:pl-64">
        {/* Top bar: where you are, one search, and the mobile menu. */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur md:px-8">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open navigation</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-72 flex-col justify-between p-4">
              <div className="space-y-5 pt-4">
                <div className="flex items-center gap-3 px-1">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-foreground">Support Console</div>
                    <div className="text-[11px] text-muted-foreground">{current.label}</div>
                  </div>
                </div>
                <SupportNavList activeTab={activeTab} onSelect={handleSelectTab} />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate({ to: "/dashboard" });
                }}
                className="w-full rounded-xl text-xs"
              >
                Back to dashboard
              </Button>
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Support
            </p>
            <h1 className="truncate text-sm font-semibold leading-tight text-foreground">
              {current.label}
            </h1>
          </div>

          {/*
            Only below `md`, where the sidebar (and its search box) is hidden.
            Both were rendering at `lg` and up, bound to the same state, so
            desktop showed two identical fields side by side.
          */}
          <div className="relative w-40 sm:w-64 md:hidden">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitSearch();
              }}
              placeholder="Email, phone or ticket"
              aria-label="Search customers"
              className="h-9 rounded-xl pl-8 text-xs"
            />
          </div>

          {agentEmail && (
            <span className="hidden max-w-[14rem] truncate rounded-full border border-border/60 px-3 py-1 text-[11px] text-muted-foreground sm:block">
              {agentEmail}
            </span>
          )}
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">
          {activeTab === "overview" && (
            <SupportOverviewTab onNavigateTab={(tab, param) => handleSelectTab(tab as TabKey, param)} />
          )}

          {activeTab === "lookup" && (
            <SupportLookupTab
              initialQuery={lookupQuery}
              onOpenOrder={handleOpenOrder}
              onOpenCase={handleOpenCase}
            />
          )}

          {activeTab === "orders" && (
            <SupportOrdersTab
              initialOrderId={targetOrderId}
              onClearInitialOrder={() => setTargetOrderId(null)}
            />
          )}

          {activeTab === "refunds" && <SupportRefundsTab />}

          {activeTab === "cases" && (
            <SupportCasesTab
              initialCaseId={targetCaseId}
              onOpenOrder={handleOpenOrder}
              onClearInitialCase={() => setTargetCaseId(null)}
            />
          )}

          {activeTab === "events" && <SupportEventsTab />}

          {activeTab === "macros" && <SupportMacrosTab />}
        </main>
      </div>
    </div>
  );
}
