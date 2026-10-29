import test from 'node:test';
import assert from 'node:assert/strict';
import { createPolicy, renderReply } from './policy.mjs';
const started = 1700000000000;
const tester = '27730000000';
const message = (changes = {}) => ({ key: { remoteJid: tester+'@s.whatsapp.net', id: 'a' }, messageTimestamp: started/1000, message: { conversation: '!crew downloads' }, ...changes });
const policy = (changes = {}) => { const decide = createPolicy({ tester, started, enabled: true, ...changes }); return (type, msg, now = started) => decide(type, msg, now); };
test('only explicit commands from tester direct chat', () => {
  assert.equal(policy()('notify', message()).question, 'downloads');
  for (const remoteJid of ['123@g.us','status@broadcast','27840000000@s.whatsapp.net']) {
    assert.equal(policy()('notify', message({ key: { remoteJid, id:'a' } })), null);
  }
  assert.equal(policy()('notify', message({message:{conversation:'hi'}})), null);
  assert.equal(policy()('notify', message({key:{remoteJid:tester+'@s.whatsapp.net', id:'a',fromMe:true}})),null);
});
test('verified LID alternate is accepted; arbitrary alternate cannot open groups', () => {
  assert.ok(policy()('notify',message({key:{remoteJid:'123@lid',remoteJidAlt:tester+'@s.whatsapp.net',id:'a'}})));
  assert.equal(policy()('notify',message({key:{remoteJid:'123@g.us',remoteJidAlt:tester+'@s.whatsapp.net',id:'a'}})),null);
});
test('default off, history, stale events, expired session', () => {
  assert.equal(policy({enabled:false})('notify',message()),null);
  assert.equal(policy()('append',message()),null);
  assert.equal(policy()('notify',message({messageTimestamp:started/1000-60})),null);
  assert.equal(policy()('notify',message(),started+31*60_000),null);
});
test('duplicates, rate and reply budget are bounded', () => {
  const decide=policy({maxReplies:2});
  assert.ok(decide('notify',message(),started));
  assert.equal(decide('notify',message(),started+6000),null);
  const second=message({key:{remoteJid:tester+'@s.whatsapp.net',id:'b'}});
  assert.equal(decide('notify',second,started+1000),null);
  assert.ok(decide('notify',second,started+6000));
  assert.equal(decide('notify',message({key:{remoteJid:tester+'@s.whatsapp.net',id:'c'}}),started+12000),null);
});
test('only canonical site links are rendered', () => {
  const text=renderReply({answer:'Hello',links:[{url:'https://crew.djpapzin.com/track/237'},{url:'https://storage.example/private?secret=1'}]});
  assert.match(text,/track\/237/); assert.doesNotMatch(text,/secret|storage/);
});


test('persistent mode requires owner; budget rolls over while old messages stay ignored',()=>{
 assert.throws(()=>policy({persistent:true}),/owner-only/);
 const decide=policy({persistent:true,owner:tester,maxReplies:1});
 assert.ok(decide('notify',message(),started));
 assert.equal(decide('notify',message({key:{remoteJid:tester+'@s.whatsapp.net',id:'b'}}),started+6000),null);
 const later=started+31*60_000;
 assert.equal(decide('notify',message(),later),null);
 assert.ok(decide('notify',message({key:{remoteJid:tester+'@s.whatsapp.net',id:'new'},messageTimestamp:later/1000}),later));
});
