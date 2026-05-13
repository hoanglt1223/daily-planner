import { PlannerGrid } from '@/components/planner/planner-grid';

export function PlannerPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Planner</h1>
        <p className="text-sm text-muted-foreground">
          Click an empty slot to create. Drag across slots for a longer block. Drag blocks to move. Click a block to edit.
        </p>
      </div>
      <PlannerGrid />
    </div>
  );
}
