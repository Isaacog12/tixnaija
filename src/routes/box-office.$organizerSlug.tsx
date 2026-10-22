import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, MapPin, BadgeCheck } from "lucide-react";
import { formatNaira } from "@/lib/currency";

export const Route = createFileRoute("/box-office/$organizerSlug")({
  component: BoxOfficePage,
  loader: async ({ params }) => {
    const rawParam = params.organizerSlug.trim();
    const lowerParam = rawParam.toLowerCase();

    // Check if it's a UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawParam);

    let query = supabase.from("profiles").select("*");
    if (isUuid) {
      query = query.or(`organizer_slug.eq.${lowerParam},id.eq.${rawParam}`);
    } else {
      query = query.or(`organizer_slug.eq.${lowerParam},username.eq.${lowerParam}`);
    }

    const { data: profile, error: profileErr } = await query.maybeSingle();

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
    const name = loaderData.profile.full_name || loaderData.profile.username || "Organizer";
    return {
      meta: [
        { title: `${name} Tickets & Events — TixNaija` },
        { name: "description", content: loaderData.profile.bio || `Buy tickets for events organized by ${name}.` },
      ]
    };
  }
});

function BoxOfficePage() {
  const { profile, events } = Route.useLoaderData();
  const organizerName = profile.full_name || profile.username || "Organizer";
  const hasCustomBanner = !!profile.banner_url;
  const bannerImage = profile.banner_url || profile.avatar_url;

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <SiteNav />
      <div className="flex-1 pb-20">
        {/* Banner */}
        <div className="w-full h-52 md:h-72 bg-muted relative overflow-hidden">
          {hasCustomBanner ? (
            <img src={profile.banner_url} alt={`${organizerName} Banner`} className="w-full h-full object-cover" />
          ) : bannerImage ? (
            <div className="w-full h-full relative">
              <img
                src={bannerImage}
                alt=""
                aria-hidden="true"
                className="w-full h-full object-cover blur-2xl scale-125 opacity-70"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-black/20" />
            </div>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-primary/10 to-background" />
          )}
        </div>
        
        {/* Profile Info */}
        <div className="mx-auto max-w-5xl px-4 relative -mt-16 sm:-mt-20">
          <Avatar className="w-32 h-32 sm:w-40 sm:h-40 border-4 border-background shadow-lg bg-card">
            <AvatarImage src={profile.avatar_url || undefined} />
            <AvatarFallback className="text-4xl">{organizerName.charAt(0).toUpperCase() || "O"}</AvatarFallback>
          </Avatar>
          
          <div className="mt-4 max-w-2xl">
            <h1 className="text-3xl sm:text-4xl font-display font-bold flex items-center gap-2">
              {organizerName}
              {profile.is_verified_organizer && (
                <BadgeCheck className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500 shrink-0" aria-label="Verified Organizer" />
              )}
            </h1>
            {profile.bio && <p className="text-muted-foreground mt-2 text-lg">{profile.bio}</p>}
          </div>
        </div>

        {/* Events Layout */}
        <div className="mx-auto max-w-5xl px-4 mt-12">
          {events && events.length > 0 ? (
            <div className="space-y-16">
              {/* Upcoming Events */}
              {events.filter((ev: any) => new Date(ev.start_datetime) >= new Date()).length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold mb-6">Upcoming Events</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {events.filter((ev: any) => new Date(ev.start_datetime) >= new Date()).map((ev: any) => {
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
                </div>
              )}

              {/* Past Events */}
              {events.filter((ev: any) => new Date(ev.start_datetime) < new Date()).length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold mb-6 text-muted-foreground">Past Events</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 opacity-70 grayscale-[30%] hover:grayscale-0 transition-all duration-500">
                    {events.filter((ev: any) => new Date(ev.start_datetime) < new Date()).map((ev: any) => {
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
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-20 bg-muted/30 rounded-xl border border-border/50">
              <p className="text-muted-foreground text-lg">No events to show right now.</p>
            </div>
          )}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
