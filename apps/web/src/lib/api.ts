const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('dt_access');
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(init?.headers ?? {}) },
    credentials: 'include',
  });
  if (res.status === 401) { window.dispatchEvent(new Event('dt:unauthorized')); throw new Error('Unauthorized'); }
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('json')) return (await res.text()) as unknown as T;
  return (await res.json()) as T;
}

export const api = {
  register: (email: string, password: string, name?: string) => req<{ data: { accessToken: string; refreshToken: string } }>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }),
  login: (email: string, password: string) => req<{ data: { accessToken: string; refreshToken: string } }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => req<{ data: { id: string; email: string; name?: string } }>('/auth/me'),
  logout: () => req('/auth/logout', { method: 'POST', body: JSON.stringify({}) }),
  projects: () => req<{ data: unknown[] }>('/projects'),
  createRun: (body: Record<string, unknown>) => req<{ data: { id: string } }>('/research', { method: 'POST', body: JSON.stringify(body) }),
  runs: (status?: string) => req<{ data: Array<{ id: string; question: string; status: string; depth: string; demo: boolean; createdAt: string }> }>(`/research${status ? `?status=${status}` : ''}`),
  run: (id: string) => req<{ data: { id: string; question: string; status: string; depth: string; demo: boolean } }>(`/research/${id}`),
  events: (id: string, after = 0) => req<{ data: Array<{ seq: number; type: string; payload: unknown; createdAt: string }> }>(`/research/${id}/events?after=${after}`),
  plan: (id: string) => req<{ data: unknown }>(`/research/${id}/plan`),
  sources: (id: string) => req<{ data: Array<{ id: string; title: string; domain: string; canonicalUrl: string; relevance: number; extractStatus: string }> }>(`/research/${id}/sources`),
  evidence: (id: string) => req<{ data: Array<{ id: string; passage: string; relevance: number; relation: string; source: { title: string; domain: string; canonicalUrl: string } }> }>(`/research/${id}/evidence`),
  claims: (id: string) => req<{ data: Array<{ id: string; text: string; status: string; links: Array<{ evidence: { passage: string; source: { title: string; canonicalUrl: string } } }> }> }>(`/research/${id}/claims`),
  report: (id: string) => req<{ data: { title: string; summary: string; methodology: string; sections: Array<{ heading: string; body: string }>; citations: Array<{ url: string; passage: string }> } | null }>(`/research/${id}/report`),
  graph: (id: string) => req<{ data: { nodes: Array<{ id: string; name: string; kind: string }>; edges: Array<{ id: string; fromId: string; toId: string; label: string }> } }>(`/research/${id}/graph`),
  cancel: (id: string) => req(`/research/${id}/cancel`, { method: 'POST', body: JSON.stringify({}) }),
  retry: (id: string) => req(`/research/${id}/retry`, { method: 'POST', body: JSON.stringify({}) }),
  settings: () => req<{ data: Record<string, unknown> }>('/settings'),
  saveSettings: (body: Record<string, unknown>) => req('/settings', { method: 'PATCH', body: JSON.stringify(body) }),
  usage: () => req<{ data: { runs: number; promptTokens: number; completionTokens: number; estCostUsd: number; note: string } }>('/usage'),
};

export function streamUrl(id: string, after = 0) {
  const token = localStorage.getItem('dt_access');
  return `${BASE}/research/${id}/stream?after=${after}${token ? `&token=${token}` : ''}`;
}
