import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import TracklistDraftPanel from './TracklistDraftPanel';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('only checks configuration and cannot scan without free credits',async()=>{
  const fetch=vi.fn(async()=>({ok:true,json:async()=>({enabled:false,draft:null})}));vi.stubGlobal('fetch',fetch);
  render(<TracklistDraftPanel adminKey="test-key"/>);
  fireEvent.change(screen.getByLabelText('Mix ID for tracklist'),{target:{value:'237'}});
  fireEvent.click(screen.getByText('Check draft'));
  await screen.findByText(/Scanning is disabled/);
  expect(screen.queryByText('Generate suggested tracklist')).toBeNull();
  expect(fetch.mock.calls).toHaveLength(1);
});
it('generates a separate draft only after an explicit click',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({enabled:true,draft:null})}).mockResolvedValueOnce({ok:true,json:async()=>({draft:{state:'ready',note:'Sampled draft',entries:[{seconds:60,artist:'Artist',title:'Song',score:95}]}})});
  vi.stubGlobal('fetch',fetch);render(<TracklistDraftPanel adminKey="test-key"/>);
  fireEvent.change(screen.getByLabelText('Mix ID for tracklist'),{target:{value:'237'}});fireEvent.click(screen.getByText('Check draft'));
  fireEvent.click(await screen.findByText('Generate suggested tracklist'));
  await screen.findByText(/Artist — Song/);
  await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(2));
  expect(fetch.mock.calls[1][1].method).toBe('POST');
  expect(screen.getByText(/Nothing is published or overwritten/)).toBeTruthy();
});
