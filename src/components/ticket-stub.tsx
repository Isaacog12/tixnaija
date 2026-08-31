import React, { useRef } from "react";
import { format } from "date-fns";
import { QRCodeCanvas } from "qrcode.react";
import { MapPin, Calendar, Download, CalendarPlus } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";

interface TicketStubProps {
  ticket: any;
  event: any;
  order: any;
  ticketType: any;
}

export function TicketStub({ ticket, event, order, ticketType }: TicketStubProps) {
  const ticketRef = useRef<HTMLDivElement>(null);

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
        // html-to-image supports modern CSS natively, but we ensure CORS is handled:
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
      pdf.save(`Ticket_${event.title}_${ticket.ticket_code.split("-")[0]}.pdf`);
      toast.success("Ticket downloaded successfully!");
    } catch (err: any) {
      console.error("Failed to download ticket", err);
      toast.error(`Download failed: ${err.message || "Unknown error"}`);
    }
  };

  const formattedDate = event.start_datetime 
    ? format(new Date(event.start_datetime), "EEEE, MMMM do, yyyy") 
    : "TBA";
    
  const formattedTime = event.start_datetime 
    ? format(new Date(event.start_datetime), "h:mm a") 
    : "TBA";

  const generateCalendarDates = () => {
    const start = new Date(event.start_datetime);
    const end = event.end_datetime ? new Date(event.end_datetime) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const formatForCal = (d: Date) => d.toISOString().replace(/-|:|\.\d+/g, "");
    return { startStr: formatForCal(start), endStr: formatForCal(end) };
  };

  const handleGoogleCalendar = () => {
    if (!event.start_datetime) return;
    const { startStr, endStr } = generateCalendarDates();
    const title = encodeURIComponent(event.title);
    const details = encodeURIComponent(event.description || "");
    const location = encodeURIComponent([event.venue_name, event.address, event.city, event.state].filter(Boolean).join(", "));
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}&location=${location}`, "_blank");
  };

  const handleIcsDownload = () => {
    if (!event.start_datetime) return;
    const { startStr, endStr } = generateCalendarDates();
    const location = [event.venue_name, event.address, event.city, event.state].filter(Boolean).join(", ");
    
    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      `DTSTART:${startStr}`,
      `DTEND:${endStr}`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${event.description || ""}`,
      `LOCATION:${location}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${event.slug || "event"}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full max-w-2xl mx-auto mb-8 relative group">
      {/* Visual Ticket Element */}
      <div 
        ref={ticketRef} 
        className="flex flex-col md:flex-row w-full bg-card/95 backdrop-blur-sm rounded-2xl overflow-hidden shadow-2xl shadow-black/5 dark:shadow-primary/5 border border-border/60 relative transition-transform duration-300 hover:shadow-primary/10"
      >
        
        {/* Main Content Area */}
        <div className="flex-1 relative min-h-[300px] flex flex-col">
          {/* Banner Image with dark gradient */}
          <div className="h-36 w-full relative shrink-0">
            {event.cover_image_url ? (
              <img 
                src={event.cover_image_url} 
                alt={event.title} 
                className="w-full h-full object-cover"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/80 to-primary" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
            <div className="absolute bottom-4 left-6 right-6 text-white">
              <h2 className="font-display text-3xl font-bold truncate tracking-tight shadow-sm drop-shadow-md">
                {event.title}
              </h2>
            </div>
          </div>

          {/* Details Area */}
          <div className="p-6 flex-1 flex flex-col justify-between gap-6 relative">
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-lg leading-tight">{formattedDate}</p>
                  <p className="text-muted-foreground">{formattedTime}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-lg leading-tight">{event.venue_name || "Online Event"}</p>
                  {(event.address || event.city || event.state) && (
                    <p className="text-muted-foreground">
                      {[event.address, event.city, event.state].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 mt-2">
              <span className="px-4 py-1.5 bg-primary text-primary-foreground text-sm font-bold rounded-full uppercase tracking-wider shadow-sm">
                {ticketType.name}
              </span>
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest opacity-60">
                TIX-{ticket.id.substring(0, 8)}
              </span>
            </div>
          </div>
        </div>

        {/* Perforated Divider (Hidden on mobile, visible on desktop) */}
        <div className="hidden md:flex flex-col items-center justify-between relative w-0 border-l-2 border-dashed border-border/80">
          <div className="w-6 h-6 bg-background rounded-full absolute -top-3 -left-3 border-b border-border/40 shadow-inner" />
          <div className="w-6 h-6 bg-background rounded-full absolute -bottom-3 -left-3 border-t border-border/40 shadow-inner" />
        </div>
        
        {/* Mobile Perforated Divider */}
        <div className="md:hidden flex items-center justify-between relative h-0 border-t-2 border-dashed border-border/80">
          <div className="w-6 h-6 bg-background rounded-full absolute -left-3 -top-3 shadow-inner border-r border-border/40" />
          <div className="w-6 h-6 bg-background rounded-full absolute -right-3 -top-3 shadow-inner border-l border-border/40" />
        </div>

        {/* Stub Area (QR Code) */}
        <div className="w-full md:w-72 bg-gradient-to-b from-card/80 to-muted/20 p-6 flex flex-col items-center justify-center shrink-0 relative overflow-hidden">
          {/* Decorative Barcode on the right edge */}
          <div className="absolute right-0 top-0 bottom-0 w-8 opacity-5" 
               style={{ backgroundImage: 'repeating-linear-gradient(to bottom, currentColor, currentColor 2px, transparent 2px, transparent 5px, currentColor 5px, currentColor 6px, transparent 6px, transparent 10px)' }}>
          </div>

          <div className="text-center w-full mb-6 z-10">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1 font-semibold">Admit One</p>
            <p className="font-display font-semibold text-xl truncate px-2 text-foreground">
              {ticket.attendee_name || order.buyer_name}
            </p>
          </div>
          
          <div className="bg-white p-4 rounded-2xl shadow-md border border-black/5 mb-4 z-10 hover:scale-105 transition-transform duration-300">
            <QRCodeCanvas 
              value={ticket.ticket_code}
              size={150}
              bgColor={"#ffffff"}
              fgColor={"#000000"}
              level={"Q"}
              includeMargin={false}
            />
          </div>
          
          <p className="text-sm font-mono font-medium text-muted-foreground uppercase tracking-widest bg-background/50 px-3 py-1 rounded-md z-10">
            {ticket.ticket_code.split("-")[0]}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap justify-end gap-3 mt-6">
        {event.start_datetime && (
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
