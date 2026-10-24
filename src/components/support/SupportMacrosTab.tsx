import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Copy, Check, Tag, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function SupportMacrosTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: macros, isLoading } = useQuery({
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

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search macros..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 rounded-xl text-xs h-9"
            />
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

                    <div className="flex justify-end">
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
    </div>
  );
}
