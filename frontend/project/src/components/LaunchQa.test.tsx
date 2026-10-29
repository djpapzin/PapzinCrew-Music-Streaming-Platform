import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import QuickPlay from './QuickPlay';
import { AccountPage } from './ListenerPages';
import FeedbackButton from './FeedbackButton';
import { Song } from '../types/music';
const song:Song={id:'1',title:'Named DJ mix',artist:'DJ',duration:1200,audioUrl:'/mix.mp3',imageUrl:'',album:'',genre:'House',year:2026};
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});
it('names the selected mix, ignores double activation and pauses the same mix',()=>{
 let now=1000;vi.spyOn(performance,'now').mockImplementation(()=>now);const play=vi.fn(),toggle=vi.fn();
 const props={songs:[song],playlists:[],onPlaySong:play,onPlayPlaylist:vi.fn(),onTogglePlay:toggle};
 const view=render(<QuickPlay {...props}/>);expect(screen.getByText(song.title)).toBeTruthy();
 fireEvent.click(screen.getByText('Play mix'));fireEvent.click(screen.getByText('Play mix'));expect(play).toHaveBeenCalledTimes(1);
 view.rerender(<QuickPlay {...props} currentSong={song} isPlaying/>);now+=1000;fireEvent.click(screen.getByText('Pause mix'));expect(toggle).toHaveBeenCalledOnce();expect(play).toHaveBeenCalledOnce();
});
it('keeps registration disabled while sign-in is pending and clears old errors on a later mode switch',async()=>{
 let finish!:(value:unknown)=>void;const fetch=vi.fn(()=>new Promise(resolve=>{finish=resolve;}));vi.stubGlobal('fetch',fetch);
 render(<MemoryRouter><AccountPage/></MemoryRouter>);fireEvent.change(screen.getByLabelText('Email or username'),{target:{value:'qa@example.invalid'}});fireEvent.change(screen.getByLabelText('Password'),{target:{value:'fake'}});fireEvent.submit(screen.getByRole('button',{name:'Sign in',exact:true}).closest('form')!);
 expect((screen.getByText('Create a new account') as HTMLButtonElement).disabled).toBe(true);
 await act(async()=>finish({ok:false,json:async()=>({detail:'Invalid credentials'})}));await screen.findByText('Invalid credentials');fireEvent.click(screen.getByText('Create a new account'));expect(screen.queryByText('Invalid credentials')).toBeNull();expect(screen.getByRole('heading',{name:'Create account'})).toBeTruthy();
});
it('closes feedback on navigation and preserves unsent draft with updated page context',()=>{
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 let navigate!:(to:number)=>void;function Harness(){navigate=useNavigate();return <FeedbackButton/>;}
 render(<MemoryRouter initialEntries={['/','/account']} initialIndex={1}><Harness/></MemoryRouter>);fireEvent.click(screen.getByRole('button',{name:'Send feedback'}));fireEvent.change(screen.getByLabelText('Your message'),{target:{value:'An unsent test message'}});
 act(()=>navigate(-1));expect(document.querySelector('dialog')?.hasAttribute('open')).toBe(false);fireEvent.click(screen.getByRole('button',{name:'Send feedback'}));expect((screen.getByLabelText('Your message') as HTMLTextAreaElement).value).toBe('An unsent test message');expect(screen.getByText(/Page: \/\./)).toBeTruthy();
});

it('shows the actual signup field error instead of a generic rejection',async()=>{
 sessionStorage.clear();
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,json:async()=>({detail:[{loc:['body','username'],msg:'Value error, username is invalid'}]})}));
 render(<MemoryRouter><AccountPage/></MemoryRouter>);fireEvent.click(screen.getByText('Create a new account'));
 fireEvent.change(screen.getByLabelText('Email'),{target:{value:'qa@example.com'}});fireEvent.change(screen.getByLabelText('Username'),{target:{value:'Guest DJ'}});fireEvent.change(screen.getByLabelText('Password'),{target:{value:'test-password-123'}});
 fireEvent.submit(screen.getByRole('button',{name:'Create account',exact:true}).closest('form')!);
 expect(await screen.findByRole('alert')).toHaveTextContent('Username: username is invalid');
});
