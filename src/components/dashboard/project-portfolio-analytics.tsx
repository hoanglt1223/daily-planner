import { useEffect, useMemo, useState } from 'react';
import { Briefcase, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { startOfWeek, addDays } from '@/lib/time-utils';

type Block = { id: string; taskId: string | null; startAt: string; endAt: string; status: string; actualMinutes: number | null };
type Task = { id: string; projectId: string | null; status: string; title: string; estimatedMinutes: number };
type Project = { id: string; name: string; color: string; status: string };

export function ProjectPortfolioAnalytics() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const weekStart = startOfWeek(new Date());
    const weekEnd = addDays(weekStart, 7);
    Promise.all([
      apiFetch<Block[]>(`/api/time-blocks?from=${weekStart.toISOString()}&to=${weekEnd.toISOString()}`),
      apiFetch<Task[]>('/api/tasks'),
      apiFetch<Project[]>('/api/projects'),
    ])
      .then(([b, t, p]) => { setBlocks(b); setTasks(t); setProjects(p); })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const analytics = useMemo(() =>
    computeProjectAnalytics(blocks, tasks, projects),
    [blocks, tasks, projects]
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (analytics.projects.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Briefcase className="size-4" />
            Project Portfolio
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-sm text-muted-foreground">
            No projects yet. Create projects to track time distribution across your work.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Briefcase className="size-4" />
          Project Portfolio
          <Badge variant="secondary" className="ml-auto text-xs">
            {analytics.projects.length} active
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-semibold">{analytics.totalHours}</p>
            <p className="text-xs text-muted-foreground">Hours this week</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold">{analytics.topProject?.name || 'N/A'}</p>
            <p className="text-xs text-muted-foreground">Top project</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold">{analytics.completionRate}%</p>
            <p className="text-xs text-muted-foreground">Task completion</p>
          </div>
        </div>

        {/* Project Distribution Bar */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Time Distribution</p>
          <div className="flex h-2 w-full overflow-hidden rounded-full">
            {analytics.projects.map(p => (
              <div
                key={p.id}
                className="h-full transition-all"
                style={{
                  width: `${p.distributionPercent}%`,
                  backgroundColor: p.color
                }}
                title={`${p.name}: ${p.hours}h (${p.distributionPercent}%)`}
              />
            ))}
          </div>
        </div>

        {/* Project Details */}
        <div className="space-y-3">
          {analytics.projects.slice(0, 5).map(project => (
            <div key={project.id} className="flex items-center gap-3 text-sm">
              <div
                className="size-3 shrink-0 rounded-sm"
                style={{ backgroundColor: project.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{project.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {project.hours}h ({project.distributionPercent}%)
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <Progress
                    value={project.taskCompletion}
                    className="h-1 flex-1"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">
                    {project.taskCompletion}%
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="size-2.5" />
                    {project.completedTasks}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="size-2.5" />
                    {project.inProgressTasks}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <AlertCircle className="size-2.5" />
                    {project.backlogTasks}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Insights */}
        {analytics.insights.length > 0 && (
          <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
            {analytics.insights.map((insight, idx) => (
              <p key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>{insight}</span>
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ProjectAnalytics {
  projects: Array<{
    id: string;
    name: string;
    color: string;
    hours: number;
    distributionPercent: number;
    completedTasks: number;
    inProgressTasks: number;
    backlogTasks: number;
    taskCompletion: number;
  }>;
  totalHours: number;
  topProject: { name: string; hours: number } | null;
  completionRate: number;
  insights: string[];
}

function computeProjectAnalytics(
  blocks: Block[],
  tasks: Task[],
  projects: Project[],
): ProjectAnalytics {
  // Build maps
  const taskProjectMap = new Map(tasks.map(t => [t.id, t.projectId]));

  // Aggregate time by project
  const projectMinutes = new Map<string, number>();
  let uncategorizedMinutes = 0;

  for (const block of blocks) {
    const duration = Math.round((new Date(block.endAt).getTime() - new Date(block.startAt).getTime()) / 60_000);
    if (duration <= 0) continue;

    const projectId = block.taskId ? taskProjectMap.get(block.taskId) ?? null : null;
    if (projectId) {
      projectMinutes.set(projectId, (projectMinutes.get(projectId) ?? 0) + duration);
    } else {
      uncategorizedMinutes += duration;
    }
  }

  // Calculate totals
  const totalMinutes = [...projectMinutes.values()].reduce((sum, mins) => sum + mins, 0) + uncategorizedMinutes;
  const totalHours = Math.round(totalMinutes / 60 * 10) / 10;

  // Build project analytics
  const projectData = projects.map(project => {
    const minutes = projectMinutes.get(project.id) ?? 0;
    const hours = Math.round(minutes / 60 * 10) / 10;
    const distributionPercent = totalMinutes > 0 ? Math.round((minutes / totalMinutes) * 100) : 0;

    // Calculate task stats
    const projectTasks = tasks.filter(t => t.projectId === project.id);
    const completedTasks = projectTasks.filter(t => t.status === 'done').length;
    const inProgressTasks = projectTasks.filter(t => t.status === 'doing').length;
    const backlogTasks = projectTasks.filter(t => t.status === 'backlog' || t.status === 'todo').length;
    const taskCompletion = projectTasks.length > 0 ? Math.round((completedTasks / projectTasks.length) * 100) : 0;

    return {
      id: project.id,
      name: project.name,
      color: project.color,
      hours,
      distributionPercent,
      completedTasks,
      inProgressTasks,
      backlogTasks,
      taskCompletion,
    };
  });

  // Sort by hours descending
  projectData.sort((a, b) => b.hours - a.hours);

  // Find top project
  const topProject = projectData.length > 0
    ? { name: projectData[0].name, hours: projectData[0].hours }
    : null;

  // Calculate overall completion rate
  const totalTasks = tasks.length;
  const totalCompleted = tasks.filter(t => t.status === 'done').length;
  const completionRate = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

  // Generate insights
  const insights: string[] = [];

  if (projectData.length >= 3) {
    const top3 = projectData.slice(0, 3);
    const top3Percent = top3.reduce((sum, p) => sum + p.distributionPercent, 0);
    if (top3Percent > 80) {
      insights.push(`Your top 3 projects consume ${top3Percent}% of your time. Consider if this aligns with your priorities.`);
    }
  }

  if (projectData.length > 0) {
    const highest = projectData[0];
    if (highest.distributionPercent > 60) {
      insights.push(`${highest.name} dominates your week (${highest.distributionPercent}%). Ensure other projects aren't neglected.`);
    }
  }

  const lowProgressProjects = projectData.filter(p => p.taskCompletion < 30 && p.backlogTasks > 2);
  if (lowProgressProjects.length > 0) {
    insights.push(`${lowProgressProjects.length} project(s) have low progress. Consider breaking down large tasks.`);
  }

  if (uncategorizedMinutes > 0 && totalMinutes > 0) {
    const uncategorizedPercent = Math.round((uncategorizedMinutes / totalMinutes) * 100);
    if (uncategorizedPercent > 20) {
      insights.push(`${uncategorizedPercent}% of your time is uncategorized. Link tasks to projects for better tracking.`);
    }
  }

  if (completionRate < 50 && totalTasks > 5) {
    insights.push('Overall task completion is low. Focus on finishing existing tasks before starting new ones.');
  } else if (completionRate > 80) {
    insights.push('Strong completion rate! You\'re making steady progress across your portfolio.');
  }

  const balancedProjects = projectData.filter(p => p.distributionPercent >= 15 && p.distributionPercent <= 40);
  if (balancedProjects.length >= 2) {
    insights.push('Good portfolio balance! You\'re distributing time across multiple projects.');
  }

  return {
    projects: projectData,
    totalHours,
    topProject,
    completionRate,
    insights: insights.slice(0, 3), // Limit to 3 insights
  };
}
