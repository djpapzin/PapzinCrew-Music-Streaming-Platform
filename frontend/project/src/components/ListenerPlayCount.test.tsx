import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import ListenerPlayCount from './ListenerPlayCount';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('shows the listener-only count with its time window',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({plays:3,window_days:30})})));
 render(<ListenerPlayCount mixId="241"/>);
 expect(await screen.findByText('3 listener plays · last 30 days')).toBeTruthy();
});
it('does not invent zero when stats are unavailable',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:false})));
 const view=render(<ListenerPlayCount mixId="241"/>);
 await new Promise(resolve=>setTimeout(resolve,0));expect(view.container.textContent).toBe('');
});
