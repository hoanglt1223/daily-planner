import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, Circle, Maximize2, Minimize2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: number;
  blockedByTaskIds: string[];
  dueDate: string | null;
}

interface DependencyGraphProps {
  tasks: Task[];
  onTaskClick?: (taskId: string) => void;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

interface Node {
  id: string;
  task: Task;
  x: number;
  y: number;
  level: number;
}

interface Edge {
  from: string;
  to: string;
}

export function DependencyGraph({ tasks, onTaskClick, fullscreen = false, onToggleFullscreen }: DependencyGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  // Filter tasks that have dependencies or are being depended on
  const relevantTasks = useMemo(() => {
    const taskIds = new Set<string>();
    tasks.forEach(t => {
      if (t.blockedByTaskIds && t.blockedByTaskIds.length > 0) {
        taskIds.add(t.id);
        t.blockedByTaskIds.forEach(id => taskIds.add(id));
      }
    });
    return tasks.filter(t => taskIds.has(t.id));
  }, [tasks]);

  // Calculate nodes and edges
  const { nodes, edges, criticalPath } = useMemo(() => {
    if (relevantTasks.length === 0) return { nodes: [], edges: [], criticalPath: new Set<string>() };

    // Build adjacency list
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    relevantTasks.forEach(t => {
      inDegree.set(t.id, 0);
      adjacency.set(t.id, []);
    });

    relevantTasks.forEach(t => {
      if (t.blockedByTaskIds) {
        t.blockedByTaskIds.forEach(blockerId => {
          if (adjacency.has(blockerId)) {
            adjacency.get(blockerId)!.push(t.id);
            inDegree.set(t.id, (inDegree.get(t.id) || 0) + 1);
          }
        });
      }
    });

    // Topological sort with levels
    const levels = new Map<string, number>();
    const queue: string[] = [];

    inDegree.forEach((degree, taskId) => {
      if (degree === 0) {
        queue.push(taskId);
        levels.set(taskId, 0);
      }
    });

    let maxLevel = 0;
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentLevel = levels.get(currentId) ?? 0;
      maxLevel = Math.max(maxLevel, currentLevel);

      const neighbors = adjacency.get(currentId) ?? [];
      neighbors.forEach(neighborId => {
        const newLevel = currentLevel + 1;
        if (!levels.has(neighborId) || levels.get(neighborId)! < newLevel) {
          levels.set(neighborId, newLevel);
        }
        const newDegree = (inDegree.get(neighborId) ?? 0) - 1;
        inDegree.set(neighborId, newDegree);
        if (newDegree === 0) {
          queue.push(neighborId);
        }
      });
    }

    // Position nodes using levels
    const levelGroups = new Map<number, string[]>();
    levels.forEach((level, taskId) => {
      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level)!.push(taskId);
    });

    const nodes: Node[] = [];
    const nodeWidth = 180;
    const nodeHeight = 60;
    const horizontalGap = 80;
    const verticalGap = 100;

    const width = Math.max(800, (maxLevel + 1) * (nodeWidth + horizontalGap) + horizontalGap);

    levelGroups.forEach((taskIdsInLevel, level) => {
      taskIdsInLevel.forEach((taskId, index) => {
        const task = relevantTasks.find(t => t.id === taskId)!;
        const x = horizontalGap + level * (nodeWidth + horizontalGap);
        const y = verticalGap + index * (nodeHeight + verticalGap);
        nodes.push({ id: taskId, task, x, y, level });
      });
    });

    // Build edges
    const edges: Edge[] = [];
    relevantTasks.forEach(t => {
      if (t.blockedByTaskIds) {
        t.blockedByTaskIds.forEach(blockerId => {
          const fromNode = nodes.find(n => n.id === blockerId);
          const toNode = nodes.find(n => n.id === t.id);
          if (fromNode && toNode) {
            edges.push({ from: blockerId, to: t.id });
          }
        });
      }
    });

    // Calculate critical path (longest path)
    const criticalPath = new Set<string>();
    const longestPath = new Map<string, number>();

    nodes.forEach(node => {
      longestPath.set(node.id, 0);
    });

    // Process in topological order
    const sortedNodes = [...nodes].sort((a, b) => a.level - b.level);
    sortedNodes.forEach(node => {
      const incomingEdges = edges.filter(e => e.to === node.id);
      let maxLen = 0;
      incomingEdges.forEach(edge => {
        const edgeLen = (longestPath.get(edge.from) ?? 0) + 1;
        maxLen = Math.max(maxLen, edgeLen);
      });
      longestPath.set(node.id, maxLen);
    });

    // Find nodes on critical path
    const maxPathLength = Math.max(...longestPath.values());
    let currentMax = maxPathLength;

    // Backtrack from nodes with max path length
    sortedNodes.reverse().forEach(node => {
      if (longestPath.get(node.id) === currentMax) {
        criticalPath.add(node.id);
        // Find predecessor
        const incomingEdges = edges.filter(e => e.to === node.id);
        incomingEdges.forEach(edge => {
          if (longestPath.get(edge.from) === currentMax - 1) {
            currentMax--;
            criticalPath.add(edge.from);
          }
        });
      }
    });

    setDimensions({ width, height: Math.max(500, nodes.length * 80 + 100) });

    return { nodes, edges, criticalPath };
  }, [relevantTasks]);

  // Get node color based on status
  const getNodeColor = (task: Task) => {
    const isCritical = criticalPath.has(task.id);
    const isHovered = hoveredNode === task.id;
    const isRelated = hoveredNode && (
      task.id === hoveredNode ||
      task.blockedByTaskIds?.includes(hoveredNode) ||
      (relevantTasks.find(t => t.id === hoveredNode)?.blockedByTaskIds?.includes(task.id))
    );

    if (task.status === 'done') return '#10b981';
    if (task.status === 'doing') return '#f59e0b';
    if (task.status === 'archived') return '#94a3b8';
    if (isCritical) return '#ef4444';
    if (isHovered) return '#3b82f6';
    if (isRelated) return '#8b5cf6';
    return '#6366f1';
  };

  if (relevantTasks.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-10 text-center">
          <Circle className="size-12 text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium">No dependencies found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Tasks with dependencies will appear here
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(fullscreen && 'fixed inset-4 z-50') }>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="size-4" />
              Task Dependencies
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {nodes.length} tasks · {edges.length} dependencies · {criticalPath.size} on critical path
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onToggleFullscreen}
          >
            {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200">
              <div className="size-2 rounded-full bg-red-500 mr-1.5" />
              Critical path
            </Badge>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
              <div className="size-2 rounded-full bg-emerald-500 mr-1.5" />
              Done
            </Badge>
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200">
              <div className="size-2 rounded-full bg-amber-500 mr-1.5" />
              In progress
            </Badge>
            <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 border-indigo-200">
              <div className="size-2 rounded-full bg-indigo-500 mr-1.5" />
              Normal
            </Badge>
          </div>
        </div>

        <div className="overflow-auto rounded-lg border bg-background" style={{ maxHeight: fullscreen ? 'calc(100vh - 200px)' : '600px' }}>
          <svg
            ref={svgRef}
            width={dimensions.width}
            height={dimensions.height}
            className="block"
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <polygon d="M0,0 L0,6 L9,3 z" fill="#94a3b8" />
              </marker>
              <marker
                id="arrowhead-critical"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <polygon d="M0,0 L0,6 L9,3 z" fill="#ef4444" />
              </marker>
            </defs>

            {/* Draw edges */}
            {edges.map((edge) => {
              const fromNode = nodes.find(n => n.id === edge.from);
              const toNode = nodes.find(n => n.id === edge.to);
              if (!fromNode || !toNode) return null;

              const isCritical = criticalPath.has(edge.from) && criticalPath.has(edge.to);
              const isHighlighted = hoveredNode && (
                edge.from === hoveredNode || edge.to === hoveredNode
              );

              const fromX = fromNode.x + 90;
              const fromY = fromNode.y + 30;
              const toX = toNode.x + 90;
              const toY = toNode.y + 30;

              // Calculate path with curvature
              const midX = (fromX + toX) / 2;
              const path = `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;

              return (
                <path
                  key={`${edge.from}-${edge.to}`}
                  d={path}
                  stroke={isCritical ? '#ef4444' : isHighlighted ? '#8b5cf6' : '#cbd5e1'}
                  strokeWidth={isCritical ? 3 : isHighlighted ? 2 : 1.5}
                  fill="none"
                  markerEnd={`url(#${isCritical ? 'arrowhead-critical' : 'arrowhead'})`}
                  opacity={hoveredNode && !isHighlighted ? 0.3 : 1}
                  className="transition-all"
                />
              );
            })}

            {/* Draw nodes */}
            {nodes.map((node) => {
              const color = getNodeColor(node.task);
              const isHovered = hoveredNode === node.id;

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => onTaskClick?.(node.id)}
                  opacity={hoveredNode && !(
                    node.id === hoveredNode ||
                    node.task.blockedByTaskIds?.includes(hoveredNode) ||
                    relevantTasks.find(t => t.id === hoveredNode)?.blockedByTaskIds?.includes(node.id)
                  ) ? 0.3 : 1}
                >
                  {/* Node background */}
                  <rect
                    width={180}
                    height={60}
                    rx={8}
                    fill={color}
                    className={cn(
                      'transition-all',
                      isHovered && 'filter brightness-110'
                    )}
                  />

                  {/* Task title */}
                  <text
                    x={10}
                    y={20}
                    className="fill-white text-xs font-medium pointer-events-none"
                    style={{ fontSize: '11px', fontWeight: 600 }}
                  >
                    {node.task.title.length > 18
                      ? node.task.title.substring(0, 18) + '...'
                      : node.task.title}
                  </text>

                  {/* Status and priority */}
                  <text
                    x={10}
                    y={40}
                    className="fill-white/80 text-[10px] pointer-events-none"
                    style={{ fontSize: '9px' }}
                  >
                    {node.task.status} · P{node.task.priority}
                  </text>

                  {/* Blocked count */}
                  {node.task.blockedByTaskIds && node.task.blockedByTaskIds.length > 0 && (
                    <g transform="translate(150, 35)">
                      <circle r={10} fill="rgba(0,0,0,0.2)" />
                      <text
                        x={0}
                        y={3}
                        className="fill-white text-[9px] font-bold text-center pointer-events-none"
                        style={{ fontSize: '9px', fontWeight: 'bold' }}
                        textAnchor="middle"
                      >
                        {node.task.blockedByTaskIds.length}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}