import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function Sources() {
  const { id = '' } = useParams();
  const { data } = useQuery({ queryKey: ['sources', id], queryFn: () => api.sources(id) });
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4"><div className="max-w-5xl mx-auto">
      <h1 className="text-xl font-bold">Source explorer</h1>
      <p className="text-xs text-zinc-500 mt-1">Relevance = RRF fusion score (higher = retrieved by more strategies at better ranks). Inclusion reason recorded per source.</p>
      <ul className="mt-3 space-y-2">
        {(data?.data ?? []).map((s) => (
          <li key={s.id} className="border border-zinc-800 rounded p-3 text-sm">
            <p className="font-medium">{s.title}</p>
            <p className="text-xs text-zinc-500">{s.domain} · {s.canonicalUrl} · relevance {s.relevance.toFixed(3)} · {s.extractStatus}</p>
          </li>
        ))}
      </ul>
    </div></div>
  );
}

export function Evidence() {
  const { id = '' } = useParams();
  const { data } = useQuery({ queryKey: ['evidence', id], queryFn: () => api.evidence(id) });
  const claims = useQuery({ queryKey: ['claims', id], queryFn: () => api.claims(id) });
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4"><div className="max-w-5xl mx-auto">
      <h1 className="text-xl font-bold">Evidence explorer</h1>
      <h2 className="mt-3 font-semibold text-sm">Passages ({data?.data.length ?? 0})</h2>
      <ul className="mt-2 space-y-2">
        {(data?.data ?? []).map((e) => (
          <li key={e.id} className="border border-zinc-800 rounded p-3 text-sm">
            <span className="text-xs px-2 py-0.5 rounded bg-zinc-800">{e.relation}</span>
            <p className="mt-1">“{e.passage}”</p>
            <p className="text-xs text-zinc-500 mt-1">{e.source.title} · {e.source.domain} · relevance {e.relevance.toFixed(2)}</p>
          </li>
        ))}
      </ul>
      <h2 className="mt-4 font-semibold text-sm">Claims ({claims.data?.data.length ?? 0})</h2>
      <ul className="mt-2 space-y-2">
        {(claims.data?.data ?? []).map((c) => (
          <li key={c.id} className="border border-zinc-800 rounded p-3 text-sm">
            <span className="text-xs px-2 py-0.5 rounded bg-zinc-800">{c.status}</span>
            <p className="mt-1">{c.text}</p>
            {c.links.map((l, i) => (<p key={i} className="text-xs text-zinc-500 mt-1">↳ “{l.evidence.passage.slice(0, 140)}…” — {l.evidence.source.title}</p>))}
          </li>
        ))}
      </ul>
    </div></div>
  );
}
