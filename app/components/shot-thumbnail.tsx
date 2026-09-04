'use client';
import { useState } from 'react';
export function shotFrameRatio(width:number,height:number) {return Math.max(.4,Math.min(4,(width||4)/(height||3)));}
export default function ShotThumbnail({src,title,author,width,height,onPreview}:{src:string;title:string;author:string;width:number;height:number;onPreview:()=>void}) {
  const [loaded,setLoaded]=useState(false);
  const [failed,setFailed]=useState(false);
  const extreme=width/height<.4||width/height>4;
  return <button type="button" className={`shotMediaLink ${loaded?'isLoaded':'isLoading'}`} onClick={onPreview} aria-label={'Preview '+title} aria-haspopup="dialog">{failed?<span className="imageUnavailable">Image unavailable</span>:<img className={loaded?'thumbFadeIn':'thumbHidden'} src={src} alt={title+' by '+author} width={width||640} height={height||480} loading="lazy" decoding="async" sizes="(max-width: 519px) 100vw, (max-width: 900px) 50vw, (max-width: 1399px) 33vw, 25vw" onLoad={()=>setLoaded(true)} onError={()=>setFailed(true)}/>} {extreme&&<span className="fullImageHint">View full image ↗</span>}</button>;
}
