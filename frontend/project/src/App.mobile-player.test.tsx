import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./components/MainContent', () => ({ default: ({ songs, onPlaySong, onTogglePlay }: any) => <>
  {songs.map((song: any) => <button key={song.id} onClick={() => onPlaySong(song, songs)}>Select {song.title}</button>)}
  <button onClick={onTogglePlay}>Toggle playback</button>
</> }));
vi.mock('./components/Header', () => ({ default: () => null }));
vi.mock('./components/Sidebar', () => ({ default: () => null }));
vi.mock('./components/MobileNav', () => ({ default: () => null }));
vi.mock('./components/PlaybackTiming', () => ({ default: () => null }));
vi.mock('./components/NowPlayingPopup', () => ({ NowPlayingPopup: () => null }));
let paused = true;
let mobile = true;
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('papzincrew:volume', '0');
  paused = true; mobile = true;
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: mobile })));
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [1, 2, 3].map(id => ({
    id, title: `Mix ${id}`, artist: { name: 'DJ' }, availability: 'public',
    file_path: `https://s3.us-east-005.backblazeb2.com/test/mix-${id}.mp3`, duration_seconds: 10,
  })) })));
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockImplementation(() => paused);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
    expect(this.muted).toBe(true); paused = false; this.dispatchEvent(new Event('play')); return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
    paused = true; this.dispatchEvent(new Event('pause'));
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const dialog = () => screen.queryByRole('dialog', { name: 'Now Playing' });
async function setup() { render(<MemoryRouter><App /></MemoryRouter>); await screen.findByRole('button', { name: 'Select Mix 1' }); }
it('opens only for explicit mobile selections; collapse survives resume and automatic advancement', async () => {
  await setup();
  fireEvent.click(screen.getByRole('button', { name: 'Select Mix 1' }));
  expect(dialog()).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Minimize player' }));
  expect(dialog()).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Toggle playback' }));
  fireEvent.click(screen.getByRole('button', { name: 'Select Mix 1' })); // Resume from a mix card.
  expect(dialog()).toBeNull();
  expect(HTMLMediaElement.prototype.load).toHaveBeenCalledTimes(1);
  const audio = document.querySelector('audio')!;
  act(() => audio.dispatchEvent(new Event('ended')));
  expect(audio.src).toContain('mix-2.mp3');
  expect(dialog()).toBeNull(); expect(audio.muted).toBe(true);
  fireEvent.click(screen.getAllByRole('button', { name: 'Open Now Playing' })[0]);
  expect(dialog()).toBeTruthy();
  fireEvent.click(screen.getAllByRole('button', { name: 'Next track' })[0]);
  expect(audio.src).toContain('mix-3.mp3'); expect(dialog()).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Minimize player' }));
  fireEvent.click(screen.getByRole('button', { name: 'Select Mix 1' }));
  expect(dialog()).toBeTruthy(); // A new explicit selection opens it again.
});
it('does not open the mobile dialog on desktop', async () => {
  mobile = false; await setup();
  fireEvent.click(screen.getByRole('button', { name: 'Select Mix 1' }));
  expect(dialog()).toBeNull();
});

function swipe(target: Element, dx: number, dy: number, cancel = false) {
  const pointer = (type: string, x: number, y: number) => {
    const event = new Event(type, { bubbles: true });
    Object.assign(event, { pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: y });
    fireEvent(target, event);
  };
  pointer('pointerdown', 100, 100);
  if (cancel) pointer('pointercancel', 100 + dx, 100 + dy);
  pointer('pointerup', 100 + dx, 100 + dy);
}
it('swipes down from artwork to collapse without interrupting muted playback', async () => {
  await setup();
  fireEvent.click(screen.getByRole('button', { name: 'Select Mix 1' }));
  const audio = document.querySelector('audio')!;
  const art = dialog()!.querySelector('[data-player-swipe-surface] img')!;
  const plays = vi.mocked(HTMLMediaElement.prototype.play).mock.calls.length;
  swipe(art, 10, 130);
  expect(dialog()).toBeNull(); expect(audio.paused).toBe(false); expect(audio.muted).toBe(true);
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(plays);
  fireEvent.click(screen.getByRole('button', { name: 'Toggle playback' }));
  fireEvent.click(screen.getByRole('button', { name: 'Toggle playback' }));
  act(() => audio.dispatchEvent(new Event('ended')));
  expect(dialog()).toBeNull(); expect(audio.muted).toBe(true);
});
it('ignores short, horizontal, upward, cancelled and control gestures', async () => {
  await setup();
  fireEvent.click(screen.getByRole('button', { name: 'Select Mix 1' }));
  const art = dialog()!.querySelector('[data-player-swipe-surface] img')!;
  for (const [dx, dy] of [[0, 30], [130, 80], [0, -130]]) {
    swipe(art, dx, dy); expect(dialog()).toBeTruthy();
  }
  swipe(art, 0, 130, true); expect(dialog()).toBeTruthy();
  swipe(dialog()!.querySelector('input[aria-label="Seek track"]')!, 0, 130);
  expect(dialog()).toBeTruthy();
  swipe(screen.getByRole('button', { name: 'Minimize player' }), 0, 130);
  expect(dialog()).toBeTruthy();
  swipe(screen.getByRole('heading', { name: 'Now Playing' }), 0, 130);
  expect(dialog()).toBeNull();
});
