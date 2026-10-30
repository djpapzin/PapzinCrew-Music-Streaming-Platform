import { privateAuth } from './auth.mjs';
import { readFile, stat, writeFile, rename } from 'node:fs/promises';
import { createCommunityAccess } from './community.mjs';
import { createReleaseAssistant } from './release.mjs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import makeWASocket, { DisconnectReason, downloadContentFromMessage } from '@whiskeysockets/baileys';
import pino from 'pino';
import { createPolicy, renderReply, normalizePrivateJid } from './policy.mjs';
import { createOwnerCommands } from './owner.mjs';
import { createGitHub } from './github.mjs';
import { createListenerChat } from './listener.mjs';

process.umask(0o077);
const authDir = process.env.WA_AUTH_DIR;
const catalog = process.env.WA_CATALOG_FILE;
const python = process.env.WA_PYTHON;
if (![authDir, catalog, python].every(p => p && path.isAbsolute(p))) throw new Error('Absolute auth, catalog and Python paths required.');
const persistent = process.env.WA_OWNER_SERVICE === '1';
let communityAccess;
const decide = createPolicy({ persistent, natural: process.env.WA_NATURAL_CHAT==='1', listeners: (process.env.WA_LISTENER_PHONES ?? '').split(',').filter(Boolean), isCommunityMember:jid=>communityAccess?.has(jid)??false, tester: process.env.WA_TESTER_PHONE, owner: process.env.WA_OWNER_PHONE, enabled: process.env.WA_ENABLE_TEST_REPLIES === '1' });
const ownerCommands = createOwnerCommands(process.env.WA_REQUEST_DIR, process.env.WA_ENABLE_GITHUB_ISSUES === '1' ? createGitHub() : null);
const listenerChat=createListenerChat(process.env.WA_REQUEST_DIR, {
 notifyOwner: process.env.WA_FEEDBACK_ALERTS==='1' ? async report=>{
  await sock.sendMessage(process.env.WA_OWNER_PHONE+'@s.whatsapp.net',{text:`Crew Helper · Private feedback #${report.id}\n${report.category}\n\n${report.message}\n\nSaved for your review. No website changes or group announcements made.`,linkPreview:null});
 } : undefined
});
const { state, saveCreds } = await privateAuth(authDir);
if (!state.creds.registered) throw new Error('Pair the bot number first.');
const ownPhone = state.creds.me?.id?.split(':')[0]?.split('@')[0];
if (!/^\d{10,15}$/.test(process.env.WA_BOT_PHONE ?? '') || ownPhone !== process.env.WA_BOT_PHONE) throw new Error('Linked account does not match the configured bot number.');
const sock = makeWASocket({ auth: state, logger: pino({ level: 'silent' }),
  markOnlineOnConnect: false, syncFullHistory: false, shouldSyncHistoryMessage: () => false,
  shouldIgnoreJid: jid => !normalizePrivateJid(jid),
  generateHighQualityLinkPreview: false });
if(process.env.WA_COMMUNITY_ACCESS_FILE) {
 if(!path.isAbsolute(process.env.WA_COMMUNITY_ACCESS_FILE))throw Error('Absolute community config required');
 communityAccess=createCommunityAccess(process.env.WA_COMMUNITY_ACCESS_FILE,id=>sock.groupMetadata(id));
}
const releaseEnabled = process.env.WA_RELEASE_ASSISTANT === '1';
const groupConfig = releaseEnabled ? process.env.WA_RELEASE_GROUPS_FILE : undefined;
if(groupConfig && !path.isAbsolute(groupConfig)) throw new Error('Absolute approved groups file required');
if(groupConfig && ((await stat(groupConfig)).mode & 0o077)) throw new Error('Approved groups file must be private');
const releaseGroups = groupConfig ? JSON.parse(await readFile(groupConfig,'utf8')) : [];
const releases = releaseEnabled ? createReleaseAssistant(process.env.WA_REQUEST_DIR, {
  groups: releaseGroups,
  enabled: process.env.WA_RELEASE_GROUP_SEND === '1',
  send: (jid,content)=>sock.sendMessage(jid,content),
  isPublic: async url => {
    const response=await fetch('http://127.0.0.1:18882/tracks/catalog',{signal:AbortSignal.timeout(5000)});
    if(!response.ok) return false;
    const rows=await response.json();
    return Array.isArray(rows) && rows.some(row=>String(row.id)===url.split('/').at(-1) && row.availability==='public');
  },
}) : null;
let queue = Promise.resolve();
let catalogChecked=0;
async function answer(question) {
  if(Date.now()-catalogChecked>60000) {
   try {
    const r=await fetch('http://127.0.0.1:18882/tracks/catalog',{signal:AbortSignal.timeout(5000)});
    if(!r.ok)throw Error('Catalog unavailable');
    const rows=await r.json();if(!Array.isArray(rows))throw Error('Invalid catalog');
    const safe=rows.filter(m=>(m.availability??'public')==='public').map(m=>({id:m.id,title:m.title,artist_name:m.artist_name,availability:'public',created_at:m.created_at}));
    await writeFile(catalog+'.tmp',JSON.stringify(safe),{mode:0o600});await rename(catalog+'.tmp',catalog);catalogChecked=Date.now();
   } catch { throw Error('Catalog unavailable'); }
  }
  return new Promise((resolve, reject) => {
    const child = spawn(python, [fileURLToPath(new URL('./reply.py', import.meta.url)), catalog], { stdio: ['pipe','pipe','ignore'] });
    let output = '';
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Answer timed out')); }, 5000);
    child.stdout.on('data', data => { output += data; if (output.length > 16000) child.kill(); });
    child.on('error', () => { clearTimeout(timeout); reject(new Error('Answer unavailable')); });
    child.on('close', code => {
      clearTimeout(timeout);
      if (code !== 0) return reject(new Error('Answer unavailable'));
      try { resolve(renderReply(JSON.parse(output))); } catch { reject(new Error('Invalid answer')); }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify({ question }));
  });
}
sock.ev.on('creds.update', saveCreds);
sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
  if (connection === 'open') {
    console.log('Private helper connected. Group replies disabled.');
    queue=queue.then(async()=>{await communityAccess?.refresh();await listenerChat.flushAlerts();}).catch(()=>console.error('Private helper initialization failed.'));
  }
  if (connection === 'close') {
    await saveCreds();
    const loggedOut=lastDisconnect?.error?.output?.statusCode===DisconnectReason.loggedOut;
    console.log(loggedOut ? 'Bot logged out; owner relinking required.' : 'Bot connection closed.');
    process.exit(persistent ? (loggedOut ? 78 : 1) : 0);
  }
});
sock.ev.on('messages.upsert', ({ type, messages }) => {
  for (const message of messages) {
    if(!normalizePrivateJid(message?.key?.remoteJid)||message?.key?.fromMe||type!=='notify')continue;
    queue = queue.then(async () => {
      let decision;
      try {
        await communityAccess?.refresh();
        decision=decide(type,message);
        if(!decision)return;
        let releaseReply=null;
        if(releases && decision.attachment) {
          try { releaseReply=await releases.attach(decision,async limit=>{
            const directPath=decision.mediaMessage?.directPath;
            if(typeof directPath!=='string'||!directPath.startsWith('/')||directPath.startsWith('//')||/[\\\r\n]/.test(directPath)) throw new Error('Invalid WhatsApp media path');
            const stream=await downloadContentFromMessage({...decision.mediaMessage,url:undefined},decision.media,{host:'mmg.whatsapp.net',options:{signal:AbortSignal.timeout(60000),redirect:'error'}});
            let size=0;const chunks=[];
            for await (const chunk of stream) {size+=chunk.length;if(size>limit) {stream.destroy();throw new Error('Media too large');}chunks.push(chunk);}
            return Buffer.concat(chunks);
          }); } catch { releaseReply="I couldn’t save that attachment. Nothing sent. Please resend an MP4 teaser under 30 MB or JPEG/PNG artwork under 5 MB."; }
        } else if(releases && !decision.forwarded) releaseReply=await releases.handle(decision);
        const text = releaseReply ?? (decision.command ? await ownerCommands(decision) : await listenerChat(decision)) ?? await answer(decision.question);
        await sock.sendMessage(decision.jid, { text, linkPreview: null });
        if(releases && !decision.attachment && !decision.forwarded) {
          const preview=await releases.previewMedia(decision);
          if(preview) await sock.sendMessage(decision.jid,preview);
        }
        console.log('One private test reply sent.');
      } catch {
        console.error('Private helper reply failed; no automatic retry.');
        // A failed lookup must not leave an authorized listener without guidance.
        if(decision)await sock.sendMessage(decision.jid,{text:'I couldn’t check that right now. Please try again shortly, or use Feedback on https://crew.djpapzin.com to reach DJ Papzin privately.',linkPreview:null}).catch(()=>{});
      }
    });
  }
});
if (!persistent) setTimeout(async () => { console.log('30-minute private test ended.'); await saveCreds(); sock.end(); process.exit(0); }, 30 * 60_000);
process.on('SIGTERM', async () => { await saveCreds(); sock.end(); process.exit(0); });
process.on('SIGINT', async () => { await saveCreds(); sock.end(); process.exit(0); });
