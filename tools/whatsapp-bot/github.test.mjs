import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createOwnerCommands } from './owner.mjs';
import { createGitHub, issuePreview, REPOSITORY } from './github.mjs';
const url=`https://github.com/${REPOSITORY}/issues/99`;
async function fixture(work) {
 const dir=await mkdtemp(path.join(os.tmpdir(),'crew-gh-'));
 try { await work(dir); } finally {await rm(dir,{recursive:true,force:true});}
}
async function draft(run,dir) {
 await run({role:'owner',question:'change Make the mobile play button easier to find'});
 return JSON.parse(await readFile(path.join(dir,'requests.json'),'utf8'))[0];
}
test('only previewed, owner-confirmed requests post; repeat is idempotent',()=>fixture(async dir=>{
 let creates=0;const gh={find:async()=>null,create:async()=>{creates++;return url;}};
 const run=createOwnerCommands(dir,gh);const record=await draft(run,dir);
 assert.match(await run({role:'owner',question:`submit ${record.id} CONFIRM`}),/First review/);
 assert.equal(creates,0);
 assert.match(await run({role:'owner',question:`preview ${record.id}`}),/PUBLIC GitHub issue preview/);
 assert.match(await run({role:'listener',question:`submit ${record.id} CONFIRM`}),/only to DJ Papzin/);
 assert.match(await run({role:'owner',question:`submit ${record.id}`}),/First review/);
 assert.equal(creates,0);
 assert.match(await run({role:'owner',question:`submit ${record.id} CONFIRM`}),/GitHub issue created/);
 assert.match(await run({role:'owner',question:`submit ${record.id} CONFIRM`}),/Already submitted/);
 assert.equal(creates,1);
 assert.match(await run({role:'owner',question:`request ${record.id}`}),/issues\/99/);
}));
test('uncertain POST never posts again; reconciliation recovers existing issue',()=>fixture(async dir=>{
 let creates=0,exists=false;
 const gh={find:async()=>exists?url:null,create:async()=>{creates++;exists=true;throw new Error('Network response lost');}};
 const run=createOwnerCommands(dir,gh);const record=await draft(run,dir);
 await run({role:'owner',question:`preview ${record.id}`});
 assert.match(await run({role:'owner',question:`submit ${record.id} CONFIRM`}),/could not be confirmed/);
 assert.match(await run({role:'owner',question:`submit ${record.id} CONFIRM`}),/issue confirmed/);
 assert.equal(creates,1);
}));
test('unresolved submission stays paused even when lookup finds nothing',()=>fixture(async dir=>{
 let creates=0;const run=createOwnerCommands(dir,{find:async()=>null,create:async()=>{creates++;throw new Error();}});
 const r=await draft(run,dir);await run({role:'owner',question:`preview ${r.id}`});
 await run({role:'owner',question:`submit ${r.id} CONFIRM`});
 assert.match(await run({role:'owner',question:`submit ${r.id} CONFIRM`}),/paused/);
 assert.equal(creates,1);
}));
test('GitHub adapter uses fixed issue endpoints and validates authors and URLs',async()=>{
 const calls=[];const record={id:'deadbeef',description:'Improve the search button; $(echo no-shell)'};
 const gh=createGitHub(async args=>{
  calls.push(args);
  if(args[1]==='user') return {login:'owner'};
  if(args.includes('POST')) return {html_url:url};
  return [{user:{login:'outsider'},body:'<!-- crew-owner-request:deadbeef -->',html_url:url}];
 });
 assert.equal(await gh.find(record),null);
 assert.equal(await gh.create(record),url);
 assert.ok(calls.every(args=>args[0]==='api' && (args[1]==='user'||args[1].startsWith(`repos/${REPOSITORY}/issues`))));
 const payload=issuePreview(record);assert.match(payload.body,/Implementation target: dev/);assert.match(payload.body,/explicitly approves/);
 assert.match(payload.body,/\$\(echo no-shell\)/);
 await assert.rejects(createGitHub(async()=>({html_url:'https://evil.example/99'})).create(record));
});
