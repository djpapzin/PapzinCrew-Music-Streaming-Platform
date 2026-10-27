import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import AnonymousStats from './AnonymousStats';
import { LibraryProvider } from '../state/LibraryContext';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('loads private aggregates only with the owner key and excludes resumes from startup average',async()=>{
  const fetch=vi.fn(async()=>({ok:true,json:async()=>({days:[{day:'2026-10-28',visits:3,devices:{mobile:3},mixes:{237:{attempts:4,starts:2,failures:1,startup_ms:6000,startup_samples:2,listen_ms:120000,resumes:1,startup_buckets:[0,2,0,0,0,0]}}}]})}));vi.stubGlobal('fetch',fetch);
  render(<LibraryProvider songs={[]}><AnonymousStats adminKey="owner-test"/></LibraryProvider>);
  expect(fetch).not.toHaveBeenCalled();fireEvent.click(screen.getByText('Load anonymous stats'));
  await screen.findByText('Visits: 3');expect(screen.getByText('Average start: 3.00s')).toBeTruthy();expect(screen.getByText('Listening: 2.0 minutes')).toBeTruthy();
  expect(fetch.mock.calls[0][1].headers['X-Admin-Api-Key']).toBe('owner-test');
});
