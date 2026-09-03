import { GIF_MAX_FRAMES,GIF_MAX_TOTAL_PIXELS } from './upload-policy.ts';
/** Bounded structural inspection; the server still fully decodes the animation. */
export function gifInfo(bytes:Uint8Array){
  const text=String.fromCharCode(...bytes.slice(0,6));if(!['GIF87a','GIF89a'].includes(text)||bytes.length<14)throw Error('Invalid GIF.');
  const word=(offset:number)=>bytes[offset]|bytes[offset+1]<<8;
  const width=word(6),height=word(8);let cursor=13,frames=0;
  if(bytes[10]&128)cursor+=3*(2**((bytes[10]&7)+1));
  function subblocks(){while(cursor<bytes.length){const size=bytes[cursor++];if(!size)return;cursor+=size;if(cursor>bytes.length)throw Error('Corrupted GIF.');}throw Error('Incomplete GIF.');}
  while(cursor<bytes.length){
    const marker=bytes[cursor++];
    if(marker===0x3b){if(!frames||!width||!height)throw Error('Invalid GIF.');return {width,height,frames};}
    if(marker===0x21){cursor++;subblocks();continue;}
    if(marker!==0x2c||cursor+9>=bytes.length)throw Error('Corrupted GIF.');
    const packed=bytes[cursor+8];cursor+=9;if(packed&128)cursor+=3*(2**((packed&7)+1));cursor++;subblocks();frames++;
    if(frames>GIF_MAX_FRAMES||width*height*frames>GIF_MAX_TOTAL_PIXELS)throw Error('GIF is too large or has too many frames. Please upload a smaller file.');
  }
  throw Error('Incomplete GIF.');
}
