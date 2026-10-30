import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createCommunityAccess} from './community.mjs';
import {createPolicy} from './policy.mjs';

test('only pinned community metadata admits private members; stale failed checks close access',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'crew-community-'));
 try {
  const file=path.join(dir,'config.json');await writeFile(file,JSON.stringify({communityJid:'1@g.us',announcementJid:'2@g.us'}),{mode:0o600});
  let broken=false;
  const access=createCommunityAccess(file,async id=>{if(broken)throw Error('offline');return {id,linkedParent:'1@g.us',isCommunityAnnounce:true,participants:[{id:'555@lid',phoneNumber:'27840000000@s.whatsapp.net'}]};},100);
  await access.refresh(1000);assert.equal(access.has('555:9@lid'),true);assert.equal(access.has('27840000000@s.whatsapp.net'),true);assert.equal(access.has('999@lid'),false);
  const now=Date.now();const decide=createPolicy({tester:'27730000000',owner:'27730000000',enabled:true,persistent:true,natural:true,started:now,isCommunityMember:access.has});
  const msg={key:{remoteJid:'555@lid',id:'m'},messageTimestamp:Math.floor(now/1000),message:{conversation:'hello'}};
  assert.equal(decide('notify',msg,now).role,'listener');
  assert.equal(decide('notify',{...msg,key:{remoteJid:'27840000001@s.whatsapp.net',remoteJidAlt:'555@lid',id:'pn-device'}},now+1000).role,'listener');
  assert.equal(decide('notify',{...msg,key:{remoteJid:'3@g.us',remoteJidAlt:'555@lid',id:'g'}},now),null);
  broken=true;await access.refresh(1200);assert.equal(access.has('555@lid'),false);
 } finally {await rm(dir,{recursive:true,force:true});}
});

test('natural replies do not silently drop a quick confirmation or another member',()=>{
 const now=Date.now(),owner='27730000000';const d=createPolicy({tester:owner,owner,enabled:true,natural:true,persistent:true,isCommunityMember:()=>true});
 const msg=(jid,id,text)=>({key:{remoteJid:jid,id},messageTimestamp:Math.floor(now/1000),message:{conversation:text}});
 assert.ok(d('notify',msg('1@lid','a','I have feedback'),now));
 assert.ok(d('notify',msg('1@lid','b','yes'),now+1000));
 assert.ok(d('notify',msg('2@lid','c','hello'),now+1001));
 assert.equal(d('notify',msg('1@lid','b','yes'),now+2000),null);
});
