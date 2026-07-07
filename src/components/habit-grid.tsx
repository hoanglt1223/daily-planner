import { cn } from '@/lib/utils';

interface HabitEntry {
  id: string;
  entryDate: string;
  completed: boolean;
  note: string | null;
}

interface Habit {
  id: string;
  name: string;
  description: string | null;
  frequency: 'daily' | 'weekly';
  targetDays: number[];
  color: string;
  icon: string;
  targetPerPeriod: number;
  entries: HabitEntry[];
  createdAt: string;
  updatedAt: string;
}

interface HabitGridProps {
  habit: Habit;
  onToggle: (date: Date, completed: boolean, note?: string) => void;
  onNoteClick?: (date: Date, note: string) => void;
  days?: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function HabitGrid({ habit, onToggle, onNoteClick, days = 30 }: HabitGridProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const gridData = [];
  const entriesByDate = new Map<string, HabitEntry>();

  habit.entries.forEach(entry => {
    const dateKey = new Date(entry.entryDate).toISOString().split('T')[0];
    entriesByDate.set(dateKey, entry);
  });

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const dateKey = date.toISOString().split('T')[0];
    const entry = entriesByDate.get(dateKey);
    const isCompleted = entry?.completed || false;
    const hasNote = entry?.note;

    gridData.push({
      date,
      isCompleted,
      hasNote: Boolean(hasNote),
      note: hasNote ? entry.note : null,
      dayOfWeek: date.getDay(),
    });
  }

  const totalCompleted = gridData.filter(d => d.isCompleted).length;
  const currentStreak = calculateCurrentStreak(gridData, today);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {totalCompleted} / {days} completed
        </span>
        {currentStreak > 0 && (
          <span className="text-emerald-600 font-medium">
            🔥 {currentStreak} day streak
          </span>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map(day => (
          <div key={day} className="text-xs text-center text-muted-foreground py-1">
            {day}
          </div>
        ))}

        {gridData.map((dayData, index) => {
          const isToday = dayData.date.getTime() === today.getTime();

          return (
            <button
              key={index}
              onClick={() => onToggle(dayData.date, !dayData.isCompleted)}
              onDoubleClick={() => dayData.hasNote && onNoteClick?.(dayData.date, dayData.note!)}
              className={cn(
                'aspect-square rounded-md transition-all hover:scale-105 flex items-center justify-center relative',
                isToday && 'ring-2 ring-primary',
                !dayData.isCompleted && 'bg-muted/30 hover:bg-muted',
                dayData.isCompleted && 'hover:opacity-80'
              )}
              style={{
                backgroundColor: dayData.isCompleted ? habit.color : undefined,
              }}
              title={dayData.date.toLocaleDateString() + (dayData.note ? `\n${dayData.note}` : '')}
            >
              {dayData.isCompleted && (
                <span className="text-white text-xs font-bold">{habit.icon}</span>
              )}
              {dayData.hasNote && !dayData.isCompleted && (
                <span className="absolute bottom-0 right-0 w-2 h-2 bg-blue-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {onNoteClick && (
        <p className="text-xs text-muted-foreground">
          Double-click a day with a dot (•) to edit notes
        </p>
      )}
    </div>
  );
}

function calculateCurrentStreak(gridData: Array<{ date: Date; isCompleted: boolean }>, today: Date): number {
  let streak = 0;
  const todayKey = today.toISOString().split('T')[0];

  for (let i = gridData.length - 1; i >= 0; i--) {
    const day = gridData[i];
    if (day.isCompleted) {
      streak++;
    } else {
      const dayKey = day.date.toISOString().split('T')[0];
      if (dayKey !== todayKey) {
        break;
      }
    }
  }

  return streak;
}
