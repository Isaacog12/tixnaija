import { Toaster as Sonner } from "sonner";
import { CheckCircle2, XCircle, AlertCircle, Info } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-zinc-950/90 group-[.toaster]:backdrop-blur-md group-[.toaster]:text-zinc-50 group-[.toaster]:border-zinc-800/50 group-[.toaster]:shadow-2xl font-sans rounded-xl overflow-hidden",
          description: "group-[.toast]:text-zinc-400",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground font-medium",
          cancelButton: "group-[.toast]:bg-zinc-800 group-[.toast]:text-zinc-300 font-medium",
          error: "group-[.toaster]:bg-zinc-950/95 group-[.toaster]:border-red-900/50 group-[.toaster]:text-zinc-50",
          success: "group-[.toaster]:bg-zinc-950/95 group-[.toaster]:border-green-900/50 group-[.toaster]:text-zinc-50",
          warning: "group-[.toaster]:bg-zinc-950/95 group-[.toaster]:border-orange-900/50 group-[.toaster]:text-zinc-50",
          info: "group-[.toaster]:bg-zinc-950/95 group-[.toaster]:border-blue-900/50 group-[.toaster]:text-zinc-50",
          icon: "group-[.toast]:mr-2",
        },
      }}
      icons={{
        success: <CheckCircle2 className="w-5 h-5 text-green-500" />,
        error: <XCircle className="w-5 h-5 text-red-500" />,
        warning: <AlertCircle className="w-5 h-5 text-orange-500" />,
        info: <Info className="w-5 h-5 text-blue-500" />,
      }}
      {...props}
    />
  );
};

export { Toaster };
