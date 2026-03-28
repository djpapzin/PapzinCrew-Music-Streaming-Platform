import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AdminAnalyticsPanel from './AdminAnalyticsPanel';

const analyticsPayload = {
  total_plays: 320,
  total_downloads: 44,
  total_storage_mb: 91.5,
  paperclip_summary: {
    goal_id: 'goal_paperclip_papzincrew_001',
    initiative_id: 'init_paperclip_phase1_mobile_publish_clarity',
    initiative_title: 'Mobile publish-state clarity',
    business_status_summary: 'Keep the publish flow tight and visible for DJ Papzin.',
    current_tracker_phase: 'review',
    blocker_summary: 'No blocker.',
    next_milestone: 'Ship the admin brief.',
    risk_flag: 'low',
    budget_flag: 'within_guardrail',
    storage_flag: 'healthy',
    linked_tracker_cards: ['#203'],
    last_updated: '2026-03-27T20:40:00Z',
    audit_ref: 'paperclip-phase1-bridge',
  },
};

describe('AdminAnalyticsPanel', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => analyticsPayload,
      }) as unknown as typeof fetch,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads admin analytics and renders the Paperclip admin brief from the shared payload', async () => {
    render(<AdminAnalyticsPanel />);

    await waitFor(() => {
      expect(screen.getByText('320')).toBeInTheDocument();
    });

    expect(screen.getByText('44')).toBeInTheDocument();
    expect(screen.getByText('91.5')).toBeInTheDocument();
    expect(screen.getByText(/Paperclip admin brief/i)).toBeInTheDocument();
    expect(screen.getByText(/Keep the publish flow tight and visible for DJ Papzin./i)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenNthCalledWith(1, expect.stringContaining('/admin/analytics'), expect.any(Object));
  });
});
