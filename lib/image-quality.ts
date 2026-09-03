import { SKILLSHOT_TYPES, SKILLSHOT_MAX_BYTES } from './upload-policy.ts';
import { gifInfo } from './gif-info.ts';

export type ImageDimensions = { width: number; height: number; frames?:number };
export type ImageCrop = 'original' | 'square' | 'landscape';

export function imageQuality({ width, height }: ImageDimensions, bytes: number) {
  const longest = Math.max(width, height);
  const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
  const divisor = gcd(width, height);
  return {
    width, height, bytes,
    ratio: `${width / divisor}:${height / divisor}`,
    orientation: width === height ? 'Square' : width > height ? 'Landscape' : 'Portrait',
    level: longest < 800 ? 'low' : longest < 1200 ? 'acceptable' : longest < 1600 ? 'great' : 'excellent',
    label: longest < 800 ? '⚠ Low resolution' : longest < 1200 ? '✓ Acceptable resolution' : longest < 1600 ? '✓ Great image quality' : '✓ Excellent image resolution',
    unusual: Math.max(width / height, height / width) >= 3,
    recommendLarger: longest < 1200,
    fileSize: bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`,
  };
}

export function imageGeometry(source: ImageDimensions, crop: ImageCrop, rotation: number) {
  let width = source.width, height = source.height;
  const ratio = crop === 'square' ? 1 : crop === 'landscape' ? 4 / 3 : width / height;
  if (width / height > ratio) width = Math.round(height * ratio);
  else if (width / height < ratio) height = Math.round(width / ratio);
  const turn = ((rotation % 360) + 360) % 360;
  return { sourceWidth: width, sourceHeight: height, sourceX: Math.floor((source.width - width) / 2), sourceY: Math.floor((source.height - height) / 2),
    width: turn === 90 || turn === 270 ? height : width, height: turn === 90 || turn === 270 ? width : height, turn };
}

// Advisory browser checks. The upload API still independently validates bytes,
// MIME, decoded dimensions, authentication, rate limits and moderation.
export async function inspectSelectedImage(file: File): Promise<ImageDimensions> {
  if (!SKILLSHOT_TYPES.has(file.type)) throw new Error('Please upload a PNG, JPG, WebP, or GIF image.');
  if (!file.size) throw new Error('This file is not a valid image.');
  if (file.size > SKILLSHOT_MAX_BYTES) throw new Error('Large image. Please choose an image of 10 MB or less.');
  if(file.type==='image/gif')return gifInfo(new Uint8Array(await file.arrayBuffer()));
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const text = (start: number, end: number) => String.fromCharCode(...header.slice(start, end));
  const actual = header[0] === 0x89 && text(1, 4) === 'PNG' ? 'image/png' : header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff ? 'image/jpeg' : text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP' ? 'image/webp' : '';
  if (actual !== file.type) throw new Error('This file is not a valid PNG, JPG, or WebP image.');
  const url = URL.createObjectURL(file);
  try {
    const dimensions = await new Promise<ImageDimensions>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('This image could not be read. Please choose a valid, undamaged image.'));
      img.src = url;
    });
    if (!dimensions.width || !dimensions.height) throw new Error('This file is not a valid image.');
    if (dimensions.width > 12000 || dimensions.height > 12000 || dimensions.width * dimensions.height > 40_000_000) throw new Error('This image has extremely large dimensions. Please resize it and try again.');
    return dimensions;
  } finally { URL.revokeObjectURL(url); }
}

export async function prepareSelectedImage(file: File, dimensions: ImageDimensions, crop: ImageCrop, rotation: number) {
  if(file.type==='image/gif')return {file,...dimensions}; // Canvas edits would silently flatten animation.
  if (rotation === 0 && crop === 'original') return { file, ...dimensions };
  const geometry = imageGeometry(dimensions, crop, rotation);
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = geometry.width; canvas.height = geometry.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image editing is unavailable. Please keep the original image.');
    context.translate(canvas.width / 2, canvas.height / 2); context.rotate(geometry.turn * Math.PI / 180);
    context.drawImage(bitmap, geometry.sourceX, geometry.sourceY, geometry.sourceWidth, geometry.sourceHeight, -geometry.sourceWidth / 2, -geometry.sourceHeight / 2, geometry.sourceWidth, geometry.sourceHeight);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, file.type, .92));
    if (!blob) throw new Error('Image editing failed. Please keep the original image.');
    if (blob.size > SKILLSHOT_MAX_BYTES) throw new Error('The edited image exceeds 10 MB. Keep the original or choose another image.');
    return { file: new File([blob], file.name, { type: blob.type, lastModified: Date.now() }), width: geometry.width, height: geometry.height };
  } finally { bitmap.close(); }
}
