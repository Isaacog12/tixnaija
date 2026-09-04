import { useState, useEffect } from "react";
import { createFileRoute, Link, useRouter, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Scanner } from "@yudiel/react-qr-scanner";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, XCircle, AlertTriangle, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/events/$eventId/scan")({
  beforeLoad: async ({ params: { eventId } }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });

    // Check if admin
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (adminRole) return;

    // Check if organizer
    const { data: event } = await supabase
      .from("events")
      .select("organizer_id")
      .eq("id", eventId)
      .maybeSingle();

    if (!event || (event as any).organizer_id !== session.user.id) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: ScannerPage,
});

type ScanResult = {
  status: "idle" | "loading" | "success" | "error" | "warning";
  message: string;
  ticket?: any;
};

function ScannerPage() {
  const { eventId } = Route.useParams();
  const [scanResult, setScanResult] = useState<ScanResult>({ status: "idle", message: "Point camera at a ticket QR code" });
  const [isScanning, setIsScanning] = useState(true);
  const router = useRouter();

  // Verify the user is the organizer for this event
  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Handle a scanned QR code
  const handleScan = async (text: string) => {
    if (!text || !isScanning) return;
    
    // Stop scanning while we process
    setIsScanning(false);
    setScanResult({ status: "loading", message: "Verifying ticket..." });

    try {
      // 1. Fetch the ticket by ticket_code and ensure it belongs to this event
      // We join order_items -> orders to verify the event_id matches
      const { data: ticketData, error: fetchError } = await supabase
        .from("tickets")
        .select(`
          *,
          order_items!inner(
            orders!inner(event_id)
          )
        `)
        .eq("ticket_code", text)
        .eq("order_items.orders.event_id", eventId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!ticketData) {
        setScanResult({ 
          status: "error", 
          message: "Invalid Ticket: Not found for this event." 
        });
        return;
      }

      // 2. Check ticket status
      if ((ticketData as any).status === 'checked_in') {
        const time = new Date((ticketData as any).checked_in_at ?? Date.now()).toLocaleTimeString();
        setScanResult({ 
          status: "warning", 
          message: `Already scanned at ${time}!`,
          ticket: ticketData
        });
        return;
      }

      if ((ticketData as any).status === 'cancelled') {
        setScanResult({ 
          status: "error", 
          message: "Ticket is cancelled and invalid.",
          ticket: ticketData
        });
        return;
      }

      // 3. Update the ticket to checked_in
      const { error: updateError } = await (supabase.from("tickets") as any)
        .update({ 
          status: "checked_in", 
          checked_in_at: new Date().toISOString(),
        })
        .eq("id", (ticketData as any).id);

      if (updateError) throw updateError;

      setScanResult({ 
        status: "success", 
        message: "Check-in Successful!",
        ticket: ticketData
      });

    } catch (err: any) {
      console.error("Scan processing error:", err);
      setScanResult({ 
        status: "error", 
        message: "Failed to process ticket: " + err.message 
      });
    }
  };

  // Reset scanner after a delay when a result is shown
  useEffect(() => {
    if (scanResult.status !== "idle" && scanResult.status !== "loading") {
      const timer = setTimeout(() => {
        setScanResult({ status: "idle", message: "Ready for next ticket" });
        setIsScanning(true);
      }, 3500); // Show result for 3.5 seconds before resetting
      
      return () => clearTimeout(timer);
    }
  }, [scanResult.status]);

  if (eventLoading) {
    return <div className="p-8 text-center">Loading event...</div>;
  }

  return (
    <div className="min-h-screen bg-black/95 text-white flex flex-col">
      {/* Top Header */}
      <div className="p-4 flex items-center gap-4 bg-black/50 backdrop-blur-md sticky top-0 z-10 border-b border-white/10">
        <Button variant="ghost" size="icon" onClick={() => router.history.back()} className="text-white hover:bg-white/20">
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <div className="flex-1 truncate">
          <h1 className="font-semibold text-lg truncate">{(event as any)?.title || "Event Check-in"}</h1>
          <p className="text-xs text-white/60">Ticket Scanner</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative max-w-md mx-auto w-full">
        
        {/* Scanner Area */}
        <div className="relative aspect-square w-full bg-black overflow-hidden shadow-2xl">
          {isScanning ? (
            <Scanner 
              onScan={(result) => handleScan(result[0].rawValue)}
              formats={["qr_code"]}
              components={{
                finder: true, // Show scanning box
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              {scanResult.status === "loading" && (
                <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full" />
              )}
              {scanResult.status === "success" && <CheckCircle className="w-24 h-24 text-green-500 animate-in zoom-in" />}
              {scanResult.status === "warning" && <AlertTriangle className="w-24 h-24 text-yellow-500 animate-in zoom-in" />}
              {scanResult.status === "error" && <XCircle className="w-24 h-24 text-red-500 animate-in zoom-in" />}
            </div>
          )}
        </div>

        {/* Status Display Area */}
        <div className="flex-1 p-6 flex flex-col justify-start">
          <Card className={`border-2 transition-colors ${
            scanResult.status === "success" ? "border-green-500 bg-green-500/10 text-green-100" :
            scanResult.status === "warning" ? "border-yellow-500 bg-yellow-500/10 text-yellow-100" :
            scanResult.status === "error" ? "border-red-500 bg-red-500/10 text-red-100" :
            "border-white/10 bg-white/5 text-white"
          }`}>
            <CardContent className="p-6 text-center">
              <h2 className="text-xl font-semibold mb-2">{scanResult.message}</h2>
              
              {scanResult.ticket && (
                <div className="mt-4 pt-4 border-t border-current/20 text-sm opacity-90 text-left space-y-1">
                  <p><strong>Name:</strong> {scanResult.ticket.attendee_name || "Guest"}</p>
                  <p><strong>Ticket ID:</strong> {scanResult.ticket.ticket_code.split("-")[0]}</p>
                </div>
              )}
              
              {scanResult.status === "idle" && (
                <p className="text-sm opacity-70 animate-pulse mt-2">
                  Position QR code inside the frame
                </p>
              )}
            </CardContent>
          </Card>
          
          {!isScanning && scanResult.status !== "loading" && (
            <Button 
              className="mt-6 w-full py-6 text-lg" 
              onClick={() => {
                setScanResult({ status: "idle", message: "Ready for next ticket" });
                setIsScanning(true);
              }}
            >
              Scan Next
            </Button>
          )}
        </div>
        
      </div>
    </div>
  );
}
