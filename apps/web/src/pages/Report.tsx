import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';

export function ReportViewer({ demo }: { demo?: boolean }) {
  const { id = '' } = useParams();
  const runId = demo ? 'demo' : id;
  const { data, isLoading } = useQuery({
    queryKey: ['report', runId],
    queryFn: async () => {
      if (demo) return { data: demoReport };
      return api.report(id);
    },
  });
  const [selected, setSelected] = useState<number | null>(null);
  const report = data?.data;
  if (isLoading) return <p className="p-4">Loading report…</p>;
  if (!report) return <p className="p-4">Report not ready yet. <Link to={`/research/${id}`} className="underline">Back to live view</Link></p>;
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4">
      <div className="max-w-4xl mx-auto">
        <Link to="/dashboard" className="text-sm text-zinc-400">← Dashboard</Link>
        {demo && <p className="mt-2 text-xs bg-amber-900 text-amber-100 rounded px-2 py-1">DEMONSTRATION DATA — sample layout only, not real research findings.</p>}
        <h1 className="text-2xl font-bold mt-2">{report.title}</h1>
        <div className="mt-2 flex gap-2 text-sm">
          {!demo && <><a className="border rounded px-2 py-1" href={`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'}/research/${id}/export/markdown`}>Export Markdown</a>
          <a className="border rounded px-2 py-1" href={`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'}/research/${id}/export/pdf`}>Export PDF/HTML</a></>}
        </div>
        <section className="mt-4"><h2 className="font-semibold">Executive summary</h2><p className="text-sm text-zinc-300 mt-1">{report.summary}</p></section>
        <section className="mt-4"><h2 className="font-semibold">Methodology</h2><p className="text-sm text-zinc-300 mt-1">{report.methodology}</p></section>
        {(report.sections ?? []).map((s, i) => (
          <section key={i} className="mt-4"><h2 className="font-semibold">{s.heading}</h2><p className="text-sm text-zinc-300 mt-1">{s.body}</p></section>
        ))}
        <section className="mt-4">
          <h2 className="font-semibold">Bibliography ({report.citations.length})</h2>
          <ol className="text-sm mt-1 space-y-1">
            {report.citations.map((c, i) => (
              <li key={i} className="border border-zinc-800 rounded p-2">
                <button className="text-violet-300" onClick={() => setSelected(selected === i ? null : i)}>[{i + 1}] {c.url}</button>
                {selected === i && <p className="text-xs text-zinc-400 mt-1">“{c.passage}” <button className="underline" onClick={() => navigator.clipboard.writeText(`${c.url} — “${c.passage}”`)}>Copy citation</button></p>}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

const demoReport = {
  title: 'DEMO REPORT — Deep-learning aerial threat detection (sample data)',
  summary: 'Sample summary showing layout. Fusion of EO + radar illustrates how findings render; not a real finding.',
  methodology: 'Demo mode: no searches executed.',
  sections: [
    { heading: 'Main findings', body: 'Sample: EO + radar fusion improves recall in cluttered airspace [1].' },
    { heading: 'Gaps', body: 'Real dataset comparison needs live search with SEARCH_PROVIDER configured.' },
  ],
  citations: [{ url: 'https://example.com/demo/sensor-fusion-survey', passage: 'Multi-modal fusion improves recall (demo passage).' }],
};
