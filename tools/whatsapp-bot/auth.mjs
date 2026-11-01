import { mkdir, chmod, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { BufferJSON, useMultiFileAuthState } from '@whiskeysockets/baileys';

// Baileys manages protocol keys; save the credential document atomically and
// serialize saves so disconnect/shutdown cannot truncate the active login.
export async function privateAuth(directory) {
  if (!directory || !path.isAbsolute(directory)) throw new Error('Absolute private auth directory required');
  await mkdir(directory,{recursive:true,mode:0o700});await chmod(directory,0o700);
  const target=path.join(directory,'creds.json');
  try { JSON.parse(await readFile(target,'utf8')); }
  catch(error) { if(error.code!=='ENOENT') throw new Error('Login file unreadable; relink in a fresh private directory.'); }
  const {state}=await useMultiFileAuthState(directory);
  let pending=Promise.resolve();
  function saveCreds() {
    const document=JSON.stringify(state.creds,BufferJSON.replacer);
    pending=pending.then(async()=>{
      const temporary=path.join(directory,'creds.'+randomUUID()+'.tmp');
      await writeFile(temporary,document,{mode:0o600,flag:'wx'});
      await rename(temporary,target);
    });
    return pending;
  }
  return {state,saveCreds,flush:()=>pending};
}
