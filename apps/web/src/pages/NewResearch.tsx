import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { api } from '../lib/api';

const schema = z.object({
  question: z.string().min(10, 'Ask a substantive question (10+ chars)').max(2000),
  depth: z.enum(['quick', 'standard', 'comprehensive']).default('standard'),
  objectives: z.string().optional(),
  language: z.string().default('en'),
  maxSeconds: z.coerce.number().min(30).max(3600).default(600),
  searchBudget: z.coerce.number().min(1).max(50).default(16),
  includeDomains: z.string().optional(),
  excludeDomains: z.string().optional(),
  demo: z.boolean().default(false),
});
type Form = z.infer<typeof schema>;

export function NewResearch() {
  const nav = useNavigate();
  const [err, setErr] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { depth: 'standard', language: 'en', maxSeconds: 600, searchBudget: 16, demo: false } });
  const onSubmit = async (f: Form) => {
    setErr('');
    try {
      const res = await api.createRun({
        question: f.question, depth: f.depth, language: f.language, maxSeconds: f.maxSeconds,
        searchBudget: f.searchBudget, demo: f.demo,
        objectives: f.objectives ? f.objectives.split('\n').map((s) => s.trim()).filter(Boolean) : [],
        includeDomains: f.includeDomains ? f.includeDomains.split(',').map((s) => s.trim()).filter(Boolean) : [],
        excludeDomains: f.excludeDomains ? f.excludeDomains.split(',').map((s) => s.trim()).filter(Boolean) : [],
        idempotencyKey: crypto.randomUUID(),
      });
      nav(`/research/${res.data.id}`);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Creation failed'); }
  };
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4">
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl mx-auto border border-zinc-800 rounded p-5 space-y-3">
        <h1 className="text-xl font-bold">New research</h1>
        {err && <p role="alert" className="text-red-400 text-sm">{err}</p>}
        <label className="block text-sm">Research question
          <textarea {...register('question')} rows={4} className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1" placeholder="Investigate the state of…" />
          {errors.question && <span className="text-red-400 text-xs">{errors.question.message}</span>}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">Depth<select {...register('depth')} className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1"><option value="quick">Quick</option><option value="standard">Standard</option><option value="comprehensive">Comprehensive</option></select></label>
          <label className="text-sm">Language<input {...register('language')} className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1" /></label>
          <label className="text-sm">Max seconds<input type="number" {...register('maxSeconds')} className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1" /></label>
          <label className="text-sm">Search budget<input type="number" {...register('searchBudget')} className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1" /></label>
        </div>
        <label className="block text-sm">Objectives (one per line)<textarea {...register('objectives')} rows={2} className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1" /></label>
        <label className="text-sm flex gap-2 items-center"><input type="checkbox" {...register('demo')} /> Run as labeled demo (no API keys, sample data only)</label>
        <button disabled={isSubmitting} className="bg-violet-600 rounded px-4 py-2 w-full disabled:opacity-50">{isSubmitting ? 'Starting…' : 'Start research'}</button>
      </form>
    </div>
  );
}
