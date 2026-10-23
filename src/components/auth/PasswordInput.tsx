import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Lock, Eye, EyeOff } from "lucide-react";

export interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
  showPassword?: boolean;
  onToggleVisibility?: () => void;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ id, label, error, showPassword, onToggleVisibility, className, ...props }, ref) => {
    return (
      <div className="flex-1 space-y-1.5">
        <Label
          htmlFor={id}
          className="text-zinc-600 dark:text-white/70 text-xs uppercase tracking-wider ml-1"
        >
          {label}
        </Label>
        <div className="relative group">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 dark:text-white/70 group-focus-within:text-zinc-900 dark:group-focus-within:text-white transition-colors" />
          <Input
            id={id}
            ref={ref}
            type={showPassword ? "text" : "password"}
            className={`pl-11 pr-11 h-12 bg-white dark:bg-white/5 border-black/10 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-white/60 focus-visible:ring-1 focus-visible:ring-black/20 dark:focus-visible:ring-white/20 focus-visible:border-black/30 dark:focus-visible:border-white/30 shadow-sm dark:shadow-none transition-all ${className || ""}`}
            {...props}
          />
          <button
            type="button"
            onClick={onToggleVisibility}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-white/70 hover:text-zinc-900 dark:hover:text-white transition-colors rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {error && <p className="text-xs text-destructive font-medium ml-1">{error}</p>}
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
