export const SKILLSHOT_MAX_BYTES = 10 * 1024 * 1024;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
export const SKILLSHOT_TYPES = new Set([...IMAGE_TYPES, 'image/gif']);
// Configurable lower limits; hard ceilings bound decoder memory and scanner work.
export const GIF_MAX_FRAMES = Math.max(1,Math.min(120,Number(process.env.NEXT_PUBLIC_GIF_MAX_FRAMES)||120));
export const GIF_MAX_TOTAL_PIXELS = 40_000_000;
export const GIF_SAMPLE_FRAMES = 12;
export function sampledFrames(count:number){
  const samples=Math.min(count,GIF_SAMPLE_FRAMES);
  return Array.from({length:samples},(_,index)=>samples===1?0:Math.round(index*(count-1)/(samples-1)));
}

export function stagingType(pathname: unknown) {
  if (typeof pathname !== 'string') return null;
  const match = /^staging\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(png|jpg|webp|gif)$/.exec(pathname);
  return match ? ({ png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp',gif:'image/gif' } as Record<string, string>)[match[1]] : null;
}

export async function readBoundedImage(stream: ReadableStream<Uint8Array>, maximum: number) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > maximum) { await reader.cancel(); throw new Error('FILE_TOO_LARGE'); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  if (!length) throw new Error('INVALID_IMAGE');
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}
