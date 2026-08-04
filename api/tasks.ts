import type { VercelResponse } from '@vercel/node';
import { and, eq, or, gte, lt, like, sql } from 'drizzle-orm';
import { db } from '../server/lib/db/client.js';
import { tasks, taskTemplates } from '../server/lib/db/schema.js';
import { requireAuth, type AuthedRequest } from '../server/lib/auth-middleware.js';

// ─── Variable substitution helper ────────────────────────────────────────────

interface TemplateValues {
  [key: string]: string;
}

function substituteVariables(text: string | null | undefined, values: TemplateValues): string {
  if (!text) return '';
  let result = text;
  for (const [key, value] of Object.entries(values)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value || '');
  }
  return result;
}

function substituteArrayVariables<T extends { title?: string }>(items: T[], values: TemplateValues): T[] {
  return items.map(item => ({
    ...item,
    ...(item.title && { title: substituteVariables(item.title, values) }),
  }));
}

// ─── Smart-view date helpers ──────────────────────────────────────────────

function todayUtcRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 86_400_000);
  return { start, end };
}

function upcomingEnd(): Date {
  const { start } = todayUtcRange();
  return new Date(start.getTime() + 7 * 86_400_000);
}

export default async function handler(req: AuthedRequest, res: VercelResponse) {
  const user = requireAuth(req, res);
  if (!user) return;
  const id = req.query.id ? String(req.query.id) : null;
  const action = req.query.action ? String(req.query.action) : null;
  const templateId = req.query.templateId ? String(req.query.templateId) : null;

  try {
    // Template listing
    if (req.method === 'GET' && action === 'templates' && !id) {
      const templates = await db.select().from(taskTemplates).where(eq(taskTemplates.userId, user.sub));
      return res.status(200).json(templates);
    }

    // Create task from template
    if (req.method === 'POST' && action === 'apply-template' && templateId) {
      const [template] = await db.select().from(taskTemplates).where(
        and(eq(taskTemplates.id, templateId), eq(taskTemplates.userId, user.sub))
      );
      if (!template) return res.status(404).json({ error: 'template_not_found' });

      const body = req.body ?? {};
      const variableValues = body.variableValues ?? {};

      // Substitute variables in all text fields
      const title = body.title ?? substituteVariables(template.defaultTitle, variableValues);
      const description = body.description ?? substituteVariables(template.defaultDescription ?? null, variableValues);
      const subtasks = body.subtasks ?? substituteArrayVariables(template.defaultSubtasks ?? [], variableValues);
      const labels = Array.isArray(body.labels) ? body.labels : (template.defaultLabels ?? []);

      const [row] = await db.insert(tasks).values({
        userId: user.sub,
        title,
        description: description || null,
        categoryId: body.categoryId ?? template.defaultCategoryId ?? null,
        status: body.status ?? template.defaultStatus,
        priority: body.priority ?? template.defaultPriority,
        estimatedMinutes: body.estimatedMinutes ?? template.defaultEstimatedMinutes,
        recurringRule: body.recurringRule ?? template.defaultRecurringRule ?? null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        subtasks,
        labels,
        blockedByTaskIds: [],
        reminderEnabled: body.reminderEnabled ?? false,
        reminderMinutes: body.reminderMinutes ?? null,
      }).returning();
      return res.status(201).json(row);
    }

    // Create template
    if (req.method === 'POST' && action === 'templates' && !id) {
      const body = req.body ?? {};
      if (!body.name || !body.defaultTitle) {
        return res.status(400).json({ error: 'name_and_default_title_required' });
      }

      const [row] = await db.insert(taskTemplates).values({
        userId: user.sub,
        name: body.name,
        description: body.description ?? null,
        defaultCategoryId: body.defaultCategoryId ?? null,
        defaultTitle: body.defaultTitle,
        defaultDescription: body.defaultDescription ?? null,
        defaultEstimatedMinutes: body.defaultEstimatedMinutes ?? 60,
        defaultPriority: body.defaultPriority ?? 3,
        defaultStatus: body.defaultStatus ?? 'todo',
        defaultRecurringRule: body.defaultRecurringRule ?? null,
        defaultLabels: Array.isArray(body.defaultLabels) ? body.defaultLabels : [],
        defaultSubtasks: body.defaultSubtasks ?? [],
        isPinned: body.isPinned ?? false,
        variables: body.variables ?? [],
      }).returning();
      return res.status(201).json(row);
    }

    // Update template
    if (req.method === 'PATCH' && action === 'templates' && id) {
      const body = req.body ?? {};
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      for (const key of [
        'name', 'description', 'defaultCategoryId', 'defaultTitle', 'defaultDescription',
        'defaultEstimatedMinutes', 'defaultPriority', 'defaultStatus', 'defaultRecurringRule',
        'defaultLabels', 'defaultSubtasks', 'isPinned', 'variables'
      ]) {
        if (key in body) patch[key] = body[key];
      }

      const [row] = await db.update(taskTemplates)
        .set(patch)
        .where(and(eq(taskTemplates.id, id), eq(taskTemplates.userId, user.sub)))
        .returning();
      if (!row) return res.status(404).json({ error: 'not_found' });
      return res.status(200).json(row);
    }

    // Delete template
    if (req.method === 'DELETE' && action === 'templates' && id) {
      await db.delete(taskTemplates).where(
        and(eq(taskTemplates.id, id), eq(taskTemplates.userId, user.sub))
      );
      return res.status(204).end();
    }

    if (req.method === 'GET' && !id) {
      // Optional query params for smart views + label filter + search
      const view = req.query.view ? String(req.query.view) : null; // today | upcoming | overdue
      const labelFilter = req.query.label ? String(req.query.label) : null;
      const searchQuery = req.query.search ? String(req.query.search).trim() : null;

      let whereClause = eq(tasks.userId, user.sub);

      if (view === 'today') {
        const { start, end } = todayUtcRange();
        whereClause = and(
          eq(tasks.userId, user.sub),
          gte(tasks.dueDate, start),
          lt(tasks.dueDate, end),
        )!;
      } else if (view === 'upcoming') {
        const { end: todayEnd } = todayUtcRange();
        const upEnd = upcomingEnd();
        whereClause = and(
          eq(tasks.userId, user.sub),
          gte(tasks.dueDate, todayEnd),
          lt(tasks.dueDate, upEnd),
        )!;
      } else if (view === 'overdue') {
        const { start: todayStart } = todayUtcRange();
        whereClause = and(
          eq(tasks.userId, user.sub),
          lt(tasks.dueDate, todayStart),
          or(
            eq(tasks.status, 'todo'),
            eq(tasks.status, 'doing'),
            eq(tasks.status, 'backlog'),
          ),
        )!;
      }

      let rows = await db.select().from(tasks).where(whereClause);

      // Label filtering is done in JS since jsonb array-contains is driver-specific.
      // At current task volumes (personal planner) this is negligible overhead.
      if (labelFilter) {
        rows = rows.filter(t => Array.isArray(t.labels) && t.labels.includes(labelFilter));
      }

      // Search filtering: case-insensitive search in title and description
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        rows = rows.filter(t =>
          t.title.toLowerCase().includes(searchLower) ||
          (t.description && t.description.toLowerCase().includes(searchLower))
        );
      }

      return res.status(200).json(rows);
    }

    if (req.method === 'POST' && !id) {
      const body = req.body ?? {};
      if (!body.title) return res.status(400).json({ error: 'title_required' });

      // Validate dependencies if provided
      const blockedByTaskIds = Array.isArray(body.blockedByTaskIds) ? body.blockedByTaskIds : [];
      if (blockedByTaskIds.length > 0) {
        // Verify all blocking tasks exist and belong to user
        const blockingTasks = await db.select().from(tasks).where(
          and(eq(tasks.userId, user.sub))
        );
        const validIds = new Set(blockingTasks.map(t => t.id));
        const invalidIds = blockedByTaskIds.filter((id: string) => !validIds.has(id));
        if (invalidIds.length > 0) {
          return res.status(400).json({ error: 'invalid_dependencies', invalidIds });
        }
      }

      const [row] = await db.insert(tasks).values({
        userId: user.sub,
        title: body.title,
        description: body.description ?? null,
        categoryId: body.categoryId ?? null,
        projectId: body.projectId ?? null,
        status: body.status ?? 'todo',
        priority: body.priority ?? 3,
        estimatedMinutes: body.estimatedMinutes ?? 60,
        recurringRule: body.recurringRule ?? null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        subtasks: body.subtasks ?? [],
        labels: Array.isArray(body.labels) ? body.labels : [],
        blockedByTaskIds,
        reminderEnabled: body.reminderEnabled ?? false,
        reminderMinutes: body.reminderMinutes ?? null,
      }).returning();
      return res.status(201).json(row);
    }

    if (req.method === 'PATCH' && id) {
      const body = req.body ?? {};
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      for (const key of ['title', 'description', 'status', 'priority', 'estimatedMinutes', 'categoryId', 'projectId', 'recurringRule', 'isPinned', 'subtasks', 'reminderEnabled', 'reminderMinutes']) {
        if (key in body) patch[key] = body[key];
      }
      if ('dueDate' in body) patch.dueDate = body.dueDate ? new Date(body.dueDate) : null;
      // labels: validate it's a string array before persisting
      if ('labels' in body) {
        patch.labels = Array.isArray(body.labels)
          ? body.labels.filter((l: unknown) => typeof l === 'string')
          : [];
      }
      // blockedByTaskIds: validate and check for circular dependencies
      if ('blockedByTaskIds' in body) {
        const blockedBy = Array.isArray(body.blockedByTaskIds) ? body.blockedByTaskIds : [];
        // Verify all blocking tasks exist and belong to user
        const allTasks = await db.select().from(tasks).where(eq(tasks.userId, user.sub));
        const validIds = new Set(allTasks.map(t => t.id));
        const invalidIds = blockedBy.filter((depId: string) => !validIds.has(depId));
        if (invalidIds.length > 0) {
          return res.status(400).json({ error: 'invalid_dependencies', invalidIds });
        }

        // Check for circular dependencies
        const visited = new Set<string>();
        const stack = [...blockedBy];

        while (stack.length > 0) {
          const currentId = stack.pop()!;
          if (currentId === id) {
            return res.status(400).json({ error: 'circular_dependency', message: 'Cannot create circular dependencies' });
          }
          if (visited.has(currentId)) continue;
          visited.add(currentId);

          const currentTask = allTasks.find(t => t.id === currentId);
          if (currentTask?.blockedByTaskIds) {
            stack.push(...currentTask.blockedByTaskIds);
          }
        }

        patch.blockedByTaskIds = blockedBy;
      }

      const [row] = await db.update(tasks)
        .set(patch)
        .where(and(eq(tasks.id, id), eq(tasks.userId, user.sub)))
        .returning();
      if (!row) return res.status(404).json({ error: 'not_found' });
      return res.status(200).json(row);
    }

    if (req.method === 'DELETE' && id) {
      await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, user.sub)));
      return res.status(204).end();
    }

    return res.status(404).json({ error: 'not_found' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
}
