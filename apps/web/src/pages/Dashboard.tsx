import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { api } from '../lib/api';

export function Dashboard() {
  const [status, setStatus] = useState('');
  const { data, isLoading, isError } = useQuery({ queryKey: ['runs', status], queryFn: () => api.runs(status || undefined) });
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-4 py-3 flex gap-3"><Link to="/" className="font-bold">DeepTrace AI</Link>
        <Link to="/research/new" className="ml-auto bg-violet-600 rounded px-3 py-1 text-sm">+ New research</Link></header>
      <main className="max-w-6xl mx-auto p-4">
        <div className="flex gap-2 items-center">
          <h1 className="text-2xl font-bold">Research dashboard</h1>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="ml-auto bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm" aria-label="Filter by status">
            <option value="">All statuses</option><option value="queued">Queued</option><option value="running">Running</option><option value="completed">Completed</option><option value="failed">Failed</option>
          </select>
        </div>
        {isLoading && <p className="mt-4 text-zinc-400">Loading…</p>}
        {isError && <p role="alert" className="mt-4 text-red-400">Could not load research. Is the API running?</p>}
        {data && data.data.length === 0 && (
          <div className="mt-6 border border-dashed border-zinc-700 rounded p-8 text-center">
            <p className="font-semibold">No research yet</p>
            <p className="text-sm text-zinc-400">Start your first investigation or try the labeled demo report.</p>
            <div className="mt-3 flex gap-2 justify-center"><Link to="/research/new" className="bg-violet-600 rounded px-3 py-1 text-sm">Start research</Link><Link to="/report/demo" className="border rounded px-3 py-1 text-sm">View demo report</Link></div>
          </div>
        )}
        <ul className="mt-4 space-y-2">
          {(data?.data ?? []).map((r) => (
            <li key={r.id} className="border border-zinc-800 rounded p-3 flex gap-3 items-center">
              <span className="text-xs px-2 py-0.5 rounded bg-zinc-800">{r.status}</span>
              {r.demo && <span className="text-xs px-2 py-0.5 rounded bg-amber-900 text-amber-200">DEMO</span>}
              <Link to={`/research/${r.id}`} className="font-medium hover:underline truncate">{r.question}</Link>
              <span className="ml-auto text-xs text-zinc-500">{new Date(r.createdAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
