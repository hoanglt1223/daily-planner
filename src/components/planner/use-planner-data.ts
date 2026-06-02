import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

export type Task = {
  id: string; title: string; description: string | null;
  status: 'backlog' | 'todo' | 'doing' | 'done' | 'archived';
  priority: number; estimatedMinutes: number;
  recurringRule: unknown | null; categoryId: string | null;
};

export type Category = {
  id: string; name: string; color: string;
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stable string keys so useEffect/useCallback don't refire on every parent
  // render just because parents recreated Date instances.
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [t, b, c] = await Promise.all([
        apiFetch<Task[]>('/api/tasks'),
        apiFetch<TimeBlock[]>(`/api/time-blocks?from=${fromIso}&to=${toIso}`),
        apiFetch<Category[]>('/api/categories'),
      ]);
      setTasks(t); setBlocks(b); setCategories(c);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [fromIso, toIso]);

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

  const updateTask = useCallback(async (id: string, patch: Partial<Pick<Task, 'status' | 'priority' | 'title' | 'description' | 'estimatedMinutes' | 'categoryId'>>) => {
    const updated = await apiFetch<Task>(`/api/tasks/${id}`, {
      method: 'PATCH', body: JSON.stringify(patch),
    });
    setTasks(prev => prev.map(t => t.id === id ? updated : t));
    return updated;
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  const createCategory = useCallback(async (payload: { name: string; color?: string }) => {
    const created = await apiFetch<Category>('/api/categories', {
      method: 'POST', body: JSON.stringify(payload),
    });
    setCategories(prev => [...prev, created]);
    return created;
  }, []);

  const updateCategory = useCallback(async (id: string, patch: { name?: string; color?: string }) => {
    const updated = await apiFetch<Category>(`/api/categories/${id}`, {
      method: 'PATCH', body: JSON.stringify(patch),
    });
    setCategories(prev => prev.map(c => c.id === id ? updated : c));
    return updated;
  }, []);

  const deleteCategory = useCallback(async (id: string) => {
    await apiFetch(`/api/categories/${id}`, { method: 'DELETE' });
    setCategories(prev => prev.filter(c => c.id !== id));
    // Clear categoryId from tasks that used this category
    setTasks(prev => prev.map(t => t.categoryId === id ? { ...t, categoryId: null } : t));
  }, []);

  return { tasks, blocks, categories, loading, error, reload, createBlock, updateBlock, deleteBlock, createTask, updateTask, deleteTask, createCategory, updateCategory, deleteCategory };
}
