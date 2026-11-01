import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { privateAuth } from './auth.mjs';

test('credential saves serialize and preserve valid private JSON',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'crew-auth-'));
 try {
  const {state,saveCreds,flush}=await privateAuth(dir);
  await Promise.all(Array.from({length:25},()=>saveCreds()));await flush();
  const target=path.join(dir,'creds.json');const previous=await readFile(target,'utf8');
  assert.ok(JSON.parse(previous).noiseKey);
  assert.equal((await stat(target)).mode&0o777,0o600);
  state.creds.bad=state.creds;
  assert.throws(()=>saveCreds());
  assert.equal(await readFile(target,'utf8'),previous);
 } finally {await rm(dir,{recursive:true,force:true});}
});
test('unreadable credentials are refused, never silently overwritten',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'crew-auth-'));
 try {
  await writeFile(path.join(dir,'creds.json'),'');
  await assert.rejects(privateAuth(dir),/unreadable/);
  assert.equal(await readFile(path.join(dir,'creds.json'),'utf8'),'');
 } finally {await rm(dir,{recursive:true,force:true});}
});
