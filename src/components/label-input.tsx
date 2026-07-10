import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface LabelInputProps {
  labels: string[];
  onChange: (labels: string[]) => void;
  availableLabels?: string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export interface LabelInputRef {
  focus: () => void;
}

export const LabelInput = forwardRef<LabelInputRef, LabelInputProps>(
  ({ labels, onChange, availableLabels = [], placeholder = 'Add label...', disabled = false, className }, ref) => {
    const [input, setInput] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
    }));

    const filteredSuggestions = availableLabels.filter(
      label => !labels.includes(label) && label.toLowerCase().includes(input.toLowerCase())
    );

    const addLabel = useCallback((label: string) => {
      const trimmed = label.trim();
      if (trimmed && !labels.includes(trimmed)) {
        onChange([...labels, trimmed]);
      }
      setInput('');
      setShowSuggestions(false);
    }, [labels, onChange]);

    const removeLabel = useCallback((label: string) => {
      onChange(labels.filter(l => l !== label));
    }, [labels, onChange]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (input.trim()) {
          addLabel(input);
        }
      } else if (e.key === 'Backspace' && !input && labels.length > 0) {
        removeLabel(labels[labels.length - 1]);
      }
    }, [input, labels, addLabel, removeLabel]);

    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex flex-wrap gap-2">
          {labels.map(label => (
            <Badge
              key={label}
              variant="secondary"
              className="gap-1.5 pl-2 pr-1.5 h-7"
            >
              <span>{label}</span>
              <button
                type="button"
                onClick={() => removeLabel(label)}
                disabled={disabled}
                className="hover:bg-destructive/20 rounded p-0.5 transition-colors"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          <div className="relative flex-1 min-w-[120px]">
            <Input
              ref={inputRef}
              value={input}
              onChange={e => {
                setInput(e.target.value);
                setShowSuggestions(e.target.value.length > 0);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowSuggestions(input.length > 0)}
              onBlur={() => {
                setTimeout(() => setShowSuggestions(false), 150);
              }}
              placeholder={labels.length === 0 ? placeholder : ''}
              disabled={disabled}
              className="h-7"
            />
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md max-h-32 overflow-y-auto">
                {filteredSuggestions.map(label => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => addLabel(label)}
                    disabled={disabled}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors"
                  >
                    <Plus className="size-3 inline mr-1.5" />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);

LabelInput.displayName = 'LabelInput';
