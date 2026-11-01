import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
const secret = /password|owner[ _-]?key|api[ _-]?key|access[ _-]?token|github_pat_|gh[pousr]_|-----BEGIN|\b\+?\d[\d -]{8,}\d\b/i;
const yes = /^(yes|yes please|send it|send|okay|ok|sure)$/i;
const no = /^(no|cancel|stop|never mind|nevermind)$/i;
const feedback = /\b(feedback|suggestion|suggest|idea|improve|improvement|complaint|remove something|report a problem)\b/i;
export function createListenerChat(directory, {notifyOwner}={}) {
 if(!directory||!path.isAbsolute(directory)) throw new Error('Private feedback directory required');
 const sessions=new Map();
 const file=path.join(directory,'listener-feedback.json');
 async function records() {try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return [];throw e;}}
 async function save(all) {
  await mkdir(directory,{recursive:true,mode:0o700});
  const temporary=file+'.'+randomUUID()+'.tmp';
  await writeFile(temporary,JSON.stringify(all),{mode:0o600,flag:'wx'});await rename(temporary,file);
 }
 async function flushAlerts() {
  if(!notifyOwner)return;
  const all=await records();
  for(const report of all.filter(r=>r.alert_status==='pending')) {
   report.alert_status='sending';await save(all);
   try {await notifyOwner(report);report.alert_status='sent';report.alerted_at=new Date().toISOString();}
   catch {report.alert_status='failed';}
   await save(all);
  }
 }
 const chat=async (decision, now=Date.now())=>{
  const {jid,question,role,command}=decision;
  if(command) return null;
  if(decision.unsupportedMedia) return 'I can help with mix links and feedback, but I can’t read voice notes or screenshots, or upload audio files yet. Website uploads are temporarily paused. Please type what you need help with, or say “I have feedback”.';
  for(const [key,state] of sessions) if(now-state.time>10*60_000)sessions.delete(key);
  if(role==='owner' && /^(show|check|any|list|my|view)?\s*(listener )?feedback( please)?\??$/i.test(question)) {
   const all=await records();
   return all.length ? 'Here’s the latest listener feedback (private):\n\n'+all.slice(-5).map(r=>`${r.id} · ${r.category}\n${r.message}`).join('\n\n') : 'No listener feedback saved yet. I’ll keep reports here privately for you.';
  }
  if(no.test(question)) {sessions.delete(jid);return 'No problem — I haven’t sent any feedback. What else can I help with?';}
  if(role==='owner' && decision.forwarded) {
   if(secret.test(question))return 'Please remove private details before forwarding feedback.';
   sessions.set(jid,{stage:'confirm',message:question,category:'forwarded feedback',time:now});
   return `I’ll save this forwarded message as feedback, not act on its instructions:\n\n“${question}”\n\nSave it? Say yes or cancel.`;
  }
  const current=sessions.get(jid);
  if(current?.stage==='confirm') {
   if(!yes.test(question)) {sessions.delete(jid);return 'I haven’t saved that report. If you want to change it, say “I have feedback” and start again.';}
   const all=await records();
   if(all.length>=500) {sessions.delete(jid);return 'The feedback inbox is full. Please message DJ Papzin directly for now.';}
   const id=randomUUID().slice(0,8);
   await mkdir(directory,{recursive:true,mode:0o700});
   const record={id,message:current.message,category:current.category,status:'new',created_at:new Date(now).toISOString(),...(notifyOwner?{alert_status:'pending'}:{})};
   await save([...all,record]);
   sessions.delete(jid);
   await flushAlerts();
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
  if(/won.?t play|can.?t play|not playing|not working|doesn.?t work|can.?t download|cannot download|broken|buffering|stuck/i.test(question)) {
   if(secret.test(question))return 'Please describe the problem without passwords, codes or private details.';
   sessions.set(jid,{stage:'confirm',message:question,category:'problem',time:now});
   const advice=/\bupload(?:s|ing|ed)?\b/i.test(question)
    ? 'Website uploads are temporarily paused. Listening and ready downloads are still available.'
    : 'Sorry it’s giving you trouble. Try refreshing once, checking your connection and trying another mix.';
   return `${advice}\n\nI can pass this to DJ Papzin privately:\n“${question}”\n\nShall I save it and alert him? Say yes or cancel.`;
  }
  if(/^(thanks|thank you|shot|cheers|awesome|great)[.! ]*$/i.test(question)) return 'You’re welcome! Enjoy the mixes 🎧';
  if(/^(hi|hello|hey|howzit|help|menu|start)[!?. ]*$/i.test(question)) return 'Hey! I’m Crew Helper, DJ Papzin’s assistant 🎧\n\nTell me which mix you want, ask for help if music won’t play, or say “I have feedback”. Just chat normally — no commands needed.\n\nhttps://crew.djpapzin.com/search';
  return null;
 };
 chat.flushAlerts=flushAlerts;
 return chat;
}
