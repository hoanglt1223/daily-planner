import { useEffect, useState } from 'react';
import { notificationService, type TaskReminder } from '@/lib/notifications';

interface Task {
  id: string;
  title: string;
  dueDate: string | null;
  reminderEnabled: boolean;
  reminderMinutes: number | null;
}

export function useTaskReminders(tasks: Task[]) {
  const [isMonitoring, setIsMonitoring] = useState(false);

  useEffect(() => {
    // Get tasks with reminders enabled and due dates
    const tasksWithReminders = tasks.filter(
      (task) => task.reminderEnabled && task.dueDate && task.reminderMinutes !== null
    );

    if (tasksWithReminders.length === 0) {
      notificationService.stopChecking();
      setIsMonitoring(false);
      return;
    }

    // Check if notifications are supported and permitted
    const { granted, denied } = notificationService.getPermission();

    if (denied) {
      setIsMonitoring(false);
      return;
    }

    if (!granted) {
      // Request permission
      notificationService.requestPermission().then((permission) => {
        if (permission.granted) {
          startMonitoring(tasksWithReminders);
        }
      });
    } else {
      startMonitoring(tasksWithReminders);
    }

    return () => {
      notificationService.stopChecking();
    };
  }, [tasks]);

  const startMonitoring = (tasksWithReminders: Task[]) => {
    setIsMonitoring(true);

    notificationService.startChecking(() => {
      const now = Date.now();
      const reminders: TaskReminder[] = [];

      for (const task of tasksWithReminders) {
        if (!task.dueDate || task.reminderMinutes === null) continue;

        const dueTime = new Date(task.dueDate).getTime();
        const reminderTime = dueTime - (task.reminderMinutes * 60 * 1000);

        // Check if we're within 1 minute of the reminder time
        if (Math.abs(now - reminderTime) < 60000) {
          reminders.push({
            taskId: task.id,
            title: task.title,
            dueDate: new Date(task.dueDate),
            reminderMinutes: task.reminderMinutes,
          });
        }
      }

      return reminders;
    });
  };

  const requestPermission = async () => {
    return await notificationService.requestPermission();
  };

  const getPermission = () => {
    return notificationService.getPermission();
  };

  return {
    isMonitoring,
    requestPermission,
    getPermission,
  };
}
