import { useState } from 'react';
import { FileText, Star, Clock, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api-client';

interface Template {
  id: string;
  name: string;
  description: string | null;
  defaultCategoryId: string | null;
  defaultTitle: string;
  defaultDescription: string | null;
  defaultEstimatedMinutes: number;
  defaultPriority: number;
  defaultStatus: string;
  defaultLabels: string[];
  defaultSubtasks: Array<{ id: string; title: string; done: boolean }>;
  defaultRecurringRule: {
    freq: 'daily' | 'weekly' | 'monthly';
    byDay?: string[];
    interval?: number;
    until?: string;
    defaultTime?: string;
    defaultDurationMinutes?: number;
  } | null;
  isPinned: boolean;
}

interface TemplateSelectorProps {
  onSelect: (template: Template) => void;
  className?: string;
}

export function TemplateSelector({ onSelect, className }: TemplateSelectorProps) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);

  const loadTemplates = async () => {
    if (templates.length > 0) return;
    setLoading(true);
    try {
      const data = await apiFetch<Template[]>('/api/templates');
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const pinned = templates.filter(t => t.isPinned);
  const regular = templates.filter(t => !t.isPinned);

  const handleSelect = (template: Template) => {
    onSelect(template);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('gap-2', className)}
          onClick={() => { if (!open) loadTemplates(); }}
        >
          <FileText className="size-3.5" />
          Templates
          <ChevronDown className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <ScrollArea className="max-h-80">
          <div className="p-2 space-y-1">
            {loading ? (
              <div className="px-2 py-4 text-sm text-center text-muted-foreground">
                Loading templates...
              </div>
            ) : templates.length === 0 ? (
              <div className="px-2 py-4 text-sm text-center text-muted-foreground">
                No templates yet. Create one in Settings.
              </div>
            ) : (
              <>
                {pinned.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                      Pinned
                    </div>
                    {pinned.map(template => (
                      <TemplateItem
                        key={template.id}
                        template={template}
                        onSelect={handleSelect}
                      />
                    ))}
                  </>
                )}
                {regular.length > 0 && pinned.length > 0 && (
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                    All Templates
                  </div>
                )}
                {regular.map(template => (
                  <TemplateItem
                    key={template.id}
                    template={template}
                    onSelect={handleSelect}
                  />
                ))}
              </>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

interface TemplateItemProps {
  template: Template;
  onSelect: (template: Template) => void;
}

function TemplateItem({ template, onSelect }: TemplateItemProps) {
  return (
    <button
      onClick={() => onSelect(template)}
      className="w-full text-left hover:bg-accent rounded-md transition-colors"
    >
      <Card className="border-none shadow-none p-2">
        <div className="flex items-start gap-2">
          {template.isPinned && (
            <Star className="size-3 text-yellow-500 mt-0.5 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{template.name}</div>
            {template.description && (
              <div className="text-xs text-muted-foreground truncate mt-0.5">
                {template.description}
              </div>
            )}
            <div className="flex flex-wrap gap-1 mt-1.5">
              <Badge variant="secondary" className="gap-1 text-xs">
                <Clock className="size-2.5" />
                {template.defaultEstimatedMinutes}m
              </Badge>
              {template.defaultPriority > 3 && (
                <Badge variant="secondary" className="text-xs">
                  Priority {template.defaultPriority}
                </Badge>
              )}
              {template.defaultLabels.slice(0, 2).map(label => (
                <Badge key={label} variant="outline" className="text-xs">
                  {label}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </button>
  );
}
