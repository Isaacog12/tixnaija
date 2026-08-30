import { useRouter, useLocation } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export function BackButton() {
  const router = useRouter();
  const location = useLocation();

  // Hide on the home page as there's nowhere to go back to.
  if (location.pathname === "/") {
    return null;
  }

  return (
    <button 
      onClick={() => router.history.back()}
      aria-label="Go back"
      className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-secondary/50 border border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary hover:border-border transition-all duration-300 shadow-sm hover:shadow-md active:scale-95 group"
    >
      <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
    </button>
  );
}
