import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LibraryProvider, LIBRARY_KEY } from '../state/LibraryContext';
import SongActions from './SongActions';
import { PlaylistsPage,PlaylistEditor } from './LibraryPages';
import { ProfilePage } from './ListenerPages';
import { Song } from '../types/music';
const songs:Song[]=[{id:'1',title:'TPW Mix',artist:'Papzin',album:'TPW',duration:60,imageUrl:'',audioUrl:'/audio.mp3',genre:'House',year:2014}];
const wrapper=(children:React.ReactNode)=><MemoryRouter><LibraryProvider songs={songs}>{children}</LibraryProvider></MemoryRouter>;
beforeEach(()=>{localStorage.clear();});
describe('Saved library flows',()=>{
  it('persists likes after remounting',async()=>{render(wrapper(<SongActions song={songs[0]}/>));await userEvent.click(screen.getByRole('button',{name:'Like TPW Mix'}));await waitFor(()=>expect(JSON.parse(localStorage.getItem(LIBRARY_KEY)!).liked).toEqual(['1']));cleanup();render(wrapper(<SongActions song={songs[0]}/>));expect(screen.getByRole('button',{name:'Unlike TPW Mix'})).toHaveAttribute('aria-pressed','true');});
  it('creates a playlist, selects tracks, and saves it',async()=>{render(wrapper(<Routes><Route path="/" element={<PlaylistsPage/>}/><Route path="/playlists/:id" element={<PlaylistEditor currentSong={null} isPlaying={false} onPlaySong={vi.fn()}/>}/></Routes>));await userEvent.type(screen.getByRole('textbox',{name:'Playlist name'}),'Demo mixes');await userEvent.click(screen.getByRole('button',{name:'Create playlist'}));await userEvent.click(screen.getByRole('checkbox',{name:'TPW Mix'}));await userEvent.click(screen.getByRole('button',{name:'Save playlist'}));await waitFor(()=>expect(JSON.parse(localStorage.getItem(LIBRARY_KEY)!).playlists[0].songIds).toEqual(['1']));});
  it('adds a track to a new playlist from its menu',async()=>{render(wrapper(<SongActions song={songs[0]}/>));await userEvent.click(screen.getByRole('button',{name:'More options for TPW Mix'}));await userEvent.type(screen.getByRole('textbox',{name:'New playlist name'}),'TPW favorites');await userEvent.click(screen.getByRole('button',{name:'Create'}));expect(screen.queryByRole('dialog')).not.toBeInTheDocument();await waitFor(()=>expect(JSON.parse(localStorage.getItem(LIBRARY_KEY)!).playlists[0].songIds).toEqual(['1']));});
  it('saves a listener profile',async()=>{render(wrapper(<ProfilePage/>));const name=screen.getByLabelText('Display name');await userEvent.clear(name);await userEvent.type(name,'DJ Papzin');await userEvent.click(screen.getByRole('button',{name:'Save profile'}));await waitFor(()=>expect(JSON.parse(localStorage.getItem(LIBRARY_KEY)!).profile.name).toBe('DJ Papzin'));});
});
