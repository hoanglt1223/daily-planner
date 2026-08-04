/**
 * Task templates system
 * Provides reusable task templates with variable substitution for quick task creation
 */

export interface TaskTemplate {
  id: string;
  name: string;
  title: string;
  description?: string;
  priority: number;
  estimatedMinutes: number;
  category?: string;
  labels?: string[];
  variables?: TemplateVariable[];
  createdAt: string;
  usageCount: number;
}

export interface TemplateVariable {
  name: string;
  placeholder: string;
  defaultValue?: string;
  type: 'text' | 'number' | 'date' | 'select';
  options?: string[]; // For select type
}

export interface TaskTemplateValues {
  [key: string]: string;
}

const STORAGE_KEY = 'task_templates';

// Built-in templates for common workflows
const BUILT_IN_TEMPLATES: Omit<TaskTemplate, 'id' | 'createdAt' | 'usageCount'>[] = [
  {
    name: 'Weekly Team Meeting',
    title: 'Weekly team sync - {{week}}',
    description: 'Agenda: review progress, blockers, and plans for the week',
    priority: 2,
    estimatedMinutes: 60,
    category: 'meeting',
    labels: ['recurring', 'team'],
    variables: [
      { name: 'week', placeholder: 'Week of Jan 15', type: 'text' },
    ],
  },
  {
    name: 'Code Review',
    title: 'Review PR: {{pr_title}}',
    description: 'Review pull request for {{feature}}',
    priority: 2,
    estimatedMinutes: 30,
    category: 'development',
    labels: ['code-review'],
    variables: [
      { name: 'pr_title', placeholder: 'Feature auth flow', type: 'text' },
      { name: 'feature', placeholder: 'Authentication', type: 'text' },
    ],
  },
  {
    name: 'Client Call',
    title: 'Call with {{client_name}}',
    description: 'Discuss {{topic}}',
    priority: 1,
    estimatedMinutes: 30,
    category: 'meeting',
    labels: ['client'],
    variables: [
      { name: 'client_name', placeholder: 'Client name', type: 'text' },
      { name: 'topic', placeholder: 'Project status', type: 'text' },
    ],
  },
  {
    name: 'Daily Planning',
    title: 'Plan my day - {{date}}',
    description: 'Review priorities and schedule time blocks',
    priority: 1,
    estimatedMinutes: 15,
    category: 'planning',
    labels: ['daily', 'planning'],
    variables: [
      { name: 'date', placeholder: 'Today', defaultValue: 'Today', type: 'text' },
    ],
  },
  {
    name: 'Bug Fix',
    title: 'Fix bug: {{bug_description}}',
    description: 'Investigate and fix: {{details}}',
    priority: 1,
    estimatedMinutes: 60,
    category: 'development',
    labels: ['bug'],
    variables: [
      { name: 'bug_description', placeholder: 'Login not working', type: 'text' },
      { name: 'details', placeholder: 'Error 500 on /login', type: 'text' },
    ],
  },
  {
    name: 'Documentation',
    title: 'Document {{feature}}',
    description: 'Write documentation for {{audience}}',
    priority: 3,
    estimatedMinutes: 45,
    category: 'documentation',
    labels: ['docs'],
    variables: [
      { name: 'feature', placeholder: 'API endpoints', type: 'text' },
      { name: 'audience', placeholder: 'Developers', type: 'select', options: ['Developers', 'Users', 'Admins'] },
    ],
  },
];

/**
 * Get all templates (built-in + user-created)
 */
export function getTemplates(): TaskTemplate[] {
  try {
    const userTemplates = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as TaskTemplate[];
    return [...BUILT_IN_TEMPLATES.map((t, i) => ({
      ...t,
      id: `builtin-${i}`,
      createdAt: new Date().toISOString(),
      usageCount: 0,
    })), ...userTemplates];
  } catch {
    return BUILT_IN_TEMPLATES.map((t: any, i: number) => ({
      ...t,
      id: `builtin-${i}`,
      createdAt: new Date().toISOString(),
      usageCount: 0,
    }));
  }
}

/**
 * Get a single template by ID
 */
export function getTemplate(id: string): TaskTemplate | null {
  const templates = getTemplates();
  return templates.find(t => t.id === id) || null;
}

/**
 * Create a new user template
 */
export function createTemplate(template: Omit<TaskTemplate, 'id' | 'createdAt' | 'usageCount'>): TaskTemplate {
  const templates = getTemplates();
  const newTemplate: TaskTemplate = {
    ...template,
    id: `custom-${Date.now()}`,
    createdAt: new Date().toISOString(),
    usageCount: 0,
  };

  // Only save user templates (not built-in)
  const userTemplates = templates.filter(t => !t.id.startsWith('builtin-'));
  userTemplates.push(newTemplate);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(userTemplates));

  return newTemplate;
}

/**
 * Update an existing user template
 */
export function updateTemplate(id: string, updates: Partial<TaskTemplate>): TaskTemplate | null {
  const templates = getTemplates();
  const template = templates.find(t => t.id === id);

  if (!template || template.id.startsWith('builtin-')) {
    return null; // Can't update built-in templates
  }

  const updated = { ...template, ...updates };
  const userTemplates = templates.filter(t => !t.id.startsWith('builtin-'));
  const index = userTemplates.findIndex(t => t.id === id);

  if (index >= 0) {
    userTemplates[index] = updated;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userTemplates));
  }

  return updated;
}

/**
 * Delete a user template
 */
export function deleteTemplate(id: string): boolean {
  if (id.startsWith('builtin-')) {
    return false; // Can't delete built-in templates
  }

  const templates = getTemplates();
  const userTemplates = templates.filter(t => !t.id.startsWith('builtin-'));
  const filtered = userTemplates.filter(t => t.id !== id);

  if (filtered.length === userTemplates.length) {
    return false; // Template not found
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  return true;
}

/**
 * Increment template usage count
 */
export function recordTemplateUsage(id: string): void {
  if (id.startsWith('builtin-')) {
    return; // Don't track built-in template usage
  }

  const templates = getTemplates();
  const userTemplates = templates.filter(t => !t.id.startsWith('builtin-'));
  const template = userTemplates.find(t => t.id === id);

  if (template) {
    template.usageCount++;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userTemplates));
  }
}

/**
 * Substitute variables in template text
 */
export function substituteVariables(text: string, values: TaskTemplateValues): string {
  let result = text;
  for (const [key, value] of Object.entries(values)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value || '');
  }
  return result;
}

/**
 * Get default values for template variables
 */
export function getVariableDefaults(template: TaskTemplate): TaskTemplateValues {
  const defaults: TaskTemplateValues = {};
  template.variables?.forEach(variable => {
    defaults[variable.name] = variable.defaultValue || '';
  });
  return defaults;
}

/**
 * Generate task from template with provided values
 */
export function generateTaskFromTemplate(
  template: TaskTemplate,
  values: TaskTemplateValues
): Omit<TaskTemplate, 'id' | 'createdAt' | 'usageCount' | 'variables'> {
  return {
    name: template.name,
    title: substituteVariables(template.title, values),
    description: template.description ? substituteVariables(template.description, values) : undefined,
    priority: template.priority,
    estimatedMinutes: template.estimatedMinutes,
    category: template.category,
    labels: template.labels,
  };
}

/**
 * Search templates by name/title
 */
export function searchTemplates(query: string): TaskTemplate[] {
  const templates = getTemplates();
  const lowerQuery = query.toLowerCase();

  return templates.filter(t =>
    t.name.toLowerCase().includes(lowerQuery) ||
    t.title.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get most used templates
 */
export function getMostUsedTemplates(limit: number = 5): TaskTemplate[] {
  const templates = getTemplates()
    .filter(t => !t.id.startsWith('builtin-'))
    .sort((a, b) => b.usageCount - a.usageCount);

  return templates.slice(0, limit);
}
