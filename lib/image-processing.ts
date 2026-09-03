import sharp from 'sharp';
import { AVATAR_MAX_BYTES, IMAGE_TYPES, SKILLSHOT_MAX_BYTES } from './upload-policy.ts';
import { SKILLSHOT_TYPES,GIF_MAX_FRAMES,GIF_MAX_TOTAL_PIXELS,sampledFrames } from './upload-policy.ts';

export { AVATAR_MAX_BYTES, IMAGE_TYPES, SKILLSHOT_MAX_BYTES };
export const MAX_IMAGE_WIDTH = 12_000;
export const MAX_IMAGE_HEIGHT = 12_000;
export const MAX_IMAGE_PIXELS = 40_000_000;

export type ProcessedImage = {
  width: number;
  height: number;
  display: Buffer;
  thumbnail: Buffer;
};

const MIME_BY_FORMAT: Record<string, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

function assertDecodedImage(metadata: sharp.Metadata, declaredType?: string, allowGif=false) {
  const width = Number(metadata.width || 0);
  const height = Number(metadata.pageHeight || metadata.height || 0);
  const format = String(metadata.format || '');
  if (!width || !height || !MIME_BY_FORMAT[format]) throw new Error('INVALID_IMAGE');
  if(format==='gif'&&!allowGif)throw new Error('INVALID_IMAGE');
  if ((metadata.pages || 1) > 1 && format!=='gif') throw new Error('INVALID_IMAGE');
  if(format==='gif'&&((metadata.pages||1)>GIF_MAX_FRAMES||width*height*(metadata.pages||1)>GIF_MAX_TOTAL_PIXELS))throw new Error('GIF_TOO_COMPLEX');
  if (declaredType && MIME_BY_FORMAT[format] !== declaredType) throw new Error('MIME_MISMATCH');
  return { width, height };
}

export function uploadError(file: File, maximumBytes: number) {
  if (!(maximumBytes===AVATAR_MAX_BYTES?IMAGE_TYPES:SKILLSHOT_TYPES).has(file.type)) return 'UNSUPPORTED_FORMAT' as const;
  if (file.size <= 0) return 'INVALID_IMAGE' as const;
  if (file.size > maximumBytes) return 'FILE_TOO_LARGE' as const;
  return null;
}

export async function moderationPreview(buffer: Buffer, declaredType: string) {
  const source = sharp(buffer, { failOn: 'warning', limitInputPixels: MAX_IMAGE_PIXELS, sequentialRead: true });
  const { width, height } = assertDecodedImage(await source.metadata(), declaredType);
  if (width > MAX_IMAGE_WIDTH || height > MAX_IMAGE_HEIGHT || width * height > MAX_IMAGE_PIXELS) throw new Error('HUGE_DIMENSIONS');
  // Decode a bounded copy for the scanner: private Blob URLs cannot be read by
  // an external moderation service. The original stays private and unchanged.
  const preview = await source.rotate().resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  return `data:image/webp;base64,${preview.toString('base64')}`;
}

export async function moderationFrames(buffer:Buffer,declaredType:string){
  if(declaredType!=='image/gif')return [await moderationPreview(buffer,declaredType)];
  const metadata=await sharp(buffer,{limitInputPixels:GIF_MAX_TOTAL_PIXELS,failOn:'warning'}).metadata();
  const {width,height}=assertDecodedImage(metadata,declaredType,true);
  if(width>MAX_IMAGE_WIDTH||height>MAX_IMAGE_HEIGHT)throw Error('HUGE_DIMENSIONS');
  const previews:string[]=[];
  for(const page of sampledFrames(metadata.pages||1)){
    const frame=await sharp(buffer,{page,pages:1,limitInputPixels:GIF_MAX_TOTAL_PIXELS,failOn:'warning'}).resize({width:1024,height:1024,fit:'inside',withoutEnlargement:true}).webp({quality:82}).toBuffer();
    previews.push(`data:image/webp;base64,${frame.toString('base64')}`);
  }
  return previews;
}

export async function processSkillshot(buffer: Buffer, declaredType?: string): Promise<ProcessedImage> {
  const source = sharp(buffer, { failOn: 'warning', limitInputPixels: MAX_IMAGE_PIXELS, sequentialRead: true });
  const metadata = await source.metadata();
  const { width, height } = assertDecodedImage(metadata, declaredType,true);
  if (width > MAX_IMAGE_WIDTH || height > MAX_IMAGE_HEIGHT || width * height > MAX_IMAGE_PIXELS) throw new Error('HUGE_DIMENSIONS');

  if(metadata.format==='gif'){
    const display=await sharp(buffer,{animated:true,failOn:'warning',limitInputPixels:GIF_MAX_TOTAL_PIXELS}).resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:85,effort:3,loop:metadata.loop||0}).toBuffer();
    const thumbnail=await sharp(buffer,{page:0,pages:1,failOn:'warning',limitInputPixels:GIF_MAX_TOTAL_PIXELS}).resize({width:960,height:720,fit:'inside',withoutEnlargement:true}).webp({quality:80}).toBuffer();
    return {width,height,display,thumbnail};
  }
  const normalized = sharp(buffer, { failOn: 'warning', limitInputPixels: MAX_IMAGE_PIXELS, sequentialRead: true }).rotate();
  const display = await normalized.clone().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 88, effort: 4, smartSubsample: true }).toBuffer();
  const thumbnail = await normalized.clone().resize({ width: 960, height: 720, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80, effort: 4, smartSubsample: true }).toBuffer();
  const swapped = [5, 6, 7, 8].includes(metadata.orientation || 1);
  return { width: swapped ? height : width, height: swapped ? width : height, display, thumbnail };
}

export async function processAvatar(buffer: Buffer, declaredType?: string) {
  const source = sharp(buffer, { failOn: 'warning', limitInputPixels: 20_000_000, sequentialRead: true });
  const metadata = await source.metadata();
  const { width, height } = assertDecodedImage(metadata, declaredType);
  if (width > 8_000 || height > 8_000 || width * height > 20_000_000) throw new Error('HUGE_DIMENSIONS');
  return source.rotate().resize(512, 512, { fit: 'cover', position: 'attention', withoutEnlargement: false }).webp({ quality: 84, effort: 4 }).toBuffer();
}

export function publicUploadMessage(code: string, kind: 'avatar' | 'skillshot' = 'skillshot') {
  const messages: Record<string, string> = {
    FILE_TOO_LARGE: kind === 'avatar' ? 'Image is too large. Please choose an image smaller than 2 MB.' : 'Image is too large. Please choose an image smaller than 10 MB.',
    UNSUPPORTED_FORMAT: kind==='avatar'?'Please upload a PNG, JPG, or WebP image.':'Please upload a PNG, JPG, WebP, or GIF image.',
    GIF_TOO_COMPLEX: 'GIF is too large or has too many frames. Please upload a smaller file.',
    INVALID_IMAGE: 'This file is not a valid image.',
    HUGE_DIMENSIONS: 'This image has extremely large dimensions. Please resize it and try again.',
    MODERATION_FAILED: "This upload couldn't be published because it doesn't meet Skillshot's content guidelines.",
    MODERATION_UNAVAILABLE: 'The automatic image safety check is temporarily unavailable. Please try again shortly. Your Skillshot has not been published.',
    STORAGE_UNAVAILABLE: 'Image storage is temporarily unavailable. Please try again later.',
  };
  return messages[code] || 'The upload could not be completed. Please try again.';
}
