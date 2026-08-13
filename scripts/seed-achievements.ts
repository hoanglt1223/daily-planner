import { db } from '../server/lib/db/client.js';
import { achievements } from '../server/lib/db/schema.js';
import { nanoid } from 'nanoid';

const ACHIEVEMENTS = [
  // Productivity achievements
  {
    id: nanoid(),
    slug: 'first-focus',
    name: 'First Focus',
    description: 'Complete your first focus session',
    icon: '🎯',
    color: '#3b82f6',
    category: 'productivity',
    requirement: { type: 'count', field: 'completedSessions', target: 1, period: 'ever' },
    points: 10,
    isSecret: false,
  },
  {
    id: nanoid(),
    slug: 'task-master',
    name: 'Task Master',
    description: 'Complete 50 tasks',
    icon: '💪',
    color: '#8b5cf6',
    category: 'productivity',
    requirement: { type: 'count', field: 'completedTasks', target: 50, period: 'ever' },
    points: 50,
    isSecret: false,
  },
  {
    id: nanoid(),
    slug: 'time-lord',
    name: 'Time Lord',
    description: 'Complete 10 hours of focused work',
    icon: '⏱️',
    color: '#f59e0b',
    category: 'productivity',
    requirement: { type: 'total', field: 'totalFocusMinutes', target: 10, period: 'ever' },
    points: 30,
    isSecret: false,
  },
  {
    id: nanoid(),
    slug: 'priority-pro',
    name: 'Priority Pro',
    description: 'Complete 10 high-priority tasks',
    icon: '🏆',
    color: '#ef4444',
    category: 'productivity',
    requirement: { type: 'count', field: 'highPriorityTasks', target: 10, period: 'ever' },
    points: 40,
    isSecret: false,
  },

  // Consistency achievements
  {
    id: nanoid(),
    slug: 'week-warrior',
    name: 'Week Warrior',
    description: 'Maintain a 7-day activity streak',
    icon: '🔥',
    color: '#f97316',
    category: 'consistency',
    requirement: { type: 'streak', field: 'dailyStreak', target: 7, period: 'ever' },
    points: 25,
    isSecret: false,
  },
  {
    id: nanoid(),
    slug: 'monthly-master',
    name: 'Monthly Master',
    description: 'Maintain a 30-day activity streak',
    icon: '💎',
    color: '#ec4899',
    category: 'consistency',
    requirement: { type: 'streak', field: 'dailyStreak', target: 30, period: 'ever' },
    points: 100,
    isSecret: false,
  },
  {
    id: nanoid(),
    slug: 'habit-hero',
    name: 'Habit Hero',
    description: 'Complete 100 habit entries',
    icon: '📅',
    color: '#14b8a6',
    category: 'consistency',
    requirement: { type: 'count', field: 'habitsCompleted', target: 100, period: 'ever' },
    points: 35,
    isSecret: false,
  },

  // Milestone achievements
  {
    id: nanoid(),
    slug: 'perfect-planner',
    name: 'Perfect Planner',
    description: 'Fill all 7 days of a week with tasks',
    icon: '📅',
    color: '#06b6d4',
    category: 'milestones',
    requirement: { type: 'count', field: 'weeklyCompletion', target: 7, period: 'week' },
    points: 45,
    isSecret: false,
  },
  {
    id: nanoid(),
    slug: 'rising-star',
    name: 'Rising Star',
    description: 'Complete 5 tasks in one day',
    icon: '🌟',
    color: '#eab308',
    category: 'milestones',
    requirement: { type: 'count', field: 'completedTasks', target: 5, period: 'day' },
    points: 15,
    isSecret: false,
  },
  {
    id: nanoid(),
    slug: 'estimation-expert',
    name: 'Estimation Expert',
    description: 'Maintain 80%+ estimation accuracy',
    icon: '🎯',
    color: '#10b981',
    category: 'milestones',
    requirement: { type: 'accuracy', field: 'estimationAccuracy', target: 80, period: 'ever' },
    points: 60,
    isSecret: false,
  },

  // Special achievements
  {
    id: nanoid(),
    slug: 'century-club',
    name: 'Century Club',
    description: 'Complete 100 tasks total',
    icon: '💯',
    color: '#f43f5e',
    category: 'special',
    requirement: { type: 'count', field: 'completedTasks', target: 100, period: 'ever' },
    points: 150,
    isSecret: false,
  },
  {
    id: nanoid(),
    slug: 'marathon-runner',
    name: 'Marathon Runner',
    description: 'Complete 50 hours of focused work',
    icon: '🏃',
    color: '#3b82f6',
    category: 'special',
    requirement: { type: 'total', field: 'totalFocusMinutes', target: 50, period: 'ever' },
    points: 200,
    isSecret: false,
  },
  {
    id: nanoid(),
    slug: 'early-bird',
    name: 'Early Bird',
    description: 'Complete 25 tasks before 9 AM',
    icon: '🐦',
    color: '#fbbf24',
    category: 'special',
    requirement: { type: 'count', field: 'completedTasks', target: 25, period: 'ever' },
    points: 75,
    isSecret: true,
  },
];

async function seedAchievements() {
  console.log('Seeding achievements...');

  for (const achievement of ACHIEVEMENTS) {
    await db.insert(achievements).values(achievement).onConflictDoNothing();
    console.log(`✅ Seeded: ${achievement.name}`);
  }

  console.log('Achievement seeding complete!');
  process.exit(0);
}

seedAchievements().catch(console.error);