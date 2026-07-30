import { useEffect, useState } from 'react';
import { api } from '../lib/api';

/** SSE with replay + reconnect: polls persisted events after reconnect using last seq. */
export function useResearchStream(runId: string | undefined) {
  const [events, setEvents] = useState<Array<{ seq: number; type: string; payload?: unknown }>>([]);
  const [connected, setConnected] = useState(false);
  const [lastSeq, setLastSeq] = useState(0);

  useEffect(() => {
    if (!runId) return;
    let closed = false;
    let es: EventSource | null = null;
    let backoff = 1000;

    const catchUp = async () => {
      try {
        const res = await api.events(runId, lastSeq);
        if (res.data.length) {
          setEvents((prev) => [...prev, ...res.data.map((e) => ({ seq: e.seq, type: e.type, payload: e.payload }))]);
          setLastSeq(res.data[res.data.length - 1]!.seq);
        }
      } catch { /* offline — SSE will retry */ }
    };

    const connect = () => {
      if (closed) return;
      es = new EventSource(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'}/research/${runId}/stream`);
      es.onopen = () => { setConnected(true); backoff = 1000; void catchUp(); };
      es.onmessage = (m) => {
        try {
          const e = JSON.parse(m.data) as { type: string; seq?: number; payload?: unknown };
          if (e.type === 'heartbeat') return;
          const seq = e.seq ?? lastSeq + 1;
          setLastSeq(seq);
          setEvents((prev) => (prev.some((p) => p.seq === seq) ? prev : [...prev, { seq, type: e.type, payload: e.payload }])); 
        } catch { /* ignore partial frame */ }
      };
      es.onerror = () => {
        setConnected(false);
        es?.close();
        setTimeout(() => { backoff = Math.min(backoff * 2, 15000); void catchUp(); connect(); }, backoff);
      };
    };
    connect();
    return () => { closed = true; es?.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  return { events, connected, lastSeq };
}
