import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import ReactFlow, { Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';
import { api } from '../lib/api';

export function Graph() {
  const { id = '' } = useParams();
  const { data } = useQuery({ queryKey: ['graph', id], queryFn: () => api.graph(id) });
  const [filter, setFilter] = useState('');
  const { nodes, edges } = useMemo(() => {
    const ns = (data?.data.nodes ?? []).filter((n) => !filter || n.name.toLowerCase().includes(filter.toLowerCase()));
    const keep = new Set(ns.map((n) => n.id));
    return {
      nodes: ns.map((n, i) => ({ id: n.id, position: { x: (i % 5) * 180, y: Math.floor(i / 5) * 120 }, data: { label: `${n.name} (${n.kind})` } })),
      edges: (data?.data.edges ?? []).filter((e) => keep.has(e.fromId) && keep.has(e.toId)).map((e) => ({ id: e.id, source: e.fromId, target: e.toId, label: e.label })),
    };
  }, [data, filter]);
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4"><div className="max-w-6xl mx-auto">
      <Link to={`/research/${id}`} className="text-sm text-zinc-400">← Live view</Link>
      <div className="flex gap-2 items-center mt-2">
        <h1 className="text-xl font-bold">Knowledge graph</h1>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search nodes…" className="ml-auto bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm" aria-label="Search nodes" />
      </div>
      <p className="text-xs text-zinc-500 mt-1">Relationships are evidence-linked and shown as provisional — select a node, then inspect evidence. Never presented as established fact without verification status.</p>
      <div className="h-[70vh] border border-zinc-800 rounded mt-3">
        <ReactFlow nodes={nodes} edges={edges} fitView><Background /><Controls /></ReactFlow>
      </div>
    </div></div>
  );
}
