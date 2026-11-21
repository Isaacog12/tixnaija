import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Search, MapPin, Tag, User, ExternalLink, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SupportEventSummary } from "@/lib/support-rpc-types";

export function SupportEventsTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const { data: eventsList, isLoading, refetch } = useQuery({
    queryKey: ["support-events-list", debouncedQuery],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("support_get_events_list", {
        p_search: debouncedQuery.trim() || undefined,
      });
      if (error) {
        console.warn("support_get_events_list:", error.message);
        return [];
      }
      return (data as SupportEventSummary[] | null) || [];
    },
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedQuery(searchQuery);
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-card/60 backdrop-blur">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-emerald-500" />
              Events Reference Directory
            </CardTitle>
            <CardDescription className="text-xs">
              Read-only index of published and upcoming events to help assist buyers with schedules, venues, and organizer contacts.
            </CardDescription>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search event title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl text-xs h-9"
              />
            </div>
            <Button type="submit" size="sm" className="rounded-xl text-xs h-9 bg-emerald-600 hover:bg-emerald-500 text-white">
              Filter
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setDebouncedQuery("");
                refetch();
              }}
              className="h-9 rounded-xl text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </form>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading events directory...
            </div>
          ) : !eventsList || eventsList.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-sm font-medium text-foreground">No events found</p>
              <p className="text-xs text-muted-foreground">
                No events matched your search criteria.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/30">
                    <TableHead>Event Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Start Date & Time</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Organizer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Public Page</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventsList.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-semibold text-xs text-foreground max-w-[220px] truncate">
                        {e.title}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {e.category || "General"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(e.start_date).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                        {e.venue || "TBA"}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-foreground">
                        {e.organizer_name || "Organizer"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={e.status === "published" ? "default" : "secondary"}
                          className="text-[10px] uppercase font-bold"
                        >
                          {e.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {e.slug && (
                          <a
                            href={`/e/${e.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                          >
                            <span>View</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
