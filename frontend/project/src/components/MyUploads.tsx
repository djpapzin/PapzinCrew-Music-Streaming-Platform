import { useState } from 'react';
import { Link } from 'react-router-dom';
import { readUploadReceipts, saveUploadReceipt } from '../lib/uploadReceipts';
export default function MyUploads() {
  const [items, setItems] = useState(readUploadReceipts);
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  return <section id="my-uploads" className="rounded-2xl border border-purple-400/30 bg-purple-950/20 p-5 space-y-3">
    <h2 className="text-xl font-semibold">My uploads</h2>
    <p>Uploads start unlisted while DJ Papzin checks them. They won’t appear in public search yet. No account is needed to open your mix.</p>
    <p className="text-sm text-gray-400">Review links saved on this browser only. Bookmark your mix link to open it on another device. Anyone with an unlisted link can listen.</p>
    {items.length ? <ul className="space-y-3">{items.map(item => <li key={item.id}><Link className="text-purple-200 underline inline-flex min-h-11 items-center" to={`/track/${item.id}`}>{item.title || `Mix ${item.id}`} — Open mix</Link></li>)}</ul> : <p>No upload links saved on this browser yet.</p>}
    <details><summary className="cursor-pointer min-h-11">Save a previous mix link</summary><form className="space-y-2" onSubmit={e => {
      e.preventDefault(); setError('');
      try {
        const url = new URL(link);
        const match = url.pathname.match(/^\/track\/(\d+)\/?$/);
        const validQuery = [...url.searchParams].every(([key, value]) => key === 'uploaded' && ['saved', 'bookmark'].includes(value));
        if (url.origin !== window.location.origin || !match || !validQuery || url.hash) throw new Error('Paste a mix link from this site, such as crew.djpapzin.com/track/241.');
        if (!saveUploadReceipt(match[1], `Saved mix ${match[1]}`)) throw new Error('This browser cannot save links. Please bookmark the mix instead.');
        setItems(readUploadReceipts()); setLink('');
      } catch (err) { setError(err instanceof Error ? err.message : 'Please check the mix link.'); }
    }}><label className="block">Mix link<input type="url" required value={link} onChange={e=>setLink(e.target.value)} className="block w-full rounded-lg bg-gray-800 p-3 mt-2" /></label><button className="rounded-lg bg-purple-700 px-4 py-3">Save mix link</button>{error && <p role="alert">{error}</p>}</form></details>
  </section>;
}
