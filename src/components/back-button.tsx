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
      className="hidden md:flex items-center justify-center w-9 h-9 rounded-lg bg-white/[0.06] border-[0.5px] border-white/[0.12] text-muted-foreground hover:text-foreground hover:bg-white/[0.1] transition-colors shadow-sm"
    >
      <ArrowLeft className="w-4 h-4" />
    </button>
  );
}
