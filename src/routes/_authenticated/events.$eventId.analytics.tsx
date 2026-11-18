import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/currency";
import { BackButton } from "@/components/back-button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { Loader2, Eye, Ticket, TrendingUp, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/events/$eventId/analytics")({
  component: EventAnalyticsPage,
});

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#a855f7"];

async function fetchEventAnalytics(eventId: string) {
  // 1. Fetch event details
  const { data: event } = await supabase
    .from("events")
    .select("title, status")
    .eq("id", eventId)
    .single();

  if (!event) throw new Error("Event not found");

  // 2. Fetch page views
  // Present in the database, missing from the stale generated `types.ts`.
  const { count: pageViews } = await (supabase as any)
    .from("event_page_views")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId);

  // 3. Fetch orders
  const { data: orders } = await supabase
    .from("orders")
    .select("created_at, total_kobo, status")
    .eq("event_id", eventId)
    .eq("status", "paid");

  // 4. Fetch ticket types
  const { data: ticketTypes } = await supabase
    .from("ticket_types")
    .select("id, name, quantity_sold, price_kobo")
    .eq("event_id", eventId);

  // Process data for charts
  let totalRevenueKobo = 0;
  let totalTicketsSold = 0;
  
  const salesByDate: Record<string, number> = {};
  
  (orders || []).forEach(o => {
    totalRevenueKobo += o.total_kobo || 0;
    const date = new Date(o.created_at).toLocaleDateString();
    salesByDate[date] = (salesByDate[date] || 0) + (o.total_kobo || 0);
  });

  const timelineData = Object.entries(salesByDate)
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .map(([date, amount]) => ({
      date,
      revenue: amount / 100 // Convert to Naira for chart readability
    }));

  const ticketTypeData = (ticketTypes || [])
    .filter(t => t.quantity_sold > 0)
    .map(t => {
      totalTicketsSold += t.quantity_sold;
      return {
        name: t.name,
        value: t.quantity_sold,
      };
    });

  return {
    event,
    pageViews: pageViews || 0,
    totalRevenueKobo,
    totalTicketsSold,
    timelineData,
    ticketTypeData,
    conversionRate: pageViews ? ((orders?.length || 0) / pageViews) * 100 : 0
  };
}

function EventAnalyticsPage() {
  const { eventId } = Route.useParams();
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["event-analytics", eventId],
    queryFn: () => fetchEventAnalytics(eventId),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center text-destructive">
        Failed to load analytics: {(error as Error)?.message}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 mb-2">
        <BackButton />
        <h1 className="font-display text-3xl md:text-4xl">{data.event.title} - Analytics</h1>
      </div>
      <p className="text-muted-foreground mb-8">Detailed insights and performance metrics for your event.</p>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3 text-muted-foreground mb-4">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <TrendingUp className="h-5 w-5" />
            </div>
            <h3 className="font-medium text-sm">Gross Revenue</h3>
          </div>
          <p className="text-2xl font-display font-bold">{formatNaira(data.totalRevenueKobo)}</p>
        </div>
        
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3 text-muted-foreground mb-4">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
              <Ticket className="h-5 w-5" />
            </div>
            <h3 className="font-medium text-sm">Tickets Sold</h3>
          </div>
          <p className="text-2xl font-display font-bold">{data.totalTicketsSold}</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3 text-muted-foreground mb-4">
            <div className="p-2 rounded-lg bg-green-500/10 text-green-500">
              <Eye className="h-5 w-5" />
            </div>
            <h3 className="font-medium text-sm">Page Views</h3>
          </div>
          <p className="text-2xl font-display font-bold">{data.pageViews}</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3 text-muted-foreground mb-4">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="font-medium text-sm">Conversion Rate</h3>
          </div>
          <p className="text-2xl font-display font-bold">{data.conversionRate.toFixed(1)}%</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Sales Timeline Chart */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="font-semibold text-lg mb-6">Revenue Over Time</h3>
          {data.timelineData.length > 0 ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.timelineData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <Line type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} tickMargin={10} stroke="#888888" />
                  <YAxis 
                    tickFormatter={(value) => `₦${value.toLocaleString()}`} 
                    tick={{ fontSize: 12 }} 
                    stroke="#888888" 
                    width={80}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`₦${value.toLocaleString()}`, 'Revenue']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Not enough data yet.
            </div>
          )}
        </div>

        {/* Ticket Breakdown Chart */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="font-semibold text-lg mb-6">Ticket Breakdown</h3>
          {data.ticketTypeData.length > 0 ? (
            <div className="h-[300px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.ticketTypeData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {data.ticketTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                     formatter={(value: number, name: string) => [`${value} tickets`, name]}
                     contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                <p className="text-3xl font-bold">{data.totalTicketsSold}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No tickets sold yet.
            </div>
          )}
          
          {data.ticketTypeData.length > 0 && (
             <div className="mt-4 space-y-2">
               {data.ticketTypeData.map((t, i) => (
                 <div key={t.name} className="flex items-center justify-between text-sm">
                   <div className="flex items-center gap-2">
                     <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                     <span>{t.name}</span>
                   </div>
                   <span className="font-semibold">{t.value}</span>
                 </div>
               ))}
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
