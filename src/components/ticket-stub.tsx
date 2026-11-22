import React, { useRef } from "react";
import { format } from "date-fns";
import { QRCodeCanvas } from "qrcode.react";
import { Download, CalendarPlus } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface TicketStubTicket {
  id?: string | null;
  ticket_code?: string | null;
  status?: string | null;
  attendee_name?: string | null;
}

interface TicketStubEvent {
  title?: string | null;
  slug?: string | null;
  description?: string | null;
  cover_image_url?: string | null;
  start_datetime?: string | null;
  end_datetime?: string | null;
  venue_name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
}

interface TicketStubOrder {
  buyer_name?: string | null;
  [key: string]: unknown;
}

interface TicketStubType {
  name?: string | null;
}

interface TicketStubProps {
  ticket?: TicketStubTicket | null;
  event?: TicketStubEvent | null;
  order?: TicketStubOrder | null;
  ticketType?: TicketStubType | null;
}

type StatusTone = "valid" | "used" | "void";

function statusMeta(status: unknown): { label: string; tone: StatusTone } {
  const value = String(status ?? "valid").toLowerCase();
  if (value === "checked_in" || value === "used") return { label: "Used — already scanned", tone: "used" };
  if (value === "cancelled" || value === "refunded" || value === "void") {
    return { label: value === "refunded" ? "Refunded" : "Cancelled", tone: "void" };
  }
  return { label: "Valid for entry", tone: "valid" };
}

export function TicketStub({ ticket = {}, event = {}, order = {}, ticketType = {} }: TicketStubProps) {
  const ticketRef = useRef<HTMLDivElement>(null);
  const safeEvent: TicketStubEvent = event || {};
  const safeTicket: TicketStubTicket = ticket || {};
  const safeOrder: TicketStubOrder = order || {};
  const safeTicketType: TicketStubType = ticketType || {};

  const ticketCode = String(safeTicket.ticket_code || safeTicket.id || "TICKET");
  const ticketShortCode = ticketCode.includes("-") ? ticketCode.split("-")[0] : ticketCode.substring(0, 8);
  const status = statusMeta(safeTicket.status);

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
        backgroundColor: "#ffffff", // Ensure background isn't transparent so text stays legible
        skipFonts: false,
      });

      // Get actual dimensions of the element to scale the PDF correctly
      const rect = ticketRef.current.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      const pdf = new jsPDF({
        orientation: width > height ? "landscape" : "portrait",
        unit: "px",
        format: [width, height],
      });

      pdf.addImage(dataUrl, "PNG", 0, 0, width, height);
      pdf.save(`Ticket_${safeEvent.title || "Tix"}_${ticketShortCode}.pdf`);
      toast.success("Ticket downloaded successfully!");
    } catch (err: unknown) {
      console.error("Failed to download ticket", err);
      toast.error(`Download failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const startRaw = typeof safeEvent.start_datetime === "string" ? safeEvent.start_datetime : null;

  const formattedDate = startRaw
    ? (() => {
        try {
          return format(new Date(startRaw), "EEEE, MMMM do, yyyy");
        } catch {
          return "TBA";
        }
      })()
    : "TBA";

  const formattedTime = startRaw
    ? (() => {
        try {
          return format(new Date(startRaw), "h:mm a");
        } catch {
          return "TBA";
        }
      })()
    : "TBA";

  const generateCalendarDates = () => {
    try {
      if (!startRaw) return { startStr: "", endStr: "" };
      const start = new Date(startRaw);
      const end = safeEvent.end_datetime
        ? new Date(safeEvent.end_datetime)
        : new Date(start.getTime() + 2 * 60 * 60 * 1000);
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
    const location = encodeURIComponent(
      [safeEvent.venue_name, safeEvent.address, safeEvent.city, safeEvent.state].filter(Boolean).join(", "),
    );
    window.open(
      `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}&location=${location}`,
      "_blank",
    );
  };

  const handleIcsDownload = () => {
    if (!safeEvent.start_datetime) return;
    const { startStr, endStr } = generateCalendarDates();
    if (!startStr || !endStr) return;
    const location = [safeEvent.venue_name, safeEvent.address, safeEvent.city, safeEvent.state]
      .filter(Boolean)
      .join(", ");

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
      "END:VCALENDAR",
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

  const details: Array<{ label: string; value: string; hint?: string }> = [
    { label: "Date", value: formattedDate, hint: formattedTime },
    {
      label: "Venue",
      value: safeEvent.venue_name || "Online event",
      hint: [safeEvent.address, safeEvent.city, safeEvent.state].filter(Boolean).join(", "),
    },
    {
      label: "Ticket type",
      value: safeTicketType.name || "General admission",
    },
    {
      label: "Ticket holder",
      value: safeTicket.attendee_name || safeOrder.buyer_name || "Guest",
    },
  ];

  return (
    <div className="mx-auto mb-8 w-full max-w-2xl">
      <div
        ref={ticketRef}
        className={cn(
          "overflow-hidden rounded-lg border bg-card",
          status.tone === "void" ? "border-destructive/40" : "border-border/60",
        )}
      >
        {/* Header strip */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border/60 px-4 py-3 sm:px-6">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Admit one
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]",
              status.tone === "valid" && "border-foreground/20 text-foreground",
              status.tone === "used" && "border-border text-muted-foreground",
              status.tone === "void" && "border-destructive/50 text-destructive",
            )}
          >
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
            {status.label}
          </span>
        </div>

        {safeEvent.cover_image_url && (
          <img
            src={safeEvent.cover_image_url}
            alt=""
            className="h-24 w-full border-b border-border/60 object-cover sm:h-32"
            crossOrigin="anonymous"
          />
        )}

        <div className="grid md:grid-cols-[1fr_auto]">
          {/* Details */}
          <div className="min-w-0 px-4 py-5 sm:px-6 sm:py-6">
            <h1 className="font-display text-2xl leading-[1.1] tracking-[-0.02em] text-foreground sm:text-3xl">
              {safeEvent.title || "Event ticket"}
            </h1>

            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              {details.map((detail) => (
                <div key={detail.label} className="min-w-0">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {detail.label}
                  </dt>
                  <dd className="mt-1 break-words text-[14px] font-medium leading-snug text-foreground">
                    {detail.value}
                    {detail.hint && (
                      <span className="mt-0.5 block text-[12px] font-normal text-muted-foreground">
                        {detail.hint}
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* QR stub — always black on white so it scans in either theme and
              survives a phone at low brightness. */}
          <div className="flex flex-col items-center justify-center gap-3 border-t border-border/60 px-4 py-6 md:border-l md:border-t-0 sm:px-6">
            <div className="rounded-md bg-white p-3 ring-1 ring-black/10">
              <QRCodeCanvas
                value={ticketCode}
                size={168}
                bgColor={"#ffffff"}
                fgColor={"#000000"}
                level={"Q"}
                includeMargin={false}
              />
            </div>
            <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-foreground">
              {ticketShortCode}
            </p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Scan at the gate
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap justify-end gap-2 print:hidden">
        {safeEvent.start_datetime && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGoogleCalendar}
              className="gap-2 rounded-md border-border/70"
            >
              <CalendarPlus className="h-4 w-4" aria-hidden />{" "}
              <span className="hidden sm:inline">Google Calendar</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleIcsDownload}
              className="gap-2 rounded-md border-border/70"
            >
              <CalendarPlus className="h-4 w-4" aria-hidden />{" "}
              <span className="hidden sm:inline">Download .ics</span>
            </Button>
          </>
        )}
        <Button size="sm" onClick={handleDownload} className="gap-2 rounded-md">
          <Download className="h-4 w-4" aria-hidden /> Download PDF
        </Button>
      </div>
    </div>
  );
}
