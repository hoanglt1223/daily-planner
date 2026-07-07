import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit3, Calendar } from 'lucide-react';
import { apiFetch, createHabit, deleteHabit, toggleHabitEntry, updateHabit } from '@/lib/api-client';
import { HabitGrid } from '@/components/habit-grid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface HabitEntry {
  id: string;
  entryDate: string;
  completed: boolean;
  note: string | null;
}

interface Habit {
  id: string;
  name: string;
  description: string | null;
  frequency: 'daily' | 'weekly';
  targetDays: number[];
  color: string;
  icon: string;
  targetPerPeriod: number;
  entries: HabitEntry[];
  createdAt: string;
  updatedAt: string;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const COLOR_OPTIONS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4'];
const ICON_OPTIONS = ['✓', '⭐', '💪', '📚', '🏃', '🧘', '💧', '🎯'];

export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    frequency: 'daily' as 'daily' | 'weekly',
    targetDays: [] as number[],
    color: '#10b981',
    icon: '✓',
    targetPerPeriod: 1,
  });

  useEffect(() => {
    loadHabits();
  }, []);

  const loadHabits = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<Habit[]>('/api/habits');
      setHabits(data);
    } catch (error) {
      toast.error('Failed to load habits');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (habitId: string, date: Date, completed: boolean) => {
    try {
      const entryDate = date.toISOString();
      await toggleHabitEntry(habitId, entryDate, completed);
      await loadHabits();
    } catch (error) {
      toast.error('Failed to update habit entry');
    }
  };

  const handleSave = async () => {
    try {
      if (!formData.name.trim()) {
        toast.error('Habit name is required');
        return;
      }

      if (editingHabit) {
        await updateHabit(editingHabit.id, formData);
        toast.success('Habit updated');
      } else {
        await createHabit(formData);
        toast.success('Habit created');
      }

      setDialogOpen(false);
      setEditingHabit(null);
      setFormData({
        name: '',
        description: '',
        frequency: 'daily',
        targetDays: [],
        color: '#10b981',
        icon: '✓',
        targetPerPeriod: 1,
      });
      await loadHabits();
    } catch (error) {
      toast.error('Failed to save habit');
    }
  };

  const handleEdit = (habit: Habit) => {
    setEditingHabit(habit);
    setFormData({
      name: habit.name,
      description: habit.description || '',
      frequency: habit.frequency,
      targetDays: habit.targetDays,
      color: habit.color,
      icon: habit.icon,
      targetPerPeriod: habit.targetPerPeriod,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (habitId: string) => {
    if (!confirm('Are you sure you want to delete this habit? All entries will be lost.')) {
      return;
    }

    try {
      await deleteHabit(habitId);
      toast.success('Habit deleted');
      await loadHabits();
    } catch (error) {
      toast.error('Failed to delete habit');
    }
  };

  const toggleDay = (day: number) => {
    setFormData(prev => ({
      ...prev,
      targetDays: prev.targetDays.includes(day)
        ? prev.targetDays.filter(d => d !== day)
        : [...prev.targetDays, day],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-muted-foreground">Loading habits...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Habit Tracker</h1>
          <p className="text-muted-foreground">Build consistency and track your daily habits</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Habit
        </Button>
      </div>

      {habits.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No habits yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first habit to start tracking your consistency
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Habit
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {habits.map(habit => {
            const totalEntries = habit.entries.length;
            const completedEntries = habit.entries.filter(e => e.completed).length;
            const completionRate = totalEntries > 0 ? Math.round((completedEntries / totalEntries) * 100) : 0;

            return (
              <Card key={habit.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <span style={{ color: habit.color }}>{habit.icon}</span>
                        {habit.name}
                      </CardTitle>
                      {habit.description && (
                        <CardDescription className="mt-1">{habit.description}</CardDescription>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline">{habit.frequency}</Badge>
                        <Badge variant="secondary">{completionRate}% complete</Badge>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(habit)}>
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(habit.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <HabitGrid
                    habit={habit}
                    onToggle={(date, completed) => handleToggle(habit.id, date, completed)}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingHabit ? 'Edit Habit' : 'Create New Habit'}</DialogTitle>
            <DialogDescription>
              {editingHabit ? 'Update habit settings' : 'Define a new habit to track'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Morning exercise"
              />
            </div>

            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Why is this habit important?"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="frequency">Frequency</Label>
                <Select
                  value={formData.frequency}
                  onValueChange={(value: 'daily' | 'weekly') =>
                    setFormData(prev => ({ ...prev, frequency: value }))
                  }
                >
                  <SelectTrigger id="frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="targetPerPeriod">Target per period</Label>
                <Input
                  id="targetPerPeriod"
                  type="number"
                  min={1}
                  value={formData.targetPerPeriod}
                  onChange={e =>
                    setFormData(prev => ({ ...prev, targetPerPeriod: parseInt(e.target.value) || 1 }))
                  }
                />
              </div>
            </div>

            {formData.frequency === 'weekly' && (
              <div>
                <Label>Target Days</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {WEEKDAYS.map((day, index) => (
                    <Button
                      key={day}
                      variant={formData.targetDays.includes(index) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleDay(index)}
                    >
                      {day.slice(0, 3)}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="color">Color</Label>
              <div className="flex gap-2 mt-2">
                {COLOR_OPTIONS.map(color => (
                  <button
                    key={color}
                    onClick={() => setFormData(prev => ({ ...prev, color }))}
                    className={`w-8 h-8 rounded-full border-2 ${
                      formData.color === color ? 'border-primary' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="icon">Icon</Label>
              <div className="flex gap-2 mt-2">
                {ICON_OPTIONS.map(icon => (
                  <button
                    key={icon}
                    onClick={() => setFormData(prev => ({ ...prev, icon }))}
                    className={`w-10 h-10 rounded-lg border-2 text-lg ${
                      formData.icon === icon ? 'border-primary bg-primary/10' : 'border-transparent'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingHabit ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
