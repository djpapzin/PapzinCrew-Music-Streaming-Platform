import { createHash } from 'node:crypto';

// Direct messages only, one approved tester, fresh commands, bounded in-memory IDs.
export function createPolicy({ tester, started = Date.now(), enabled = false, maxReplies = 20 }) {
  if (!/^\d{10,15}$/.test(tester ?? '')) throw new Error('One international tester number is required.');
  const expected = tester + '@s.whatsapp.net';
  const seen = new Set();
  let replies = 0;
  let last = 0;
  return (event, message, now = Date.now()) => {
    if (!enabled || event !== 'notify' || now - started > 30 * 60_000 || replies >= maxReplies) return null;
    const key = message?.key;
    const jid = key?.remoteJid ?? '';
    if (key?.fromMe || !key?.id || !/^\d+@(s\.whatsapp\.net|lid)$/.test(jid)) return null;
    // Alternate PN is provided by WhatsApp's envelope, never by message text.
    if (jid !== expected && !(jid.endsWith('@lid') && key.remoteJidAlt === expected)) return null;
    const timestamp = Number(message.messageTimestamp) * 1000;
    if (!Number.isFinite(timestamp) || timestamp < started - 10_000 || timestamp > now + 60_000) return null;
    const text = message.message?.conversation ?? message.message?.extendedTextMessage?.text;
    if (typeof text !== 'string' || !/^!crew(?:\s|$)/i.test(text)) return null;
    const question = text.replace(/^!crew\s*/i, '').trim() || 'What is Papzin & Crew?';
    if (question.length > 1500 || (last && now - last < 5000)) return null;
    const hash = createHash('sha256').update(jid + ':' + key.id).digest('hex');
    if (seen.has(hash)) return null;
    seen.add(hash);
    replies++;
    last = now;
    return { jid, question };
  };
}

export function renderReply(reply) {
  if (typeof reply?.answer !== 'string' || reply.answer.length > 3500) throw new Error('Invalid answer');
  const links = (reply.links ?? []).filter(link =>
    typeof link.url === 'string' && /^https:\/\/crew\.djpapzin\.com\/(?:track\/[1-9]\d*|search|upload|install)?$/.test(link.url));
  return 'Papzin & Crew test helper 🤖\n\n' + reply.answer +
    links.map(link => '\n' + link.url).join('') +
    (reply.needs_owner ? '\n\nDJ Papzin can help if this does not answer your question.' : '');
}
