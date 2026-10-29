import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
const secret = /password|owner[ _-]?key|api[ _-]?key|access[ _-]?token|github_pat_|gh[pousr]_|-----BEGIN|\b\+?\d[\d -]{8,}\d\b/i;
const yes = /^(yes|yes please|send it|send|okay|ok|sure)$/i;
const no = /^(no|cancel|stop|never mind|nevermind)$/i;
const feedback = /\b(feedback|suggestion|suggest|idea|improve|improvement|complaint|remove something|report a problem)\b/i;
export function createListenerChat(directory) {
 if(!directory||!path.isAbsolute(directory)) throw new Error('Private feedback directory required');
 const sessions=new Map();
 const file=path.join(directory,'listener-feedback.json');
 async function records() {try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return [];throw e;}}
 return async (decision, now=Date.now())=>{
  const {jid,question,role,command}=decision;
  if(command) return null;
  for(const [key,state] of sessions) if(now-state.time>10*60_000)sessions.delete(key);
  if(role==='owner' && /^(show|check|any|list|my|view)?\s*(listener )?feedback( please)?\??$/i.test(question)) {
   const all=await records();
   return all.length ? 'Here’s the latest listener feedback (private):\n\n'+all.slice(-5).map(r=>`${r.id} · ${r.category}\n${r.message}`).join('\n\n') : 'No listener feedback saved yet. I’ll keep reports here privately for you.';
  }
  if(no.test(question)) {sessions.delete(jid);return 'No problem — I haven’t sent any feedback. What else can I help with?';}
  const current=sessions.get(jid);
  if(current?.stage==='confirm') {
   if(!yes.test(question)) {sessions.delete(jid);return 'I haven’t saved that report. If you want to change it, say “I have feedback” and start again.';}
   const all=await records();
   if(all.length>=500) {sessions.delete(jid);return 'The feedback inbox is full. Please message DJ Papzin directly for now.';}
   const id=randomUUID().slice(0,8);
   await mkdir(directory,{recursive:true,mode:0o700});
   const record={id,message:current.message,category:current.category,status:'new',created_at:new Date(now).toISOString()};
   const temporary=file+'.'+randomUUID()+'.tmp';
   await writeFile(temporary,JSON.stringify([...all,record]),{mode:0o600,flag:'wx'});await rename(temporary,file);
   sessions.delete(jid);
   return 'Thanks! I’ve saved your feedback privately for DJ Papzin. He’ll review it when he can. Anything else I can help with?';
  }
  if(current?.stage==='collect') {
   if(question.trim().length<3) return 'Tell me a little more about what happened or what you’d like changed.';
   if(secret.test(question)) return 'Please leave out passwords, codes, phone/account numbers and other private details. Just describe the problem or idea.';
   const category=/idea|suggest|improv/i.test(current.prompt)?'idea':'other';
   sessions.set(jid,{stage:'confirm',message:question,category,time:now});
   return `Here’s what I’ll pass to DJ Papzin privately:\n\n“${question}”\n\nShall I save it? Say yes, or cancel. Please leave out private details.`;
  }
  if(feedback.test(question)) {
   if(sessions.size>=100) return 'I’m handling a few conversations. Please try again shortly.';
   sessions.set(jid,{stage:'collect',prompt:question,time:now});
   return 'Of course. What would you like DJ Papzin to know? A problem, an idea, something to improve or remove — just tell me here. I’ll show you the message before saving it privately for him. Please leave out private details.';
  }
  if(/^(thanks|thank you|shot|cheers|awesome|great)[.! ]*$/i.test(question)) return 'You’re welcome! Enjoy the mixes 🎧';
  if(/^(hi|hello|hey|howzit|help|menu|start)[!?. ]*$/i.test(question)) return 'Hey! I’m Crew Helper, DJ Papzin’s assistant 🎧\n\nTell me which mix you want, ask for help if music won’t play, or say “I have feedback”. Just chat normally — no commands needed.\n\nhttps://crew.djpapzin.com/search';
  return null;
 };
}
