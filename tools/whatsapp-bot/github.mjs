import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
const exec = promisify(execFile);
export const REPOSITORY = 'djpapzin/PapzinCrew-Music-Streaming-Platform';
const BASE = `https://github.com/${REPOSITORY}/issues/`;
export function issuePreview(record) {
  if (!/^[a-f0-9]{8}$/.test(record.id)) throw new Error('Invalid request ID');
  const title = `[WhatsApp ${record.id}] ${record.description.replace(/[\r\n]/g,' ').slice(0,100)}`;
  const body = `Website change requested privately by the verified owner through Crew Helper.\n\n${record.description}\n\nImplementation target: dev. Open any implementation PR against dev. Do not promote to main, merge into main or deploy until DJ Papzin explicitly approves the reviewed change.\n\nThis issue requests review and development work; it does not authorize spending, coding agents, production changes, credential access or changes to existing tracklists.\n\n<!-- crew-owner-request:${record.id} -->`;
  return {title,body,hash:createHash('sha256').update(JSON.stringify({title,body})).digest('hex')};
}
export function validIssueUrl(url) { return typeof url==='string' && url.startsWith(BASE) && /^\d+$/.test(url.slice(BASE.length)); }
export function createGitHub(run = async args => {
  const {stdout}=await exec('gh',args,{timeout:15000,maxBuffer:2*1024*1024,env:{...process.env,GH_PROMPT_DISABLED:'1',GH_PAGER:'cat'}});
  return JSON.parse(stdout);
}) {
  const endpoint=`repos/${REPOSITORY}/issues`;
  return {
    async find(record) {
      const actor=await run(['api','user']);
      for(let page=1;page<=10;page++) {
        const issues=await run(['api',`${endpoint}?state=all&per_page=100&page=${page}`]);
        if(!Array.isArray(issues)) throw new Error('Invalid GitHub response');
        const found=issues.find(i=>!i.pull_request && i.user?.login===actor.login && i.body?.includes(`<!-- crew-owner-request:${record.id} -->`));
        if(found) {if(!validIssueUrl(found.html_url)) throw new Error('Invalid issue URL');return found.html_url;}
        if(issues.length<100) return null;
      }
      throw new Error('Issue reconciliation needs owner review');
    },
    async create(record) {
      const {title,body}=issuePreview(record);
      // Fixed repository and fixed endpoint. No shell, code, branch or workflow commands.
      const issue=await run(['api',endpoint,'--method','POST','--raw-field',`title=${title}`,'--raw-field',`body=${body}`]);
      if(!validIssueUrl(issue.html_url)) throw new Error('Invalid issue URL');
      return issue.html_url;
    },
  };
}
