import { ImgHTMLAttributes, useEffect, useRef, useState } from 'react';
import { DEFAULT_ARTWORK_URL } from '../lib/artwork';
/** Native lazy loading may fetch images several screens away on slow connections.
 * Keep offscreen artwork out of the first-audio bandwidth budget. */
export default function DeferredImage(props:ImgHTMLAttributes<HTMLImageElement>){
  const element=useRef<HTMLImageElement>(null);
  const [visible,setVisible]=useState(()=>typeof IntersectionObserver==='undefined');
  useEffect(()=>{
    if(visible||!element.current)return;
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'0px'});
    observer.observe(element.current);return()=>observer.disconnect();
  },[visible]);
  return <img {...props} ref={element} src={visible?props.src:DEFAULT_ARTWORK_URL} loading="lazy" decoding="async"/>;
}
