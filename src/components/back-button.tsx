import { useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export function BackButton() {
  const router = useRouter();

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={() => router.history.back()}
      className="text-muted-foreground hover:text-foreground -ml-2"
    >
      <ArrowLeft className="w-4 h-4 mr-2" />
      Back
    </Button>
  );
}
