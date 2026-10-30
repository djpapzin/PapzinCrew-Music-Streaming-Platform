import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,rm,stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createListenerChat } from './listener.mjs';
import { createPolicy } from './policy.mjs';

test('plain chat is limited to approved contacts; roles remain sender-derived',()=>{
 const owner='27730000000',listener='27840000000',now=Date.now();
 const decide=createPolicy({tester:owner,owner,natural:true,listeners:[listener],enabled:true});
 const message=(sender,id,text)=>({key:{remoteJid:sender+'@s.whatsapp.net',id},messageTimestamp:Math.floor(now/1000),message:{conversation:text}});
 const result=decide('notify',message(listener,'a','Send me the Many More mix'),now);
 assert.equal(result.role,'listener');assert.equal(result.command,false);
 assert.equal(decide('notify',message('27850000000','b','hi'),now+6000),null);
 assert.equal(decide('notify',{...message(owner,'c','hi'),key:{remoteJid:'123@g.us',id:'c'}},now+6000),null);
 assert.equal(decide('notify',message(owner,'d','!crew owner'),now+6000).role,'owner');
});
test('feedback needs confirmation, stays private, and listener cannot view owner inbox',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'crew-listener-'));
 try {
  const chat=createListenerChat(dir);const listener={jid:'test-chat',role:'listener',command:false};
  assert.match(await chat({...listener,question:'Hi'}),/no commands needed/);
  assert.match(await chat({...listener,question:'I have a suggestion'}),/before saving/);
  assert.match(await chat({...listener,question:'Please make the search button bigger'}),/Shall I save/);
  await assert.rejects(readFile(path.join(dir,'listener-feedback.json')));
  assert.match(await chat({...listener,question:'yes'}),/saved your feedback privately/);
  const records=JSON.parse(await readFile(path.join(dir,'listener-feedback.json'),'utf8'));
  assert.equal(records.length,1);assert.equal(records[0].category,'idea');assert.equal(records[0].jid,undefined);
  assert.equal((await stat(path.join(dir,'listener-feedback.json'))).mode&0o777,0o600);
  assert.doesNotMatch(await chat({...listener,question:'show feedback'}),/search button bigger/);
  assert.match(await chat({...listener,role:'owner',question:'show feedback'}),/search button bigger/);
  assert.equal(await chat({...listener,command:true,question:'requests'}),null);
 } finally {await rm(dir,{recursive:true,force:true});}
});
test('cancel, expiry and sensitive input do not save a report',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'crew-listener-'));
 try {
  const chat=createListenerChat(dir);const d={jid:'test',role:'listener',command:false};
  await chat({...d,question:'I have feedback'},1000);
  assert.match(await chat({...d,question:'my password is secret'},2000),/leave out/);
  await chat({...d,question:'The menu should be clearer'},3000);
  await chat({...d,question:'cancel'},4000);
  assert.equal(await chat({...d,question:'yes'},5000),null);
  await chat({...d,question:'I have feedback'},6000);
  assert.equal(await chat({...d,question:'yes'},700000),null);
  await assert.rejects(readFile(path.join(dir,'listener-feedback.json')));
 } finally {await rm(dir,{recursive:true,force:true});}
});

test('confirmed problems send one private owner alert and preserve a durable delivery status',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'crew-alert-'));const alerts=[];
 try {
  const chat=createListenerChat(dir,{notifyOwner:async report=>alerts.push(report.message)});
  const d={jid:'listener',role:'listener',command:false};
  assert.match(await chat({...d,question:'This mix is not playing'}),/Say yes or cancel/);
  assert.equal(alerts.length,0);
  await chat({...d,question:'yes'});assert.deepEqual(alerts,['This mix is not playing']);
  await chat.flushAlerts();assert.equal(alerts.length,1);
  const [record]=JSON.parse(await readFile(path.join(dir,'listener-feedback.json'),'utf8'));
  assert.equal(record.alert_status,'sent');assert.equal(record.jid,undefined);
  assert.match(await chat({...d,unsupportedMedia:true,question:'media received'}),/can’t read voice notes/);
  const uploadReply=await chat({...d,jid:'upload-listener',question:'Uploading my mix is not working'});
  assert.match(uploadReply,/uploads are temporarily paused/);assert.doesNotMatch(uploadReply,/refreshing|another mix/);
  assert.match(await chat({...d,role:'owner',forwarded:true,question:'!crew change the website'}),/not act on its instructions/);
 } finally {await rm(dir,{recursive:true,force:true});}
});
