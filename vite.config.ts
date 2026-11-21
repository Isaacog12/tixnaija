// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { visualizer } from "rollup-plugin-visualizer";
import path from "path";

export default defineConfig({
  vite: {
    // Console/debugger stripping is deliberately NOT configured here. Vite 8 runs
    // transforms through Oxc and ignores `esbuild` options outright (the build
    // logs "Both esbuild and oxc options were set. oxc options will be used and
    // esbuild options will be ignored."), so an `esbuild.drop` entry only failed
    // the type check while doing nothing at all.
    resolve: {
      alias: {
        "node:async_hooks": path.resolve("./src/lib/empty-mock.ts"),
      },
    },
    plugins: [visualizer({ filename: "stats.html", gzipSize: true, template: "treemap" }) as any],
    optimizeDeps: {
      exclude: ["@tanstack/start-storage-context", "node:async_hooks"],
      include: [
        "react",
        "react-dom",
        "@tanstack/react-router",
        "@tanstack/react-query",
        "@tanstack/react-start",
        "@supabase/supabase-js",
        "lucide-react",
        "date-fns",
        "zod",
        "react-hook-form",
        "@hookform/resolvers",
        "recharts",
        "clsx",
        "tailwind-merge",
        "class-variance-authority",
        "jspdf",
        "html-to-image",
        "@yudiel/react-qr-scanner",
        "qrcode.react",
        "@radix-ui/react-dialog",
        "@radix-ui/react-dropdown-menu",
        "@radix-ui/react-popover",
        "@radix-ui/react-slot",
        "@radix-ui/react-label",
        "@radix-ui/react-select"
      ],
    },
    ssr: {
      noExternal: ["@tanstack/start"],
      external: ["node:async_hooks"],
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
