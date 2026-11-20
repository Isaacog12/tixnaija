import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, AlertTriangle, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/toast";
import { formatNaira } from "@/lib/currency";
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

type Preview = {
  orders: number;
  tickets: number;
  buyers: number;
  paid_unrefunded: number;
  open_refunds: number;
  revenue_kobo: number;
  refunded_kobo: number;
  money_owed: boolean;
};

/**
 * Admin delete for a single event.
 *
 * The admin chooses what happens to the event's records: keep them (the event
 * is taken down and hidden, orders and tickets stay in the database) or clear
 * everything (the event and the rows attached to it are deleted).
 * Buyers are cancelled and notified either way, by the RPC.
 *
 * Clearing is refused while money is owed, and refund records are never
 * deleted. The numbers come from admin_event_deletion_preview, which is
 * SECURITY DEFINER because admins cannot read orders directly.
 */
export function EventDeleteDialog({
  event,
  purgeOnly = false,
  onClose,
  onDeleted,
}: {
  event: { id: string; title: string } | null;
  purgeOnly?: boolean;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const qc = useQueryClient();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [busy, setBusy] = useState<DeleteMode | null>(null);

  useEffect(() => {
    if (!event) {
      setPreview(null);
      setPreviewFailed(false);
      return;
    }
    let cancelled = false;

    (async () => {
      const { data, error } = await (supabase.rpc as any)(
        "admin_event_deletion_preview",
        { p_event_id: event.id },
      );
      if (cancelled) return;
      if (error || !data) {
        setPreview(null);
        setPreviewFailed(true);
        return;
      }
      setPreviewFailed(false);
      setPreview(data as Preview);
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
        ? "Event and its records were deleted."
        : "Event removed. Orders and tickets were kept.",
    );
    qc.invalidateQueries({ queryKey: ["admin-events"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
    qc.invalidateQueries({ queryKey: ["my-events"] });
    onClose();
    onDeleted?.();
  }

  const moneyOwed = preview?.money_owed ?? false;

  return (
    <AlertDialog open={!!event} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="rounded-3xl border-destructive/20 shadow-2xl max-h-[85vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-2xl text-destructive">
            {purgeOnly ? "Clear this event permanently?" : "Delete this event?"}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base text-foreground/80 mt-2">
            <strong>&ldquo;{event?.title}&rdquo;</strong>{" "}
            {purgeOnly
              ? "was removed earlier and its records are still stored. Clearing it deletes the event and everything attached to it."
              : "will be cancelled and every buyer with a valid ticket will be notified first. Then choose what happens to its records."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="rounded-2xl border border-border/60 bg-secondary/40 p-4 text-sm space-y-1">
          {preview === null ? (
            <p className="text-muted-foreground">
              {previewFailed
                ? "Sales for this event could not be checked."
                : "Checking ticket sales…"}
            </p>
          ) : preview.orders === 0 ? (
            <p className="text-foreground/80">No ticket sales on this event.</p>
          ) : (
            <>
              <p className="text-foreground/80">
                <strong>{preview.orders}</strong> {preview.orders === 1 ? "order" : "orders"} ·{" "}
                <strong>{preview.tickets}</strong> {preview.tickets === 1 ? "ticket" : "tickets"} ·{" "}
                <strong>{preview.buyers}</strong> {preview.buyers === 1 ? "buyer" : "buyers"}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatNaira(preview.revenue_kobo)} collected ·{" "}
                {formatNaira(preview.refunded_kobo)} refunded
              </p>
            </>
          )}
        </div>

        {moneyOwed && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-xs text-amber-500/90">
              Money is still owed: {preview?.paid_unrefunded} paid{" "}
              {preview?.paid_unrefunded === 1 ? "buyer has" : "buyers have"} no processed refund, and{" "}
              {preview?.open_refunds} refund{" "}
              {preview?.open_refunds === 1 ? "request is" : "requests are"} still open. Records cannot
              be cleared until those refunds are processed — remove the event and keep the records
              for now.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {!purgeOnly && (
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
          )}

          <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
            <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-destructive">Delete everything</p>
              <p className="text-xs text-destructive/80 mt-1">
                Permanently deletes the event plus its orders, tickets, check-ins, promo codes and
                waitlist entries. Refund records are kept. This cannot be undone.
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="shrink-0 rounded-lg"
              onClick={() => run("purge")}
              disabled={busy !== null || moneyOwed}
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
