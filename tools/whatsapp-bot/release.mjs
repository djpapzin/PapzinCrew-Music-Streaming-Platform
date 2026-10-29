import { mkdir, chmod, readFile, writeFile, rename, stat, statfs } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';

const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const MIX = /^https:\/\/crew\.djpapzin\.com\/track\/[1-9]\d*$/;
const secrets = /password|owner[ _-]?key|api[ _-]?key|access[ _-]?token|github_pat_|-----BEGIN/i;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const dateInSA = now => new Date(now).toLocaleDateString('en-CA', { timeZone:'Africa/Johannesburg' });
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value+'T00:00:00Z').toISOString().slice(0,10) === value;

export function createReleaseAssistant(directory, { groups=[], enabled=false, send=null, isPublic=async()=>false, now=()=>Date.now() }={}) {
  if (!directory || !path.isAbsolute(directory)) throw new Error('Private absolute release directory required');
  if (!Array.isArray(groups) || groups.length>10 || groups.some(g=>!g || !/^\d+(?:-\d+)?@g\.us$/.test(g.jid) || !/^[a-z0-9-]{1,40}$/.test(g.key) || typeof g.name!=='string' || g.name.length>100 || /[\r\n]/.test(g.name)) || new Set(groups.map(g=>g.key)).size!==groups.length || new Set(groups.map(g=>g.jid)).size!==groups.length) throw new Error('Invalid approved release groups');
  const file=path.join(directory,'releases.json');
  async function load() {
    await mkdir(directory,{recursive:true,mode:0o700}); await chmod(directory,0o700);
    try { return JSON.parse(await readFile(file,'utf8')); } catch(e) { if(e.code==='ENOENT') return []; throw e; }
  }
  async function save(records) {
    const temp=file+'.'+randomUUID()+'.tmp';
    await writeFile(temp,JSON.stringify(records),{mode:0o600,flag:'wx'}); await rename(temp,file);
  }
  function announcement(record,kind) {
    const selected=record.groups.map(key=>groups.find(g=>g.key===key));
    if(selected.some(g=>!g)) throw new Error('A selected group is no longer configured');
    const asset=record.assets?.[kind==='teaser'?'teaser':'artwork'];
    const payload={text:record[kind].text,asset:asset ? {name:asset.name,sha256:asset.sha256,mime:asset.mime}:null,groups:selected.map(g=>({jid:g.jid,name:g.name})),date:record.date,url:record.url};
    return {selected,asset,hash:sha(JSON.stringify(payload))};
  }
  async function seed({id,title,credit,date,url}) {
    if(!ID.test(id)||!title?.trim()||title.length>180||!credit?.trim()||credit.length>100||!validDate(date)||!MIX.test(url)||secrets.test(title+' '+credit)) throw new Error('Invalid release details');
    const records=await load(); if(records.some(r=>r.id===id)) return false;
    if(records.length>=50) throw new Error('Release queue full');
    const label=new Date(date+'T12:00:00Z').toLocaleDateString('en-ZA',{weekday:'long',day:'numeric',month:'long',timeZone:'Africa/Johannesburg'});
    records.push({id,title,credit,date,url,groups:[],assets:{},teaser:{text:`A glimpse of what’s coming ${label} 👀🔥\n${title}, mixed by ${credit}. Let’s Cruize! 🎶`},launch:{text:`${title} is here 🎧🔥\nMixed by ${credit}.\n\nListen here: ${url}\n\nLet us know what you think — and if anything breaks. Let’s Cruize!`}});
    await save(records); return true;
  }
  async function attach({role,question,attachment}, download) {
    if(role!=='owner') return 'Only DJ Papzin can attach release material.';
    const match=question.match(/^release\s+([a-z0-9-]+)\s+(teaser|artwork)$/i);
    if(!match || !attachment) return 'Add the caption: !crew release guest48 teaser (video) or !crew release guest48 artwork (image).';
    const records=await load(), record=records.find(r=>r.id===match[1].toLowerCase());
    if(!record) return 'Prepare that release first.';
    const kind=match[2].toLowerCase();
    const mime=attachment.mime;
    const extension=kind==='teaser' && mime==='video/mp4' ? 'mp4' : kind==='artwork' && mime==='image/jpeg' ? 'jpg' : kind==='artwork' && mime==='image/png' ? 'png' : null;
    const limit=kind==='teaser'?30*1024*1024:5*1024*1024;
    if(!extension || !Number.isFinite(attachment.size) || attachment.size<=0 || attachment.size>limit) return 'Use an MP4 teaser up to 30 MB, or JPEG/PNG artwork up to 5 MB.';
    const disk=await statfs(directory);
    if(disk.bavail*disk.bsize-attachment.size<15_000_000_000) return 'Not enough safe disk space for a release attachment. Nothing downloaded or sent.';
    const bytes=await download(limit);
    if(!Buffer.isBuffer(bytes)||bytes.length!==attachment.size||bytes.length>limit) throw new Error('Attachment size mismatch');
    // One current asset per slot; no accumulation of old teaser files.
    const name=`${record.id}-${kind}`;
    const target=path.join(directory,name),temp=target+'.'+randomUUID()+'.tmp';
    await writeFile(temp,bytes,{mode:0o600,flag:'wx'});await rename(temp,target);
    record.assets[kind]={name,mime,sha256:sha(bytes),size:bytes.length};
    delete record[kind==='teaser'?'teaser':'launch'].approved;
    await save(records);
    return `${kind==='teaser'?'Teaser':'Artwork'} saved privately for ${record.title}. Nothing sent. Say “preview ${record.id} ${kind==='teaser'?'teaser':'launch'}” to review it.`;
  }
  async function handle({role,question}) {
    const input=question.trim();
    const relevant=/^(release|prepare)\b|^(preview|approve|send)\s+[a-z0-9-]+\s+(teaser|launch)\b/i.test(input);
    if(!relevant) return null;
    if(role!=='owner') return 'Release drafts and announcements are managed privately by DJ Papzin. Ask me for a public mix link or send feedback.';
    if(/^(release|release help)$/i.test(input)) return 'Release assistant 🎧\n\nPrepare guest48 — see the release\nPreview guest48 teaser — review teaser\nPreview guest48 launch — review release post\nApprove guest48 teaser — approve exactly that preview\nSend guest48 teaser — separate send step, only to selected approved groups\n\nTo attach video/art, send it with caption “!crew release guest48 teaser” or “!crew release guest48 artwork”. Nothing is scheduled or sent automatically. Group sending is off unless explicitly configured.';
    const create=input.match(/^release new ([a-z0-9-]+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*(\S+)$/i);
    if(create) {try {const added=await seed({id:create[1].toLowerCase(),title:create[2],credit:create[3],date:create[4],url:create[5]});return added?'Private release prepared. Say “prepare '+create[1]+'” to review it.':'That release already exists; nothing overwritten.';}catch{return 'Check the release title, credit, YYYY-MM-DD date and canonical mix link. No release was saved.';}}
    const records=await load();
    const match=input.match(/^(?:(prepare|preview|approve|send)\s+|release\s+)([a-z0-9-]+)(?:\s+(teaser|launch|groups))?(?:\s+(text)\s+([\s\S]+)|\s+([a-z0-9,-]+))?$/i);
    if(!match) return 'Say “prepare guest48”, “preview guest48 teaser” or “release help”.';
    const [,verb,id,slot,edit,text,groupKeys]=match;
    const record=records.find(r=>r.id===id.toLowerCase());
    if(!record) return 'No matching release. Create one with: !crew release new ID | title | DJ credit | YYYY-MM-DD | mix link';
    if(!slot) return `${record.title}\nMixed by ${record.credit}\nRelease date: ${record.date} (South Africa)\n${record.url}\n\nTeaser: ${record.assets?.teaser?'attached privately':'not attached'}\nArtwork: ${record.assets?.artwork?'attached privately':'not attached'}\n\nSay “preview ${record.id} teaser” or “preview ${record.id} launch”. Nothing sent.`;
    if(slot.toLowerCase()==='groups') {
      if(verb && verb.toLowerCase()!=='prepare') return 'Use !crew release '+record.id+' groups group-key';
      const keys=(groupKeys||'').split(',').filter(Boolean);
      if(!keys.length||new Set(keys).size!==keys.length||keys.some(key=>!groups.some(g=>g.key===key))) return groups.length?'Choose approved group keys: '+groups.map(g=>g.key+' ('+g.name+')').join(', '):'No groups are configured. Your drafts stay private.';
      record.groups=keys;delete record.teaser.approved;delete record.launch.approved;await save(records);
      return 'Selected: '+keys.map(key=>groups.find(g=>g.key===key).name).join(', ')+'. Preview again before approval. Nothing sent.';
    }
    const kind=slot.toLowerCase(),draft=record[kind];
    if(edit) {
      if(text.length>1500||secrets.test(text)) return 'Keep announcement text under 1500 characters and leave out credentials.';
      draft.text=text;delete draft.approved;await save(records);return 'Draft changed. Preview and approve it again. Nothing sent.';
    }
    let view;try{view=announcement(record,kind);}catch{return 'A group configuration changed. Select the groups again and preview; nothing sent.';}
    const action=(verb||'preview').toLowerCase();
    if(action==='preview'||action==='prepare') {
      draft.preview=view.hash;await save(records);
      return `PRIVATE ${kind} preview — ${record.title}\n\nAudience: ${view.selected.map(g=>g.name).join(', ')||'none selected — group sending blocked'}\nAttachment: ${view.asset?view.asset.name:'none (text only)'}\n\n${draft.text}\n\nNothing sent. To approve exactly this version: approve ${record.id} ${kind}`;
    }
    if(action==='approve') {
      if(draft.preview!==view.hash) return 'Preview the current announcement first. Nothing approved or sent.';
      draft.approved=view.hash;await save(records);
      return `Approved this exact ${kind} draft for ${view.selected.map(g=>g.name).join(', ')||'no groups'}. Nothing sent. ${view.selected.length?'Say “send '+record.id+' '+kind+'” when ready.':'Group sending is blocked until groups are selected and you approve a fresh preview.'}`;
    }
    if(action==='send') {
      if(!enabled||!send||!view.selected.length) return 'Group sending is off or no groups are selected. Your approved draft stays private; nothing sent.';
      if(draft.approved!==view.hash) return 'The text, attachment or groups changed. Preview and approve the current version first.';
      if(!await isPublic(record.url)) return 'The listening link is not confirmed public. Nothing sent.';
      const day=dateInSA(now());
      if((kind==='teaser'&&day>=record.date)||(kind==='launch'&&day<record.date)) return 'This announcement does not match the release date in South Africa. Review it before sending.';
      if(draft.delivery) return 'A send was already attempted. '+(draft.delivery.status==='sent'?'It is recorded as sent.':'Check WhatsApp with DJ Papzin; automatic retries are blocked to avoid duplicates.');
      let media;
      if(view.asset) {
        const full=path.join(directory,view.asset.name);
        if(path.basename(view.asset.name)!==view.asset.name || (await stat(full)).size>30*1024*1024) throw new Error('Invalid media');
        media=await readFile(full);if(sha(media)!==view.asset.sha256) return 'The saved attachment changed. Reattach it, preview and approve again; nothing sent.';
      }
      draft.delivery={status:'sending',groups:[],at:new Date(now()).toISOString()};await save(records);
      for(const group of view.selected) {
        draft.delivery.groups.push({key:group.key,status:'attempting'});await save(records);
        try {
          await send(group.jid,media ? (kind==='teaser'?{video:media,mimetype:view.asset.mime,caption:draft.text}:{image:media,mimetype:view.asset.mime,caption:draft.text}):{text:draft.text,linkPreview:null});
          draft.delivery.groups.at(-1).status='sent';await save(records);
        } catch {draft.delivery.status='uncertain';await save(records);return 'Sending could not be confirmed. Stopped; no retry or further group sends. Check WhatsApp before doing anything else.';}
      }
      draft.delivery.status='sent';await save(records);return 'Announcement sent to the selected groups: '+view.selected.map(g=>g.name).join(', ')+'.';
    }
    return 'Say “preview '+record.id+' '+kind+'”. Nothing sent.';
  }
  async function previewMedia({role,question}) {
    if(role!=='owner') return null;
    const match=question.trim().match(/^preview\s+([a-z0-9-]+)\s+(teaser|launch)$/i);
    if(!match) return null;
    const record=(await load()).find(r=>r.id===match[1].toLowerCase());
    if(!record) return null;
    const kind=match[2].toLowerCase(),view=announcement(record,kind);
    if(!view.asset||record[kind].preview!==view.hash) return null;
    if(path.basename(view.asset.name)!==view.asset.name) throw new Error('Invalid preview asset');
    const full=path.join(directory,view.asset.name);
    if((await stat(full)).size>30*1024*1024) throw new Error('Preview asset too large');
    const bytes=await readFile(full);
    if(sha(bytes)!==view.asset.sha256) throw new Error('Preview asset changed');
    return kind==='teaser'?{video:bytes,mimetype:view.asset.mime,caption:'Private teaser preview for DJ Papzin. Nothing sent to groups.'}:{image:bytes,mimetype:view.asset.mime,caption:'Private release artwork preview for DJ Papzin. Nothing sent to groups.'};
  }
  return {seed,attach,handle,previewMedia};
}
