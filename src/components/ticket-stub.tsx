import React, { useRef } from "react";
import { format } from "date-fns";
import { QRCodeSVG } from "qrcode.react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { MapPin, Calendar, Download } from "lucide-react";
import { Button } from "./ui/button";

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
      const canvas = await html2canvas(ticketRef.current, {
        scale: 2, // High resolution
        useCORS: true, // Allow external images (like cover_image_url)
        backgroundColor: null, // Transparent
      });
      const dataUrl = canvas.toDataURL("image/png");
      
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height]
      });
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`Ticket_${event.title}_${ticket.ticket_code.split("-")[0]}.pdf`);
    } catch (err) {
      console.error("Failed to download ticket", err);
    }
  };

  const formattedDate = event.start_datetime 
    ? format(new Date(event.start_datetime), "EEEE, MMMM do, yyyy") 
    : "TBA";
    
  const formattedTime = event.start_datetime 
    ? format(new Date(event.start_datetime), "h:mm a") 
    : "TBA";

  return (
    <div className="w-full max-w-2xl mx-auto mb-8">
      {/* Visual Ticket Element */}
      <div 
        ref={ticketRef} 
        className="flex flex-col md:flex-row w-full bg-card rounded-2xl overflow-hidden shadow-lg border border-border relative"
      >
        
        {/* Main Content Area */}
        <div className="flex-1 relative min-h-[300px] flex flex-col">
          {/* Banner Image with dark gradient */}
          <div className="h-32 w-full relative shrink-0">
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
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
            <div className="absolute bottom-4 left-6 right-6 text-white">
              <h2 className="font-display text-2xl font-bold truncate tracking-tight shadow-sm">
                {event.title}
              </h2>
            </div>
          </div>

          {/* Details Area */}
          <div className="p-6 flex-1 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">{formattedDate}</p>
                  <p className="text-muted-foreground text-sm">{formattedTime}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">{event.venue_name || "Online Event"}</p>
                  {(event.address || event.city || event.state) && (
                    <p className="text-muted-foreground text-sm">
                      {[event.address, event.city, event.state].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 bg-primary/10 text-primary text-sm font-semibold rounded-full uppercase tracking-wider">
                {ticketType.name}
              </span>
            </div>
          </div>
        </div>

        {/* Perforated Divider (Hidden on mobile, visible on desktop) */}
        <div className="hidden md:flex flex-col items-center justify-between relative w-0 border-l-2 border-dashed border-border/50">
          <div className="w-6 h-6 bg-background rounded-full absolute -top-3 -left-3 border-b-2 border-border/10 shadow-inner" />
          <div className="w-6 h-6 bg-background rounded-full absolute -bottom-3 -left-3 border-t-2 border-border/10 shadow-inner" />
        </div>
        
        {/* Mobile Perforated Divider */}
        <div className="md:hidden flex items-center justify-between relative h-0 border-t-2 border-dashed border-border/50">
          <div className="w-6 h-6 bg-background rounded-full absolute -left-3 -top-3 shadow-inner" />
          <div className="w-6 h-6 bg-background rounded-full absolute -right-3 -top-3 shadow-inner" />
        </div>

        {/* Stub Area (QR Code) */}
        <div className="w-full md:w-64 bg-card/50 p-6 flex flex-col items-center justify-center shrink-0">
          <div className="text-center w-full mb-6">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Attendee</p>
            <p className="font-semibold text-lg truncate px-2">
              {ticket.attendee_name || order.buyer_name}
            </p>
          </div>
          
          <div className="bg-white p-3 rounded-xl shadow-sm mb-4">
            <QRCodeSVG 
              value={ticket.ticket_code}
              size={140}
              bgColor={"#ffffff"}
              fgColor={"#000000"}
              level={"Q"}
              includeMargin={false}
            />
          </div>
          
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
            {ticket.ticket_code.split("-")[0]}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end mt-4">
        <Button variant="outline" onClick={handleDownload} className="gap-2">
          <Download className="w-4 h-4" /> Download Ticket
        </Button>
      </div>
    </div>
  );
}
