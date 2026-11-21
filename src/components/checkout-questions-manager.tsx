import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function CheckoutQuestionsManager({ eventId }: { eventId: string }) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  
  const [newQuestion, setNewQuestion] = useState({
    question_text: "",
    type: "text",
    required: false,
    options: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchQuestions();
  }, [eventId]);

  async function fetchQuestions() {
    const { data, error } = await supabase
      .from("checkout_questions")
      .select("*")
      .eq("event_id", eventId)
      .order("position", { ascending: true });
    
    if (error) {
      toast.error("Failed to fetch questions");
    } else {
      setQuestions(data || []);
    }
    setLoading(false);
  }

  async function addQuestion() {
    if (!newQuestion.question_text.trim()) {
      return toast.error("Question text is required");
    }
    
    setSaving(true);
    let optionsArr = null;
    if (newQuestion.type === 'select' || newQuestion.type === 'checkbox') {
       optionsArr = newQuestion.options.split(',').map(s => s.trim()).filter(Boolean);
       if (optionsArr.length < 2) {
         setSaving(false);
         return toast.error("Please provide at least 2 options, separated by commas");
       }
    }

    const { data, error } = await supabase.from("checkout_questions").insert({
      event_id: eventId,
      question_text: newQuestion.question_text,
      type: newQuestion.type as any,
      required: newQuestion.required,
      options: optionsArr,
      position: questions.length,
    }).select().single();

    setSaving(false);
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Question added!");
      setQuestions([...questions, data]);
      setOpen(false);
      setNewQuestion({ question_text: "", type: "text", required: false, options: "" });
    }
  }

  async function deleteQuestion(id: string) {
    if (!confirm("Are you sure?")) return;
    
    const { error } = await supabase.from("checkout_questions").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Question removed");
      setQuestions(questions.filter(q => q.id !== id));
    }
  }

  if (loading) return <div className="p-4 flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {questions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No custom questions added yet. You can ask buyers questions like "Dietary requirements?" or "T-shirt size?".</p>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <div key={q.id} className="flex items-start justify-between p-4 rounded-lg border border-border bg-background">
              <div>
                <p className="font-medium text-sm">{q.question_text} {q.required && <span className="text-destructive">*</span>}</p>
                <p className="text-xs text-muted-foreground capitalize">{q.type.replace('_', ' ')}</p>
                {q.options && q.options.length > 0 && (
                   <p className="text-xs text-muted-foreground mt-1">Options: {q.options.join(', ')}</p>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={() => deleteQuestion(q.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="secondary" className="w-full">
            <Plus className="h-4 w-4 mr-2" /> Add Question
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Question</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Question Text</Label>
              <Input 
                placeholder="e.g. What is your T-shirt size?" 
                value={newQuestion.question_text}
                onChange={e => setNewQuestion({...newQuestion, question_text: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Question Type</Label>
              <Select value={newQuestion.type} onValueChange={(v) => setNewQuestion({...newQuestion, type: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Short Text</SelectItem>
                  <SelectItem value="long_text">Long Text</SelectItem>
                  <SelectItem value="select">Dropdown (Select one)</SelectItem>
                  <SelectItem value="checkbox">Checkboxes (Select multiple)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(newQuestion.type === 'select' || newQuestion.type === 'checkbox') && (
              <div className="space-y-2">
                <Label>Options</Label>
                <Input 
                  placeholder="Small, Medium, Large" 
                  value={newQuestion.options}
                  onChange={e => setNewQuestion({...newQuestion, options: e.target.value})}
                />
                <p className="text-xs text-muted-foreground">Separate options with commas</p>
              </div>
            )}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <Label>Required</Label>
              <Switch 
                checked={newQuestion.required}
                onCheckedChange={c => setNewQuestion({...newQuestion, required: c})}
              />
            </div>
            <Button onClick={addQuestion} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : "Save Question"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
