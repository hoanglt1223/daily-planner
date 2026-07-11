import { useState, useEffect } from 'react';
import { Copy, Edit, Trash2, Plus, Sparkles, Clock, Tag, List } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

type Template = {
  id: string;
  name: string;
  description: string | null;
  defaultTitle: string;
  defaultDescription: string | null;
  defaultEstimatedMinutes: number;
  defaultPriority: number;
  defaultStatus: string;
  defaultLabels: string[];
  defaultSubtasks: Array<{ id: string; title: string; done: boolean }>;
};

export function TaskTemplates({ onSelectTemplate }: { onSelectTemplate: (template: Template) => void }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    defaultTitle: '',
    defaultDescription: '',
    defaultEstimatedMinutes: 60,
    defaultPriority: 3,
    defaultLabels: '',
    defaultSubtasks: '',
  });

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Template[]>('/api/tasks?action=templates');
      setTemplates(data);
    } catch (e) {
      console.error('Failed to load templates:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTemplates(); }, []);

  const handleCreate = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      description: '',
      defaultTitle: '',
      defaultDescription: '',
      defaultEstimatedMinutes: 60,
      defaultPriority: 3,
      defaultLabels: '',
      defaultSubtasks: '',
    });
    setDialogOpen(true);
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description ?? '',
      defaultTitle: template.defaultTitle,
      defaultDescription: template.defaultDescription ?? '',
      defaultEstimatedMinutes: template.defaultEstimatedMinutes,
      defaultPriority: template.defaultPriority,
      defaultLabels: template.defaultLabels.join(', '),
      defaultSubtasks: template.defaultSubtasks.map(s => s.title).join('\n'),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        name: formData.name,
        description: formData.description || null,
        defaultTitle: formData.defaultTitle,
        defaultDescription: formData.defaultDescription || null,
        defaultEstimatedMinutes: formData.defaultEstimatedMinutes,
        defaultPriority: formData.defaultPriority,
        defaultLabels: formData.defaultLabels.split(',').map(l => l.trim()).filter(Boolean),
        defaultSubtasks: formData.defaultSubtasks.split('\n').map(title => ({
          id: crypto.randomUUID(),
          title: title.trim(),
          done: false,
        })).filter(s => s.title),
      };

      if (editingTemplate) {
        await apiFetch(`/api/tasks?action=templates&id=${editingTemplate.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/tasks?action=templates', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setDialogOpen(false);
      loadTemplates();
    } catch (e) {
      console.error('Failed to save template:', e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      await apiFetch(`/api/tasks?action=templates&id=${id}`, { method: 'DELETE' });
      loadTemplates();
    } catch (e) {
      console.error('Failed to delete template:', e);
    }
  };

  const handleUseTemplate = (template: Template) => {
    onSelectTemplate(template);
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading templates...</div>;
  }

  if (templates.length === 0) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <Sparkles className="size-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium mb-1">No task templates yet</p>
          <p className="text-xs text-muted-foreground mb-4 max-w-xs">
            Create templates for recurring tasks like daily standups, weekly reviews, or monthly reports
          </p>
          <Button size="sm" onClick={handleCreate}>
            <Plus className="size-4 mr-1" />
            Create Template
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Task Templates</h3>
        <Button size="sm" variant="ghost" onClick={handleCreate}>
          <Plus className="size-4" />
        </Button>
      </div>

      <div className="grid gap-2">
        {templates.map(template => (
          <Card key={template.id} className="hover:bg-muted/50 transition-colors">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  {template.description && (
                    <CardDescription className="text-xs mt-1">{template.description}</CardDescription>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleUseTemplate(template)}>
                    <Copy className="size-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(template)}>
                    <Edit className="size-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(template.id)}>
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {template.defaultEstimatedMinutes}m
                </div>
                <Badge variant="outline" className="text-xs">Priority: {template.defaultPriority}</Badge>
                {template.defaultLabels.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Tag className="size-3" />
                    {template.defaultLabels.slice(0, 2).map(l => (
                      <Badge key={l} variant="secondary" className="text-xs">{l}</Badge>
                    ))}
                    {template.defaultLabels.length > 2 && (
                      <Badge variant="secondary" className="text-xs">+{template.defaultLabels.length - 2}</Badge>
                    )}
                  </div>
                )}
                {template.defaultSubtasks.length > 0 && (
                  <div className="flex items-center gap-1">
                    <List className="size-3" />
                    {template.defaultSubtasks.length} subtasks
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create Template'}</DialogTitle>
            <DialogDescription>
              {editingTemplate ? 'Update template settings' : 'Create a reusable task template'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Daily Standup, Weekly Review"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="What is this template for?"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="defaultTitle">Default Task Title *</Label>
              <Input
                id="defaultTitle"
                value={formData.defaultTitle}
                onChange={e => setFormData({ ...formData, defaultTitle: e.target.value })}
                placeholder="e.g., Daily Team Standup"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="defaultDescription">Default Task Description</Label>
              <Textarea
                id="defaultDescription"
                value={formData.defaultDescription}
                onChange={e => setFormData({ ...formData, defaultDescription: e.target.value })}
                placeholder="Default task details..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="defaultEstimatedMinutes">Est. Minutes</Label>
                <Input
                  id="defaultEstimatedMinutes"
                  type="number"
                  value={formData.defaultEstimatedMinutes}
                  onChange={e => setFormData({ ...formData, defaultEstimatedMinutes: parseInt(e.target.value) || 60 })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="defaultPriority">Priority (1-5)</Label>
                <Input
                  id="defaultPriority"
                  type="number"
                  min="1"
                  max="5"
                  value={formData.defaultPriority}
                  onChange={e => setFormData({ ...formData, defaultPriority: parseInt(e.target.value) || 3 })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="defaultLabels">Default Labels (comma-separated)</Label>
              <Input
                id="defaultLabels"
                value={formData.defaultLabels}
                onChange={e => setFormData({ ...formData, defaultLabels: e.target.value })}
                placeholder="work, urgent, review"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="defaultSubtasks">Default Subtasks (one per line)</Label>
              <Textarea
                id="defaultSubtasks"
                value={formData.defaultSubtasks}
                onChange={e => setFormData({ ...formData, defaultSubtasks: e.target.value })}
                placeholder="Review yesterday's progress&#10;Plan today's work&#10;Identify blockers"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>
              {editingTemplate ? 'Update' : 'Create'} Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
