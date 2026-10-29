import { privateAuth } from './auth.mjs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import makeWASocket, { DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import { createPolicy, renderReply } from './policy.mjs';
import { createOwnerCommands } from './owner.mjs';
import { createGitHub } from './github.mjs';

process.umask(0o077);
const authDir = process.env.WA_AUTH_DIR;
const catalog = process.env.WA_CATALOG_FILE;
const python = process.env.WA_PYTHON;
if (![authDir, catalog, python].every(p => p && path.isAbsolute(p))) throw new Error('Absolute auth, catalog and Python paths required.');
const persistent = process.env.WA_OWNER_SERVICE === '1';
const decide = createPolicy({ persistent, tester: process.env.WA_TESTER_PHONE, owner: process.env.WA_OWNER_PHONE, enabled: process.env.WA_ENABLE_TEST_REPLIES === '1' });
const ownerCommands = createOwnerCommands(process.env.WA_REQUEST_DIR, process.env.WA_ENABLE_GITHUB_ISSUES === '1' ? createGitHub() : null);
const { state, saveCreds } = await privateAuth(authDir);
if (!state.creds.registered) throw new Error('Pair the bot number first.');
const ownPhone = state.creds.me?.id?.split(':')[0]?.split('@')[0];
if (!/^\d{10,15}$/.test(process.env.WA_BOT_PHONE ?? '') || ownPhone !== process.env.WA_BOT_PHONE) throw new Error('Linked account does not match the configured bot number.');
const sock = makeWASocket({ auth: state, logger: pino({ level: 'silent' }),
  markOnlineOnConnect: false, syncFullHistory: false, shouldSyncHistoryMessage: () => false,
  shouldIgnoreJid: jid => !/^\d+@(s\.whatsapp\.net|lid)$/.test(jid),
  generateHighQualityLinkPreview: false });
let queue = Promise.resolve();
function answer(question) {
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
  if (connection === 'open') console.log('Private test connected. Only allowlisted !crew commands receive replies.');
  if (connection === 'close') {
    await saveCreds();
    const loggedOut=lastDisconnect?.error?.output?.statusCode===DisconnectReason.loggedOut;
    console.log(loggedOut ? 'Bot logged out; owner relinking required.' : 'Bot connection closed.');
    process.exit(persistent ? (loggedOut ? 78 : 1) : 0);
  }
});
sock.ev.on('messages.upsert', ({ type, messages }) => {
  for (const message of messages) {
    const decision = decide(type, message);
    if (!decision) continue;
    queue = queue.then(async () => {
      try {
        const text = await ownerCommands(decision) ?? await answer(decision.question);
        await sock.sendMessage(decision.jid, { text, linkPreview: null });
        console.log('One private test reply sent.');
      } catch { console.error('Private test reply failed; no automatic retry.'); }
    });
  }
});
if (!persistent) setTimeout(async () => { console.log('30-minute private test ended.'); await saveCreds(); sock.end(); process.exit(0); }, 30 * 60_000);
process.on('SIGTERM', async () => { await saveCreds(); sock.end(); process.exit(0); });
process.on('SIGINT', async () => { await saveCreds(); sock.end(); process.exit(0); });
