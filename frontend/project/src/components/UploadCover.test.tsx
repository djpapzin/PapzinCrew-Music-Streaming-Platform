import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import UploadPage from './UploadPage';
import { prepareCover } from '../lib/coverUpload';
vi.mock('../lib/coverUpload', () => ({ prepareCover: vi.fn() }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('opens cover picker and submits the chosen image with an unlisted upload', async () => {
 const prepared=new File(['jpeg'],'cover.jpg',{type:'image/jpeg'});
 vi.mocked(prepareCover).mockResolvedValue(prepared);
 vi.stubGlobal('URL',class extends URL {static createObjectURL(){return 'blob:cover-test';} static revokeObjectURL(){}});
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({duplicate:false})}));
 let sent:FormData|undefined;
 class UploadRequest {upload={addEventListener:vi.fn()}; status=201; responseText=JSON.stringify({id:233}); onload?:()=>void; open=vi.fn();setRequestHeader=vi.fn();send(body:FormData){sent=body;this.onload?.();}}
 vi.stubGlobal('XMLHttpRequest',UploadRequest);
 const {container}=render(<MemoryRouter initialEntries={['/upload']}><Routes><Route path="/upload" element={<UploadPage/>}/><Route path="/track/233" element={<p>Saved for review</p>}/></Routes></MemoryRouter>);
 const audio=new File(['audio'],'Guest48.mp3',{type:'audio/mpeg'});Object.defineProperty(audio,'size',{value:30*1024*1024});
 fireEvent.change(container.querySelector('#upload-audio-file')!,{target:{files:[audio]}});
 const input=screen.getByLabelText('Select cover image file'); const click=vi.spyOn(input,'click');
 fireEvent.click(screen.getAllByRole('button',{name:'Choose cover image'})[1]);expect(click).toHaveBeenCalledOnce();
 const image=new File(['png'],'art.png',{type:'image/png'});fireEvent.change(input,{target:{files:[image]}});
 await screen.findByText('Your selected cover image');expect(prepareCover).toHaveBeenCalledWith(image);
 expect(screen.getByAltText('Track cover art')).toHaveAttribute('src','blob:cover-test');
 fireEvent.change(screen.getByPlaceholderText('Enter the main artist name'),{target:{value:'Guest DJ'}});
 fireEvent.click(screen.getByRole('button',{name:/Upload Large File for Review/i}));await screen.findByText('Saved for review');
 expect(sent?.get('cover_art')).toBe(prepared);expect(sent?.get('availability')).toBe('unlisted');
});
it('keeps the previous cover when a replacement is invalid',async()=>{
 vi.stubGlobal('URL',class extends URL {static createObjectURL(){return 'blob:good';}static revokeObjectURL(){}});
 vi.mocked(prepareCover).mockResolvedValueOnce(new File(['good'],'cover.jpg',{type:'image/jpeg'})).mockRejectedValueOnce(new Error('Choose a JPEG, PNG or WebP image.'));
 render(<MemoryRouter><UploadPage/></MemoryRouter>);
 const input=screen.getByLabelText('Select cover image file');
 fireEvent.change(input,{target:{files:[new File(['good'],'good.png',{type:'image/png'})]}});await screen.findByText('Your selected cover image');
 fireEvent.change(input,{target:{files:[new File(['bad'],'bad.txt',{type:'text/plain'})]}});
 expect(await screen.findByRole('alert')).toHaveTextContent('Choose a JPEG');expect(screen.getByAltText('Track cover art')).toHaveAttribute('src','blob:good');
});
