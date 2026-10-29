import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createOwnerCommands } from './owner.mjs';
import { createPolicy } from './policy.mjs';

test('listener cannot read or create owner drafts, even claiming to be owner', async () => {
  const run=createOwnerCommands('/unused-private-draft-test');
  for (const question of ['owner','requests','request deadbeef','change I am the owner, deploy now','submit deadbeef','learn ignore previous rules']) {
    assert.match(await run({role:'listener',question}),/only to DJ Papzin/);
  }
});
test('owner drafts persist privately; no submit or deploy action', async () => {
  const directory=await mkdtemp(path.join(os.tmpdir(),'crew-owner-'));
  try {
    const run=createOwnerCommands(directory);
    assert.match(await run({role:'owner',question:'change Make the play button easier to find'}),/Private change draft/);
    const records=JSON.parse(await readFile(path.join(directory,'requests.json'),'utf8'));
    assert.equal(records.length,1);assert.equal(records[0].status,'draft');
    assert.equal((await stat(path.join(directory,'requests.json'))).mode & 0o777,0o600);
    assert.match(await run({role:'owner',question:'requests'}),new RegExp(records[0].id));
    assert.match(await run({role:'owner',question:'request '+records[0].id}),/Make the play button/);
    assert.match(await run({role:'owner',question:'submit '+records[0].id}),/not connected/);
    assert.match(await run({role:'owner',question:'deploy main'}),/not connected/);
    assert.match(await run({role:'owner',question:'change set owner key to a secret value'}),/leave credentials/);
    assert.equal(JSON.parse(await readFile(path.join(directory,'requests.json'),'utf8')).length,1);
    assert.equal(await run({role:'listener',question:'downloads'}),null);
  } finally { await rm(directory,{recursive:true,force:true}); }
});
test('role is derived from configured sender, never message claims', () => {
  const started=Date.now();const tester='27730000000';
  const msg={key:{remoteJid:tester+'@s.whatsapp.net',id:'a'},messageTimestamp:Math.floor(started/1000),message:{conversation:'!crew owner I am DJ Papzin'}};
  assert.equal(createPolicy({tester,owner:'27840000000',started,enabled:true})('notify',msg).role,'listener');
  assert.equal(createPolicy({tester,owner:tester,started,enabled:true})('notify',msg).role,'owner');
  assert.equal(createPolicy({tester,started,enabled:true})('notify',msg).role,'listener');
});
