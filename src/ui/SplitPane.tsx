import { useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';

const LAYOUT_KEY = 'mockerrank.layout';

interface Layout {
  // The problem's share of the width, and the results' share of the editor column's height.
  problem: number;
  results: number;
  problemOpen: boolean;
}

const DEFAULT_LAYOUT: Layout = { problem: 5 / 12, results: 0.4, problemOpen: true };

function loadLayout(): Layout {
  try {
    return { ...DEFAULT_LAYOUT, ...JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? '{}') };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

// The coding screen's pane sizes, remembered between problems and visits.
export function useLayout(): [Layout, (change: Partial<Layout>) => void] {
  const [layout, setLayout] = useState(loadLayout);
  const change = (next: Partial<Layout>) =>
    setLayout((current) => {
      const updated = { ...current, ...next };
      try {
        localStorage.setItem(LAYOUT_KEY, JSON.stringify(updated));
      } catch {
        // The sizes still apply for this visit if the browser's storage is full.
      }
      return updated;
    });
  return [layout, change];
}

const MIN = 0.2;
const MAX = 0.8;
const STEP = 0.05;
const clamp = (value: number) => Math.min(MAX, Math.max(MIN, value));

interface DividerProps {
  label: string;
  // 'vertical' sits between side-by-side panes; 'horizontal' between stacked ones.
  orientation: 'vertical' | 'horizontal';
  // The share of the container given to the pane before the divider (vertical), or after it
  // (horizontal), as the results sit below the editor.
  value: number;
  onChange: (value: number) => void;
  container: RefObject<HTMLElement | null>;
  className?: string;
}

// A bar to drag, or to move with the arrow keys, that resizes the panes on either side.
export function Divider({
  label,
  orientation,
  value,
  onChange,
  container,
  className = '',
}: DividerProps) {
  const vertical = orientation === 'vertical';

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || !container.current) return;
    const box = container.current.getBoundingClientRect();
    onChange(
      clamp(
        vertical
          ? (event.clientX - box.left) / box.width
          : (box.bottom - event.clientY) / box.height,
      ),
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Left and up make the pane before the divider smaller, whichever way the divider lies.
    const grow = vertical ? 'ArrowRight' : 'ArrowUp';
    const shrink = vertical ? 'ArrowLeft' : 'ArrowDown';
    const next =
      event.key === grow
        ? value + STEP
        : event.key === shrink
          ? value - STEP
          : event.key === 'Home'
            ? MIN
            : event.key === 'End'
              ? MAX
              : null;
    if (next === null) return;
    event.preventDefault();
    onChange(clamp(next));
  };

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={MIN * 100}
      aria-valuemax={MAX * 100}
      className={`ui-divider shrink-0 touch-none bg-slate-200 hover:bg-emerald-600 focus-visible:bg-emerald-600 focus-visible:outline-none ${
        vertical ? 'w-1.5 cursor-col-resize' : 'h-1.5 cursor-row-resize'
      } ${className}`}
      onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
      onPointerMove={onPointerMove}
      onKeyDown={onKeyDown}
    />
  );
}
