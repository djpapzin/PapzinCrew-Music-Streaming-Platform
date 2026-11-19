import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import App from './App';
import { fetchCatalog } from './lib/fetchCatalog';

vi.mock('./lib/fetchCatalog', () => ({ fetchCatalog: vi.fn() }));
vi.mock('./components/FeedbackButton', () => ({ default: () => null }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function CurrentUrl() {
  const { pathname, search } = useLocation();
  return <output aria-label="Current URL">{pathname}{search}</output>;
}

it('restores a search link and preserves filters when the query is edited or cleared', async () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
  vi.mocked(fetchCatalog).mockResolvedValue([
    { id: 142, title: 'Supreme Masters Lab Mix 01', artist: { name: "Itshu'Prince & RealProDJ" },
      genre: 'House', duration_seconds: 1870, availability: 'public' },
    { id: 143, title: 'Other mix', artist: { name: 'RealProDJ' },
      genre: 'House', duration_seconds: 2000, availability: 'public' },
  ]);
  render(<MemoryRouter initialEntries={['/', '/search?q=Itshu+Prince+Supreme&genre=House&duration=medium']} initialIndex={1}>
    <App />
    <CurrentUrl />
  </MemoryRouter>);

  const input = screen.getByRole('textbox', { name: 'Search music' });
  const url = screen.getByLabelText('Current URL');
  expect(input).toHaveValue('Itshu Prince Supreme');
  expect(await screen.findByRole('link', { name: 'Supreme Masters Lab Mix 01' })).toHaveAttribute('href', '/track/142');
  expect(screen.queryByRole('link', { name: 'Other mix' })).toBeNull();

  fireEvent.change(input, { target: { value: "Itshu'Prince & RealProDJ" } });
  const params = new URLSearchParams(url.textContent?.split('?')[1]);
  expect(params.get('q')).toBe("Itshu'Prince & RealProDJ");
  expect(params.get('genre')).toBe('House');
  expect(params.get('duration')).toBe('medium');

  fireEvent.change(input, { target: { value: '' } });
  expect(url).toHaveTextContent('/search?genre=House&duration=medium');
  expect(screen.getByRole('link', { name: 'Other mix' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
  expect(url).toHaveTextContent(/^\/$/);
});
