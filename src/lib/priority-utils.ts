export type MatrixQuadrant = 'q1' | 'q2' | 'q3' | 'q4';

export type TaskStatus = 'backlog' | 'todo' | 'doing' | 'done' | 'archived';

export type Task = {
  id: string; title: string; description?: string | null;
  status: TaskStatus;
  priority: number; estimatedMinutes: number;
  dueDate?: string | null; categoryId: string | null;
};

export interface QuadrantTasks {
  q1: Task[]; // Important & Urgent
  q2: Task[]; // Important & Not Urgent
  q3: Task[]; // Not Important & Urgent
  q4: Task[]; // Not Important & Not Urgent
}

export interface MatrixStats {
  q1: number;
  q2: number;
  q3: number;
  q4: number;
}

/**
 * Categorize a task into one of 4 quadrants based on priority and due date
 * Q1 (Important & Urgent): priority >= 4 OR due within 1 day
 * Q2 (Important & Not Urgent): priority >= 3 AND due > 1 day
 * Q3 (Not Important & Urgent): priority <= 2 AND due within 2 days
 * Q4 (Not Important & Not Urgent): priority <= 2 AND due > 2 days
 */
export function categorizeTask(task: Task): MatrixQuadrant {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const oneDayFromNow = new Date(today);
  oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);

  const twoDaysFromNow = new Date(today);
  twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const isUrgent = dueDate && dueDate <= twoDaysFromNow;
  const isVeryUrgent = dueDate && dueDate <= oneDayFromNow;
  const isImportant = task.priority >= 3;
  const isVeryImportant = task.priority >= 4;

  // Q1: Important & Urgent (high priority OR due very soon)
  if (isVeryImportant || isVeryUrgent || (isImportant && isUrgent)) {
    return 'q1';
  }

  // Q2: Important & Not Urgent (moderate-high priority but not due soon)
  if (isImportant && !isUrgent) {
    return 'q2';
  }

  // Q3: Not Important & Urgent (low priority but due soon)
  if (!isImportant && isUrgent) {
    return 'q3';
  }

  // Q4: Not Important & Not Urgent (low priority, no immediate deadline)
  return 'q4';
}

/**
 * Group tasks by quadrant
 */
export function groupTasksByQuadrant(tasks: Task[]): QuadrantTasks {
  const result: QuadrantTasks = { q1: [], q2: [], q3: [], q4: [] };

  for (const task of tasks) {
    const quadrant = categorizeTask(task);
    result[quadrant].push(task);
  }

  return result;
}

/**
 * Calculate task counts per quadrant
 */
export function getMatrixStats(tasks: Task[]): MatrixStats {
  const grouped = groupTasksByQuadrant(tasks);
  return {
    q1: grouped.q1.length,
    q2: grouped.q2.length,
    q3: grouped.q3.length,
    q4: grouped.q4.length,
  };
}

/**
 * Update task priority based on target quadrant
 */
export function updatePriorityForQuadrant(task: Task, targetQuadrant: MatrixQuadrant): Partial<Task> {
  const updates: Partial<Task> = {};

  switch (targetQuadrant) {
    case 'q1':
      // Important & Urgent
      updates.priority = Math.max(task.priority, 4);
      if (!task.dueDate) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        updates.dueDate = tomorrow.toISOString();
      }
      break;
    case 'q2':
      // Important & Not Urgent
      updates.priority = Math.max(task.priority, 3);
      if (task.dueDate) {
        const dueDate = new Date(task.dueDate);
        const twoDaysFromNow = new Date();
        twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
        if (dueDate <= twoDaysFromNow) {
          const weekFromNow = new Date();
          weekFromNow.setDate(weekFromNow.getDate() + 7);
          updates.dueDate = weekFromNow.toISOString();
        }
      }
      break;
    case 'q3':
      // Not Important & Urgent
      updates.priority = Math.min(task.priority, 2);
      if (!task.dueDate) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 2);
        updates.dueDate = tomorrow.toISOString();
      }
      break;
    case 'q4':
      // Not Important & Not Urgent
      updates.priority = Math.min(task.priority, 2);
      if (task.dueDate) {
        const dueDate = new Date(task.dueDate);
        const twoDaysFromNow = new Date();
        twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
        if (dueDate <= twoDaysFromNow) {
          updates.dueDate = null;
        }
      }
      break;
  }

  return updates;
}

export const quadrantLabels = {
  q1: { title: 'Do First', description: 'Important & Urgent', color: 'bg-red-50 border-red-200' },
  q2: { title: 'Schedule', description: 'Important & Not Urgent', color: 'bg-blue-50 border-blue-200' },
  q3: { title: 'Delegate', description: 'Not Important & Urgent', color: 'bg-yellow-50 border-yellow-200' },
  q4: { title: 'Eliminate', description: 'Not Important & Not Urgent', color: 'bg-gray-50 border-gray-200' },
};