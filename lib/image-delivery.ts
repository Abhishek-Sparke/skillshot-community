type StoredImage = { image_url: unknown; display_url?: unknown; thumbnail_url?: unknown; image_type: unknown };

export function imageDelivery(row: StoredImage, variant: string | null, download: boolean) {
  const optimized = !download && (variant === 'thumbnail' ? row.thumbnail_url || row.display_url : row.display_url);
  const type = optimized ? 'image/webp' : String(row.image_type).toLowerCase();
  const extensions: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
  return { pathname: String(optimized || row.image_url), type, extension: extensions[type] || 'png' };
}
