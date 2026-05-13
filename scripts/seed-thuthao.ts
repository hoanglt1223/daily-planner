/**
 * Seed Thu Thao's planner: user, categories, recurring tasks, and the
 * concrete time blocks for the week of 2026-05-11..15.
 *
 * Run: npm run seed:thuthao
 * Idempotent: removes the user's existing tasks/blocks/categories before reseeding.
 */
import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';

// Load .env.local before importing drizzle client
try {
  const raw = readFileSync('.env.local', 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
} catch { /* no .env.local */ }

const { db } = await import('../server/lib/db/client.js');
const { users, categories, tasks, timeBlocks } = await import('../server/lib/db/schema.js');
const { hashPassword } = await import('../server/lib/auth.js');

const EMAIL = process.env.THUTHAO_EMAIL || 'thuthao@daily-planner.local';
const PASSWORD = process.env.THUTHAO_PASSWORD || 'changeme123';
const TZ = 'Asia/Bangkok';

// ─── 1. Upsert user ────────────────────────────────────────────────────────
async function upsertUser() {
  const existing = await db.select().from(users).where(eq(users.email, EMAIL)).limit(1);
  if (existing[0]) {
    console.log(`  user exists, wiping their tasks/blocks/categories…`);
    await db.delete(timeBlocks).where(eq(timeBlocks.userId, existing[0].id));
    await db.delete(tasks).where(eq(tasks.userId, existing[0].id));
    await db.delete(categories).where(eq(categories.userId, existing[0].id));
    return existing[0];
  }
  const [u] = await db.insert(users).values({
    email: EMAIL,
    name: 'Thu Thao',
    passwordHash: hashPassword(PASSWORD),
    timezone: TZ,
    privacy: 'busy_only_to_managers',
  }).returning();
  console.log(`  user created: ${u.email}`);
  return u;
}

// ─── 2. Categories ─────────────────────────────────────────────────────────
const CATEGORIES = [
  { name: 'Lesson plan',     color: '#8b5cf6' }, // violet
  { name: 'Đi dạy',          color: '#10b981' }, // emerald
  { name: 'Training GV',     color: '#f59e0b' }, // amber
  { name: 'Phỏng vấn GV',    color: '#ec4899' }, // pink
  { name: 'Support GV',      color: '#0ea5e9' }, // sky
  { name: 'Admin daily',     color: '#6366f1' }, // indigo
  { name: 'Tập kịch',        color: '#f43f5e' }, // rose
];

async function seedCategories(userId: string) {
  const rows = await db.insert(categories).values(
    CATEGORIES.map(c => ({ userId, name: c.name, color: c.color })),
  ).returning();
  const byName: Record<string, string> = {};
  for (const r of rows) byName[r.name] = r.id;
  return byName;
}

// ─── 3. Recurring tasks (Thu Thao's 10-item job description) ───────────────
type TaskSeed = {
  title: string;
  description?: string;
  categoryName: string;
  estimatedMinutes: number;
  recurringRule?: {
    freq: 'daily' | 'weekly' | 'monthly';
    byDay?: string[];
    interval?: number;
    defaultTime?: string;
    defaultDurationMinutes?: number;
  } | null;
  priority?: number;
};

const TASK_SEEDS: TaskSeed[] = [
  {
    title: 'Sắp xếp lịch dạy + notify Ms. Minh',
    description: 'Daily 9:00-9:30. Báo lịch đổi lớp của GV cho Minh.',
    categoryName: 'Admin daily',
    estimatedMinutes: 30,
    recurringRule: {
      freq: 'weekly', byDay: ['MO', 'TU', 'WE', 'TH', 'FR'],
      defaultTime: '09:00', defaultDurationMinutes: 30,
    },
    priority: 1,
  },
  {
    title: 'Đi dạy ở Little people',
    description: 'Chiều thứ 4 và thứ 6. 12:45-16:00.',
    categoryName: 'Đi dạy',
    estimatedMinutes: 210,
    recurringRule: {
      freq: 'weekly', byDay: ['WE', 'FR'],
      defaultTime: '12:45', defaultDurationMinutes: 195,
    },
    priority: 1,
  },
  {
    title: 'Tập kịch',
    description: '16:00-16:30 sau giờ dạy (T4, T6).',
    categoryName: 'Tập kịch',
    estimatedMinutes: 30,
    recurringRule: {
      freq: 'weekly', byDay: ['WE', 'FR'],
      defaultTime: '16:00', defaultDurationMinutes: 30,
    },
    priority: 2,
  },
  {
    title: 'Viết lesson plan (1 bài)',
    description: '4 tiếng/bài, 5 bài/tuần. Lập riêng từng bài.',
    categoryName: 'Lesson plan',
    estimatedMinutes: 240,
    priority: 2,
  },
  {
    title: 'Training GV',
    description: 'Lịch không cố định, phụ thuộc có tuyển được GV và lịch trống của GV.',
    categoryName: 'Training GV',
    estimatedMinutes: 120,
    priority: 3,
  },
  {
    title: 'Phỏng vấn GV',
    description: '1 tiếng / người. Thường chiều T3 hoặc T5: 14-17h.',
    categoryName: 'Phỏng vấn GV',
    estimatedMinutes: 60,
    priority: 3,
  },
  {
    title: 'Support + Feedback GV',
    description: 'GV mới: 4 buổi đầu. GV cũ: 1-2 buổi nếu cần. Mỗi buổi 3,5h. Input lịch dạy tất cả centers.',
    categoryName: 'Support GV',
    estimatedMinutes: 210,
    priority: 3,
  },
  {
    title: 'Check học cụ (xử lý vấn đề)',
    description: 'GV check giáo cụ buổi liền trước và báo cáo. 30p nếu phát sinh.',
    categoryName: 'Support GV',
    estimatedMinutes: 30,
    priority: 4,
  },
  {
    title: 'Trực điện thoại / GV gặp khó khăn',
    description: '24/7 — vấn đề phát sinh bất kỳ lúc nào.',
    categoryName: 'Support GV',
    estimatedMinutes: 30,
    priority: 4,
  },
  {
    title: 'Sắp xếp GV cover lớp',
    description: 'Ad-hoc khi cần cover.',
    categoryName: 'Admin daily',
    estimatedMinutes: 30,
    priority: 3,
  },
];

async function seedTasks(userId: string, catIds: Record<string, string>) {
  const rows = await db.insert(tasks).values(
    TASK_SEEDS.map(t => ({
      userId,
      categoryId: catIds[t.categoryName],
      title: t.title,
      description: t.description ?? null,
      estimatedMinutes: t.estimatedMinutes,
      recurringRule: t.recurringRule ?? null,
      priority: t.priority ?? 3,
      status: 'todo' as const,
    })),
  ).returning();
  const byTitle: Record<string, string> = {};
  for (const r of rows) byTitle[r.title] = r.id;
  return byTitle;
}

// ─── 4. Concrete blocks for week 2026-05-11..15 ────────────────────────────
function isoAt(dateStr: string, hhmm: string): Date {
  // dateStr is yyyy-MM-dd in Asia/Bangkok (+07). Build UTC by subtracting 7h.
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh - 7, mm, 0));
}

type Block = { date: string; start: string; end: string; title: string; taskTitle?: string };

const WEEK_BLOCKS: Block[] = [
  // MON 11
  { date: '2026-05-11', start: '09:00', end: '09:30', title: 'Sắp xếp lịch dạy + notify Ms. Minh', taskTitle: 'Sắp xếp lịch dạy + notify Ms. Minh' },
  { date: '2026-05-11', start: '09:30', end: '12:00', title: 'Soạn Lesson plan 1' },
  { date: '2026-05-11', start: '12:30', end: '14:00', title: 'Soạn tiếp Lesson plan 1' },
  { date: '2026-05-11', start: '14:00', end: '18:00', title: 'Soạn Lesson plan 2' },

  // TUE 12
  { date: '2026-05-12', start: '09:00', end: '09:30', title: 'Sắp xếp lịch dạy + notify Ms. Minh', taskTitle: 'Sắp xếp lịch dạy + notify Ms. Minh' },
  { date: '2026-05-12', start: '09:30', end: '12:00', title: 'Soạn Lesson plan 3' },
  { date: '2026-05-12', start: '12:30', end: '14:00', title: 'Soạn tiếp Lesson plan 3' },
  { date: '2026-05-12', start: '14:00', end: '18:00', title: 'Xử lý tasks phát sinh (PV/Training/Support)' },

  // WED 13
  { date: '2026-05-13', start: '09:00', end: '09:30', title: 'Sắp xếp lịch dạy + notify Ms. Minh', taskTitle: 'Sắp xếp lịch dạy + notify Ms. Minh' },
  { date: '2026-05-13', start: '09:30', end: '12:00', title: 'Soạn 1/2 Lesson plan 4' },
  { date: '2026-05-13', start: '12:45', end: '16:00', title: 'Đi dạy ở Little people', taskTitle: 'Đi dạy ở Little people' },
  { date: '2026-05-13', start: '16:00', end: '16:30', title: 'Tập kịch', taskTitle: 'Tập kịch' },

  // THU 14
  { date: '2026-05-14', start: '09:00', end: '09:30', title: 'Sắp xếp lịch dạy + notify Ms. Minh', taskTitle: 'Sắp xếp lịch dạy + notify Ms. Minh' },
  { date: '2026-05-14', start: '09:30', end: '12:00', title: 'Soạn Lesson plan 5' },
  { date: '2026-05-14', start: '12:30', end: '14:00', title: 'Soạn tiếp Lesson plan 5' },
  { date: '2026-05-14', start: '14:00', end: '17:00', title: 'Xử lý tasks phát sinh (PV/Training/Support)' },

  // FRI 15
  { date: '2026-05-15', start: '09:00', end: '09:30', title: 'Sắp xếp lịch dạy + notify Ms. Minh', taskTitle: 'Sắp xếp lịch dạy + notify Ms. Minh' },
  { date: '2026-05-15', start: '09:30', end: '12:00', title: 'Soạn tiếp LP4 + Review 5 lesson plans' },
  { date: '2026-05-15', start: '12:45', end: '16:00', title: 'Đi dạy ở Little people', taskTitle: 'Đi dạy ở Little people' },
  { date: '2026-05-15', start: '16:00', end: '16:30', title: 'Tập kịch', taskTitle: 'Tập kịch' },
];

async function seedBlocks(userId: string, taskIds: Record<string, string>) {
  const rows = WEEK_BLOCKS.map(b => ({
    userId,
    taskId: b.taskTitle ? taskIds[b.taskTitle] ?? null : null,
    title: b.title,
    startAt: isoAt(b.date, b.start),
    endAt: isoAt(b.date, b.end),
    status: 'planned' as const,
  }));
  // Use onConflictDoNothing because daily-recurring tasks would conflict on
  // (taskId, startAt) when the materializer next runs — pre-seeding is safe.
  await db.insert(timeBlocks).values(rows).onConflictDoNothing();
  console.log(`  inserted ${rows.length} time blocks for week of 2026-05-11`);
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set. Put it in .env.local or export it.');
    process.exit(1);
  }
  console.log('Seeding Thu Thao planner…');
  const user = await upsertUser();
  const cats = await seedCategories(user.id);
  console.log(`  ${Object.keys(cats).length} categories created`);
  const tasksByTitle = await seedTasks(user.id, cats);
  console.log(`  ${Object.keys(tasksByTitle).length} tasks created`);
  await seedBlocks(user.id, tasksByTitle);

  console.log('\nDone. Login credentials:');
  console.log(`  email:    ${EMAIL}`);
  console.log(`  password: ${PASSWORD}`);
  console.log('\nNote: weekly recurring tasks will auto-materialize for future weeks');
  console.log('the first time the user requests the time-blocks API.');
}

main().catch(e => { console.error(e); process.exit(1); });
