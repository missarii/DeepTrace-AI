import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';

export function Settings() {
  const { data, refetch } = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const usage = useQuery({ queryKey: ['usage'], queryFn: api.usage });
  const [msg, setMsg] = useState('');
  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api.saveSettings({ chatProvider: String(fd.get('chat') ?? 'mock'), maxIterations: Number(fd.get('iters') ?? 2) });
    setMsg('Saved. Secrets are env-only in this release and never echoed to the browser.');
    void refetch();
  };
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4"><div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold">Settings & integrations</h1>
      <p className="text-xs text-zinc-500 mt-1">Provider keys are configured via environment on the server. The browser never receives stored secrets.</p>
      <form onSubmit={save} className="mt-3 border border-zinc-800 rounded p-4 space-y-3 text-sm">
        <label className="block">Chat provider<select name="chat" defaultValue="mock" className="ml-2 bg-zinc-900 border border-zinc-700 rounded px-2 py-1"><option value="mock">Mock (offline)</option><option value="openai">OpenAI-compatible</option><option value="anthropic">Anthropic</option><option value="ollama">Ollama (local)</option></select></label>
        <label className="block">Max iterations<input name="iters" type="number" defaultValue={2} min={1} max={5} className="ml-2 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 w-20" /></label>
        <button className="bg-violet-600 rounded px-3 py-1">Save</button>
        {msg && <p className="text-green-300 text-xs">{msg}</p>}
        <pre className="text-xs text-zinc-400 whitespace-pre-wrap">{JSON.stringify(data?.data ?? {}, null, 2)}</pre>
      </form>
      <section className="mt-4 border border-zinc-800 rounded p-4 text-sm">
        <h2 className="font-semibold">Usage & cost (estimates)</h2>
        <pre className="text-xs text-zinc-400 mt-2">{JSON.stringify(usage.data?.data ?? {}, null, 2)}</pre>
      </section>
      <section className="mt-4 border border-zinc-800 rounded p-4 text-sm">
        <h2 className="font-semibold">Data retention</h2>
        <p className="text-xs text-zinc-400 mt-1">Delete your account and all research data:</p>
        <button className="mt-2 border border-red-700 text-red-300 rounded px-3 py-1" onClick={async () => { if (confirm('Delete all your data?')) { await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'}/auth/me`, { method: 'DELETE', headers: { authorization: `Bearer ${localStorage.getItem('dt_access')}` } }); localStorage.removeItem('dt_access'); location.href = '/'; } }}>Delete my data</button>
      </section>
    </div></div>
  );
}
