import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { LucideIcon } from "lucide-react";

export interface AuthFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  icon: LucideIcon;
  error?: string;
}

export const AuthField = React.forwardRef<HTMLInputElement, AuthFieldProps>(
  ({ id, label, icon: Icon, error, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        <Label
          htmlFor={id}
          className="text-zinc-600 dark:text-white/70 text-xs uppercase tracking-wider ml-1"
        >
          {label}
        </Label>
        <div className="relative group">
          <Icon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 dark:text-white/40 group-focus-within:text-zinc-900 dark:group-focus-within:text-white transition-colors" />
          <Input
            id={id}
            ref={ref}
            className={`pl-11 h-12 bg-white dark:bg-white/5 border-black/10 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-black/20 dark:focus-visible:ring-white/20 focus-visible:border-black/30 dark:focus-visible:border-white/30 shadow-sm dark:shadow-none transition-all ${className || ""}`}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-red-400 ml-1">{error}</p>}
      </div>
    );
  },
);
AuthField.displayName = "AuthField";
