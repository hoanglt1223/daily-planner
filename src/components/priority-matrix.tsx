import { useState } from 'react';
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { categorizeTask, groupTasksByQuadrant, updatePriorityForQuadrant, quadrantLabels, type MatrixQuadrant, type QuadrantTasks, type Task } from '@/lib/priority-utils';

interface SortableTaskProps {
  task: Task;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
}

function SortableTask({ task }: SortableTaskProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 cursor-move hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm text-gray-900 truncate">{task.title}</h4>
          {task.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            {task.dueDate && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(new Date(task.dueDate), 'MMM d')}
              </div>
            )}
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {task.estimatedMinutes}m
            </div>
            <div className="flex items-center gap-1">
              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                task.priority >= 4 ? 'bg-red-100 text-red-700' :
                task.priority >= 3 ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                P{task.priority}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface QuadrantProps {
  quadrant: MatrixQuadrant;
  tasks: Task[];
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
}

function Quadrant({ quadrant, tasks, onUpdateTask }: QuadrantProps) {
  const { title, description, color } = quadrantLabels[quadrant];

  return (
    <div className={`${color} border-2 rounded-xl p-4 flex flex-col h-full`}>
      <div className="mb-3">
        <h3 className="font-semibold text-gray-900 flex items-center justify-between">
          {title}
          <span className="text-xs bg-white px-2 py-1 rounded-full font-medium">{tasks.length}</span>
        </h3>
        <p className="text-xs text-gray-600 mt-1">{description}</p>
      </div>
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-2 overflow-y-auto max-h-96">
          {tasks.map(task => (
            <SortableTask key={task.id} task={task} onUpdateTask={onUpdateTask} />
          ))}
          {tasks.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">
              No tasks in this quadrant
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

interface PriorityMatrixProps {
  tasks: Task[];
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
}

export function PriorityMatrix({ tasks, onUpdateTask }: PriorityMatrixProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [groupedTasks, setGroupedTasks] = useState<QuadrantTasks>(groupTasksByQuadrant(tasks));

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const targetQuadrant = over.id as MatrixQuadrant;

    if (!targetQuadrant || !['q1', 'q2', 'q3', 'q4'].includes(targetQuadrant)) return;

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const currentQuadrant = categorizeTask(task);
    if (currentQuadrant === targetQuadrant) return;

    const updates = updatePriorityForQuadrant(task, targetQuadrant);
    onUpdateTask(taskId, updates);

    // Optimistically update local state
    const updatedTask = { ...task, ...updates };
    const newGroupedTasks = { ...groupedTasks };
    newGroupedTasks[currentQuadrant] = newGroupedTasks[currentQuadrant].filter(t => t.id !== taskId);
    newGroupedTasks[targetQuadrant] = [...newGroupedTasks[targetQuadrant], updatedTask];
    setGroupedTasks(newGroupedTasks);
  };

  return (
    <div className="w-full">
      <DndContext
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DndContext
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <Quadrant quadrant="q1" tasks={groupedTasks.q1} onUpdateTask={onUpdateTask} />
            <Quadrant quadrant="q2" tasks={groupedTasks.q2} onUpdateTask={onUpdateTask} />
            <Quadrant quadrant="q3" tasks={groupedTasks.q3} onUpdateTask={onUpdateTask} />
            <Quadrant quadrant="q4" tasks={groupedTasks.q4} onUpdateTask={onUpdateTask} />
          </DndContext>
        </div>
        <DragOverlay>
          {activeTask && (
            <div className="rotate-3 opacity-90">
              <SortableTask task={activeTask} onUpdateTask={() => {}} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}