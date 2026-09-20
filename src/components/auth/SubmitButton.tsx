import React from "react";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight } from "lucide-react";
import { ButtonProps } from "@/components/ui/button";

export interface SubmitButtonProps extends ButtonProps {
  isSubmitting: boolean;
  text: string;
}

export function SubmitButton({ isSubmitting, text, className, ...props }: SubmitButtonProps) {
  return (
    <Button
      type="submit"
      disabled={isSubmitting || props.disabled}
      className={`w-full h-12 mt-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-[0_0_20px_hsl(var(--primary)/0.2)] transition-all disabled:opacity-50 disabled:shadow-none ${className || ""}`}
      {...props}
    >
      {isSubmitting ? (
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      ) : (
        <span className="flex items-center text-base">
          {text} <ArrowRight className="ml-2 h-4 w-4" />
        </span>
      )}
    </Button>
  );
}
