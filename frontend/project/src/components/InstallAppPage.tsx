import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Share, Smartphone } from 'lucide-react';

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches
  || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

export default function InstallAppPage() {
  const [installed, setInstalled] = useState(isStandalone);
  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)');
    const refresh = () => setInstalled(isStandalone());
    media.addEventListener('change', refresh);
    return () => media.removeEventListener('change', refresh);
  }, []);

  return <section className="max-w-xl mx-auto space-y-6">
    <div className="flex items-center gap-4">
      <img src="/icons/apple-touch-icon.png" alt="Papzin & Crew app icon" className="w-20 h-20 rounded-2xl" />
      <div><h2 className="text-2xl font-bold">Papzin & Crew on your phone</h2><p className="text-gray-300 mt-2">Your mixes, one tap from your Home Screen.</p></div>
    </div>
    {installed ? <div className="rounded-xl bg-purple-500/15 border border-purple-400/30 p-5 space-y-3">
      <h3 className="text-lg font-semibold">You’re using the Home Screen app</h3>
      <p className="text-gray-300">Open it from the PapzinCrew icon whenever you want to listen.</p>
      <Link to="/" className="inline-flex min-h-11 items-center rounded-full bg-purple-600 px-5 font-medium">Browse mixes</Link>
    </div> : <div className="rounded-xl bg-white/5 border border-white/10 p-5 space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2"><Smartphone className="w-5 h-5" /> Install on iPhone</h3>
      <ol className="list-decimal pl-5 space-y-3 text-gray-200">
        <li>Open <a className="text-purple-300 underline break-all" href="https://papzincrew.netlify.app/">papzincrew.netlify.app</a> in Safari on your iPhone.</li>
        <li>Tap <strong>Share</strong> <Share className="inline w-4 h-4" aria-hidden="true" />. Depending on your Safari layout, it may be inside the More menu.</li>
        <li>Choose <strong>Add to Home Screen</strong>. If it’s missing, use <strong>Edit Actions</strong> to add it.</li>
        <li>Keep <strong>Open as Web App</strong> on if shown, then tap <strong>Add</strong>.</li>
        <li>Launch <strong>PapzinCrew</strong> from your Home Screen.</li>
      </ol>
      <p className="text-gray-400 text-sm">On Android, open the browser menu and choose Install app or Add to Home screen.</p>
    </div>}
    <div className="space-y-2 text-gray-300">
      <p>This is the free Home Screen web app. It opens in its own window and uses the live music catalog.</p>
      <p>You need an internet connection to stream. Favorites and playlists are saved on this device; your browser’s existing library may be separate from the installed app.</p>
    </div>
    <div className="rounded-xl bg-white/5 p-5 space-y-3">
      <h3 className="font-semibold">Try your first mobile test</h3>
      <p className="text-gray-300">Play a mix, open Now Playing, seek, minimize, and pause. Then check what happens when you lock the screen or switch apps.</p>
      <Link className="inline-flex min-h-11 items-center text-purple-300" to="/albums?series=TPW%20%E2%80%94%20The%20Pristine%20World">Open the TPW collection →</Link>
    </div>
  </section>;
}
