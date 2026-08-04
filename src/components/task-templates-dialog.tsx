import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  FileText, Clock, Target, Plus, Search, Sparkles, ChevronRight, Edit2, Trash2, Zap
} from 'lucide-react';
import {
  getTemplates,
  createTemplate,
  deleteTemplate,
  updateTemplate,
  recordTemplateUsage,
  generateTaskFromTemplate,
  getMostUsedTemplates,
  type TaskTemplate,
  type TaskTemplateValues,
} from '@/lib/task-templates';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TaskTemplatesDialogProps {
  open: boolean;
  onClose: () => void;
  onTaskCreated: (task: {
    title: string;
    description: string | null;
    priority: number;
    estimatedMinutes: number;
    categoryId: string | null;
  }) => void;
}

export function TaskTemplatesDialog({ open, onClose, onTaskCreated }: TaskTemplatesDialogProps) {
  const [search, setSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [templateValues, setTemplateValues] = useState<TaskTemplateValues>({});
  const [creatingNew, setCreatingNew] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [mostUsed, setMostUsed] = useState<TaskTemplate[]>([]);

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open]);

  function loadTemplates() {
    setTemplates(getTemplates());
    setMostUsed(getMostUsedTemplates(3));
  }

  const handleSelectTemplate = (template: TaskTemplate) => {
    setSelectedTemplate(template);
    setTemplateValues({});
    setCreatingNew(false);
    setEditingTemplate(null);
  };

  const handleValueChange = (variableName: string, value: string) => {
    setTemplateValues(prev => ({ ...prev, [variableName]: value }));
  };

  const handleCreateFromTemplate = () => {
    if (!selectedTemplate) return;

    // Check if all required variables have values
    const missingVars = selectedTemplate.variables?.filter(v => {
      const value = templateValues[v.name];
      return !value || value.trim() === '';
    });

    if (missingVars && missingVars.length > 0) {
      toast.error('Please fill in all template fields');
      return;
    }

    const task = generateTaskFromTemplate(selectedTemplate, templateValues);
    onTaskCreated({
      title: task.title,
      description: task.description || null,
      priority: task.priority,
      estimatedMinutes: task.estimatedMinutes,
      categoryId: null,
    });

    recordTemplateUsage(selectedTemplate.id);
    onClose();
    setSelectedTemplate(null);
    setTemplateValues({});
    toast.success(`Task created from "${selectedTemplate.name}" template`);
  };

  const handleCreateNew = () => {
    setCreatingNew(true);
    setEditingTemplate({
      id: '',
      name: '',
      title: '',
      description: '',
      priority: 3,
      estimatedMinutes: 30,
      labels: [],
      variables: [],
      createdAt: new Date().toISOString(),
      usageCount: 0,
    });
    setSelectedTemplate(null);
  };

  const handleSaveNew = () => {
    if (!editingTemplate || !editingTemplate.name || !editingTemplate.title) {
      toast.error('Template name and title are required');
      return;
    }

    createTemplate({
      name: editingTemplate.name,
      title: editingTemplate.title,
      description: editingTemplate.description,
      priority: editingTemplate.priority,
      estimatedMinutes: editingTemplate.estimatedMinutes,
      category: editingTemplate.category,
      labels: editingTemplate.labels,
      variables: editingTemplate.variables,
    });

    toast.success('Template created successfully');
    loadTemplates();
    setCreatingNew(false);
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = (id: string) => {
    if (id.startsWith('builtin-')) {
      toast.error('Cannot delete built-in templates');
      return;
    }

    if (confirm('Are you sure you want to delete this template?')) {
      deleteTemplate(id);
      toast.success('Template deleted');
      loadTemplates();
      if (selectedTemplate?.id === id) {
        setSelectedTemplate(null);
      }
    }
  };

  const handleEditTemplate = (template: TaskTemplate) => {
    if (template.id.startsWith('builtin-')) {
      toast.error('Cannot edit built-in templates');
      return;
    }
    setEditingTemplate(template);
    setCreatingNew(false);
    setSelectedTemplate(template);
  };

  const handleSaveEdit = () => {
    if (!editingTemplate || !editingTemplate.id) return;

    updateTemplate(editingTemplate.id, editingTemplate);
    toast.success('Template updated successfully');
    loadTemplates();
    setEditingTemplate(null);
  };

  const filteredTemplates = search
    ? templates.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.title.toLowerCase().includes(search.toLowerCase())
      )
    : templates;

  if (editingTemplate) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {creatingNew ? 'Create New Template' : 'Edit Template'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Template Name</label>
              <Input
                value={editingTemplate.name}
                onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                placeholder="e.g., Weekly Meeting"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Task Title</label>
              <Input
                value={editingTemplate.title}
                onChange={e => setEditingTemplate({ ...editingTemplate, title: e.target.value })}
                placeholder="Use {{variable}} for dynamic values"
              />
              <p className="text-xs text-muted-foreground">
                Use &lbrace;variable&rbrace; syntax for dynamic values (e.g., "Meeting with &lbrace;client&rbrace;")
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={editingTemplate.description || ''}
                onChange={e => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                placeholder="Task description..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <select
                  value={editingTemplate.priority}
                  onChange={e => setEditingTemplate({ ...editingTemplate, priority: Number(e.target.value) })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                >
                  <option value={1}>1 - Urgent</option>
                  <option value={2}>2 - High</option>
                  <option value={3}>3 - Normal</option>
                  <option value={4}>4 - Low</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Estimated Minutes</label>
                <Input
                  type="number"
                  value={editingTemplate.estimatedMinutes}
                  onChange={e => setEditingTemplate({ ...editingTemplate, estimatedMinutes: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Variables</label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const newVar = { name: '', placeholder: '', type: 'text' as const };
                    setEditingTemplate({
                      ...editingTemplate,
                      variables: [...(editingTemplate.variables || []), newVar],
                    });
                  }}
                >
                  <Plus className="size-3 mr-1" />
                  Add Variable
                </Button>
              </div>
              <div className="space-y-2">
                {editingTemplate.variables?.map((variable, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 border rounded-md">
                    <Input
                      placeholder="Variable name"
                      value={variable.name}
                      onChange={e => {
                        const newVars = [...(editingTemplate.variables || [])];
                        newVars[idx] = { ...variable, name: e.target.value };
                        setEditingTemplate({ ...editingTemplate, variables: newVars });
                      }}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Placeholder"
                      value={variable.placeholder}
                      onChange={e => {
                        const newVars = [...(editingTemplate.variables || [])];
                        newVars[idx] = { ...variable, placeholder: e.target.value };
                        setEditingTemplate({ ...editingTemplate, variables: newVars });
                      }}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const newVars = editingTemplate.variables?.filter((_, i) => i !== idx) || [];
                        setEditingTemplate({ ...editingTemplate, variables: newVars });
                      }}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setEditingTemplate(null);
              setCreatingNew(false);
            }}>
              Cancel
            </Button>
            <Button onClick={creatingNew ? handleSaveNew : handleSaveEdit}>
              {creatingNew ? 'Create Template' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            Task Templates
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Search and create */}
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search templates..."
                className="pl-10"
              />
            </div>
            <Button onClick={handleCreateNew} variant="outline">
              <Plus className="size-4 mr-2" />
              New Template
            </Button>
          </div>

          <div className="flex-1 overflow-hidden flex gap-4">
            {/* Template list */}
            <div className="w-1/2 overflow-hidden flex flex-col">
              {mostUsed.length > 0 && !search && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                    <Zap className="size-3" />
                    Most Used
                  </p>
                  <div className="space-y-1">
                    {mostUsed.map(template => (
                      <button
                        key={template.id}
                        onClick={() => handleSelectTemplate(template)}
                        className={cn(
                          'w-full flex items-center gap-2 p-2 rounded-md text-left hover:bg-muted transition-colors',
                          selectedTemplate?.id === template.id && 'bg-primary/10 border border-primary/20'
                        )}
                      >
                        <FileText className="size-4 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{template.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{template.title}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {template.usageCount}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto pr-4">
                <div className="space-y-1">
                  {filteredTemplates.map(template => (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className={cn(
                        'w-full flex items-center gap-2 p-2 rounded-md text-left hover:bg-muted transition-colors group',
                        selectedTemplate?.id === template.id && 'bg-primary/10 border border-primary/20'
                      )}
                    >
                      <FileText className={cn(
                        'size-4 shrink-0',
                        template.id.startsWith('builtin-') ? 'text-primary' : 'text-muted-foreground'
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{template.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{template.title}</p>
                      </div>
                      {!template.id.startsWith('builtin-') && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditTemplate(template);
                            }}
                          >
                            <Edit2 className="size-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTemplate(template.id);
                            }}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      )}
                      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Template details */}
            <div className="w-1/2 border-l pl-4 overflow-hidden flex flex-col">
              {selectedTemplate ? (
                <div className="flex-1 overflow-y-auto">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        {selectedTemplate.name}
                        {selectedTemplate.id.startsWith('builtin-') && (
                          <Badge variant="secondary" className="text-xs">Built-in</Badge>
                        )}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">{selectedTemplate.title}</p>
                    </div>

                    {selectedTemplate.description && (
                      <div>
                        <p className="text-sm">{selectedTemplate.description}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Target className="size-4 text-muted-foreground" />
                        <span>Priority {selectedTemplate.priority}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="size-4 text-muted-foreground" />
                        <span>{selectedTemplate.estimatedMinutes} min</span>
                      </div>
                    </div>

                    {selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-sm font-semibold">Fill in the details:</p>
                        {selectedTemplate.variables.map(variable => (
                          <div key={variable.name} className="space-y-1">
                            <label className="text-sm font-medium">
                              {variable.placeholder}
                            </label>
                            {variable.type === 'select' && variable.options ? (
                              <select
                                value={templateValues[variable.name] || ''}
                                onChange={e => handleValueChange(variable.name, e.target.value)}
                                className="w-full rounded-md border border-input bg-background px-3 py-2"
                              >
                                <option value="">Select...</option>
                                {variable.options.map(option => (
                                  <option key={option} value={option}>{option}</option>
                                ))}
                              </select>
                            ) : (
                              <Input
                                value={templateValues[variable.name] || ''}
                                onChange={e => handleValueChange(variable.name, e.target.value)}
                                placeholder={variable.placeholder}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Preview */}
                    <div className="p-3 bg-muted rounded-md space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">Preview:</p>
                      <p className="text-sm font-medium">
                        {selectedTemplate.title.replace(/\{\{(\w+)\}\}/g, (match, name) => {
                          const value = templateValues[name];
                          return value || match;
                        })}
                      </p>
                      {selectedTemplate.description && (
                        <p className="text-sm text-muted-foreground">
                          {selectedTemplate.description.replace(/\{\{(\w+)\}\}/g, (match, name) => {
                            const value = templateValues[name];
                            return value || match;
                          })}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end mt-4">
                    <Button onClick={handleCreateFromTemplate} className="gap-2">
                      <Sparkles className="size-4" />
                      Create Task
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-center">
                  <div>
                    <FileText className="size-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {search ? 'No templates found' : 'Select a template to get started'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
