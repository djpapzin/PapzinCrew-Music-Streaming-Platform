import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MixDetails from './MixDetails';
import BrowseMixes from './BrowseMixes';
import { LibraryProvider } from '../state/LibraryContext';
import { Song } from '../types/music';
import { relatedMixes } from '../lib/discovery';
const base:Song={id:'1',title:'TPW 1',artist:'Papzin',album:'',duration:1800,imageUrl:'',audioUrl:'/1.mp3',genre:'House',year:2014};
const songs=[base,{...base,id:'2',title:'TPW 2'},{...base,id:'3',title:'TPW 10',genre:'Soul'},{...base,id:'4',title:'Other mix',artist:'Guest',genre:'Soul'}];
const wrap=(child:React.ReactNode,path='/')=><MemoryRouter initialEntries={[path]}><LibraryProvider songs={songs}>{child}</LibraryProvider></MemoryRouter>;
beforeEach(()=>localStorage.clear());afterEach(cleanup);
describe('mix details and discovery',()=>{
 it('shows real metadata and plays the ordered series',async()=>{const play=vi.fn();render(wrap(<Routes><Route path="/track/:id" element={<MixDetails songs={[{...base,description:'Recorded live.',tracklist:'1. First track\n2. Second track'},...songs.slice(1)]} loading={false} error={null} currentSong={null} isPlaying={false} onPlaySong={play} onTogglePlay={vi.fn()}/>}/></Routes>,'/track/1'));expect(screen.getByText('Recorded live.')).toBeInTheDocument();expect(screen.getByText(/1. First track/)).toBeInTheDocument();await userEvent.click(screen.getByRole('button',{name:'Play mix'}));expect(play.mock.calls[0][1].map((s:Song)=>s.id)).toEqual(['1','2','3']);expect(screen.getByRole('link',{name:'Papzin',exact:true})).toHaveAttribute('href','/artists?artist=Papzin');});
 it('pauses the active mix without restarting and shows an honest missing tracklist',async()=>{const toggle=vi.fn(),play=vi.fn();render(wrap(<Routes><Route path="/track/:id" element={<MixDetails songs={songs} loading={false} error={null} currentSong={base} isPlaying onPlaySong={play} onTogglePlay={toggle}/>}/></Routes>,'/track/1'));await userEvent.click(screen.getByRole('button',{name:'Pause mix'}));expect(toggle).toHaveBeenCalledOnce();expect(play).not.toHaveBeenCalled();expect(screen.getByText(/tracklist hasn’t been added/)).toBeInTheDocument();});
 it('does not show not-found while the catalog is loading',()=>{render(wrap(<Routes><Route path="/track/:id" element={<MixDetails songs={[]} loading error={null} currentSong={null} isPlaying={false} onPlaySong={vi.fn()} onTogglePlay={vi.fn()}/>}/></Routes>,'/track/1'));expect(screen.queryByText(/Mix not found/)).toBeNull();});
 it('combines query with genre and restores other genres when cleared',async()=>{render(wrap(<BrowseMixes songs={songs} query="TPW 1" loading={false} error={null} currentSong={null} isPlaying={false} onPlaySong={vi.fn()}/>,'/search?genre=House'));expect(screen.getByRole('link',{name:'TPW 1',exact:true})).toBeInTheDocument();expect(screen.queryByRole('link',{name:'TPW 10',exact:true})).toBeNull();await userEvent.click(screen.getByRole('button',{name:'Clear filters'}));expect(screen.getByRole('link',{name:'TPW 10',exact:true})).toBeInTheDocument();});
 it('combines genre and duration and includes a mix at the 30-minute boundary', async () => {
   render(wrap(<BrowseMixes songs={songs} query="" loading={false} error={null} currentSong={null} isPlaying={false} onPlaySong={vi.fn()}/>, '/search?genre=House&duration=short'));
   expect(screen.getByText(/No mixes match/)).toBeInTheDocument();
   await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Filter by duration' }), 'medium');
   expect(screen.getByRole('link', { name: 'TPW 1', exact: true })).toBeInTheDocument();
   expect(screen.queryByRole('link', { name: 'TPW 10', exact: true })).toBeNull();
 });
 it('finds mix and artist words across fields while honoring browse filters', async () => {
   const title = 'Supreme Masters Lab Mix 01';
   const mix = { ...base, id: '142', title, artist: "Itshu'Prince & RealProDJ", duration: 1870 };
   const catalog = [...songs, mix, { ...mix, id: '143', title: 'Supreme Masters Lab Mix 02', duration: 900 }];
   render(wrap(<BrowseMixes songs={catalog} query="Itshu Prince Supreme Masters" loading={false} error={null}
     currentSong={null} isPlaying={false} onPlaySong={vi.fn()}/>, '/search?genre=House&duration=medium'));
   expect(screen.getByRole('link', { name: title, exact: true })).toHaveAttribute('href', '/track/142');
   expect(screen.getByRole('status')).toHaveTextContent(/^1 mix in House/);
   await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Filter by genre' }), 'Soul');
   expect(screen.getByText(/No mixes match/)).toBeInTheDocument();
 });
 it('keeps matching mix order natural and excludes unavailable related tracks',()=>{expect(relatedMixes(base,[...songs,{...base,id:'bad',title:'TPW 3',playable:false}]).map(s=>s.id)).toEqual(['2','3']);});
});
