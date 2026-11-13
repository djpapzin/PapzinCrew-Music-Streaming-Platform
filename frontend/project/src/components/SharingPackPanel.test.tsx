import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import SharingPackPanel from './SharingPackPanel';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const pack={id:2,title:'Public mix',artist:'DJ',fingerprint:'abc',url:'https://crew.djpapzin.com/track/2',short:'Short draft',long:'Long draft',credit_note:'Confirm credit'};
const response=(data:unknown,ok=true)=>({ok,json:async()=>data});
async function load(){await screen.findByRole('option',{name:/#2/});fireEvent.change(screen.getByLabelText('Public mix'),{target:{value:'2'}});fireEvent.click(screen.getByText('Prepare drafts'));await screen.findByLabelText('Short announcement draft');}
it('validates freshly before clipboard data resolves and preserves edited draft',async()=>{
 const copy=vi.fn(async(items:any[])=>{await items[0].data['text/plain'];});
 vi.stubGlobal('ClipboardItem',class{constructor(public data:any){}});vi.stubGlobal('navigator',{clipboard:{write:copy}});
 const fetch=vi.fn(async(url:string)=>response(url.endsWith('/sharing')?{mixes:[pack]}:pack));vi.stubGlobal('fetch',fetch);
 render(<SharingPackPanel/>);await load();fireEvent.change(screen.getByLabelText('Short announcement draft'),{target:{value:'Edited draft'}});
 fireEvent.click(screen.getByText('Validate and copy short draft'));await screen.findByText(/Draft copied/);
 expect(copy).toHaveBeenCalledTimes(1);expect(fetch).toHaveBeenCalledTimes(3);expect(screen.getByLabelText('Short announcement draft')).toHaveValue('Edited draft');
});
it('blocks stale or withdrawn mix copying without overwriting edits',async()=>{
 let changed=false;const copy=vi.fn(async(items:any[])=>{await items[0].data['text/plain'];});
 vi.stubGlobal('ClipboardItem',class{constructor(public data:any){}});vi.stubGlobal('navigator',{clipboard:{write:copy}});
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>response(url.endsWith('/sharing')?{mixes:[pack]}:{...pack,fingerprint:changed?'changed':'abc'})));
 render(<SharingPackPanel/>);await load();fireEvent.change(screen.getByLabelText('Long announcement draft'),{target:{value:'Keep my edits'}});changed=true;
 fireEvent.click(screen.getByText('Validate and copy long draft'));await screen.findByText(/Catalog details changed/);
 expect(screen.getByLabelText('Long announcement draft')).toHaveValue('Keep my edits');expect(screen.getByText('Validate and copy long draft')).toBeDisabled();
});
