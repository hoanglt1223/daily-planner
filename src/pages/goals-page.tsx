import { useEffect, useState } from 'react';
import { Target, Plus } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { GoalCard } from '@/components/goals/goal-card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface Goal {
  id: string;
  title: string;
  description: string | null;
  period: string;
  status: string;
  targetValue: number;
  currentValue: number;
  unit: string | null;
  color: string;
  category: string | null;
  startDate: string;
  endDate: string;
  linkedTaskIds: string[];
  linkedHabitIds: string[];
}

const PERIODS = ['weekly', 'monthly', 'quarterly', 'yearly'] as const;
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
const CATEGORIES = ['Health', 'Career', 'Finance', 'Learning', 'Relationships', 'Personal Growth', 'Other'];

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    period: 'quarterly' as const,
    targetValue: 1,
    unit: '',
    color: '#3b82f6',
    category: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = () => {
    setLoading(true);
    apiFetch<Goal[]>('/api/goals')
      .then(setGoals)
      .catch(() => toast.error('Failed to load goals'))
      .finally(() => setLoading(false));
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!formData.targetValue || formData.targetValue < 1) {
      toast.error('Target value must be at least 1');
      return;
    }
    if (!formData.startDate || !formData.endDate) {
      toast.error('Start and end dates are required');
      return;
    }

    const payload = {
      title: formData.title,
      description: formData.description || null,
      period: formData.period,
      targetValue: formData.targetValue,
      currentValue: editingGoal?.currentValue ?? 0,
      unit: formData.unit || null,
      color: formData.color,
      category: formData.category || null,
      startDate: formData.startDate,
      endDate: formData.endDate,
      linkedTaskIds: editingGoal?.linkedTaskIds ?? [],
      linkedHabitIds: editingGoal?.linkedHabitIds ?? [],
    };

    const promise = editingGoal
      ? apiFetch(`/api/goals/${editingGoal.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
      : apiFetch('/api/goals', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

    promise
      .then(() => {
        toast.success(editingGoal ? 'Goal updated' : 'Goal created');
        setDialogOpen(false);
        resetForm();
        loadGoals();
      })
      .catch(() => toast.error('Failed to save goal'));
  };

  const handleEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setFormData({
      title: goal.title,
      description: goal.description || '',
      period: goal.period as any,
      targetValue: goal.targetValue,
      unit: goal.unit || '',
      color: goal.color,
      category: goal.category || '',
      startDate: goal.startDate.split('T')[0],
      endDate: goal.endDate.split('T')[0],
    });
    setDialogOpen(true);
  };

  const handleDelete = (goalId: string) => {
    if (!confirm('Delete this goal?')) return;

    apiFetch(`/api/goals/${goalId}`, { method: 'DELETE' })
      .then(() => {
        toast.success('Goal deleted');
        loadGoals();
      })
      .catch(() => toast.error('Failed to delete goal'));
  };

  const handleProgressUpdate = (goalId: string, newValue: number) => {
    apiFetch(`/api/goals/${goalId}`, {
      method: 'PATCH',
      body: JSON.stringify({ currentValue: newValue }),
    })
      .then(() => loadGoals())
      .catch(() => toast.error('Failed to update progress'));
  };

  const resetForm = () => {
    setEditingGoal(null);
    setFormData({
      title: '',
      description: '',
      period: 'quarterly',
      targetValue: 1,
      unit: '',
      color: '#3b82f6',
      category: '',
      startDate: '',
      endDate: '',
    });
  };

  const activeGoals = goals.filter(g => g.status === 'active');
  const completedGoals = goals.filter(g => g.status === 'completed');
  const pausedGoals = goals.filter(g => g.status === 'paused');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Goals & OKRs</h1>
          <p className="text-sm text-muted-foreground">Track your long-term objectives and key results</p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" />
          New Goal
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading goals...</div>
      ) : goals.length === 0 ? (
        <div className="text-center py-12">
          <Target className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No goals yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Create your first goal to start tracking your long-term objectives</p>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Goal
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {activeGoals.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Active ({activeGoals.length})</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeGoals.map(goal => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onProgressUpdate={handleProgressUpdate}
                  />
                ))}
              </div>
            </div>
          )}

          {completedGoals.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Completed ({completedGoals.length})</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {completedGoals.map(goal => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onProgressUpdate={handleProgressUpdate}
                  />
                ))}
              </div>
            </div>
          )}

          {pausedGoals.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Paused ({pausedGoals.length})</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pausedGoals.map(goal => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onProgressUpdate={handleProgressUpdate}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingGoal ? 'Edit Goal' : 'Create New Goal'}</DialogTitle>
            <DialogDescription>
              Set a long-term objective with measurable targets
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Read 12 books this year"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Additional context about your goal..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="period">Period</Label>
                <Select value={formData.period} onValueChange={(v: any) => setFormData({ ...formData, period: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIODS.map(p => (
                      <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetValue">Target Value *</Label>
                <Input
                  id="targetValue"
                  type="number"
                  min="1"
                  value={formData.targetValue}
                  onChange={e => setFormData({ ...formData, targetValue: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">Unit (optional)</Label>
              <Input
                id="unit"
                value={formData.unit}
                onChange={e => setFormData({ ...formData, unit: e.target.value })}
                placeholder="e.g., books, km, hours, $"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 ${formData.color === color ? 'border-foreground' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData({ ...formData, color })}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={formData.category} onValueChange={v => setFormData({ ...formData, category: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>
              {editingGoal ? 'Update Goal' : 'Create Goal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}