import { useState, useEffect, useCallback } from "react";
import { createFileRoute, useRouter, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Scanner } from "@yudiel/react-qr-scanner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertTriangle, ArrowLeft, Scan, RefreshCcw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

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
  details?: string;
};

function ScannerPage() {
  const { eventId } = Route.useParams();
  const [scanResult, setScanResult] = useState<ScanResult>({ status: "idle", message: "Scanning..." });
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

  const triggerHaptic = (type: "success" | "error" | "warning") => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      if (type === "success") {
        navigator.vibrate([50, 50, 50]);
      } else if (type === "error" || type === "warning") {
        navigator.vibrate([100, 50, 100, 50, 200]);
      }
    }
  };

  const handleScan = useCallback(async (text: string) => {
    if (!text || !isScanning) return;
    
    setIsScanning(false);
    setScanResult({ status: "loading", message: "Verifying ticket..." });

    try {
      const { data: result, error: rpcError } = await supabase.rpc("check_in_ticket", {
        p_ticket_code: text,
        p_event_id: eventId,
      });

      if (rpcError) throw rpcError;

      const res = result as { success: boolean; reason: string; message: string; checked_in_at?: string };

      if (!res.success) {
        if (res.reason === "already_scanned") {
          const time = res.checked_in_at
            ? new Date(res.checked_in_at).toLocaleTimeString()
            : "unknown time";
          setScanResult({
            status: "warning",
            message: "Already Scanned",
            details: `This ticket was checked in at ${time}.`,
          });
          triggerHaptic("warning");
        } else {
          setScanResult({
            status: "error",
            message: "Invalid Ticket",
            details: res.message,
          });
          triggerHaptic("error");
        }
        return;
      }

      setScanResult({
        status: "success",
        message: "Check-in Successful",
        details: "Ticket is valid and marked as used.",
      });
      triggerHaptic("success");

    } catch (err: any) {
      console.error("Scan processing error:", err);
      setScanResult({ 
        status: "error", 
        message: "Processing Failed", 
        details: err.message || "Network error. Try again."
      });
      triggerHaptic("error");
    }
  }, [eventId, isScanning]);

  const resetScanner = () => {
    setScanResult({ status: "idle", message: "Scanning..." });
    setIsScanning(true);
  };

  useEffect(() => {
    if (scanResult.status === "success" || scanResult.status === "warning") {
      const timer = setTimeout(() => {
        resetScanner();
      }, 3500); 
      return () => clearTimeout(timer);
    }
  }, [scanResult.status]);

  if (eventLoading) {
    return <div className="min-h-dvh bg-black flex items-center justify-center text-white/50">Loading scanner...</div>;
  }

  const getStatusColor = (status: ScanResult["status"]) => {
    switch (status) {
      case "success": return "bg-green-500 text-white";
      case "error": return "bg-destructive text-destructive-foreground";
      case "warning": return "bg-amber-500 text-white";
      default: return "bg-primary text-primary-foreground";
    }
  };

  const getStatusIcon = (status: ScanResult["status"]) => {
    switch (status) {
      case "success": return <CheckCircle2 className="w-16 h-16 mb-4 opacity-90" />;
      case "error": return <XCircle className="w-16 h-16 mb-4 opacity-90" />;
      case "warning": return <AlertTriangle className="w-16 h-16 mb-4 opacity-90" />;
      case "loading": return <Scan className="w-16 h-16 mb-4 opacity-90 animate-pulse" />;
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden flex flex-col">
      {/* Immersive Camera Layer */}
      <div className="absolute inset-0 z-0 bg-black">
        <Scanner 
          onScan={(result) => handleScan(result[0].rawValue)}
          formats={["qr_code"]}
          paused={!isScanning}
          components={{
            finder: false // We will build our own fluid finder
          }}
          styles={{
            video: { width: "100%", height: "100%", objectFit: "cover" }
          }}
        />
        
        {/* Apple-style Finder Overlay */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
          <motion.div 
            animate={{ scale: isScanning ? 1 : 0.95, opacity: isScanning ? 1 : 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="w-64 h-64 border-2 border-white/40 rounded-3xl relative"
          >
            {/* Corner Markers */}
            <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-3xl"></div>
            <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-3xl"></div>
            <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-3xl"></div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-3xl"></div>
          </motion.div>
        </div>
      </div>

      {/* Floating Translucent Header */}
      <div className="relative z-10 pt-safe px-4 pb-4">
        <div className="mt-4 flex items-center justify-between bg-black/30 backdrop-blur-2xl rounded-full p-2 pr-6 border border-white/10 shadow-2xl">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.history.back()} 
            className="h-10 w-10 rounded-full hover:bg-white/20 text-white shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 text-center truncate px-2">
            <h1 className="font-semibold text-[15px] truncate tracking-tight">
              {(event as any)?.title || "Scanner"}
            </h1>
          </div>
          <div className="w-10 shrink-0" /> {/* Balance */}
        </div>
      </div>

      {/* Fluid Results Sheet */}
      <AnimatePresence>
        {scanResult.status !== "idle" && (
          <motion.div 
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0, transition: { duration: 0.3, ease: "easeIn" } }}
            transition={{ duration: 0.4, ease: "easeOut" }} // Removed bounce
            className="absolute bottom-0 left-0 right-0 z-50 p-4"
          >
            <div className={`p-8 rounded-[2rem] shadow-2xl backdrop-blur-3xl flex flex-col items-center text-center ${getStatusColor(scanResult.status)}`}>
              
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3, ease: "easeOut", delay: 0.1 }}
              >
                {getStatusIcon(scanResult.status)}
              </motion.div>

              <h2 className="text-3xl font-display font-semibold tracking-tight mb-2">
                {scanResult.message}
              </h2>
              
              {scanResult.details && (
                <p className="text-white/80 font-medium text-[15px] mb-8 leading-relaxed max-w-[280px]">
                  {scanResult.details}
                </p>
              )}

              {scanResult.status === "error" && (
                <Button 
                  size="lg" 
                  onClick={resetScanner}
                  className="w-full rounded-full bg-black/20 hover:bg-black/30 text-white border border-white/20 h-14 text-[17px] font-semibold tracking-wide"
                >
                  <RefreshCcw className="w-5 h-5 mr-2" />
                  Try Again
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
