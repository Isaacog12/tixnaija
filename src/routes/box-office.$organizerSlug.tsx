import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, MapPin } from "lucide-react";
import { formatNaira } from "@/lib/currency";

export const Route = createFileRoute("/box-office/$organizerSlug")({
  component: BoxOfficePage,
  loader: async ({ params }) => {
    // Fetch profile
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("organizer_slug", params.organizerSlug)
      .single();

    if (profileErr || !profile) {
      throw new Error("Organizer not found");
    }

    // Fetch events
    const { data: events, error: eventsErr } = await supabase
      .from("events")
      .select("id, title, slug, city, venue_name, start_datetime, end_datetime, cover_image_url, category, ticket_types(price_kobo)")
      .eq("organizer_id", profile.id)
      .eq("status", "published")
      .order("start_datetime", { ascending: true });

    if (eventsErr) throw eventsErr;

    return { profile, events };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Box Office - TixNaija" }] };
    return {
      meta: [
        { title: `${loaderData.profile.full_name} Tickets & Events — TixNaija` },
        { name: "description", content: loaderData.profile.bio || `Buy tickets for events organized by ${loaderData.profile.full_name}.` },
      ]
    };
  }
});

function BoxOfficePage() {
  const { profile, events } = Route.useLoaderData();

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <SiteNav />
      <div className="flex-1 pb-20">
        {/* Banner */}
        <div className="w-full h-48 md:h-64 bg-muted relative">
          {profile.banner_url ? (
            <img src={profile.banner_url} alt="Banner" className="w-full h-full object-cover" />
          ) : (
             <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/5" />
          )}
        </div>
        
        {/* Profile Info */}
        <div className="mx-auto max-w-5xl px-4 relative -mt-16 sm:-mt-20">
          <Avatar className="w-32 h-32 sm:w-40 sm:h-40 border-4 border-background shadow-lg bg-card">
            <AvatarImage src={profile.avatar_url || undefined} />
            <AvatarFallback className="text-4xl">{profile.full_name?.charAt(0).toUpperCase() || "O"}</AvatarFallback>
          </Avatar>
          
          <div className="mt-4 max-w-2xl">
            <h1 className="text-3xl sm:text-4xl font-display font-bold">{profile.full_name}</h1>
            {profile.bio && <p className="text-muted-foreground mt-2 text-lg">{profile.bio}</p>}
          </div>
        </div>

        {/* Events Grid */}
        <div className="mx-auto max-w-5xl px-4 mt-12">
          <h2 className="text-2xl font-bold mb-6">Upcoming Events</h2>
          {events && events.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((ev: any) => {
                const minPrice = ev.ticket_types?.length ? Math.min(...ev.ticket_types.map((t: any) => t.price_kobo)) : 0;
                return (
                  <Link
                    key={ev.id}
                    to="/e/$slug"
                    params={{ slug: ev.slug }}
                    className="group flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card hover:border-primary/40 hover:shadow-lg transition-all"
                  >
                    <div className="aspect-[4/3] bg-muted overflow-hidden relative">
                      {ev.cover_image_url ? (
                        <img src={ev.cover_image_url} alt={ev.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full bg-primary/10" />
                      )}
                      <div className="absolute top-3 right-3 bg-background/90 backdrop-blur text-xs font-semibold px-2 py-1 rounded-md shadow-sm">
                        {minPrice > 0 ? formatNaira(minPrice) : "Free"}
                      </div>
                    </div>
                    <div className="p-4 flex flex-col flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">{ev.category || "Event"}</p>
                      <h3 className="font-bold text-lg leading-tight mb-2 line-clamp-2">{ev.title}</h3>
                      <div className="mt-auto space-y-1.5 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 shrink-0" />
                          <span className="truncate">
                            {new Date(ev.start_datetime).toLocaleDateString("en-NG", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 shrink-0" />
                          <span className="truncate">{ev.city || ev.venue_name || "TBA"}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20 bg-muted/30 rounded-xl border border-border/50">
              <p className="text-muted-foreground text-lg">No upcoming events right now.</p>
            </div>
          )}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
