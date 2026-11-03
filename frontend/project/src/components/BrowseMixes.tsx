import { useSearchParams, Link } from 'react-router-dom';
import { Song } from '../types/music';
import { durationFilters, filterMixes, genreOf } from '../lib/discovery';
import { sortCollectionTracks } from '../lib/catalog';
import { TrackList } from './LibraryPages';
interface Props { songs: Song[]; query: string; loading: boolean; error: string | null; currentSong: Song | null; isPlaying: boolean; onPlaySong: (song: Song, queue?: Song[]) => void; }
export default function BrowseMixes({ songs, query, loading, error, currentSong, isPlaying, onPlaySong }: Props) {
  const [params, setParams] = useSearchParams();
  const genre = params.get('genre') || '';
  const duration = durationFilters.find(filter => filter.value === params.get('duration'));
  const sort = params.get('sort') || 'series';
  const genres = Array.from(new Set(songs.map(genreOf))).sort();
  const matched = filterMixes(songs, query, genre, duration?.value);
  const results = sort === 'title' ? [...matched].sort((a,b) => a.title.localeCompare(b.title, undefined, { numeric: true })) : sortCollectionTracks(matched);
  const change = (key: string, value: string) => { const next = new URLSearchParams(params); value ? next.set(key,value) : next.delete(key); setParams(next); };
  return <section className="max-w-5xl mx-auto space-y-6">
    <div><p className="text-purple-300 text-xs uppercase tracking-widest mb-2">Find your next listen</p><h2 className="text-3xl font-bold">{query.trim() ? 'Search results' : 'Browse mixes'}</h2><p className="text-gray-400 mt-2">Find mixes by genre and length, or follow a mix series from the beginning.</p></div>
    <div className="flex flex-wrap gap-3"><Link className="min-h-11 inline-flex items-center bg-white/10 rounded-full px-4" to="/albums">Mix series →</Link><Link className="min-h-11 inline-flex items-center bg-white/10 rounded-full px-4" to="/artists">Artists →</Link></div>
    <div className="grid gap-3 sm:grid-cols-3 items-end rounded-2xl bg-white/5 p-4">
      <label className="flex-1 min-w-0 text-sm text-gray-300">Genre<select aria-label="Filter by genre" value={genre} onChange={e => change('genre', e.target.value)} className="block w-full min-h-11 bg-gray-900 border border-white/20 rounded-lg p-2 mt-2"><option value="">All genres</option>{genre && !genres.includes(genre) && <option value={genre}>{genre}</option>}{genres.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
      <label className="min-w-0 text-sm text-gray-300">Duration
        <select aria-label="Filter by duration" value={duration?.value || ''} onChange={e => change('duration', e.target.value)} className="block w-full min-h-11 bg-gray-900 border border-white/20 rounded-lg p-2 mt-2">
          <option value="">Any duration</option>
          {durationFilters.map(filter => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
        </select>
      </label>
      <label className="flex-1 min-w-0 text-sm text-gray-300">Order<select aria-label="Sort mixes" value={sort} onChange={e => change('sort', e.target.value)} className="block w-full min-h-11 bg-gray-900 border border-white/20 rounded-lg p-2 mt-2"><option value="series">Series order</option><option value="title">Title A–Z</option></select></label>
      {(genre || duration) && <button className="text-purple-300 min-h-11 justify-self-start" onClick={() => {
        const next = new URLSearchParams(params);
        next.delete('genre');
        next.delete('duration');
        setParams(next);
      }}>Clear filters</button>}
    </div>
    {!loading && !error && <p role="status" className="text-sm text-gray-400">{results.length} {results.length === 1 ? 'mix' : 'mixes'}{genre ? ` in ${genre}` : ''}{duration ? ` · ${duration.label}` : ''}{query.trim() ? ` matching “${query.trim()}”` : ''}</p>}
    {results.length ? <TrackList songs={results} currentSong={currentSong} isPlaying={isPlaying} onPlaySong={onPlaySong}/> : !loading && !error ? <p className="rounded-xl bg-white/5 p-6">No mixes match. Try another search or clear the filters.</p> : null}
  </section>;
}
