import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import DeviceVolumeControl from './DeviceVolumeControl';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('volume controls by device', () => {
  it.each([
    ['iPhone', 'iPhone', 5],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X)', 'MacIntel', 5],
  ])('explains device volume on %s', (userAgent, platform, maxTouchPoints) => {
    vi.stubGlobal('navigator', { userAgent, platform, maxTouchPoints });
    render(<DeviceVolumeControl><input type="range" aria-label="Volume" /></DeviceVolumeControl>);
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.getByText(/volume buttons/)).toBeTruthy();
  });
  it.each(['Mozilla/5.0 (Linux; Android 14)', 'Mozilla/5.0 (Macintosh; Intel Mac OS X)'])('preserves the slider on %s', userAgent => {
    vi.stubGlobal('navigator', { userAgent, platform: 'MacIntel', maxTouchPoints: 0 });
    render(<DeviceVolumeControl><input type="range" aria-label="Volume" /></DeviceVolumeControl>);
    expect(screen.getByRole('slider', { name: 'Volume' })).toBeTruthy();
  });
});
