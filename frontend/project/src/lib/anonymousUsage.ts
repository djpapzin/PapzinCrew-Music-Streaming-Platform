import { API_BASE } from './api';
export const TEST_ACTIVITY='papzincrew:test-activity';
export function testActivity(){try{return localStorage.getItem(TEST_ACTIVITY)==='1';}catch{return false;}}
export const USAGE_OPT_OUT='papzincrew:anonymous-stats-off';
export const LISTEN_FLUSH_INTERVAL_MS=60000;
export function usageAllowed() {
  try {
    return navigator.doNotTrack!=='1' && !(navigator as Navigator&{globalPrivacyControl?:boolean}).globalPrivacyControl && localStorage.getItem(USAGE_OPT_OUT)!=='1' && !location.hostname.includes('--') && location.hostname!=='localhost' && location.hostname!=='127.0.0.1';
  }catch{return false;}
}
export function sendUsage(kind:string,mix=0,value=0,resume=false) {
  if(!usageAllowed())return;
  try {
    const body=JSON.stringify({activity:testActivity()?'test':'listener',kind,mix:Number(mix)||0,value:Math.max(0,Math.min(120000,Math.round(value))),resume,device:window.matchMedia('(max-width: 767px)').matches?'mobile':'desktop'});
    // Best effort only: no offline queue, retries or effect on playback.
    void fetch(`${API_BASE}/usage`,{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true,credentials:'omit',referrerPolicy:'no-referrer'}).catch(()=>{});
  }catch{/* Analytics must never affect listening. */}
}
export function recordVisit() {
  if(!usageAllowed()||location.pathname.startsWith('/admin'))return;
  try {
    const key='papzincrew:visit-time';const last=Number(sessionStorage.getItem(key)||0);const now=Date.now();
    if(now-last>30*60*1000)sendUsage('visit');
    sessionStorage.setItem(key,String(now));
  }catch{/* No storage means skip visitor counting rather than invent identifiers. */}
}
export function createPlaybackUsage() {
  let mix=0;let requested=0;let resume=false;let pending=false;let failure=false;let since:number|null=null;
  const flush=()=>{if(since!==null){const now=performance.now();sendUsage('listen',mix,Math.min(120000,now-since));since=now;}};
  const stop=()=>{flush();since=null;};
  return {
    begin(id:string,isResume:boolean){stop();mix=Number(id)||0;resume=isResume;requested=performance.now();pending=true;failure=false;sendUsage('attempt',mix,0,resume);},
    started(){if(pending){sendUsage('start',mix,performance.now()-requested,resume);pending=false;}if(since===null)since=performance.now();},
    stop,
    cancel(){stop();pending=false;},
    failed(){stop();if(!failure&&mix){sendUsage('failed',mix,0,resume);failure=true;}pending=false;},
    flush,
  };
}
