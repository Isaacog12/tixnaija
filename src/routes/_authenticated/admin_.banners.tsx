import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Edit2, CheckCircle, XCircle, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { BackButton } from "@/components/back-button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin_/banners")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) throw redirect({ to: "/dashboard" });
  },
  component: AdminBannersPage,
});

interface Banner {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  display_order: number;
  click_count: number;
}

function AdminBannersPage() {
  const qc = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);

  const { data: banners, isLoading } = useQuery({
    queryKey: ["admin-banners"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sponsored_banners")
        .select("*")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Banner[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sponsored_banners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Banner deleted");
      qc.invalidateQueries({ queryKey: ["admin-banners"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("sponsored_banners").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-banners"] }),
    onError: (e: any) => toast.error(e.message),
  });

  function handleEdit(banner: Banner) {
    setEditingBanner(banner);
    setIsDialogOpen(true);
  }

  function handleCreateNew() {
    setEditingBanner(null);
    setIsDialogOpen(true);
  }

  if (isLoading) {
    return <div className="mx-auto max-w-4xl px-4 py-10">Loading banners...</div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <BackButton />
            <h1 className="font-display text-4xl md:text-5xl">Sponsored Banners</h1>
          </div>
          <p className="mt-2 text-muted-foreground">Manage homepage sponsored banner slots.</p>
        </div>
        <Button onClick={handleCreateNew} className="gradient-sunset text-primary-foreground shadow-glow">
          <Plus className="mr-2 h-4 w-4" /> New Banner
        </Button>
      </div>

      <div className="space-y-4">
        {(!banners || banners.length === 0) ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center text-muted-foreground">
            No banners yet. Click "New Banner" to create one.
          </div>
        ) : (
          banners.map((banner) => (
            <div key={banner.id} className="flex flex-col sm:flex-row items-center gap-4 rounded-xl border border-border bg-card/60 p-4 shadow-sm">
              <div className="h-24 w-48 flex-shrink-0 overflow-hidden rounded bg-muted/30">
                <img src={banner.image_url} alt={banner.title} className="h-full w-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg truncate">{banner.title}</h3>
                <p className="text-sm text-muted-foreground truncate">{banner.link_url || "No link"}</p>
                <div className="mt-2 flex gap-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <span>Clicks: <strong className="text-foreground">{banner.click_count}</strong></span>
                  <span>Order: <strong className="text-foreground">{banner.display_order}</strong></span>
                </div>
              </div>
              <div className="flex flex-row sm:flex-col gap-2 items-end">
                <Button variant={banner.is_active ? "default" : "secondary"} size="sm" onClick={() => toggleActiveMutation.mutate({ id: banner.id, is_active: !banner.is_active })}>
                  {banner.is_active ? "Active" : "Hidden"}
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => handleEdit(banner)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => { if(confirm("Delete this banner?")) deleteMutation.mutate(banner.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <BannerDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        banner={editingBanner}
        onSuccess={() => {
          setIsDialogOpen(false);
          qc.invalidateQueries({ queryKey: ["admin-banners"] });
        }}
      />
    </div>
  );
}

function BannerDialog({ open, onOpenChange, banner, onSuccess }: { open: boolean; onOpenChange: (open: boolean) => void; banner: Banner | null; onSuccess: () => void }) {
  const [title, setTitle] = useState(banner?.title || "");
  const [linkUrl, setLinkUrl] = useState(banner?.link_url || "");
  const [displayOrder, setDisplayOrder] = useState(banner?.display_order?.toString() || "0");
  const [isActive, setIsActive] = useState(banner ? banner.is_active : true);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset state when banner changes
  useState(() => {
    setTitle(banner?.title || "");
    setLinkUrl(banner?.link_url || "");
    setDisplayOrder(banner?.display_order?.toString() || "0");
    setIsActive(banner ? banner.is_active : true);
    setFile(null);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title) return toast.error("Title is required");
    if (!banner && !file) return toast.error("Image is required for new banners");
    setLoading(true);

    try {
      let imageUrl = banner?.image_url;

      if (file) {
        const ext = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("banners")
          .upload(fileName, file);
        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage.from("banners").getPublicUrl(fileName);
        imageUrl = publicData.publicUrl;
      }

      const payload = {
        title,
        image_url: imageUrl,
        link_url: linkUrl || null,
        display_order: parseInt(displayOrder) || 0,
        is_active: isActive,
      };

      if (banner) {
        const { error } = await supabase.from("sponsored_banners").update(payload).eq("id", banner.id);
        if (error) throw error;
        toast.success("Banner updated");
      } else {
        const { error } = await supabase.from("sponsored_banners").insert(payload);
        if (error) throw error;
        toast.success("Banner created");
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{banner ? "Edit Banner" : "New Banner"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Banner Title</Label>
            <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Summer Fest Promo" required />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="image">Image</Label>
            <Input id="image" type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} />
            {banner && !file && <p className="text-xs text-muted-foreground">Leave empty to keep existing image</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="link_url">Link URL (Optional)</Label>
            <Input id="link_url" type="url" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="display_order">Display Order</Label>
              <Input id="display_order" type="number" value={displayOrder} onChange={e => setDisplayOrder(e.target.value)} />
            </div>
            <div className="flex items-center space-x-2 mt-8">
              <input type="checkbox" id="is_active" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="h-4 w-4" />
              <Label htmlFor="is_active">Active</Label>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Saving..." : "Save Banner"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
