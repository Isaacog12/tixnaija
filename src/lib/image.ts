export function optimizeImage(url: string | null | undefined, width: number = 800): string {
  if (!url) return "";
  // Check if it's already a Supabase public URL
  if (url.includes("/storage/v1/object/public/")) {
    return url.replace("/storage/v1/object/public/", `/storage/v1/render/image/public/`) + `?width=${width}&quality=80`;
  }
  return url;
}
