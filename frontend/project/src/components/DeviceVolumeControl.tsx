import { ReactNode } from 'react';

// iPadOS can identify as a Mac when requesting desktop sites.
export const usesDeviceVolume = (device = navigator) =>
  /iPad|iPhone|iPod/.test(device.userAgent)
  || (device.platform === 'MacIntel' && device.maxTouchPoints > 1);

export default function DeviceVolumeControl({ children }: { children: ReactNode }) {
  return usesDeviceVolume()
    ? <p className="text-sm text-gray-300 flex-1">Use your iPhone or iPad’s volume buttons.</p>
    : <>{children}</>;
}
