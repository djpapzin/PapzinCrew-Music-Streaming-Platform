import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,it,expect,vi} from 'vitest';
import LatestMix,{latestMix} from './LatestMix';
import type {Song} from '../types/music';
const mix=(id:string):Song=>({id,title:`Guest ${id}`,artist:'DJ',album:'',duration:100,imageUrl:'',audioUrl:'/audio.mp3',genre:'House',year:2026});
afterEach(cleanup);
it('selects the newest playable public catalog addition, independently of input order',()=>{expect(latestMix([mix('241'),mix('47'),{...mix('999'),playable:false},{...mix('1000'),audioUrl:''}])?.id).toBe('241');});
it('updates the homepage spotlight when a newer mix is published and plays that mix',()=>{
 const play=vi.fn();const view=render(<MemoryRouter><LatestMix songs={[mix('47'),mix('241')]} onPlaySong={play}/></MemoryRouter>);
 expect(screen.getByRole('heading').textContent).toBe('Guest 241');fireEvent.click(screen.getByRole('button',{name:'Play latest mix'}));expect(play.mock.calls[0][0].id).toBe('241');
 view.rerender(<MemoryRouter><LatestMix songs={[mix('47'),mix('241'),mix('245')]} onPlaySong={play}/></MemoryRouter>);expect(screen.getByRole('heading').textContent).toBe('Guest 245');expect(screen.getByRole('link',{name:'Mix details →'}).getAttribute('href')).toBe('/track/245');
});
it('does not display an empty or unavailable spotlight',()=>{const {container}=render(<MemoryRouter><LatestMix songs={[]} onPlaySong={()=>{}}/></MemoryRouter>);expect(container.textContent).toBe('');});
