import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

type ShortcutRow = { keys: string; description: string };

const SECTIONS: Array<{ title: string; items: ShortcutRow[] }> = [
  {
    title: 'Planner',
    items: [
      { keys: 'd', description: 'Switch to day view' },
      { keys: 'w', description: 'Switch to week view' },
      { keys: 'j / ←', description: 'Previous day / week' },
      { keys: 'k / →', description: 'Next day / week' },
      { keys: 't', description: 'Jump to today' },
      { keys: 'n', description: 'New task' },
      { keys: 'f or /', description: 'Focus backlog search' },
    ],
  },
  {
    title: 'Navigation',
    items: [
      { keys: 'g d', description: 'Go to dashboard' },
      { keys: 'g p', description: 'Go to planner' },
      { keys: 'g m', description: 'Go to manager' },
    ],
  },
];

const GLOBAL_ITEMS: ShortcutRow[] = [
  { keys: 'n', description: 'Quick capture task' },
  { keys: '? or Ctrl+/', description: 'Show / hide this help' },
  { keys: 'Escape', description: 'Close any dialog' },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onHelp() { setOpen(o => !o); }
    function onClose() { setOpen(false); }
    document.addEventListener('shortcut:help', onHelp);
    document.addEventListener('shortcut:close-dialogs', onClose);
    return () => {
      document.removeEventListener('shortcut:help', onHelp);
      document.removeEventListener('shortcut:close-dialogs', onClose);
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>Navigate and manage your planner faster.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {SECTIONS.map(section => (
            <div key={section.title}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </p>
              <div className="space-y-1.5">
                {section.items.map(item => (
                  <div key={item.keys} className="flex items-center justify-between text-sm">
                    <div className="flex gap-1">
                      {item.keys.split(' / ').map((k, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && <span className="text-muted-foreground">/</span>}
                          <Kbd>{k}</Kbd>
                        </span>
                      ))}
                    </div>
                    <span className="text-muted-foreground">{item.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="border-t pt-3">
            <div className="space-y-1.5">
              {GLOBAL_ITEMS.map(item => (
                <div key={item.keys} className="flex items-center justify-between text-sm">
                  <div className="flex gap-1">
                    {item.keys.split(' / ').map((k, i) => (
                      <span key={i} className="flex items-center gap-1">
                        {i > 0 && <span className="text-muted-foreground">/</span>}
                        <Kbd>{k}</Kbd>
                      </span>
                    ))}
                  </div>
                  <span className="text-muted-foreground">{item.description}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
