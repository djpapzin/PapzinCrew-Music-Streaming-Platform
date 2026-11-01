import {readFile,stat} from 'node:fs/promises';
import {normalizePrivateJid} from './policy.mjs';

// Membership comes only from pinned WhatsApp metadata, never a message claim.
export function createCommunityAccess(file, fetchMetadata, ttl=60000) {
 let members=new Set(), checked=0, pending;
 return {
  has: jid=>members.has(normalizePrivateJid(jid)),
  async refresh(now=Date.now()) {
   if(checked && now-checked<ttl)return;
   if(pending)return pending;
   pending=(async()=>{
    try {
     if((await stat(file)).mode&0o077)throw Error('Private community config required');
     const c=JSON.parse(await readFile(file,'utf8'));
     if(!/^\d+@g\.us$/.test(c.communityJid)||!/^\d+@g\.us$/.test(c.announcementJid))throw Error('Invalid community');
     const g=await fetchMetadata(c.announcementJid);
     if(g.id!==c.announcementJid||g.linkedParent!==c.communityJid||!g.isCommunityAnnounce)throw Error('Wrong community');
     members=new Set(g.participants.flatMap(p=>[p.id,p.phoneNumber,p.lid]).map(normalizePrivateJid).filter(Boolean));
    } catch { members.clear(); }
    finally {checked=now;pending=null;}
   })();
   return pending;
  }
 };
}
