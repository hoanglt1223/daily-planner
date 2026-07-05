/**
 * Browser notification service for task reminders
 */

export interface NotificationPermission {
  granted: boolean;
  denied: boolean;
  default: boolean;
}

export interface TaskReminder {
  taskId: string;
  title: string;
  dueDate: Date;
  reminderMinutes: number;
}

class NotificationService {
  private isSupported: boolean;
  private checkInterval: number | null = null;

  constructor() {
    this.isSupported = 'Notification' in window;
  }

  /**
   * Get current permission status
   */
  getPermission(): NotificationPermission {
    if (!this.isSupported) {
      return { granted: false, denied: true, default: false };
    }

    const permission = Notification.permission;
    return {
      granted: permission === 'granted',
      denied: permission === 'denied',
      default: permission === 'default',
    };
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported) {
      return { granted: false, denied: true, default: false };
    }

    const permission = await Notification.requestPermission();
    return {
      granted: permission === 'granted',
      denied: permission === 'denied',
      default: permission === 'default',
    };
  }

  /**
   * Show a notification for a task reminder
   */
  show(reminder: TaskReminder): void {
    const { granted, denied } = this.getPermission();

    if (!granted || denied) {
      return;
    }

    const timeUntilDue = reminder.dueDate.getTime() - Date.now();
    const timeText = this.formatTimeUntilDue(timeUntilDue);

    new Notification(`Task Due ${timeText}`, {
      body: reminder.title,
      icon: '/favicon.ico',
      tag: reminder.taskId,
      requireInteraction: true,
    });
  }

  /**
   * Format time until due into human-readable text
   */
  private formatTimeUntilDue(ms: number): string {
    const minutes = Math.floor(ms / 60000);

    if (minutes < 60) {
      return `in ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `in ${hours} hour${hours !== 1 ? 's' : ''}`;
    }

    const days = Math.floor(hours / 24);
    return `in ${days} day${days !== 1 ? 's' : ''}`;
  }

  /**
   * Start checking for task reminders
   * @param checkFunction Function that returns tasks with reminders due
   */
  startChecking(checkFunction: () => TaskReminder[]): void {
    if (this.checkInterval) {
      this.stopChecking();
    }

    // Check every minute for due reminders
    this.checkInterval = window.setInterval(() => {
      const reminders = checkFunction();
      reminders.forEach(reminder => this.show(reminder));
    }, 60000); // Check every minute
  }

  /**
   * Stop checking for task reminders
   */
  stopChecking(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Check if notifications are supported
   */
  isNotificationSupported(): boolean {
    return this.isSupported;
  }
}

// Singleton instance
export const notificationService = new NotificationService();
