import { useNavigate } from 'react-router-dom';
import { Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Task {
  id: string;
  title: string;
  description: string | null;
  estimatedMinutes: number;
  priority: number;
}

interface FocusModeButtonProps {
  task: Task;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function FocusModeButton({
  task,
  variant = 'outline',
  size = 'sm',
  className = ''
}: FocusModeButtonProps) {
  const navigate = useNavigate();

  const enterFocusMode = () => {
    localStorage.setItem('focusTask', JSON.stringify(task));
    navigate('/focus');
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={enterFocusMode}
      className={className}
    >
      <Maximize2 className="size-4 mr-2" />
      Focus
    </Button>
  );
}
