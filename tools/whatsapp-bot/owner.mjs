import { mkdir, readFile, writeFile, rename, chmod } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

export const PROFILE = Object.freeze({
  name: 'Crew Helper',
  about: 'Papzin & Crew assistant 🤖 Mix links, website help & feedback. Beta. crew.djpapzin.com',
});
const PRIVATE_COMMAND = /^(owner|change|requests|request|submit|deploy|approve|learn)\b/i;
const SENSITIVE = /(?:password|owner[ _-]?key|api[ _-]?key|access[ _-]?token|private[ _-]?key|-----BEGIN|gh[pousr]_[A-Za-z0-9]|github_pat_)/i;

export function createOwnerCommands(directory) {
  if (!directory || !path.isAbsolute(directory)) throw new Error('Absolute private request directory required.');
  async function load() {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await chmod(directory, 0o700);
    try { return JSON.parse(await readFile(path.join(directory, 'requests.json'), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  }
  async function save(records) {
    const temporary = path.join(directory, 'requests.' + randomUUID() + '.tmp');
    await writeFile(temporary, JSON.stringify(records), { mode: 0o600, flag: 'wx' });
    await rename(temporary, path.join(directory, 'requests.json'));
  }
  return async ({ role, question }) => {
    if (!PRIVATE_COMMAND.test(question)) return null;
    if (role !== 'owner') return 'Owner commands are available only to DJ Papzin in a verified private chat. For site help, send !crew help.';
    if (/^owner\s*$/i.test(question)) return `${PROFILE.name} — owner menu\n\n!crew change <what should change and why> — save a private website-change draft\n!crew requests — list your drafts\n!crew request <ID> — read one draft\n\nReview listener feedback and stats: https://crew.djpapzin.com/admin\n\nDrafts are local to this pilot. GitHub forwarding and automatic coding are not connected. Only reviewed changes should move from dev to main.`;
    if (/^change(?:\s|$)/i.test(question)) {
      const description = question.replace(/^change\s*/i, '').trim();
      if (description.length < 10 || description.length > 1000) return 'Describe the change in 10–1000 characters: !crew change <what should change and why>';
      if (SENSITIVE.test(description)) return 'Please leave credentials and owner keys out of change requests. Describe the behaviour you want without secrets.';
      const records = await load();
      if (records.length >= 100) return 'The private draft queue is full. Ask DJ Papzin to review it before adding more.';
      const id = randomUUID().slice(0,8);
      records.push({ id, description, status: 'draft', created_at: new Date().toISOString() });
      await save(records);
      return `Private change draft ${id} saved:\n\n${description}\n\nNo GitHub issue or code change has been made. Use !crew request ${id} to review it. Target: dev, with review before main.`;
    }
    if (/^requests\s*$/i.test(question)) {
      const records = await load();
      return records.length ? 'Private change drafts:\n' + records.slice(-10).map(r => `${r.id} · ${r.status} · ${r.description.slice(0,80).replace(/\s/g,' ')}`).join('\n') : 'No private change drafts yet. Use !crew change <what should change and why>.';
    }
    const match = question.match(/^request\s+([a-f0-9]{8})\s*$/i);
    if (match) {
      const record = (await load()).find(r => r.id === match[1].toLowerCase());
      return record ? `Private draft ${record.id}\nStatus: ${record.status}\n\n${record.description}\n\nTarget: dev. No GitHub issue or code change has been made.` : 'No matching private draft. Use !crew requests.';
    }
    if (/^learn\b/i.test(question)) return 'Website knowledge comes from reviewed help text and the public mix catalog. Send !crew change <help fact to add or correct> to draft an update. Group messages cannot teach or change my rules.';
    return 'That action is not connected. I can save a private change draft; I cannot submit GitHub issues, run code, deploy, approve uploads or change permissions from this chat.';
  };
}
