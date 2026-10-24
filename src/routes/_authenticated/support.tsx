import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
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
  ChevronRight,
  LogOut,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SupportOverviewTab } from "@/components/support/SupportOverviewTab";
import { SupportLookupTab } from "@/components/support/SupportLookupTab";
import { SupportOrdersTab } from "@/components/support/SupportOrdersTab";
import { SupportRefundsTab } from "@/components/support/SupportRefundsTab";
import { SupportCasesTab } from "@/components/support/SupportCasesTab";
import { SupportEventsTab } from "@/components/support/SupportEventsTab";
import { SupportMacrosTab } from "@/components/support/SupportMacrosTab";

export const Route = createFileRoute("/_authenticated/support" as any)({
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

const NAV_ITEMS: { key: TabKey; label: string; icon: any; description: string }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard, description: "Daily snapshot & queues" },
  { key: "lookup", label: "Universal Lookup", icon: Search, description: "Search email, phone, tickets" },
  { key: "orders", label: "Orders & Tickets", icon: ShoppingBag, description: "Deliveries & resends" },
  { key: "refunds", label: "Refund Requests", icon: RotateCcw, description: "Triage & recommendations" },
  { key: "cases", label: "Support Cases", icon: Inbox, description: "Inquiries & message thread" },
  { key: "events", label: "Events Directory", icon: Calendar, description: "Read-only event index" },
  { key: "macros", label: "Canned Macros", icon: BookOpen, description: "Standardized templates" },
];

function SupportPortal() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [lookupQuery, setLookupQuery] = useState<string>("");
  const [targetOrderId, setTargetOrderId] = useState<string | null>(null);
  const [targetCaseId, setTargetCaseId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sync with window location search params if present
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab") as TabKey;
      if (tabParam && NAV_ITEMS.some((n) => n.key === tabParam)) {
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

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Desktop Sidebar Navigation */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border/60 bg-card/30 p-4 shrink-0 justify-between">
        <div className="space-y-6">
          {/* Support Branding */}
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="h-9 w-9 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-foreground">Support Portal</div>
              <div className="text-[11px] text-muted-foreground">TixNaija Customer Care</div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => handleSelectTab(item.key)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? "bg-emerald-600/15 text-emerald-400 font-semibold border border-emerald-500/20"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`h-4 w-4 ${isActive ? "text-emerald-400" : "text-muted-foreground"}`} />
                    <span>{item.label}</span>
                  </div>
                  {isActive && <ChevronRight className="h-3.5 w-3.5 text-emerald-400" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="pt-4 border-t border-border/40 space-y-2">
          <div className="p-3 rounded-xl bg-secondary/30 border border-border/30 text-[11px] text-muted-foreground space-y-1">
            <div className="font-semibold text-foreground flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              Audited Session
            </div>
            <p className="text-[10px] leading-tight">
              All lookups and ticket resends are strictly logged for compliance with NDPA regulations.
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/dashboard" })}
            className="w-full justify-start text-xs text-muted-foreground hover:text-foreground rounded-xl"
          >
            ← Return to Dashboard
          </Button>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border/60 bg-card/40 backdrop-blur sticky top-0 z-20">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <div className="font-bold text-xs text-foreground">Support Portal</div>
            <div className="text-[10px] text-muted-foreground">
              {NAV_ITEMS.find((n) => n.key === activeTab)?.label}
            </div>
          </div>
        </div>

        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-4 flex flex-col justify-between">
            <div className="space-y-6 pt-4">
              <div className="flex items-center gap-3 px-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-bold text-sm text-foreground">Support Portal</div>
                  <div className="text-[11px] text-muted-foreground">TixNaija Care</div>
                </div>
              </div>

              <nav className="space-y-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => handleSelectTab(item.key)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                        isActive
                          ? "bg-emerald-600/15 text-emerald-400 font-semibold border border-emerald-500/20"
                          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`h-4 w-4 ${isActive ? "text-emerald-400" : "text-muted-foreground"}`} />
                        <span>{item.label}</span>
                      </div>
                      {isActive && <ChevronRight className="h-3.5 w-3.5 text-emerald-400" />}
                    </button>
                  );
                })}
              </nav>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMobileMenuOpen(false);
                navigate({ to: "/dashboard" });
              }}
              className="w-full text-xs rounded-xl"
            >
              Return to Dashboard
            </Button>
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Support Working Surface */}
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
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
  );
}
