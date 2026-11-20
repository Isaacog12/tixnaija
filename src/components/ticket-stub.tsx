import React, { useRef } from "react";
import { format } from "date-fns";
import { QRCodeCanvas } from "qrcode.react";
import { MapPin, Calendar, Download, CalendarPlus } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "@/lib/toast";

interface TicketStubProps {
  ticket: any;
  event: any;
  order: any;
  ticketType: any;
}

export function TicketStub({ ticket = {}, event = {}, order = {}, ticketType = {} }: TicketStubProps) {
  const ticketRef = useRef<HTMLDivElement>(null);
  const safeEvent = event || {};
  const safeTicket = ticket || {};
  const safeOrder = order || {};
  const safeTicketType = ticketType || {};

  const ticketCode = String(safeTicket.ticket_code || safeTicket.id || "TICKET");
  const ticketShortCode = ticketCode.includes("-") ? ticketCode.split("-")[0] : ticketCode.substring(0, 8);

  const handleDownload = async () => {
    if (!ticketRef.current) return;
    try {
      // Ensure fonts are fully loaded before capturing so we don't get generic fallback fonts
      await document.fonts.ready;
      
      // Dynamically import heavy libraries for PDF generation to reduce bundle size
      const { toPng } = await import("html-to-image");
      const { jsPDF } = await import("jspdf");

      // Use html-to-image to fully support modern CSS like oklch from Tailwind v4
      const dataUrl = await toPng(ticketRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff', // Ensure background isn't transparent so text stays legible
        skipFonts: false,
      });
      
      // Get actual dimensions of the element to scale the PDF correctly
      const rect = ticketRef.current.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      const pdf = new jsPDF({
        orientation: width > height ? "landscape" : "portrait",
        unit: "px",
        format: [width, height]
      });
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
      pdf.save(`Ticket_${safeEvent.title || "Tix"}_${ticketShortCode}.pdf`);
      toast.success("Ticket downloaded successfully!");
    } catch (err: any) {
      console.error("Failed to download ticket", err);
      toast.error(`Download failed: ${err.message || "Unknown error"}`);
    }
  };

  const formattedDate = safeEvent.start_datetime 
    ? (() => {
        try {
          return format(new Date(safeEvent.start_datetime), "EEEE, MMMM do, yyyy");
        } catch {
          return "TBA";
        }
      })()
    : "TBA";
    
  const formattedTime = safeEvent.start_datetime 
    ? (() => {
        try {
          return format(new Date(safeEvent.start_datetime), "h:mm a");
        } catch {
          return "TBA";
        }
      })()
    : "TBA";

  const generateCalendarDates = () => {
    try {
      const start = new Date(safeEvent.start_datetime);
      const end = safeEvent.end_datetime ? new Date(safeEvent.end_datetime) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
      const formatForCal = (d: Date) => d.toISOString().replace(/-|:|\.\d+/g, "");
      return { startStr: formatForCal(start), endStr: formatForCal(end) };
    } catch {
      return { startStr: "", endStr: "" };
    }
  };

  const handleGoogleCalendar = () => {
    if (!safeEvent.start_datetime) return;
    const { startStr, endStr } = generateCalendarDates();
    if (!startStr || !endStr) return;
    const title = encodeURIComponent(safeEvent.title || "Event");
    const details = encodeURIComponent(safeEvent.description || "");
    const location = encodeURIComponent([safeEvent.venue_name, safeEvent.address, safeEvent.city, safeEvent.state].filter(Boolean).join(", "));
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}&location=${location}`, "_blank");
  };

  const handleIcsDownload = () => {
    if (!safeEvent.start_datetime) return;
    const { startStr, endStr } = generateCalendarDates();
    if (!startStr || !endStr) return;
    const location = [safeEvent.venue_name, safeEvent.address, safeEvent.city, safeEvent.state].filter(Boolean).join(", ");
    
    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      `DTSTART:${startStr}`,
      `DTEND:${endStr}`,
      `SUMMARY:${safeEvent.title || "Event"}`,
      `DESCRIPTION:${safeEvent.description || ""}`,
      `LOCATION:${location}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${safeEvent.slug || "event"}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full max-w-2xl mx-auto mb-8 relative group">
      {/* Visual Ticket Element */}
      <div 
        ref={ticketRef} 
        className="flex flex-col md:flex-row w-full bg-card/95 backdrop-blur-sm rounded-2xl overflow-hidden shadow-2xl shadow-black/5 border border-border/60 relative transition-transform duration-300 hover:shadow-primary/20"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%239C92AC' fill-opacity='0.03' fill-rule='evenodd'%3E%3Ccircle cx='3' cy='3' r='3'/%3E%3Ccircle cx='13' cy='13' r='3'/%3E%3C/g%3E%3C/svg%3E")`
        }}
      >
        
        {/* Main Content Area */}
        <div className="flex-1 relative min-h-[300px] flex flex-col">
          {/* Banner Image with dark gradient */}
          <div className="h-36 w-full relative shrink-0">
            {safeEvent.cover_image_url ? (
              <img 
                src={safeEvent.cover_image_url} 
                alt={safeEvent.title || "Event"} 
                className="w-full h-full object-cover"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/80 to-primary" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-card/95 via-card/40 to-transparent" />
            <div className="absolute bottom-4 left-6 right-6 text-white drop-shadow-lg">
              <h2 className="font-display text-4xl font-extrabold truncate tracking-tight">
                {safeEvent.title || "Event Ticket"}
              </h2>
            </div>
          </div>

          {/* Details Area */}
          <div className="p-6 flex-1 flex flex-col justify-between gap-6 relative">
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="shrink-0 mt-0.5">
                  <Calendar className="w-6 h-6 text-primary drop-shadow-sm" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-lg leading-tight tracking-tight">{formattedDate}</p>
                  <p className="text-muted-foreground font-medium">{formattedTime}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="shrink-0 mt-0.5">
                  <MapPin className="w-6 h-6 text-primary drop-shadow-sm" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-lg leading-tight tracking-tight">{safeEvent.venue_name || "Online Event"}</p>
                  {(safeEvent.address || safeEvent.city || safeEvent.state) && (
                    <p className="text-muted-foreground font-medium">
                      {[safeEvent.address, safeEvent.city, safeEvent.state].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 mt-2">
              <span className="px-4 py-1.5 bg-primary text-primary-foreground text-sm font-bold rounded-full uppercase tracking-wider shadow-sm">
                {safeTicketType.name || "General Admission"}
              </span>
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest opacity-60">
                TIX-{safeTicket.id ? String(safeTicket.id).substring(0, 8) : ticketShortCode}
              </span>
            </div>
          </div>
        </div>

        {/* Perforated Divider (Hidden on mobile, visible on desktop) */}
        <div className="hidden md:flex flex-col items-center justify-between relative w-0 border-l-2 border-dashed border-border/80">
          <div className="w-6 h-6 bg-background rounded-full absolute -top-3 -left-3" />
          <div className="w-6 h-6 bg-background rounded-full absolute -bottom-3 -left-3" />
        </div>
        
        {/* Mobile Perforated Divider */}
        <div className="md:hidden flex items-center justify-between relative h-0 border-t-2 border-dashed border-border/80">
          <div className="w-6 h-6 bg-background rounded-full absolute -left-3 -top-3" />
          <div className="w-6 h-6 bg-background rounded-full absolute -right-3 -top-3" />
        </div>

        {/* Stub Area (QR Code) */}
        <div className="w-full md:w-72 p-6 flex flex-col items-center justify-center shrink-0 relative overflow-hidden bg-primary/5">
          {/* Subtle sunset gradient wash on the stub */}
          <div className="absolute inset-0 opacity-10 gradient-sunset pointer-events-none" />
          {/* Decorative Barcode on the right edge */}
          <div className="absolute right-0 top-0 bottom-0 w-8 opacity-5" 
               style={{ backgroundImage: 'repeating-linear-gradient(to bottom, currentColor, currentColor 2px, transparent 2px, transparent 5px, currentColor 5px, currentColor 6px, transparent 6px, transparent 10px)' }}>
          </div>

          <div className="text-center w-full mb-6 z-10">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1 font-semibold">Admit One</p>
            <p className="font-display font-semibold text-xl truncate px-2 text-foreground">
              {safeTicket.attendee_name || safeOrder.buyer_name || "Guest"}
            </p>
          </div>
          
          <div className="bg-white p-4 rounded-2xl shadow-md border border-black/5 mb-4 z-10 hover:scale-105 transition-transform duration-300">
            <QRCodeCanvas 
              value={ticketCode}
              size={150}
              bgColor={"#ffffff"}
              fgColor={"#000000"}
              level={"Q"}
              includeMargin={false}
            />
          </div>
          
          <p className="text-sm font-mono font-medium text-muted-foreground uppercase tracking-widest bg-background/50 px-3 py-1 rounded-md z-10">
            {ticketShortCode}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap justify-end gap-3 mt-6">
        {safeEvent.start_datetime && (
          <>
            <Button variant="outline" onClick={handleGoogleCalendar} className="gap-2 bg-card/50 backdrop-blur-sm border-border/60 hover:bg-accent/50">
              <CalendarPlus className="w-4 h-4 text-primary" /> <span className="hidden sm:inline">Google Calendar</span>
            </Button>
            <Button variant="outline" onClick={handleIcsDownload} className="gap-2 bg-card/50 backdrop-blur-sm border-border/60 hover:bg-accent/50">
              <CalendarPlus className="w-4 h-4 text-primary" /> <span className="hidden sm:inline">Download .ics</span>
            </Button>
          </>
        )}
        <Button variant="default" onClick={handleDownload} className="gap-2 gradient-sunset text-white border-0 shadow-glow hover:opacity-90">
          <Download className="w-4 h-4" /> Download PDF
        </Button>
      </div>
    </div>
  );
}
