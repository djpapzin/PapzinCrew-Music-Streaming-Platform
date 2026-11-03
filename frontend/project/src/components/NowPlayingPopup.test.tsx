import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { NowPlayingPopup } from './NowPlayingPopup';
import type { PlayerState } from '../types/music';
afterEach(cleanup);
it('restores the floating desktop dock on double-click while leaving its controls alone',()=>{
 const noop=vi.fn();const track={id:'1',title:'Mix one',artist:'DJ'};
 const playerState={currentSong:null,isPlaying:false,volume:0,currentTime:0,duration:100,queue:[],currentIndex:0,shuffle:false,repeat:'none'} as PlayerState;
 render(<NowPlayingPopup track={track} isVisible onClose={noop} playerState={playerState} onTogglePlay={noop} onNext={noop} onPrevious={noop} onVolumeChange={noop} onSeek={noop} onToggleShuffle={noop} onToggleRepeat={noop} liked={false} onToggleLike={noop}/>);
 fireEvent.click(screen.getByRole('button',{name:'Minimize player'}));
 fireEvent.doubleClick(screen.getByRole('button',{name:'Play'}));expect(screen.queryByRole('dialog',{name:'Now Playing'})).toBeNull();
 fireEvent.doubleClick(screen.getByText('Mix one'));expect(screen.getByRole('dialog',{name:'Now Playing'})).toBeTruthy();expect(noop).not.toHaveBeenCalled();
});
