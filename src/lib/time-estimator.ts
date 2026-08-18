import { apiFetch } from './api-client';

export interface TimeEstimate {
  estimate: number | null;
  confidence: 'none' | 'low' | 'medium' | 'high';
  sampleSize: number;
  message: string;
}

export async function fetchSmartEstimate(
  categoryId?: string | null,
  priority?: number | null
): Promise<TimeEstimate> {
  const params = new URLSearchParams();
  if (categoryId) params.set('categoryId', categoryId);
  if (priority) params.set('priority', priority.toString());

  return apiFetch<TimeEstimate>(`/api/tasks?action=estimate&${params.toString()}`);
}

export function getConfidenceColor(confidence: TimeEstimate['confidence']): string {
  switch (confidence) {
    case 'high': return 'text-green-600';
    case 'medium': return 'text-yellow-600';
    case 'low': return 'text-orange-600';
    default: return 'text-gray-400';
  }
}

export function getConfidenceIcon(confidence: TimeEstimate['confidence']): string {
  switch (confidence) {
    case 'high': return '✓';
    case 'medium': return '~';
    case 'low': return '?';
    default: return '—';
  }
}
