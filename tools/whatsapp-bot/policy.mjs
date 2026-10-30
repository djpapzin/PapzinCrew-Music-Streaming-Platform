import { createHash } from 'node:crypto';

// Device suffixes identify linked devices of the same account, not new senders.
export function normalizePrivateJid(jid) {
  const match=typeof jid==='string' && jid.match(/^(\d+)(?::\d+)?@(s\.whatsapp\.net|lid)$/);
  return match ? match[1]+'@'+match[2] : null;
}

// Direct messages only, one approved tester, fresh commands, bounded in-memory IDs.
export function createPolicy({ tester, started = Date.now(), enabled = false, maxReplies, owner, persistent = false, natural = false, listeners = [], isCommunityMember=()=>false }) {
  maxReplies ??= persistent && natural ? 500 : 20;
  if (!/^\d{10,15}$/.test(tester ?? '')) throw new Error('One international tester number is required.');
  if (!Array.isArray(listeners) || listeners.length>100 || listeners.some(n=>!/^\d{10,15}$/.test(n))) throw new Error('Invalid listener allowlist');
  const allowed = new Set([tester,...listeners].map(n=>n+'@s.whatsapp.net'));
  const ownerJid=owner+'@s.whatsapp.net';
  if (owner !== undefined && !/^\d{10,15}$/.test(owner)) throw new Error('Invalid owner number');
  if (persistent && owner !== tester) throw new Error('Persistent mode is owner-only');
  const seen = new Map();
  let windowStart = started;
  let replies = 0;
  let last = 0;
  const senderRates=new Map();
  return (event, message, now = Date.now()) => {
    if (persistent && now-windowStart >= 30*60_000) { windowStart=now; replies=0; }
    if (!enabled || event !== 'notify' || (!persistent && now - started > 30 * 60_000) || replies >= maxReplies) return null;
    const key = message?.key;
    const jid = normalizePrivateJid(key?.remoteJid) ?? '';
    if (key?.fromMe || !key?.id || !jid) return null;
    // Alternate PN is provided by WhatsApp's envelope, never by message text.
    const sender=jid.endsWith('@lid') ? normalizePrivateJid(key.remoteJidAlt) : jid;
    if(!allowed.has(sender) && !isCommunityMember(sender) && !isCommunityMember(jid)) return null;
    const timestamp = Number(message.messageTimestamp) * 1000;
    if (!Number.isFinite(timestamp) || timestamp < Math.max(started - 10_000, now - 120_000) || timestamp > now + 60_000) return null;
    const role = sender===ownerJid ? 'owner' : 'listener';
    const video = message.message?.videoMessage;
    const image = message.message?.imageMessage;
    const media = video ?? image;
    const caption = media?.caption;
    const attachmentAllowed = role==='owner' && typeof caption==='string' && /^!crew\s+release\s+[a-z0-9-]+\s+(teaser|artwork)\s*$/i.test(caption);
    const unsupportedMedia=!attachmentAllowed && Boolean(message.message?.audioMessage||message.message?.documentMessage||video||image);
    const text = message.message?.conversation ?? message.message?.extendedTextMessage?.text ?? (attachmentAllowed ? caption : unsupportedMedia ? 'media received' : undefined);
    if(typeof text!=='string') return null;
    const forwarded=Boolean(message.message?.extendedTextMessage?.contextInfo?.isForwarded);
    const command=!forwarded && /^!crew(?:\s|$)/i.test(text);
    if(!natural && !command) return null;
    const question = (command ? text.replace(/^!crew\s*/i, '') : text).trim() || 'What is Papzin & Crew?';
    const rate=senderRates.get(sender??jid);
    if (question.length > 1500 || (!natural && last && now-last<5000)
        || (natural && rate && now-rate.start<30*60_000 && (rate.count>=40 || now-rate.last<300))) return null;
    const hash = createHash('sha256').update(jid + ':' + key.id).digest('hex');
    if (seen.has(hash)) return null;
    for (const [id,time] of seen) if (now-time > 120_000) seen.delete(id);
    seen.set(hash,now);
    replies++;
    last = now;
    if(natural) {
      for(const [key,r] of senderRates)if(now-r.start>=30*60_000)senderRates.delete(key);
      senderRates.set(sender??jid,{start:rate && now-rate.start<30*60_000?rate.start:now,count:rate && now-rate.start<30*60_000?rate.count+1:1,last:now});
    }
    return { jid, question, role, command, unsupportedMedia, forwarded, ...(attachmentAllowed ? {attachment:{mime:media.mimetype,size:Number(media.fileLength)},media:video?'video':'image',mediaMessage:media} : {}) };
  };
}

export function renderReply(reply) {
  if (typeof reply?.answer !== 'string' || reply.answer.length > 3500) throw new Error('Invalid answer');
  const links = (reply.links ?? []).filter(link =>
    typeof link.url === 'string' && /^https:\/\/crew\.djpapzin\.com\/(?:track\/[1-9]\d*|search|upload|install)?$/.test(link.url));
  return 'Crew Helper · Papzin & Crew 🤖\n\n' + reply.answer +
    links.map(link => '\n' + link.url).join('') +
    (reply.needs_owner ? '\n\nDJ Papzin can help if this does not answer your question.' : '');
}
