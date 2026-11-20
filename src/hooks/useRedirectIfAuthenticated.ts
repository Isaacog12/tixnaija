import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "@/lib/toast";
import { supabase } from "@/integrations/supabase/client";
import { getAuthErrorMessage } from "@/utils/auth-errors";

export function useRedirectIfAuthenticated(redirectUrl?: string) {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (data.session) navigate({ to: redirectUrl || "/dashboard", replace: true });
      })
      .catch((err: unknown) => {
        console.error("Failed to check session:", err);
        toast.error(getAuthErrorMessage(err));
      });
  }, [navigate]);
}
