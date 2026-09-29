import { formatCompactCurrency, formatNumber } from '@/utils/format';

/** Categorical palette bound to CSS variables so both themes stay consistent. */
const CLUSTER_VARIABLES = [
  '--cluster-1',
  '--cluster-2',
  '--cluster-3',
  '--cluster-4',
  '--cluster-5',
  '--cluster-6',
  '--cluster-7',
  '--cluster-8',
] as const;

export function clusterColor(index: number): string {
  return `hsl(var(${CLUSTER_VARIABLES[Math.abs(index) % CLUSTER_VARIABLES.length]}))`;
}

export const chartColors = {
  primary: 'hsl(var(--primary))',
  accent: 'hsl(var(--accent))',
  expense: 'hsl(var(--negative))',
  income: 'hsl(var(--positive))',
  warning: 'hsl(var(--warning))',
  info: 'hsl(var(--info))',
  grid: 'hsl(var(--border))',
  axis: 'hsl(var(--muted-foreground))',
  muted: 'hsl(var(--muted-foreground))',
} as const;

export const axisProps = {
  tick: { fill: chartColors.axis, fontSize: 11 },
  stroke: chartColors.grid,
  tickLine: false,
  axisLine: false,
} as const;

export const gridProps = {
  stroke: chartColors.grid,
  strokeDasharray: '3 3',
  strokeOpacity: 0.5,
  vertical: false,
} as const;

export const currencyTickFormatter = (value: number): string => formatCompactCurrency(value);
export const countTickFormatter = (value: number): string => formatNumber(value);
