import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createReleaseAssistant } from './release.mjs';
const guest={id:'guest48',title:'Cruize Friday Guest 48',credit:'Mr Dominate SA',date:'2026-10-30',url:'https://crew.djpapzin.com/track/241'};
const groups=[{key:'pilot',name:'Private release test',jid:'120000000000000@g.us'}];
async function setup(t,options={}) {
 const dir=await mkdtemp(path.join(os.tmpdir(),'crew-release-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const sent=[];const app=createReleaseAssistant(dir,{groups,enabled:true,isPublic:async()=>true,now:()=>Date.parse('2026-10-29T20:00:00Z'),send:async(...args)=>sent.push(args),...options});
 await app.seed(guest);
 return {dir,app,sent,ask:question=>app.handle({role:'owner',question})};
}
test('Guest 48 stays a private draft and preserves its DJ credit',async t=>{
 const {ask,dir,sent}=await setup(t); const reply=await ask('prepare guest48');
 assert.match(reply,/Mr Dominate SA/);assert.match(reply,/2026-10-30/);assert.equal(sent.length,0);
 assert.equal((await stat(path.join(dir,'releases.json'))).mode&0o777,0o600);
});
test('existing GitHub previews and listener conversation are not intercepted',async t=>{
 const {app}=await setup(t);
 assert.equal(await app.handle({role:'owner',question:'preview abc12345'}),null);
 assert.equal(await app.handle({role:'listener',question:'send me Many More'}),null);
 assert.match(await app.handle({role:'listener',question:'approve guest48 teaser'}),/privately/);
});
test('send requires selected approved groups and an exact preview approval',async t=>{
 const {ask,sent}=await setup(t);
 assert.match(await ask('send guest48 teaser'),/no groups/);
 await ask('release guest48 groups pilot');
 assert.match(await ask('approve guest48 teaser'),/Preview/);
 assert.match(await ask('send guest48 teaser'),/Preview|preview/);
 const preview=await ask('preview guest48 teaser');assert.match(preview,/Private release test/);
 assert.equal(sent.length,0);await ask('approve guest48 teaser');assert.equal(sent.length,0);
 await ask('send guest48 teaser');assert.equal(sent.length,1);assert.equal(sent[0][0],groups[0].jid);
 await ask('send guest48 teaser');assert.equal(sent.length,1);
});
test('edits invalidate approval and cannot invent a group destination',async t=>{
 const {ask,sent}=await setup(t);await ask('release guest48 groups pilot');await ask('preview guest48 teaser');await ask('approve guest48 teaser');
 await ask('release guest48 teaser text Revised teaser');
 assert.match(await ask('send guest48 teaser'),/changed/);assert.equal(sent.length,0);
 assert.match(await ask('release guest48 groups strangers'),/Choose approved/);
});
test('disabled transport, non-public link and wrong release date block sending',async t=>{
 for(const options of [{enabled:false},{isPublic:async()=>false},{now:()=>Date.parse('2026-10-30T00:00:00Z')}]) {
  const {ask,sent}=await setup(t,options);await ask('release guest48 groups pilot');await ask('preview guest48 teaser');await ask('approve guest48 teaser');await ask('send guest48 teaser');assert.equal(sent.length,0);
 }
 const {ask,sent}=await setup(t);await ask('release guest48 groups pilot');await ask('preview guest48 launch');await ask('approve guest48 launch');assert.match(await ask('send guest48 launch'),/release date/);assert.equal(sent.length,0);
});
test('uncertain delivery stops the batch and stays blocked after restart',async t=>{
 let attempts=0;const both=[...groups,{key:'second',name:'Second test group',jid:'120000000000001@g.us'}];
 const {ask,dir}=await setup(t,{groups:both,send:async()=>{attempts++;throw new Error('network');}});
 await ask('release guest48 groups pilot,second');await ask('preview guest48 teaser');await ask('approve guest48 teaser');assert.match(await ask('send guest48 teaser'),/could not be confirmed/);assert.equal(attempts,1);
 const again=createReleaseAssistant(dir,{groups:both,enabled:true,send:async()=>attempts++,isPublic:async()=>true,now:()=>Date.parse('2026-10-29T20:00:00Z')});
 assert.match(await again.handle({role:'owner',question:'send guest48 teaser'}),/already attempted/);assert.equal(attempts,1);
});
test('attachments are owner-only, bounded and kept private',async t=>{
 const {app,dir}=await setup(t);let downloads=0;
 const attachment={mime:'video/mp4',size:4};const decision={role:'owner',question:'release guest48 teaser',attachment};
 assert.match(await app.attach({...decision,role:'listener'},async()=>{downloads++;}),/Only DJ/);assert.equal(downloads,0);
 assert.match(await app.attach({...decision,attachment:{...attachment,size:40*1024*1024}},async()=>{downloads++;}),/30 MB/);assert.equal(downloads,0);
 await app.attach(decision,async()=>Buffer.from('test'));
 assert.equal((await stat(path.join(dir,'guest48-teaser'))).mode&0o777,0o600);
});
test('attachment changes after approval cannot be sent',async t=>{
 const {app,ask,dir,sent}=await setup(t);
 await app.attach({role:'owner',question:'release guest48 teaser',attachment:{mime:'video/mp4',size:4}},async()=>Buffer.from('test'));
 await ask('release guest48 groups pilot');await ask('preview guest48 teaser');await ask('approve guest48 teaser');
 await writeFile(path.join(dir,'guest48-teaser'),'edit');assert.match(await ask('send guest48 teaser'),/attachment changed/);assert.equal(sent.length,0);
});
test('a changed configured group requires a new approval',async t=>{
 const {ask,dir}=await setup(t);await ask('release guest48 groups pilot');await ask('preview guest48 teaser');await ask('approve guest48 teaser');
 let sent=0;const again=createReleaseAssistant(dir,{groups:[{...groups[0],jid:'120000000000002@g.us'}],enabled:true,isPublic:async()=>true,send:async()=>sent++});
 assert.match(await again.handle({role:'owner',question:'send guest48 teaser'}),/changed/);assert.equal(sent,0);
});
test('seeding twice does not overwrite owner edits and invalid URLs are rejected',async t=>{
 const {app,ask}=await setup(t);await ask('release guest48 teaser text My edited teaser');assert.equal(await app.seed(guest),false);assert.match(await ask('preview guest48 teaser'),/My edited teaser/);
 await assert.rejects(app.seed({...guest,id:'other',url:'https://storage.example.com/audio.mp3'}));
});

test('media preview returns the exact attachment only to the owner after a matching preview',async t=>{
 const {app,ask}=await setup(t);
 await app.attach({role:'owner',question:'release guest48 teaser',attachment:{mime:'video/mp4',size:4}},async()=>Buffer.from('test'));
 assert.equal(await app.previewMedia({role:'owner',question:'preview guest48 teaser'}),null);
 await ask('preview guest48 teaser');
 assert.equal(await app.previewMedia({role:'listener',question:'preview guest48 teaser'}),null);
 const preview=await app.previewMedia({role:'owner',question:'preview guest48 teaser'});
 assert.deepEqual(preview.video,Buffer.from('test'));
 assert.match(preview.caption,/Nothing sent to groups/);
});

test('launch date uses SAST midnight and sends the approved launch copy',async t=>{
 const {ask,sent}=await setup(t,{now:()=>Date.parse('2026-10-29T22:00:00Z')});
 await ask('release guest48 groups pilot');await ask('preview guest48 launch');await ask('approve guest48 launch');await ask('send guest48 launch');
 assert.equal(sent.length,1);assert.match(sent[0][1].text,/Mr Dominate SA/);assert.match(sent[0][1].text,/https:\/\/crew.djpapzin.com\/track\/241/);
 await ask('preview guest48 teaser');await ask('approve guest48 teaser');assert.match(await ask('send guest48 teaser'),/release date/);assert.equal(sent.length,1);
});
