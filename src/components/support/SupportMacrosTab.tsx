import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Copy, Check, Tag, Search, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/lib/toast";

export function SupportMacrosTab() {
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Create Macro Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [macroTitle, setMacroTitle] = useState("");
  const [macroCategory, setMacroCategory] = useState("general");
  const [macroContent, setMacroContent] = useState("");

  const { data: macros, isLoading, refetch } = useQuery({
    queryKey: ["support-macros-list"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("support_get_macros");
      if (error) {
        console.warn("support_get_macros:", error.message);
        return [];
      }
      return (data as any[]) || [];
    },
  });

  // Create Macro Mutation
  const createMutation = useMutation({
    mutationFn: async ({
      title,
      category,
      content,
    }: {
      title: string;
      category: string;
      content: string;
    }) => {
      const { data, error } = await (supabase.rpc as any)("admin_manage_macro", {
        p_action: "create",
        p_title: title.trim(),
        p_category: category,
        p_content: content.trim(),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("New canned macro response created.");
      setCreateModalOpen(false);
      setMacroTitle("");
      setMacroCategory("general");
      setMacroContent("");
      qc.invalidateQueries({ queryKey: ["support-macros-list"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create macro");
    },
  });

  // Delete Macro Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase.rpc as any)("admin_manage_macro", {
        p_action: "delete",
        p_id: id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Macro removed.");
      qc.invalidateQueries({ queryKey: ["support-macros-list"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete macro");
    },
  });

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    toast.success("Macro content copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredMacros = (macros || []).filter((m: any) => {
    const q = searchTerm.toLowerCase();
    return (
      m.title.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q) ||
      m.content.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-card/60 backdrop-blur">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-emerald-500" />
              Canned Responses & Macros
            </CardTitle>
            <CardDescription className="text-xs">
              Pre-approved standardized replies for common customer questions regarding transfers, refunds, missing emails, and door check-ins.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search macros..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 rounded-xl text-xs h-9"
              />
            </div>
            <Button
              size="sm"
              onClick={() => setCreateModalOpen(true)}
              className="rounded-xl text-xs h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              New Macro
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading macros...
            </div>
          ) : filteredMacros.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-sm font-medium text-foreground">No macros found</p>
              <p className="text-xs text-muted-foreground">
                No templates matched your search or no macros have been created yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMacros.map((m: any) => (
                <Card key={m.id} className="border-border/60 bg-card/50 flex flex-col justify-between">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-sm font-bold text-foreground">
                        {m.title}
                      </CardTitle>
                      <Badge variant="outline" className="text-[10px] uppercase shrink-0 font-medium">
                        {m.category}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-3 rounded-xl bg-secondary/40 border border-border/40 text-xs text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">
                      {m.content}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this macro template?")) {
                            deleteMutation.mutate(m.id);
                          }
                        }}
                        className="h-8 rounded-xl text-xs text-muted-foreground hover:text-rose-400 gap-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(m.id, m.content)}
                        className="h-8 rounded-xl text-xs gap-1.5"
                      >
                        {copiedId === m.id ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy Macro</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Macro Dialog */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-emerald-500" />
              Create Standardized Macro
            </DialogTitle>
            <DialogDescription className="text-xs">
              Add a reusable canned response template for support tickets and inquiry threads.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Macro Title:</label>
              <Input
                placeholder="e.g. Refund Policy / Event Postponement"
                value={macroTitle}
                onChange={(e) => setMacroTitle(e.target.value)}
                className="rounded-xl text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Category:</label>
              <Select value={macroCategory} onValueChange={setMacroCategory}>
                <SelectTrigger className="rounded-xl text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="tickets">Tickets</SelectItem>
                  <SelectItem value="payments">Payments</SelectItem>
                  <SelectItem value="refunds">Refunds</SelectItem>
                  <SelectItem value="checkin">Check-in</SelectItem>
                  <SelectItem value="account">Account</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Standardized Template Content:</label>
              <Textarea
                placeholder="Write the pre-approved standard response..."
                value={macroContent}
                onChange={(e) => setMacroContent(e.target.value)}
                rows={5}
                className="rounded-xl text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateModalOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={createMutation.isPending}
              onClick={() => {
                if (!macroTitle.trim()) {
                  toast.error("Please enter a title");
                  return;
                }
                if (!macroContent.trim() || macroContent.trim().length < 10) {
                  toast.error("Please enter comprehensive macro content");
                  return;
                }
                createMutation.mutate({
                  title: macroTitle,
                  category: macroCategory,
                  content: macroContent,
                });
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs"
            >
              {createMutation.isPending ? "Saving..." : "Create Macro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
