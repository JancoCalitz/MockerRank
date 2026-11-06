import { useState } from 'react';

// Chart styling follows one small system: a single accent for data, hairline grid, and text in
// the normal text colours, never the data colour.
// Each theme sets these colours. SVG marks take them through style, where CSS variables work.
const ACCENT = 'var(--chart-accent)';
const TRACK = 'var(--chart-track)';
const GRID = 'var(--chart-grid)';
const TARGET_LINE = 'var(--chart-target)';
const SURFACE = 'var(--chart-surface)';
const TEXT = 'var(--chart-text)';
const TEXT_STRONG = 'var(--chart-text-strong)';

const round = (value: number) => Math.round(value);

interface BarRow {
  label: string;
  percent: number;
  detail?: string;
}

// Thin horizontal bars on a common 0 to 100 scale, with each value printed at the end.
export function PercentBars({ rows, label }: { rows: BarRow[]; label: string }) {
  return (
    <ul aria-label={label} className="space-y-2">
      {rows.map((row) => (
        <li
          key={row.label}
          className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_3rem] items-center gap-3"
        >
          <span className="truncate text-sm" title={row.label}>
            {row.label}
            {row.detail && <span className="ml-1 text-xs text-slate-500">{row.detail}</span>}
          </span>
          <span className="h-2 rounded-full" style={{ background: TRACK }}>
            <span
              className="block h-2 rounded-full"
              style={{ width: `${row.percent}%`, background: ACCENT }}
            />
          </span>
          <span className="text-right text-sm font-semibold tabular-nums">
            {round(row.percent)}%
          </span>
        </li>
      ))}
    </ul>
  );
}

// How far a score is from the target, with the target marked on the track.
export function TargetMeter({ percent, target }: { percent: number; target: number }) {
  return (
    <div
      role="meter"
      aria-label={`Score against the ${target}% target`}
      aria-valuenow={round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="relative mt-5 h-2 rounded-full"
      style={{ background: TRACK }}
    >
      <div className="h-2 rounded-full" style={{ width: `${percent}%`, background: ACCENT }} />
      <div className="absolute -top-1 h-4 w-0.5 bg-slate-900" style={{ left: `${target}%` }} />
      <span
        className="absolute -top-6 -translate-x-1/2 text-xs text-slate-600"
        style={{ left: `${target}%` }}
      >
        {target}% target
      </span>
    </div>
  );
}

export interface TrendPoint {
  label: string;
  percent: number;
  assisted: boolean;
}

const WIDTH = 640;
const HEIGHT = 220;
const MARGIN = { top: 16, right: 44, bottom: 26, left: 36 };
const GRID_VALUES = [0, 20, 40, 60, 80, 100];

export function ScoreTrend({ points, target }: { points: TrendPoint[]; target: number }) {
  const [active, setActive] = useState<number | null>(null);
  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const x = (index: number) =>
    MARGIN.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const y = (percent: number) => MARGIN.top + (1 - percent / 100) * plotHeight;
  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index)},${y(point.percent)}`)
    .join(' ');
  const last = points.length - 1;
  const shown = active === null ? null : points[active];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={`Score by attempt, from ${round(points[0]!.percent)}% to ${round(points[last]!.percent)}%, against a target of ${target}%. The attempts table below lists every value.`}
        onPointerLeave={() => setActive(null)}
      >
        {GRID_VALUES.map((value) => (
          <g key={value}>
            <line
              x1={MARGIN.left}
              x2={WIDTH - MARGIN.right}
              y1={y(value)}
              y2={y(value)}
              style={{ stroke: value === target ? TARGET_LINE : GRID }}
              strokeWidth={1}
            />
            <text
              x={MARGIN.left - 8}
              y={y(value) + 4}
              textAnchor="end"
              fontSize={11}
              style={{ fill: TEXT }}
            >
              {value}
            </text>
          </g>
        ))}
        <text
          x={WIDTH - MARGIN.right}
          y={y(target) - 6}
          textAnchor="end"
          fontSize={11}
          style={{ fill: TEXT }}
        >
          {target}% target
        </text>
        <path
          d={path}
          fill="none"
          style={{ stroke: ACCENT }}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {active !== null && (
          <line
            x1={x(active)}
            x2={x(active)}
            y1={MARGIN.top}
            y2={HEIGHT - MARGIN.bottom}
            style={{ stroke: GRID }}
            strokeWidth={1}
          />
        )}
        {points.map((point, index) => (
          <g key={point.label}>
            {/* Assisted attempts are hollow, so they differ by shape as well as colour. */}
            <circle
              cx={x(index)}
              cy={y(point.percent)}
              r={point.assisted ? 3.5 : 4}
              style={{
                fill: point.assisted ? SURFACE : ACCENT,
                stroke: point.assisted ? ACCENT : SURFACE,
              }}
              strokeWidth={2}
            />
            {/* A larger invisible target, because small dots are hard to hover. */}
            <circle
              cx={x(index)}
              cy={y(point.percent)}
              r={14}
              fill="transparent"
              className="outline-none"
              tabIndex={0}
              role="img"
              aria-label={`${point.label}: ${round(point.percent)}%${point.assisted ? ', assisted' : ''}`}
              onPointerEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
            />
          </g>
        ))}
        <text
          x={x(last) + 9}
          y={y(points[last]!.percent) + 4}
          fontSize={12}
          fontWeight={600}
          style={{ fill: TEXT_STRONG }}
        >
          {round(points[last]!.percent)}%
        </text>
        <text
          x={x(0)}
          y={HEIGHT - 8}
          textAnchor={points.length === 1 ? 'middle' : 'start'}
          fontSize={11}
          style={{ fill: TEXT }}
        >
          {points[0]!.label}
        </text>
        {last > 0 && (
          <text x={x(last)} y={HEIGHT - 8} textAnchor="end" fontSize={11} style={{ fill: TEXT }}>
            {points[last]!.label}
          </text>
        )}
      </svg>
      {shown && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded border border-slate-200 bg-white px-2 py-1 text-xs shadow"
          style={{
            left: `${(x(active!) / WIDTH) * 100}%`,
            top: `${(y(shown.percent) / HEIGHT) * 100}%`,
            marginTop: '10px',
          }}
        >
          <strong>{round(shown.percent)}%</strong> {shown.label}
          {shown.assisted && ', assisted'}
        </div>
      )}
      {points.some((point) => point.assisted) && (
        <p className="text-xs text-slate-600">A hollow dot is an assisted attempt.</p>
      )}
    </div>
  );
}
