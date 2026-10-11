import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminAnalyticsPanel from './AdminAnalyticsPanel';
afterEach(()=>vi.unstubAllGlobals());
const summary={total_tracks:178,total_artists:5,total_duration_hours:93.1,total_storage_mb:9000};
describe('Catalog overview',()=>{
  it('loads public totals without distributing admin secrets',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>summary}));render(<AdminAnalyticsPanel/>);expect(await screen.findByText('178')).toBeInTheDocument();expect(screen.getByText('93.1')).toBeInTheDocument();expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/tracks/catalog-summary'));});
  it('recovers from failure using Refresh',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce({ok:false}).mockResolvedValueOnce({ok:true,json:async()=>summary}));render(<AdminAnalyticsPanel/>);await screen.findByRole('alert');await userEvent.click(screen.getByRole('button',{name:'Refresh'}));expect(await screen.findByText('178')).toBeInTheDocument();});
});
