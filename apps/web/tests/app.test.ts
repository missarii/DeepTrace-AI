import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const researchSchema = z.object({ question: z.string().min(10).max(2000), depth: z.enum(['quick', 'standard', 'comprehensive']) });

describe('research form validation', () => {
  it('rejects short questions', () => {
    expect(researchSchema.safeParse({ question: 'hi', depth: 'standard' }).success).toBe(false);
  });
  it('accepts valid input', () => {
    expect(researchSchema.safeParse({ question: 'What are sensor fusion benchmarks for aerial detection?', depth: 'quick' }).success).toBe(true);
  });
});

describe('sse replay helper', () => {
  it('merges without duplicating seqs', () => {
    const prev = [{ seq: 1, type: 'a' }, { seq: 2, type: 'b' }];
    const incoming = [{ seq: 2, type: 'b' }, { seq: 3, type: 'c' }];
    const merged = [...prev, ...incoming.filter((e) => !prev.some((p) => p.seq === e.seq))];
    expect(merged.map((e) => e.seq)).toEqual([1, 2, 3]);
  });
});
