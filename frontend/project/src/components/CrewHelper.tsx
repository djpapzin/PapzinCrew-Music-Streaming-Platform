import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../lib/api';

type Reply = { answer: string; links: { label: string; url: string }[] };
type Turn = { question: string; reply: Reply };

export default function CrewHelper({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement;
    closeButton.current?.focus();
    return () => {
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, [open]);

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = question.trim();
    if (!text || pending) return;
    setPending(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/tracks/crew-helper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      });
      if (!response.ok) throw new Error();
      const reply: Reply = await response.json();
      setTurns(previous => [...previous, { question: text, reply }]);
      setQuestion('');
    } catch {
      setError('Crew Helper couldn’t answer right now. Try again or open Beta help.');
    } finally {
      setPending(false);
    }
  }

  return <section hidden={!open} role="dialog" aria-labelledby="crew-helper-title"
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}
    className="fixed inset-x-3 bottom-40 z-[45] max-h-[min(65dvh,36rem,calc(100dvh-11rem))] space-y-4 overflow-y-auto rounded-2xl border border-white/20 bg-gray-950 p-4 shadow-2xl sm:left-auto sm:right-6 sm:w-96 lg:bottom-28 lg:max-h-[min(65dvh,36rem,calc(100dvh-8rem))]">
    <div className="flex items-center justify-between gap-3">
      <h2 id="crew-helper-title" className="text-xl font-bold">Crew Helper</h2>
      <button ref={closeButton} type="button" className="min-h-11 rounded-lg px-3 hover:bg-white/10" onClick={onClose}>Close chat</button>
    </div>
    <p className="text-gray-300">Ask for mix recommendations, a mix link, or help with playback.</p>
    <p className="text-sm text-gray-400">Try “Recommend a House mix”, “TPW 37”, or “My mix won’t play”. Keep passwords and private details out of chat.</p>
    <div role="log" aria-label="Crew Helper conversation" className="space-y-4">
      {turns.map(({ question, reply }, index) => <div className="space-y-2 break-words" key={index}>
        <p className="rounded-xl bg-purple-900/50 p-4"><strong>You</strong><br/>{question}</p>
        <div className="rounded-xl bg-white/10 p-4">
          <strong>Crew Helper</strong>
          <p className="mt-2 whitespace-pre-wrap">{reply.answer}</p>
          {reply.links.map(link => <Link className="mt-2 block text-purple-200 underline" key={link.url} to={new URL(link.url).pathname} onClick={onClose}>{link.label}</Link>)}
        </div>
      </div>)}
    </div>
    <form className="space-y-3" onSubmit={ask}>
      <label className="block" htmlFor="crew-question">Ask Crew Helper</label>
      <textarea id="crew-question" className="w-full rounded-xl bg-white/10 p-3" rows={2} maxLength={1500}
        value={question} disabled={pending} onChange={event => setQuestion(event.target.value)}/>
      <button className="min-h-11 rounded-full bg-purple-700 px-5 disabled:opacity-50" disabled={pending || !question.trim()}>
        {pending ? 'Getting an answer…' : 'Send'}
      </button>
      {error && <p role="alert" className="text-amber-200">{error}</p>}
    </form>
    <div className="flex flex-wrap gap-4 text-purple-200">
      <Link to="/about" onClick={onClose}>Beta help</Link>
      <a href="https://www.facebook.com/groups/PapzinCrew/" target="_blank" rel="noopener noreferrer">Facebook community</a>
    </div>
  </section>;
}
