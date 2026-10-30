import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MixDetails from './MixDetails';
vi.mock('./SongActions', () => ({ default: () => null }));
vi.mock('./LibraryPages', () => ({ TrackList: () => null }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const mix = { id: 236, title: 'Unlisted test', artist: { name: 'Upload Tests' }, availability: 'unlisted', file_path: 'https://storage/test.wav' };
function show() {
 const play = vi.fn();
 render(<MemoryRouter initialEntries={['/track/236']}><Routes><Route path="/track/:id" element={<MixDetails songs={[]} loading={false} error={null} currentSong={null} isPlaying={false} onPlaySong={play} onTogglePlay={vi.fn()} />} /></Routes></MemoryRouter>);
 return play;
}
describe('Direct mix links', () => {
 it('loads unlisted audio absent from discovery with an isolated queue', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => mix }));
  const play = show();
  expect(await screen.findByRole('heading', { name: 'Unlisted test' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Play mix' }));
  expect(play).toHaveBeenCalledWith(expect.objectContaining({ id: '236' }), [expect.objectContaining({ id: '236' })]);
 });
 it.each([401, 403])('preserves private restrictions for %s', async status => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status })); show();
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('requires authorized access'));
  expect(screen.queryByRole('button', { name: 'Play mix' })).not.toBeInTheDocument();
 });
 it('reports a missing mix', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 })); show();
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Mix not found.'));
 });
});


it('offers a real download only from the verified public VPS cache',async()=>{
 const cached_audio_url='https://audio.djpapzin.com/tracks/236/cached/abcdefabcdefabcdefabcdef';
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({...mix,availability:'public',allow_downloads:'yes',cached_audio_url})}));
 show();const link=await screen.findByRole('link',{name:'Download mix'});
 expect(link).toHaveAttribute('href',cached_audio_url+'?download=1');expect(link).toHaveAttribute('download');
});
it('does not fall back to Backblaze when a permitted download is not cached',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({...mix,availability:'public',allow_downloads:'yes'})}));
 show();const button=await screen.findByRole('button',{name:'Download mix'});
 expect(screen.queryByRole('link',{name:'Download mix'})).not.toBeInTheDocument();
 await userEvent.click(button);expect(screen.getByRole('status')).toHaveTextContent('Download is being prepared');
});
it('never offers downloads for an unlisted upload even when downloads were allowed',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({...mix,allow_downloads:'yes',cached_audio_url:'https://audio.djpapzin.com/tracks/236/cached/abcdefabcdefabcdefabcdef'})}));
 show();await screen.findByRole('heading',{name:'Unlisted test'});
 expect(screen.queryByRole('link',{name:'Download mix'})).not.toBeInTheDocument();
 expect(screen.queryByText(/Download is being prepared/)).not.toBeInTheDocument();
});
