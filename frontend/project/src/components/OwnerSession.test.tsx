import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import Panel from './ProtectedAdminAnalyticsPanel';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('restores a remembered device and automatically loads private anonymous stats',async()=>{
  const fetch=vi.fn(async(url:string)=>({ok:true,json:async()=>url.endsWith('/session')?{authenticated:true}:{days:[]}}));vi.stubGlobal('fetch',fetch);render(<Panel/>);
  await screen.findByText('Owner access is unlocked on this device.');await screen.findByText('Visits: 0');
  expect(screen.queryByLabelText('Owner analytics key')).toBeNull();expect(fetch.mock.calls.some(call=>call[0].includes('/admin/usage?activity=listener'))).toBe(true);
});
it('unlocks once without storing the raw key and signs out',async()=>{
  const fetch=vi.fn(async(url:string,options?:RequestInit)=>({ok:true,json:async()=>url.endsWith('/session')&&!options?.method?{authenticated:false}:url.includes('/session')?{authenticated:true}:{days:[]}}));vi.stubGlobal('fetch',fetch);render(<Panel/>);
  fireEvent.change(screen.getByLabelText('Owner analytics key'),{target:{value:'private-key'}});fireEvent.click(screen.getByLabelText('Remember this private device for 30 days'));fireEvent.click(screen.getByText('Unlock admin'));
  await screen.findByText('Owner access is unlocked on this device.');
  const login=fetch.mock.calls.find(call=>call[0].includes('remember=true'));expect(login?.[1]?.method).toBe('POST');
  expect(localStorage.getItem('owner-key')).toBeNull();
  fireEvent.click(screen.getByText('Sign out of admin'));await screen.findByLabelText('Owner analytics key');expect(screen.queryByText('Visits: 0')).toBeNull();
});
