type StoredImage = { image_url: unknown; display_url?: unknown; thumbnail_url?: unknown; image_type: unknown };

export function imageDelivery(row: StoredImage, variant: string | null, download: boolean) {
  const isGif = String(row.image_type).toLowerCase() === 'image/gif';
  const optimized = !download && (variant === 'thumbnail' ? row.thumbnail_url || row.display_url : row.display_url);
  const type = !isGif && optimized ? 'image/webp' : String(row.image_type).toLowerCase();
  const extensions: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
  const pathname = String((isGif ? row.image_url : (optimized || row.image_url)));
  return { pathname, type, extension: extensions[type] || 'png' };
}
