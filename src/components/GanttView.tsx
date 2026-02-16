import { useRef, useEffect, useMemo } from 'react';
import { GrantCall } from '../lib/supabase';
import { DataSet } from 'vis-data';
import { Timeline } from 'vis-timeline/standalone';
import 'vis-timeline/styles/vis-timeline-graph2d.min.css';

interface Props {
  calls: GrantCall[];
  onSelect: (id: string) => void;
}

export function GanttView({ calls, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<Timeline | null>(null);

  // Only calls with announced_at
  const ganttCalls = useMemo(() => {
    return calls.filter(c => c.announced_at);
  }, [calls]);

  // Color by source
  const sourceColors: Record<string, string> = useMemo(() => {
    const colors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
      '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
      '#14b8a6', '#e11d48', '#0ea5e9', '#a855f7', '#22c55e',
    ];
    const sources = [...new Set(ganttCalls.map(c => c.source))].sort();
    const map: Record<string, string> = {};
    sources.forEach((s, i) => { map[s] = colors[i % colors.length]; });
    return map;
  }, [ganttCalls]);

  useEffect(() => {
    if (!containerRef.current || ganttCalls.length === 0) return;

    const endOfYear = new Date(new Date().getFullYear(), 11, 31).toISOString().slice(0, 10);

    const groupNames = [...new Set(ganttCalls.map(c => c.source))].sort();
    const groups = new DataSet(
      groupNames.map(name => ({
        id: name,
        content: name,
        style: 'font-size: 12px; font-weight: 600;',
      }))
    );

    // Add group to items
    const itemsWithGroups = new DataSet(
      ganttCalls.map(c => ({
        id: c.id,
        group: c.source,
        content: c.title.length > 50 ? c.title.slice(0, 47) + '...' : c.title,
        start: c.announced_at!,
        end: c.deadline_at || endOfYear,
        title: `${c.title}\n${c.source}\nOd: ${c.announced_at}\nDo: ${c.deadline_at || 'koniec roka'}`,
        style: `background-color: ${sourceColors[c.source] || '#888'}; color: white; border: none; border-radius: 3px; font-size: 11px;`,
      }))
    );

    const options = {
      stack: true,
      zoomMin: 1000 * 60 * 60 * 24 * 7,      // 1 week
      zoomMax: 1000 * 60 * 60 * 24 * 365 * 2, // 2 years
      start: new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      end: new Date(new Date().getTime() + 180 * 24 * 60 * 60 * 1000),  // 6 months ahead
      orientation: 'top' as const,
      margin: { item: 2 },
      tooltip: { followMouse: true },
      horizontalScroll: true,
      zoomKey: 'ctrlKey' as const,
    };

    if (timelineRef.current) {
      timelineRef.current.destroy();
    }

    const timeline = new Timeline(containerRef.current, itemsWithGroups, groups, options);
    timeline.on('select', (props: { items: string[] }) => {
      if (props.items.length > 0) {
        onSelect(props.items[0]);
      }
    });

    timelineRef.current = timeline;

    return () => {
      if (timelineRef.current) {
        timelineRef.current.destroy();
        timelineRef.current = null;
      }
    };
  }, [ganttCalls, sourceColors, onSelect]);

  return (
    <div className="gantt-view">
      <div className="gantt-info">
        <span>📊 {ganttCalls.length} výziev s dátumom vyhlásenia</span>
        <span className="gantt-hint">Ctrl + kolečko myši = zoom | Ťahanie = posúvanie</span>
      </div>
      <div className="gantt-legend">
        {Object.entries(sourceColors).map(([src, color]) => (
          <span key={src} className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: color }} />
            {src}
          </span>
        ))}
      </div>
      <div ref={containerRef} className="timeline-container" />
    </div>
  );
}
