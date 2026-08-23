import { useState, useEffect } from 'react';
import { FileText, Plus, Pencil, Trash2, Star, StarOff, Save, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';

interface Template {
  id: string;
  name: string;
  description: string | null;
  defaultCategoryId: string | null;
  defaultTitle: string;
  defaultDescription: string | null;
  defaultEstimatedMinutes: number;
  defaultPriority: number;
  defaultStatus: string;
  defaultLabels: string[];
  defaultSubtasks: Array<{ id: string; title: string; done: boolean }>;
  defaultRecurringRule: {
    freq: 'daily' | 'weekly' | 'monthly';
    byDay?: string[];
    interval?: number;
    until?: string;
    defaultTime?: string;
    defaultDurationMinutes?: number;
  } | null;
  isPinned: boolean;
  variables: Array<{
    name: string;
    placeholder: string;
    defaultValue?: string;
    type: 'text' | 'number' | 'date' | 'select';
    options?: string[];
  }>;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

export function TaskTemplatesManager() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<Template[]>('/api/templates'),
      apiFetch<Category[]>('/api/categories'),
    ]).then(([templatesData, categoriesData]) => {
      setTemplates(templatesData);
      setCategories(categoriesData);
    }).catch(() => toast.error('Failed to load templates'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(formData: TemplateFormData) {
    setSaving(true);
    try {
      if (editingTemplate) {
        const updated = await apiFetch<Template>(`/api/templates?id=${editingTemplate.id}`, {
          method: 'PATCH',
          body: JSON.stringify(formData),
        });
        setTemplates(t => t.map(x => x.id === updated.id ? updated : x));
        toast.success('Template updated');
      } else {
        const created = await apiFetch<Template>('/api/templates', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
        setTemplates(t => [...t, created]);
        toast.success('Template created');
      }
      setDialogOpen(false);
      setEditingTemplate(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this template?')) return;
    try {
      await apiFetch(`/api/templates?id=${id}`, { method: 'DELETE' });
      setTemplates(t => t.filter(x => x.id !== id));
      toast.success('Template deleted');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function togglePin(template: Template) {
    try {
      const updated = await apiFetch<Template>(`/api/templates?id=${template.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isPinned: !template.isPinned }),
      });
      setTemplates(t => t.map(x => x.id === updated.id ? updated : x));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="size-4" /> Task Templates
            </CardTitle>
            <CardDescription>Save frequently used task configurations for quick access.</CardDescription>
          </div>
          <Button size="sm" onClick={() => { setEditingTemplate(null); setDialogOpen(true); }}>
            <Plus className="size-3.5 mr-1.5" /> New Template
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-sm text-muted-foreground">Loading...</div>
        ) : templates.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No templates yet. Create one to speed up task entry.
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <div className="space-y-2">
              {templates.map(template => (
                <TemplateItem
                  key={template.id}
                  template={template}
                  onEdit={() => { setEditingTemplate(template); setDialogOpen(true); }}
                  onDelete={() => handleDelete(template.id)}
                  onTogglePin={() => togglePin(template)}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      <TemplateFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        template={editingTemplate}
        categories={categories}
        onSave={handleSave}
        saving={saving}
      />
    </Card>
  );
}

interface TemplateItemProps {
  template: Template;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}

function TemplateItem({ template, onEdit, onDelete, onTogglePin }: TemplateItemProps) {
  return (
    <div className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
      <button
        onClick={onTogglePin}
        className="mt-1 text-muted-foreground hover:text-yellow-500 transition-colors"
        title={template.isPinned ? 'Unpin' : 'Pin'}
      >
        {template.isPinned ? <Star className="size-3.5 fill-yellow-500 text-yellow-500" /> : <StarOff className="size-3.5" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{template.name}</span>
          {template.isPinned && <Badge variant="secondary" className="text-xs">Pinned</Badge>}
        </div>
        {template.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
        )}
        <div className="flex flex-wrap gap-1 mt-1.5">
          <Badge variant="outline" className="text-xs gap-1">
            <Clock className="size-2.5" />
            {template.defaultEstimatedMinutes}m
          </Badge>
          <Badge variant="outline" className="text-xs">
            Priority {template.defaultPriority}
          </Badge>
          {template.defaultLabels.slice(0, 2).map(label => (
            <Badge key={label} variant="secondary" className="text-xs">
              {label}
            </Badge>
          ))}
        </div>
        <div className="text-xs text-muted-foreground mt-1 truncate">
          Default: {template.defaultTitle}
        </div>
      </div>

      <div className="flex gap-1">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onEdit}>
          <Pencil className="size-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={onDelete}>
          <Trash2 className="size-3" />
        </Button>
      </div>
    </div>
  );
}

interface TemplateFormData {
  name: string;
  description: string | null;
  defaultCategoryId: string | null;
  defaultTitle: string;
  defaultDescription: string | null;
  defaultEstimatedMinutes: number;
  defaultPriority: number;
  defaultStatus: string;
  defaultLabels: string[];
  defaultSubtasks: Array<{ id: string; title: string; done: boolean }>;
  defaultRecurringRule: Template['defaultRecurringRule'];
  isPinned: boolean;
}

interface TemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template | null;
  categories: Category[];
  onSave: (data: TemplateFormData) => void;
  saving: boolean;
}

function TemplateFormDialog({ open, onOpenChange, template, categories, onSave, saving }: TemplateFormDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [defaultTitle, setDefaultTitle] = useState('');
  const [defaultDescription, setDefaultDescription] = useState('');
  const [defaultEstimatedMinutes, setDefaultEstimatedMinutes] = useState(60);
  const [defaultPriority, setDefaultPriority] = useState(3);
  const [defaultStatus, setDefaultStatus] = useState('todo');
  const [defaultLabels, setDefaultLabels] = useState('');
  const [defaultCategoryId, setDefaultCategoryId] = useState<string>('');

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || '');
      setDefaultTitle(template.defaultTitle);
      setDefaultDescription(template.defaultDescription || '');
      setDefaultEstimatedMinutes(template.defaultEstimatedMinutes);
      setDefaultPriority(template.defaultPriority);
      setDefaultStatus(template.defaultStatus);
      setDefaultLabels(template.defaultLabels.join(', '));
      setDefaultCategoryId(template.defaultCategoryId || '');
    } else {
      setName('');
      setDescription('');
      setDefaultTitle('');
      setDefaultDescription('');
      setDefaultEstimatedMinutes(60);
      setDefaultPriority(3);
      setDefaultStatus('todo');
      setDefaultLabels('');
      setDefaultCategoryId('');
    }
  }, [template, open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const labelsArray = defaultLabels.split(',').map(l => l.trim()).filter(Boolean);
    onSave({
      name,
      description: description || null,
      defaultCategoryId: defaultCategoryId || null,
      defaultTitle,
      defaultDescription: defaultDescription || null,
      defaultEstimatedMinutes,
      defaultPriority,
      defaultStatus,
      defaultLabels: labelsArray,
      defaultSubtasks: [],
      defaultRecurringRule: null,
      isPinned: template?.isPinned || false,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? 'Edit Template' : 'New Template'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="template-name">Template Name *</Label>
            <Input
              id="template-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Daily Standup"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="template-desc">Description</Label>
            <Input
              id="template-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What this template is for"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="default-title">Default Task Title *</Label>
            <Input
              id="default-title"
              value={defaultTitle}
              onChange={e => setDefaultTitle(e.target.value)}
              placeholder="e.g., Daily standup meeting"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="default-desc">Default Description</Label>
            <Textarea
              id="default-desc"
              value={defaultDescription}
              onChange={e => setDefaultDescription(e.target.value)}
              placeholder="Default task description"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="default-minutes">Duration (min)</Label>
              <Input
                id="default-minutes"
                type="number"
                min={1}
                value={defaultEstimatedMinutes}
                onChange={e => setDefaultEstimatedMinutes(parseInt(e.target.value) || 60)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="default-priority">Priority</Label>
              <Input
                id="default-priority"
                type="number"
                min={1}
                max={5}
                value={defaultPriority}
                onChange={e => setDefaultPriority(parseInt(e.target.value) || 3)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="default-category">Category</Label>
            <select
              id="default-category"
              value={defaultCategoryId}
              onChange={e => setDefaultCategoryId(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background"
            >
              <option value="">None</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="default-labels">Labels (comma-separated)</Label>
            <Input
              id="default-labels"
              value={defaultLabels}
              onChange={e => setDefaultLabels(e.target.value)}
              placeholder="e.g., recurring, work, important"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim() || !defaultTitle.trim()}>
              {saving ? <Save className="size-3.5 mr-1.5 animate-spin" /> : <Save className="size-3.5 mr-1.5" />}
              {template ? 'Update' : 'Create'} Template
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
