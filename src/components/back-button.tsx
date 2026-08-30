import { useRouter, useLocation } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export function BackButton() {
  const router = useRouter();
  const location = useLocation();

  // Hide on the home page as there's nowhere to go back to.
  if (location.pathname === "/") {
    return null;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 w-full">
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => router.history.back()}
        className="text-muted-foreground hover:text-foreground -ml-2"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>
    </div>
  );
}
