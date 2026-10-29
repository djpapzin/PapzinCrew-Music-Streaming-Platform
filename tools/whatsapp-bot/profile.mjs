import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys';
import pino from 'pino';
import { PROFILE } from './owner.mjs';
process.umask(0o077);
const {state,saveCreds}=await useMultiFileAuthState(process.env.WA_AUTH_DIR);
if (!state.creds.registered || state.creds.me?.id?.split(':')[0]?.split('@')[0] !== process.env.WA_BOT_PHONE) throw new Error('Wrong linked bot account');
const sock=makeWASocket({auth:state,logger:pino({level:'silent'}),markOnlineOnConnect:false,syncFullHistory:false,shouldSyncHistoryMessage:()=>false,shouldIgnoreJid:()=>true});
const timeout=setTimeout(()=>process.exit(1),45000);
sock.ev.on('creds.update',saveCreds);
sock.ev.on('connection.update',async ({connection})=>{
  if(connection==='open') {
    try {
      await sock.updateProfileName(PROFILE.name);
      await sock.updateProfileStatus(PROFILE.about);
      console.log('Bot profile name and About updated. No messages sent.');
      clearTimeout(timeout);
      setTimeout(()=>{sock.end();process.exit(0);},5000);
    } catch { console.error('Profile update failed.');process.exit(1); }
  }
});
