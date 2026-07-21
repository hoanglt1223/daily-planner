import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderOpen, Plus, Pencil, Trash2, Calendar, CheckCircle2, Clock, AlertCircle, Archive, PauseCircle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type ProjectStatus = 'active' | 'completed' | 'archived' | 'on_hold';

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  color: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  stats: {
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    overdueTasks: number;
    progress: number;
  };
}

const STATUS_CONFIG: Record<ProjectStatus, { label: string; icon: typeof CheckCircle2; color: string }> = {
  active: { label: 'Active', icon: Clock, color: 'text-blue-500' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'text-emerald-500' },
  archived: { label: 'Archived', icon: Archive, color: 'text-slate-500' },
  on_hold: { label: 'On Hold', icon: PauseCircle, color: 'text-amber-500' },
};

export function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#6366f1',
    status: 'active' as ProjectStatus,
    startDate: '',
    endDate: '',
  });

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch<Project[]>('/api/projects?action=list');
      setProjects(data);
    } catch (err) {
      console.error('Failed to load projects:', err);
      setError('Failed to load projects');
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProjects(); }, []);

  const handleCreate = () => {
    setEditingProject(null);
    setFormData({
      name: '',
      description: '',
      color: '#6366f1',
      status: 'active',
      startDate: '',
      endDate: '',
    });
    setDialogOpen(true);
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setFormData({
      name: project.name,
      description: project.description || '',
      color: project.color,
      status: project.status,
      startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : '',
      endDate: project.endDate ? new Date(project.endDate).toISOString().split('T')[0] : '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (project: Project) => {
    if (!confirm(`Delete project "${project.name}"? Tasks will be unlinked but not deleted.`)) return;

    try {
      await apiFetch(`/api/projects?action=delete&id=${project.id}`, { method: 'DELETE' });
      toast.success('Project deleted');
      loadProjects();
    } catch (err) {
      console.error('Failed to delete project:', err);
      toast.error('Failed to delete project');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const payload = {
        name: formData.name,
        description: formData.description || null,
        color: formData.color,
        status: formData.status,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
      };

      if (editingProject) {
        await apiFetch(`/api/projects?action=update&id=${editingProject.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success('Project updated');
      } else {
        await apiFetch('/api/projects?action=create', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Project created');
      }

      setDialogOpen(false);
      loadProjects();
    } catch (err) {
      console.error('Failed to save project:', err);
      toast.error('Failed to save project');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
            <p className="text-muted-foreground">Organize your tasks into projects</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <AlertCircle className="size-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-lg font-semibold">Failed to load projects</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
        <Button onClick={loadProjects}>Retry</Button>
      </div>
    );
  }

  const isEmpty = projects.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">Organize your tasks into projects</p>
        </div>
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="size-4" />
          New Project
        </Button>
      </div>

      {isEmpty ? (
        <Card className="border-dashed border-2 border-muted-foreground/25 bg-muted/20">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="rounded-full bg-primary/10 p-4">
              <FolderOpen className="size-8 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold">No projects yet</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Create your first project to start organizing your tasks
              </p>
            </div>
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="size-4" />
              Create Project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const StatusIcon = STATUS_CONFIG[project.status].icon;
            return (
              <Card key={project.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div
                        className="size-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: project.color }}
                      />
                      <CardTitle className="truncate">{project.name}</CardTitle>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn('gap-1 flex-shrink-0', STATUS_CONFIG[project.status].color)}
                    >
                      <StatusIcon className="size-3" />
                      {STATUS_CONFIG[project.status].label}
                    </Badge>
                  </div>
                  {project.description && (
                    <CardDescription className="line-clamp-2">{project.description}</CardDescription>
                  )}
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{project.stats.progress}%</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          width: `${project.stats.progress}%`,
                          backgroundColor: project.color,
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="size-3" />
                      {project.stats.completedTasks}/{project.stats.totalTasks}
                    </span>
                    {project.stats.inProgressTasks > 0 && (
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {project.stats.inProgressTasks} in progress
                      </span>
                    )}
                    {project.stats.overdueTasks > 0 && (
                      <span className="flex items-center gap-1 text-red-500">
                        <AlertCircle className="size-3" />
                        {project.stats.overdueTasks} overdue
                      </span>
                    )}
                  </div>

                  {(project.startDate || project.endDate) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="size-3" />
                      {project.startDate && (
                        <span>Starts {new Date(project.startDate).toLocaleDateString()}</span>
                      )}
                      {project.startDate && project.endDate && <span>→</span>}
                      {project.endDate && (
                        <span>Ends {new Date(project.endDate).toLocaleDateString()}</span>
                      )}
                    </div>
                  )}
                </CardContent>

                <CardFooter className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(`/tasks?project=${project.id}`)}
                  >
                    View Tasks
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleEdit(project)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(project)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingProject ? 'Edit Project' : 'Create Project'}</DialogTitle>
            <DialogDescription>
              {editingProject ? 'Update project details' : 'Create a new project to organize your tasks'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Website Redesign"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the project..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="color">Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="color"
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="size-10 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: ProjectStatus) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([value, { label }]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingProject ? 'Update' : 'Create'} Project
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
