import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MainContent from './MainContent';
import { LibraryProvider } from '../state/LibraryContext';
import { saveUploadReceipt } from '../lib/uploadReceipts';

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllEnvs(); });

it('keeps review links available from My uploads while intake is paused', () => {
  vi.stubEnv('VITE_UPLOADS_ENABLED', 'false');
  saveUploadReceipt(1, 'Submitted mix');
  render(<MemoryRouter initialEntries={['/upload#my-uploads']}>
    <LibraryProvider songs={[]}><MainContent searchQuery="" songs={[]} playlists={[]}
      albums={[]} artists={[]} tracksLoading={false} tracksError={null} currentSong={null}
      isPlaying={false} onPlaySong={vi.fn()} onPlayPlaylist={vi.fn()} onTogglePlay={vi.fn()}
      volume={0} setVolume={vi.fn()} onRetry={vi.fn()}/></LibraryProvider>
  </MemoryRouter>);
  expect(screen.getByRole('heading', {name: 'Uploads are temporarily paused'})).toBeInTheDocument();
  expect(screen.getByRole('link', {name: 'Submitted mix — Open mix'})).toHaveAttribute('href', '/track/1');
  expect(screen.queryByRole('button', {name: 'Upload for Review'})).not.toBeInTheDocument();
});
