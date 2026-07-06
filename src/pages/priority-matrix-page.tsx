import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PriorityMatrix } from '@/components/priority-matrix';
import type { Task } from '@/lib/priority-utils';

export function PriorityMatrixPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/tasks', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleUpdateTask = async (id: string, updates: Partial<Task>) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        // Refresh tasks to get updated state
        fetchTasks();
      }
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Priority Matrix</h1>
              <p className="text-sm text-gray-600 mt-1">
                Eisenhower Matrix - Drag tasks between quadrants to update priority
              </p>
            </div>
          </div>
          <Button variant="outline" size="icon" onClick={fetchTasks}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {tasks.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <p className="text-gray-600 mb-4">No tasks yet. Create some tasks to see them in the matrix.</p>
            <Button onClick={() => navigate('/planner')}>Go to Planner</Button>
          </div>
        ) : (
          <PriorityMatrix tasks={tasks} onUpdateTask={handleUpdateTask} />
        )}
      </div>
    </div>
  );
}