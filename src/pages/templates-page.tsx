import { useState, useEffect } from 'react';
import { Copy, Edit, Trash2, Plus, Sparkles, Clock, Tag, List, Search, Zap, FolderOpen, TrendingUp } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

type TemplateVariable = {
  name: string;
  placeholder: string;
  defaultValue?: string;
  type: 'text' | 'number' | 'date' | 'select';
  options?: string[];
};

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
  variables: TemplateVariable[];
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
};

const BUILT_IN_TEMPLATES: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Weekly Team Sync',
    description: 'Recurring weekly team meeting to review progress, blockers, and plans',
    defaultTitle: 'Team Sync - Week of {{week}}',
    defaultDescription: 'Agenda:\n- Review last week\'s progress\n- Discuss blockers\n- Plan upcoming work\n- Share updates',
    defaultEstimatedMinutes: 60,
    defaultPriority: 2,
    defaultStatus: 'todo',
    defaultLabels: ['recurring', 'meeting', 'team'],
    defaultSubtasks: [
      { id: '1', title: 'Prepare agenda', done: false },
      { id: '2', title: 'Review metrics', done: false },
      { id: '3', title: 'Send summary', done: false },
    ],
    variables: [
      { name: 'week', placeholder: 'Week of Jan 15', type: 'text' },
    ],
    isPinned: true,
  },
  {
    name: 'Code Review',
    description: 'Review pull request for code quality, logic, and best practices',
    defaultTitle: 'Review PR: {{pr_title}}',
    defaultDescription: 'Review PR for {{feature}}\n\nChecklist:\n- Code quality\n- Test coverage\n- Documentation\n- Performance',
    defaultEstimatedMinutes: 30,
    defaultPriority: 2,
    defaultStatus: 'todo',
    defaultLabels: ['code-review', 'development'],
    defaultSubtasks: [
      { id: '1', title: 'Read requirements', done: false },
      { id: '2', title: 'Check implementation', done: false },
      { id: '3', title: 'Verify tests', done: false },
    ],
    variables: [
      { name: 'pr_title', placeholder: 'Feature auth flow', type: 'text' },
      { name: 'feature', placeholder: 'Authentication', type: 'text' },
    ],
    isPinned: false,
  },
  {
    name: 'Daily Planning',
    description: 'Plan your daily priorities and schedule time blocks',
    defaultTitle: 'Daily Planning - {{date}}',
    defaultDescription: 'Review priorities and schedule time blocks for the day',
    defaultEstimatedMinutes: 15,
    defaultPriority: 1,
    defaultStatus: 'todo',
    defaultLabels: ['planning', 'daily'],
    defaultSubtasks: [
      { id: '1', title: 'Review yesterday\'s completed tasks', done: false },
      { id: '2', title: 'Identify top 3 priorities', done: false },
      { id: '3', title: 'Schedule time blocks', done: false },
    ],
    variables: [
      { name: 'date', placeholder: 'Today', defaultValue: 'Today', type: 'text' },
    ],
    isPinned: true,
  },
  {
    name: 'Bug Investigation',
    description: 'Investigate and fix reported bugs',
    defaultTitle: 'Fix bug: {{bug_description}}',
    defaultDescription: 'Investigate and fix: {{details}}\n\nSteps:\n1. Reproduce the issue\n2. Identify root cause\n3. Implement fix\n4. Add tests\n5. Document',
    defaultEstimatedMinutes: 60,
    defaultPriority: 1,
    defaultStatus: 'todo',
    defaultLabels: ['bug', 'development'],
    defaultSubtasks: [
      { id: '1', title: 'Reroduce issue', done: false },
      { id: '2', title: 'Find root cause', done: false },
      { id: '3', title: 'Implement fix', done: false },
      { id: '4', title: 'Add tests', done: false },
    ],
    variables: [
      { name: 'bug_description', placeholder: 'Login not working', type: 'text' },
      { name: 'details', placeholder: 'Error 500 on /login', type: 'text' },
    ],
    isPinned: false,
  },
];

export function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [variableDialogOpen, setVariableDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [selectedTemplateForVariables, setSelectedTemplateForVariables] = useState<Template | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [showBuiltIn, setShowBuiltIn] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    defaultTitle: '',
    defaultDescription: '',
    defaultEstimatedMinutes: 60,
    defaultPriority: 3,
    defaultLabels: '',
    defaultSubtasks: '',
    variables: [] as TemplateVariable[],
    isPinned: false,
  });

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Template[]>('/api/tasks?action=templates');
      setTemplates(data);
    } catch (e) {
      console.error('Failed to load templates:', e);
      toast.error('Failed to load templates');
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
      variables: [],
      isPinned: false,
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
      variables: template.variables || [],
      isPinned: template.isPinned,
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
        variables: formData.variables,
        isPinned: formData.isPinned,
      };

      if (editingTemplate) {
        await apiFetch(`/api/tasks?action=templates&id=${editingTemplate.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success('Template updated successfully');
      } else {
        await apiFetch('/api/tasks?action=templates', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Template created successfully');
      }

      setDialogOpen(false);
      loadTemplates();
    } catch (e) {
      console.error('Failed to save template:', e);
      toast.error('Failed to save template');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      await apiFetch(`/api/tasks?action=templates&id=${id}`, { method: 'DELETE' });
      toast.success('Template deleted');
      loadTemplates();
    } catch (e) {
      console.error('Failed to delete template:', e);
      toast.error('Failed to delete template');
    }
  };

  const handleUseTemplate = (template: Template) => {
    if (template.variables && template.variables.length > 0) {
      setSelectedTemplateForVariables(template);
      const initialValues: Record<string, string> = {};
      template.variables.forEach(v => {
        initialValues[v.name] = v.defaultValue || '';
      });
      setVariableValues(initialValues);
      setVariableDialogOpen(true);
    } else {
      // Apply template directly (no variables)
      applyTemplate(template, {});
    }
  };

  const applyTemplate = async (template: Template, values: Record<string, string>) => {
    try {
      // Substitute variables in title, description, and subtasks
      const substitute = (text: string) => {
        let result = text;
        for (const [key, value] of Object.entries(values)) {
          const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
          result = result.replace(regex, value || '');
        }
        return result;
      };

      const taskPayload = {
        title: substitute(template.defaultTitle),
        description: template.defaultDescription ? substitute(template.defaultDescription) : null,
        estimatedMinutes: template.defaultEstimatedMinutes,
        priority: template.defaultPriority,
        status: template.defaultStatus,
        labels: template.defaultLabels,
        subtasks: template.defaultSubtasks.map(st => ({
          id: st.id,
          title: substitute(st.title),
          done: false,
        })),
      };

      await apiFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(taskPayload),
      });

      toast.success(`Task created from template "${template.name}"`);
      setVariableDialogOpen(false);
      setSelectedTemplateForVariables(null);
      setVariableValues({});
    } catch (e) {
      console.error('Failed to apply template:', e);
      toast.error('Failed to apply template');
    }
  };

  const handleVariableSubmit = () => {
    if (selectedTemplateForVariables) {
      applyTemplate(selectedTemplateForVariables, variableValues);
    }
  };

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.defaultTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const sortedTemplates = [...filteredTemplates].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return 0;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Task Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create reusable task templates with variables for quick task creation
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="size-4 mr-2" />
          New Template
        </Button>
      </div>

      <Card className="border-dashed border-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Sparkles className="size-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-sm">What are templates?</h3>
              <p className="text-xs text-muted-foreground mt-1 mb-2">
                Templates help you quickly create recurring tasks. Use variables like {'{{week}}'} to customize each instance.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setShowBuiltIn(!showBuiltIn)}
              >
                {showBuiltIn ? 'Hide' : 'Show'} Built-in Templates
                {showBuiltIn ? <FolderOpen className="size-3 ml-1" /> : <TrendingUp className="size-3 ml-1" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {showBuiltIn && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Zap className="size-4 text-yellow-500" />
            Built-in Templates
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {BUILT_IN_TEMPLATES.map((template, index) => (
              <Card key={index} className="border-yellow-200 dark:border-yellow-900 bg-yellow-50/50 dark:bg-yellow-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    {template.name}
                    <Badge variant="secondary" className="text-xs">Built-in</Badge>
                  </CardTitle>
                  {template.description && (
                    <CardDescription className="text-xs mt-1">{template.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-3">
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
                      </div>
                    )}
                  </div>
                  <div className="text-xs font-mono bg-muted/50 p-2 rounded">
                    {template.defaultTitle}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon" onClick={loadTemplates} title="Refresh">
          <TrendingUp className="size-4" />
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Sparkles className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No task templates yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              Create your first template for recurring tasks like daily standups, weekly reviews, or monthly reports
            </p>
            <Button onClick={handleCreate}>
              <Plus className="size-4 mr-2" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      ) : sortedTemplates.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No templates found</h3>
            <p className="text-sm text-muted-foreground">
              Try adjusting your search query
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {sortedTemplates.map(template => (
            <Card key={template.id} className={`${template.isPinned ? 'border-primary' : ''} hover:bg-muted/50 transition-colors`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      {template.isPinned && <Badge variant="default" className="text-xs">Pinned</Badge>}
                    </div>
                    {template.description && (
                      <CardDescription className="text-xs mt-1">{template.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleUseTemplate(template)} title="Use template">
                      <Copy className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(template)} title="Edit template">
                      <Edit className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(template.id)} title="Delete template">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="text-sm font-medium p-2 bg-muted/50 rounded">
                    {template.defaultTitle}
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {template.defaultEstimatedMinutes}m
                    </div>
                    <Badge variant="outline" className="text-xs">Priority: {template.defaultPriority}</Badge>
                    {template.defaultLabels.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Tag className="size-3" />
                        {template.defaultLabels.slice(0, 3).map(l => (
                          <Badge key={l} variant="secondary" className="text-xs">{l}</Badge>
                        ))}
                        {template.defaultLabels.length > 3 && (
                          <Badge variant="secondary" className="text-xs">+{template.defaultLabels.length - 3}</Badge>
                        )}
                      </div>
                    )}
                    {template.defaultSubtasks.length > 0 && (
                      <div className="flex items-center gap-1">
                        <List className="size-3" />
                        {template.defaultSubtasks.length} subtasks
                      </div>
                    )}
                    {template.variables && template.variables.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Zap className="size-3" />
                        {template.variables.length} variables
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create Template'}</DialogTitle>
            <DialogDescription>
              {editingTemplate ? 'Update template settings and variables' : 'Create a reusable task template with optional variables'}
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
                placeholder="e.g., Daily Team Standup - {{date}}"
              />
              <p className="text-xs text-muted-foreground">
                Use {'{{variable_name}}'} for dynamic content
              </p>
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

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPinned"
                checked={formData.isPinned}
                onChange={e => setFormData({ ...formData, isPinned: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="isPinned" className="cursor-pointer">Pin template (show first in list)</Label>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Variables</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setFormData({
                    ...formData,
                    variables: [...formData.variables, { name: '', placeholder: '', type: 'text' as const }],
                  })}
                >
                  <Plus className="size-3 mr-1" />
                  Add Variable
                </Button>
              </div>
              <div className="text-xs text-muted-foreground mb-2">
                Use {'{{variable_name}}'} in title, description, or subtasks
              </div>
              {formData.variables.length === 0 ? (
                <div className="text-xs text-muted-foreground italic py-2 bg-muted/30 rounded">
                  No variables - this template will be used as-is
                </div>
              ) : (
                <div className="space-y-2">
                  {formData.variables.map((v, index) => (
                    <div key={index} className="flex gap-2 items-start p-2 border rounded-lg bg-muted/30">
                      <div className="grid gap-1 flex-1">
                        <Input
                          placeholder="Variable name"
                          value={v.name}
                          onChange={e => {
                            const newVars = [...formData.variables];
                            newVars[index] = { ...v, name: e.target.value };
                            setFormData({ ...formData, variables: newVars });
                          }}
                        />
                        <Input
                          placeholder="Placeholder"
                          value={v.placeholder}
                          onChange={e => {
                            const newVars = [...formData.variables];
                            newVars[index] = { ...v, placeholder: e.target.value };
                            setFormData({ ...formData, variables: newVars });
                          }}
                        />
                        <div className="flex gap-2">
                          <Select
                            value={v.type}
                            onValueChange={(value: any) => {
                              const newVars = [...formData.variables];
                              newVars[index] = { ...v, type: value };
                              setFormData({ ...formData, variables: newVars });
                            }}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">Text</SelectItem>
                              <SelectItem value="number">Number</SelectItem>
                              <SelectItem value="date">Date</SelectItem>
                              <SelectItem value="select">Select</SelectItem>
                            </SelectContent>
                          </Select>
                          {v.type === 'select' && (
                            <Input
                              className="flex-1"
                              placeholder="Options (comma-separated)"
                              value={v.options?.join(', ') || ''}
                              onChange={e => {
                                const newVars = [...formData.variables];
                                newVars[index] = {
                                  ...v,
                                  options: e.target.value.split(',').map(o => o.trim()).filter(Boolean)
                                };
                                setFormData({ ...formData, variables: newVars });
                              }}
                            />
                          )}
                          <Input
                            className="flex-1"
                            placeholder="Default value (optional)"
                            value={v.defaultValue || ''}
                            onChange={e => {
                              const newVars = [...formData.variables];
                              newVars[index] = { ...v, defaultValue: e.target.value };
                              setFormData({ ...formData, variables: newVars });
                            }}
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="mt-1"
                        onClick={() => {
                          const newVars = formData.variables.filter((_, i) => i !== index);
                          setFormData({ ...formData, variables: newVars });
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
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

      <Dialog open={variableDialogOpen} onOpenChange={setVariableDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Fill in template variables</DialogTitle>
            <DialogDescription>
              Provide values for the template variables to create your task
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {selectedTemplateForVariables?.variables.map((variable) => (
              <div key={variable.name} className="grid gap-2">
                <Label htmlFor={`var-${variable.name}`}>
                  {variable.placeholder || variable.name}
                </Label>
                {variable.type === 'select' ? (
                  <Select
                    value={variableValues[variable.name] || variable.defaultValue || ''}
                    onValueChange={(value) => setVariableValues({ ...variableValues, [variable.name]: value })}
                  >
                    <SelectTrigger id={`var-${variable.name}`}>
                      <SelectValue placeholder={variable.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {variable.options?.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={`var-${variable.name}`}
                    type={variable.type === 'number' ? 'number' : variable.type === 'date' ? 'date' : 'text'}
                    placeholder={variable.placeholder}
                    value={variableValues[variable.name] || variable.defaultValue || ''}
                    onChange={(e) => setVariableValues({ ...variableValues, [variable.name]: e.target.value })}
                  />
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setVariableDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleVariableSubmit}>
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
