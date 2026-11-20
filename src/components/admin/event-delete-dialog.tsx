import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, AlertTriangle, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type DeleteMode = "keep_records" | "purge";

/**
 * Admin delete for a single event.
 *
 * The admin chooses what happens to the event's records: keep them (the event
 * is taken down and hidden, orders and tickets stay in the database) or clear
 * everything (orders, tickets and the event itself are deleted).
 * Buyers are cancelled and notified either way, by the RPC.
 */
export function EventDeleteDialog({
  event,
  onClose,
  onDeleted,
}: {
  event: { id: string; title: string } | null;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const qc = useQueryClient();
  const [counts, setCounts] = useState<{ orders: number; tickets: number } | null>(null);
  const [busy, setBusy] = useState<DeleteMode | null>(null);

  useEffect(() => {
    if (!event) {
      setCounts(null);
      return;
    }
    let cancelled = false;

    (async () => {
      const [{ count: orderCount }, { data: items }] = await Promise.all([
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("event_id", event.id),
        supabase
          .from("order_items")
          .select("quantity, orders!inner(event_id)")
          .eq("orders.event_id", event.id),
      ]);

      if (cancelled) return;
      setCounts({
        orders: orderCount ?? 0,
        tickets: (items ?? []).reduce((sum: number, row: any) => sum + (row.quantity ?? 0), 0),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [event]);

  async function run(mode: DeleteMode) {
    if (!event) return;
    setBusy(mode);
    const { error } = await (supabase.rpc as any)("admin_delete_event", {
      p_event_id: event.id,
      p_mode: mode,
      p_note:
        mode === "purge"
          ? "Deleted by platform admin. All records were cleared."
          : "Removed by platform admin. Records were kept.",
    });
    setBusy(null);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success(
      mode === "purge"
        ? "Event and all its records were deleted."
        : "Event removed. Orders and tickets were kept.",
    );
    qc.invalidateQueries({ queryKey: ["admin-events"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
    qc.invalidateQueries({ queryKey: ["my-events"] });
    onClose();
    onDeleted?.();
  }

  const hasSales = (counts?.orders ?? 0) > 0;

  return (
    <AlertDialog open={!!event} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="rounded-3xl border-destructive/20 shadow-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-2xl text-destructive">
            Delete this event?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base text-foreground/80 mt-2">
            <strong>&ldquo;{event?.title}&rdquo;</strong> will be cancelled and every buyer with a
            valid ticket will be notified first. Then choose what happens to its records.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="rounded-2xl border border-border/60 bg-secondary/40 p-4 text-sm">
          {counts === null ? (
            <span className="text-muted-foreground">Checking ticket sales…</span>
          ) : hasSales ? (
            <span className="text-foreground/80">
              <strong>{counts.orders}</strong> {counts.orders === 1 ? "order" : "orders"} ·{" "}
              <strong>{counts.tickets}</strong> {counts.tickets === 1 ? "ticket" : "tickets"} on this
              event.
            </span>
          ) : (
            <span className="text-foreground/80">No ticket sales on this event.</span>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-2xl border border-border/60 p-4">
            <Archive className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Remove, keep records</p>
              <p className="text-xs text-muted-foreground mt-1">
                The event disappears from the platform. Orders, tickets, payouts and refunds stay
                in the database for accounting.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 rounded-lg"
              onClick={() => run("keep_records")}
              disabled={busy !== null}
            >
              {busy === "keep_records" ? "Removing…" : "Keep records"}
            </Button>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-destructive">Delete everything</p>
              <p className="text-xs text-destructive/80 mt-1">
                Permanently deletes the event plus its orders, tickets, check-ins, promo codes and
                refund requests. This cannot be undone.
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="shrink-0 rounded-lg"
              onClick={() => run("purge")}
              disabled={busy !== null}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {busy === "purge" ? "Deleting…" : "Clear everything"}
            </Button>
          </div>
        </div>

        <AlertDialogFooter className="mt-2">
          <AlertDialogCancel className="rounded-xl h-11" disabled={busy !== null}>
            Cancel
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
