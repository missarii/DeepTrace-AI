import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useResearchStream } from '../hooks/useStream';

export function LiveResearch() {
  const { id = '' } = useParams();
  const { events, connected } = useResearchStream(id);
  const run = useQuery({ queryKey: ['run', id], queryFn: () => api.run(id), refetchInterval: 5000 });
  const plan = useQuery({ queryKey: ['plan', id], queryFn: () => api.plan(id) });
  const sources = useQuery({ queryKey: ['sources', id], queryFn: () => api.sources(id), refetchInterval: 5000 });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4">
      <div className="max-w-6xl mx-auto">
        <Link to="/dashboard" className="text-sm text-zinc-400">← Dashboard</Link>
        <div className="flex items-center gap-2 mt-2">
          <h1 className="text-xl font-bold truncate">{run.data?.data.question ?? 'Loading…'}</h1>
          <span className={`text-xs px-2 py-0.5 rounded ${connected ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'}`}>{connected ? 'LIVE' : 'RECONNECTING'}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-zinc-800">{run.data?.data.status}</span>
          <span className="ml-auto flex gap-2">
            <button className="border rounded px-2 py-1 text-sm" onClick={() => api.cancel(id).then(() => run.refetch())}>Cancel</button>
            <button className="border rounded px-2 py-1 text-sm" onClick={() => api.retry(id).then(() => run.refetch())}>Retry</button>
            <Link to={`/report/${id}`} className="bg-violet-600 rounded px-2 py-1 text-sm">View report</Link>
          </span>
        </div>
        {!connected && <p className="text-xs text-amber-300 mt-1">Connection lost — replaying missed events from persisted log on reconnect.</p>}
        <div className="grid md:grid-cols-2 gap-3 mt-4">
          <section className="border border-zinc-800 rounded p-3">
            <h2 className="font-semibold">Research plan</h2>
            <pre className="text-xs mt-2 whitespace-pre-wrap text-zinc-300">{JSON.stringify((plan.data?.data as { subquestions?: string[] } | null)?.subquestions ?? plan.data?.data ?? 'Plan pending…', null, 2)}</pre>
          </section>
          <section className="border border-zinc-800 rounded p-3">
            <h2 className="font-semibold">Agent activity ({events.length})</h2>
            <ul className="mt-2 space-y-1 max-h-64 overflow-auto text-xs" aria-live="polite">
              {events.map((e) => (<li key={e.seq} className="border-b border-zinc-900 py-1"><span className="text-violet-300">{e.type}</span> <span className="text-zinc-500">#{e.seq}</span></li>))}
              {events.length === 0 && <li className="text-zinc-500">Waiting for first events…</li>}
            </ul>
          </section>
        </div>
        <section className="border border-zinc-800 rounded p-3 mt-3">
          <h2 className="font-semibold">Discovered sources ({sources.data?.data.length ?? 0})</h2>
          <ul className="mt-2 text-sm space-y-1">
            {(sources.data?.data ?? []).map((s) => (
              <li key={s.id} className="flex gap-2"><span className="text-zinc-500">{s.relevance.toFixed(2)}</span><span className="truncate">{s.title}</span><span className="ml-auto text-xs text-zinc-500">{s.domain}</span></li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2 text-sm">
            <Link to={`/sources/${id}`} className="border rounded px-2 py-1">Source explorer</Link>
            <Link to={`/evidence/${id}`} className="border rounded px-2 py-1">Evidence explorer</Link>
            <Link to={`/graph/${id}`} className="border rounded px-2 py-1">Knowledge graph</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
