import sharp from 'sharp';

export const SKILLSHOT_MAX_BYTES = 10 * 1024 * 1024;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
export const MAX_IMAGE_WIDTH = 12_000;
export const MAX_IMAGE_HEIGHT = 12_000;
export const MAX_IMAGE_PIXELS = 40_000_000;

export type ProcessedImage = {
  width: number;
  height: number;
  display: Buffer;
  thumbnail: Buffer;
};

export function uploadError(file: File, maximumBytes: number) {
  if (!IMAGE_TYPES.has(file.type)) return 'UNSUPPORTED_FORMAT' as const;
  if (file.size <= 0) return 'INVALID_IMAGE' as const;
  if (file.size > maximumBytes) return 'FILE_TOO_LARGE' as const;
  return null;
}

export async function processSkillshot(buffer: Buffer): Promise<ProcessedImage> {
  const source = sharp(buffer, { failOn: 'warning', limitInputPixels: MAX_IMAGE_PIXELS, sequentialRead: true });
  const metadata = await source.metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  if (!width || !height || !['png', 'jpeg', 'webp'].includes(String(metadata.format))) throw new Error('INVALID_IMAGE');
  if (width > MAX_IMAGE_WIDTH || height > MAX_IMAGE_HEIGHT || width * height > MAX_IMAGE_PIXELS) throw new Error('HUGE_DIMENSIONS');

  const normalized = sharp(buffer, { failOn: 'warning', limitInputPixels: MAX_IMAGE_PIXELS, sequentialRead: true }).rotate();
  const display = await normalized.clone().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 88, effort: 4, smartSubsample: true }).toBuffer();
  const thumbnail = await normalized.clone().resize({ width: 960, height: 720, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80, effort: 4, smartSubsample: true }).toBuffer();
  return { width, height, display, thumbnail };
}

export async function processAvatar(buffer: Buffer) {
  const source = sharp(buffer, { failOn: 'warning', limitInputPixels: 20_000_000, sequentialRead: true });
  const metadata = await source.metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  if (!width || !height || !['png', 'jpeg', 'webp'].includes(String(metadata.format))) throw new Error('INVALID_IMAGE');
  if (width > 8_000 || height > 8_000 || width * height > 20_000_000) throw new Error('HUGE_DIMENSIONS');
  return source.rotate().resize(512, 512, { fit: 'cover', position: 'attention', withoutEnlargement: false }).webp({ quality: 84, effort: 4 }).toBuffer();
}

export function publicUploadMessage(code: string, kind: 'avatar' | 'skillshot' = 'skillshot') {
  const messages: Record<string, string> = {
    FILE_TOO_LARGE: kind === 'avatar' ? 'Image is too large. Please choose an image smaller than 2 MB.' : 'Image is too large. Please choose an image smaller than 10 MB.',
    UNSUPPORTED_FORMAT: 'Please upload a PNG, JPG, or WebP image.',
    INVALID_IMAGE: 'This file is not a valid image.',
    HUGE_DIMENSIONS: 'This image has extremely large dimensions. Please resize it and try again.',
    MODERATION_FAILED: 'This Skillshot could not be published because it did not pass the safety review.',
    STORAGE_UNAVAILABLE: 'Image storage is temporarily unavailable. Please try again later.',
  };
  return messages[code] || 'The upload could not be completed. Please try again.';
}
