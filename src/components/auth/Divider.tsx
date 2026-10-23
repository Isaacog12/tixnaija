import React from "react";

export function Divider({ text = "OR CONTINUE WITH" }: { text?: string }) {
  return (
    <div className="relative py-4">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-black/10 dark:border-white/10" />
      </div>
      <div className="relative flex justify-center text-xs">
        <span className="bg-background px-3 text-zinc-500 dark:text-white/70">{text}</span>
      </div>
    </div>
  );
}
