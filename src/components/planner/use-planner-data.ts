import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

export type Task = {
  id: string; title: string; description: string | null;
  status: 'backlog' | 'todo' | 'doing' | 'done' | 'archived';
  priority: number; estimatedMinutes: number;
  recurringRule: unknown | null; categoryId: string | null;
};

export type TimeBlock = {
  id: string; taskId: string | null; title: string;
  startAt: string; endAt: string;
  status: 'planned' | 'in_progress' | 'completed' | 'skipped' | 'pending';
  note: string | null;
};

export function usePlannerData(from: Date, to: Date) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [t, b] = await Promise.all([
        apiFetch<Task[]>('/api/tasks'),
        apiFetch<TimeBlock[]>(`/api/time-blocks?from=${from.toISOString()}&to=${to.toISOString()}`),
      ]);
      setTasks(t); setBlocks(b);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { reload(); }, [reload]);

  const createBlock = useCallback(async (payload: {
    taskId?: string; title: string; startAt: Date; endAt: Date;
  }) => {
    const created = await apiFetch<TimeBlock>('/api/time-blocks', {
      method: 'POST',
      body: JSON.stringify({
        taskId: payload.taskId ?? null,
        title: payload.title,
        startAt: payload.startAt.toISOString(),
        endAt: payload.endAt.toISOString(),
      }),
    });
    setBlocks(prev => [...prev, created]);
    return created;
  }, []);

  const updateBlock = useCallback(async (id: string, patch: { startAt?: Date; endAt?: Date; title?: string; note?: string | null; status?: TimeBlock['status'] }) => {
    const body: Record<string, unknown> = { ...patch };
    if (patch.startAt) body.startAt = patch.startAt.toISOString();
    if (patch.endAt) body.endAt = patch.endAt.toISOString();
    const updated = await apiFetch<TimeBlock>(`/api/time-blocks/${id}`, {
      method: 'PATCH', body: JSON.stringify(body),
    });
    setBlocks(prev => prev.map(b => b.id === id ? updated : b));
    return updated;
  }, []);

  const deleteBlock = useCallback(async (id: string) => {
    await apiFetch(`/api/time-blocks/${id}`, { method: 'DELETE' });
    setBlocks(prev => prev.filter(b => b.id !== id));
  }, []);

  const createTask = useCallback(async (payload: Partial<Task> & { title: string }) => {
    const created = await apiFetch<Task>('/api/tasks', {
      method: 'POST', body: JSON.stringify(payload),
    });
    setTasks(prev => [created, ...prev]);
    return created;
  }, []);

  return { tasks, blocks, loading, error, reload, createBlock, updateBlock, deleteBlock, createTask };
}
