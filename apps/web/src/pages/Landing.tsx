import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '../stores/session';
import { api } from '../lib/api';

function Shell({ children }: { children: React.ReactNode }) {
  const { email, toggleTheme, theme, setEmail } = useSession();
  const nav = useNavigate();
  return (
    <div className={theme === 'dark' ? 'dark min-h-screen bg-zinc-950 text-zinc-100' : 'min-h-screen bg-white text-zinc-900'}>
      <header className="border-b border-zinc-800/40 px-4 py-3 flex items-center gap-4">
        <Link to="/" className="font-bold text-lg">DeepTrace AI</Link>
        <nav className="flex gap-3 text-sm">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/research/new">New research</Link>
          <Link to="/settings">Settings</Link>
        </nav>
        <div className="ml-auto flex gap-2 items-center text-sm">
          <button onClick={toggleTheme} className="border rounded px-2 py-1" aria-label="Toggle theme">{theme === 'dark' ? 'Light' : 'Dark'}</button>
          {email ? (<><span>{email}</span><button className="border rounded px-2 py-1" onClick={async () => { await api.logout(); localStorage.removeItem('dt_access'); setEmail(null); nav('/'); }}>Logout</button></>) : (<><Link to="/login" className="border rounded px-2 py-1">Sign in</Link><Link to="/register" className="border rounded px-2 py-1">Register</Link></>)}
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-4">{children}</main>
    </div>
  );
}

export function Landing() {
  return (
    <Shell>
      <section className="py-10">
        <p className="text-xs uppercase tracking-widest text-violet-400">Autonomous research engine</p>
        <h1 className="text-4xl font-bold mt-2">Ask a hard question. Get evidence, not vibes.</h1>
        <p className="mt-3 text-zinc-400 max-w-2xl">DeepTrace plans, searches, extracts, verifies claims, and synthesizes a cited report — with budgets, provenance, and honest limitations.</p>
        <div className="mt-5 flex gap-2">
          <Link to="/research/new" className="bg-violet-600 rounded px-4 py-2">Start research</Link>
          <Link to="/report/demo" className="border rounded px-4 py-2">View sample report (demo data)</Link>
        </div>
      </section>
      <section className="grid md:grid-cols-3 gap-3">
        {[['Plan & decompose', 'Subquestions, queries, completion criteria — validated with Pydantic.'], ['Search & verify', 'Tavily/Brave + SSRF-safe extraction, dedup, RRF ranking, claim verification.'], ['Report & export', 'Cited sections, contradictions, gaps, Markdown/PDF export.']].map(([h, b]) => (
          <div key={h} className="border border-zinc-800 rounded p-4"><h3 className="font-semibold">{h}</h3><p className="text-sm text-zinc-400 mt-1">{b}</p></div>
        ))}
      </section>
      <section className="mt-8 text-sm text-zinc-400">
        <h2 className="font-semibold text-zinc-200">Privacy & providers</h2>
        <p className="mt-1">Queries are sent to your configured search provider; documents stay server-side. API keys never reach the browser. Demo mode runs with zero keys and is always labeled.</p>
      </section>
    </Shell>
  );
}

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const nav = useNavigate();
  const { setEmail } = useSession();
  const [email, setE] = useState('demo@deeptrace.ai');
  const [password, setP] = useState('deeptrace123');
  const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    try {
      const res = mode === 'login' ? await api.login(email, password) : await api.register(email, password, 'Demo');
      localStorage.setItem('dt_access', res.data.accessToken);
      setEmail(email); nav('/dashboard');
    } catch (err) { setErr(err instanceof Error ? err.message : 'Auth failed'); }
  };
  return (
    <Shell>
      <form onSubmit={submit} className="max-w-sm mx-auto mt-10 border border-zinc-800 rounded p-5 space-y-3">
        <h1 className="text-xl font-bold">{mode === 'login' ? 'Sign in' : 'Register'}</h1>
        {err && <p role="alert" className="text-red-400 text-sm">{err}</p>}
        <label className="block text-sm">Email<input value={email} onChange={(e) => setE(e.target.value)} className="mt-1 w-full bg-transparent border rounded px-2 py-1" /></label>
        <label className="block text-sm">Password<input type="password" value={password} onChange={(e) => setP(e.target.value)} className="mt-1 w-full bg-transparent border rounded px-2 py-1" /></label>
        <button className="bg-violet-600 rounded px-4 py-2 w-full">{mode === 'login' ? 'Sign in' : 'Create account'}</button>
      </form>
    </Shell>
  );
}
