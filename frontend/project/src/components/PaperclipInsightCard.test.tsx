import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PaperclipInsightCard from './PaperclipInsightCard';

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

describe('PaperclipInsightCard', () => {
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

  it('loads and renders the live Paperclip summary', async () => {
    render(<PaperclipInsightCard taskId={203} />);

    expect(screen.getByText(/Loading Paperclip insight/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(summary.business_status_summary)).toBeInTheDocument();
    });

    expect(screen.getByText(/Phase: review/i)).toBeInTheDocument();
    expect(screen.getByText(/Risk: low/i)).toBeInTheDocument();
    expect(screen.getByText(/Budget: within_guardrail/i)).toBeInTheDocument();
    expect(screen.getByText(/Storage: healthy/i)).toBeInTheDocument();
    expect(screen.getByText(/Goal: goal_paperclip_papzincrew_001/i)).toBeInTheDocument();
    expect(screen.getByText(/Initiative: init_paperclip_phase1_mobile_publish_clarity/i)).toBeInTheDocument();
    expect(screen.getByText(/Linked cards: #203, #204/i)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/paperclip/summary/203'));
  });

  it('renders a provided summary without fetching', () => {
    render(<PaperclipInsightCard taskId={203} summary={summary} />);

    expect(screen.getByText(summary.business_status_summary)).toBeInTheDocument();
    expect(screen.getByText(/Phase: review/i)).toBeInTheDocument();
    expect(screen.queryByText(/Loading Paperclip insight/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Refresh Paperclip insight/i })).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('renders a compact variant focused on publish/admin summaries', async () => {
    render(<PaperclipInsightCard taskId={203} compact />);

    await waitFor(() => {
      expect(screen.getByText(summary.business_status_summary)).toBeInTheDocument();
    });

    expect(screen.getByText(/Initiative: Mobile publish-state clarity/i)).toBeInTheDocument();
    expect(screen.queryByText(/Goal: goal_paperclip_papzincrew_001/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/init_paperclip_phase1_mobile_publish_clarity/i)).not.toBeInTheDocument();
  });

  it('shows an error when the fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => ({ error: 'bad gateway' }),
      }) as unknown as typeof fetch,
    );

    render(<PaperclipInsightCard taskId={203} />);

    await waitFor(() => {
      expect(screen.getByText(/HTTP 502/i)).toBeInTheDocument();
    });
  });

  it('does not silently fall back to a hardcoded Paperclip task id', async () => {
    render(<PaperclipInsightCard taskId={null} />);

    await waitFor(() => {
      expect(screen.getByText(/Set a Paperclip task context first/i)).toBeInTheDocument();
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText(/Task #—/i)).toBeInTheDocument();
  });
});
