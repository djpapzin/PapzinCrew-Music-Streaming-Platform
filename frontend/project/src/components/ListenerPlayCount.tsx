import {useEffect,useState} from 'react';
import {API_BASE} from '../lib/api';
export default function ListenerPlayCount({mixId}:{mixId:string}){
 const [result,setResult]=useState<{id:string;count:number}|null>(null);
 useEffect(()=>{
  setResult(null);const controller=new AbortController();
  fetch(`${API_BASE}/tracks/${encodeURIComponent(mixId)}/listener-plays`,{signal:controller.signal})
   .then(async response=>{if(!response.ok)throw new Error();return response.json();})
   .then(data=>{if(!controller.signal.aborted&&Number.isSafeInteger(data.plays)&&data.plays>=0)setResult({id:mixId,count:data.plays});})
   .catch(()=>{});
  return ()=>controller.abort();
 },[mixId]);
 if(!result||result.id!==mixId)return null;
 return <p className="text-sm text-gray-400" title="Successful playback starts in the last 30 days since listener tracking began. Marked tests and earlier mixed activity are excluded. Repeat listens can count; these are not unique listeners.">{result.count.toLocaleString()} listener {result.count===1?'play':'plays'} · last 30 days</p>;
}
