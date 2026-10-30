import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import DownloadStats from './DownloadStats';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('loads owner-only per-mix request counts and keeps completions distinct',async()=>{
 const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({mixes:[{id:241,title:'Guest 48',requests:3},{id:237,title:'Many More',requests:0}]})});vi.stubGlobal('fetch',fetch);
 const view=render(<DownloadStats adminKey=""/>);expect(fetch).not.toHaveBeenCalled();
 expect(screen.getByRole('button',{name:'Refresh download counts'})).toBeDisabled();
 view.rerender(<DownloadStats adminKey="test-owner"/>);fireEvent.click(screen.getByRole('button',{name:'Refresh download counts'}));
 expect(await screen.findByText('Total download requests: 3')).toBeTruthy();expect(screen.getByText('Guest 48')).toBeTruthy();expect(screen.getByText(/not unique people or confirmed completed files/)).toBeTruthy();
 fireEvent.change(screen.getByLabelText('Find a mix'),{target:{value:'Guest'}});expect(screen.queryByText('Many More')).toBeNull();
 view.rerender(<DownloadStats adminKey=""/>);expect(screen.queryByText('Guest 48')).toBeNull();
});
