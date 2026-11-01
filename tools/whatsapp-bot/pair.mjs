import { privateAuth } from './auth.mjs';
// Pairing only: intentionally has no message handlers, sends or group actions.
import { mkdir, chmod } from 'node:fs/promises';
import path from 'node:path';
import makeWASocket, { DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';

process.umask(0o077);
const phone = process.env.WA_BOT_PHONE;
const directory = process.env.WA_AUTH_DIR;
if (!/^\d{10,15}$/.test(phone ?? '') || !directory || !path.isAbsolute(directory)) {
  throw new Error('Set WA_BOT_PHONE in international digits and an absolute private WA_AUTH_DIR.');
}
await mkdir(directory, { recursive: true, mode: 0o700 });
await chmod(directory, 0o700);
let pairingRequested = false;
let restarts = 0;
const deadline = setTimeout(() => { console.log('Pairing window ended; rerun when the phone is ready.'); process.exit(0); }, 5 * 60_000);
async function connect() {
  const { state, saveCreds } = await privateAuth(directory);
  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    markOnlineOnConnect: false,
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    shouldIgnoreJid: () => true,
    generateHighQualityLinkPreview: false,
  });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async ({ connection, qr, lastDisconnect }) => {
    if (qr && !state.creds.registered && !pairingRequested) {
      pairingRequested = true;
      try {
        const code = await sock.requestPairingCode(phone);
        console.log('PHONE LINK CODE: ' + code);
      } catch {
        console.error('Could not request a pairing code. Check that WhatsApp is registered on the bot phone.');
        process.exitCode = 1;
        sock.end();
        clearTimeout(deadline);
      }
    }
    if (connection === 'open') {
      clearTimeout(deadline);
      console.log('Bot number linked. Pairing-only session; no messages sent.');
      // Allow the phone to finish its linked-device confirmation before disconnecting.
      setTimeout(() => sock.end(), 30000);
      setTimeout(() => process.exit(0), 31000);
    }
    if (connection === 'close') {
      const status = lastDisconnect?.error?.output?.statusCode;
      if (status === DisconnectReason.restartRequired && restarts++ < 2) {
        await connect();
      } else {
        clearTimeout(deadline);
        console.log('Connection closed. No messages sent.');
      }
    }
  });
}
await connect();
