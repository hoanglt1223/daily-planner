import type { VercelResponse } from '@vercel/node';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../server/lib/db/client.js';
import { projects, tasks } from '../server/lib/db/schema.js';
import { requireAuth, type AuthedRequest } from '../server/lib/auth-middleware.js';
import { nanoid } from 'nanoid';

export default async function handler(req: AuthedRequest, res: VercelResponse) {
  const user = requireAuth(req, res);
  if (!user) return;

  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const action = url.searchParams.get('action') || 'list';
  const id = url.searchParams.get('id');

  if (action === 'list') {
    return listProjects(req, res, user.sub);
  } else if (action === 'create') {
    return createProject(req, res, user.sub);
  } else if (action === 'update' && id) {
    return updateProject(req, res, id, user.sub);
  } else if (action === 'delete' && id) {
    return deleteProject(req, res, id, user.sub);
  } else if (action === 'get' && id) {
    return getProject(req, res, id, user.sub);
  } else {
    return res.status(400).json({ error: 'Invalid action' });
  }
}

async function listProjects(req: AuthedRequest, res: VercelResponse, userId: string) {
  try {
    const userProjects = await db.query.projects.findMany({
      where: eq(projects.userId, userId),
      orderBy: [desc(projects.createdAt)],
    });

    // Calculate task counts and progress for each project
    const projectsWithStats = await Promise.all(
      userProjects.map(async (project) => {
        const allTasks = await db.query.tasks.findMany({
          where: eq(tasks.projectId, project.id),
        });

        const totalTasks = allTasks.length;
        const completedTasks = allTasks.filter(t => t.status === 'done').length;
        const inProgressTasks = allTasks.filter(t => t.status === 'doing').length;
        const overdueTasks = allTasks.filter(t => {
          if (t.dueDate && t.status !== 'done') {
            return new Date(t.dueDate) < new Date();
          }
          return false;
        }).length;

        return {
          ...project,
          stats: {
            totalTasks,
            completedTasks,
            inProgressTasks,
            overdueTasks,
            progress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
          },
        };
      })
    );

    return res.status(200).json(projectsWithStats);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return res.status(500).json({ error: 'Failed to fetch projects' });
  }
}

async function getProject(req: AuthedRequest, res: VercelResponse, id: string, userId: string) {
  try {
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.userId, userId)),
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const projectTasks = await db.query.tasks.findMany({
      where: eq(tasks.projectId, id),
    });

    return res.status(200).json({
      ...project,
      tasks: projectTasks,
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    return res.status(500).json({ error: 'Failed to fetch project' });
  }
}

async function createProject(req: AuthedRequest, res: VercelResponse, userId: string) {
  try {
    const body = req.body ?? {};
    const { name, description, color, startDate, endDate } = body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const newProject = await db.insert(projects).values({
      id: nanoid(),
      userId,
      name: name.trim(),
      description: description || null,
      color: color || '#6366f1',
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    return res.status(201).json(newProject[0]);
  } catch (error) {
    console.error('Error creating project:', error);
    return res.status(500).json({ error: 'Failed to create project' });
  }
}

async function updateProject(req: AuthedRequest, res: VercelResponse, id: string, userId: string) {
  try {
    const body = req.body ?? {};
    const { name, description, color, status, startDate, endDate } = body;

    const existing = await db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.userId, userId)),
    });

    if (!existing) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const updated = await db.update(projects)
      .set({
        name: name?.trim() || existing.name,
        description: description !== undefined ? description : existing.description,
        color: color || existing.color,
        status: status || existing.status,
        startDate: startDate ? new Date(startDate) : existing.startDate,
        endDate: endDate ? new Date(endDate) : existing.endDate,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning();

    return res.status(200).json(updated[0]);
  } catch (error) {
    console.error('Error updating project:', error);
    return res.status(500).json({ error: 'Failed to update project' });
  }
}

async function deleteProject(req: AuthedRequest, res: VercelResponse, id: string, userId: string) {
  try {
    const existing = await db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.userId, userId)),
    });

    if (!existing) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Unlink tasks from this project
    await db.update(tasks)
      .set({ projectId: null })
      .where(eq(tasks.projectId, id));

    // Delete the project
    await db.delete(projects).where(eq(projects.id, id));

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    return res.status(500).json({ error: 'Failed to delete project' });
  }
}
