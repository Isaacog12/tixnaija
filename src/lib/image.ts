/**
 * Supabase Storage image transformations.
 *
 * A public object URL (`/storage/v1/object/public/...`) serves the original
 * upload at full size. Rewriting it to the render endpoint
 * (`/storage/v1/render/image/public/...`) makes Supabase resize and re-encode
 * the image on the edge, which is the single biggest LCP win on the public
 * event pages — organisers upload multi-megabyte posters.
 *
 * URLs that are not Supabase Storage objects (external CDNs, data URIs) are
 * returned untouched, since we cannot transform what we do not host.
 */

const STORAGE_OBJECT = "/storage/v1/object/public/";
const STORAGE_RENDER = "/storage/v1/render/image/public/";

/**
 * Image transformations are a paid Supabase add-on. This project's tenant
 * answers the render endpoint with 403 FeatureNotEnabled, which surfaced as
 * broken event posters. While that is the case every helper below returns the
 * original public object URL, which serves fine. Flip this to true only after
 * transformations are enabled in the Supabase dashboard.
 */
const IMAGE_TRANSFORMS_ENABLED = false;

export type ImageFormat = "webp" | "avif" | "origin";

function isSupabaseStorageUrl(url: string): boolean {
  return url.includes(STORAGE_OBJECT);
}

/**
 * Returns a resized, re-encoded variant of a Supabase Storage image.
 * `width` is in CSS pixels of the rendered box; pass the largest width the
 * element can occupy so the image stays sharp on high-DPI screens.
 */
export function optimizeImage(
  url: string | null | undefined,
  width: number = 800,
  format: ImageFormat = "webp",
): string | undefined {
  if (!url) return undefined;
  if (!IMAGE_TRANSFORMS_ENABLED) return url;
  if (!isSupabaseStorageUrl(url)) return url;

  const base = url.replace(STORAGE_OBJECT, STORAGE_RENDER);
  return `${base}?width=${width}&quality=80&format=${format}`;
}

/**
 * Builds a `srcset` from the same source image at several widths so the browser
 * downloads only what the current viewport needs. Widths must be ascending.
 */
export function imageSrcSet(
  url: string | null | undefined,
  widths: number[],
  format: ImageFormat = "webp",
): string | undefined {
  if (!IMAGE_TRANSFORMS_ENABLED) return undefined;
  if (!url || !isSupabaseStorageUrl(url)) return undefined;

  return widths
    .map((width) => `${optimizeImage(url, width, format)} ${width}w`)
    .join(", ");
}
