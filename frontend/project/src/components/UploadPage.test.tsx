import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import UploadPage from './UploadPage';

const summary = {
  goal_id: 'goal_paperclip_papzincrew_001',
  initiative_id: 'init_paperclip_phase1_mobile_publish_clarity',
  initiative_title: 'Mobile publish-state clarity',
  business_status_summary: 'Ready to improve the pre-publish state on mobile.',
  current_tracker_phase: 'review',
  blocker_summary: 'No current blocker.',
  next_milestone: 'Approve the Paperclip insight card.',
  risk_flag: 'low',
  budget_flag: 'within_guardrail',
  storage_flag: 'healthy',
  linked_tracker_cards: ['#203', '#204'],
  last_updated: '2026-03-27T20:40:00Z',
  audit_ref: 'paperclip-phase1-bridge',
};

describe('UploadPage Paperclip context', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => summary,
      }) as unknown as typeof fetch,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the Paperclip card from the paperclipTaskId query param', async () => {
    render(
      <MemoryRouter initialEntries={['/upload?paperclipTaskId=321']}>
        <Routes>
          <Route path="/upload" element={<UploadPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(summary.business_status_summary)).toBeInTheDocument();
    });

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/paperclip/summary/321'));
  });

  it('shows a helper message instead of silently using a fallback Paperclip id', () => {
    render(
      <MemoryRouter initialEntries={['/upload']}>
        <Routes>
          <Route path="/upload" element={<UploadPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Open this upload page with a/i)).toBeInTheDocument();
    expect(screen.getByText(/paperclipTaskId/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
