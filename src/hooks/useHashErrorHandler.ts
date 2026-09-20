import { useEffect } from "react";
import { toast } from "sonner";
import { getAuthErrorMessage } from "@/utils/auth-errors";

export function useHashErrorHandler() {
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("error_description=")) {
      const params = new URLSearchParams(hash.substring(1));
      const errorDesc = params.get("error_description");
      if (errorDesc) {
        toast.error(getAuthErrorMessage(errorDesc.replace(/\+/g, " ")));
        window.history.replaceState(null, "", window.location.pathname);
      }
    }
  }, []);
}
