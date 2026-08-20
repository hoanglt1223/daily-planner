import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface FilterPanelProps {
  filters: {
    status: string;
    priority: string;
    category: string;
    dateFrom: string;
    dateTo: string;
    includeCompleted: boolean;
    includeTimeBlocks: boolean;
    includeTasks: boolean;
  };
  onFiltersChange: (filters: FilterPanelProps['filters']) => void;
  onClear: () => void;
}

export function FilterPanel({ filters, onFiltersChange, onClear }: FilterPanelProps) {
  const updateFilter = (key: string, value: string | boolean) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={filters.status}
            onValueChange={(v) => updateFilter('status', v)}
          >
            <SelectTrigger id="status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All statuses</SelectItem>
              <SelectItem value="backlog">Backlog</SelectItem>
              <SelectItem value="todo">Todo</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Select
            value={filters.priority}
            onValueChange={(v) => updateFilter('priority', v)}
          >
            <SelectTrigger id="priority">
              <SelectValue placeholder="All priorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All priorities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            placeholder="Filter by category..."
            value={filters.category}
            onChange={(e) => updateFilter('category', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dateFrom">From date</Label>
          <Input
            id="dateFrom"
            type="date"
            value={filters.dateFrom}
            onChange={(e) => updateFilter('dateFrom', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dateTo">To date</Label>
          <Input
            id="dateTo"
            type="date"
            value={filters.dateTo}
            onChange={(e) => updateFilter('dateTo', e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-4 pt-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="includeTasks"
            checked={filters.includeTasks}
            onCheckedChange={(v) => updateFilter('includeTasks', v === true)}
          />
          <Label htmlFor="includeTasks" className="cursor-pointer">
            Include tasks
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="includeTimeBlocks"
            checked={filters.includeTimeBlocks}
            onCheckedChange={(v) => updateFilter('includeTimeBlocks', v === true)}
          />
          <Label htmlFor="includeTimeBlocks" className="cursor-pointer">
            Include time blocks
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="includeCompleted"
            checked={filters.includeCompleted}
            onCheckedChange={(v) => updateFilter('includeCompleted', v === true)}
          />
          <Label htmlFor="includeCompleted" className="cursor-pointer">
            Include completed
          </Label>
        </div>

        <div className="ml-auto">
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear filters
          </Button>
        </div>
      </div>
    </div>
  );
}
