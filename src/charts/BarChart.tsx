import { useEffect, useRef } from 'react';
import { echarts, token, tooltipTheme, useEChart } from './echarts';

export interface BarItem {
  label: string;
  value: number;
  /** Shown as the direct label at the end of the bar, e.g. "23%". */
  note: string;
  /** Full text for the tooltip (labels are truncated). */
  detail: string;
}

interface Props {
  items: readonly BarItem[];
  color: string;
  /** Re-read the CSS colour tokens when the theme changes. */
  darkMode: boolean;
  ariaLabel: string;
}

const ROW = 26;

/** Horizontal bars, largest first, with a direct label per bar and a tooltip with the full name. */
export function BarChart({ items, color, darkMode, ariaLabel }: Props) {
  const el = useRef<HTMLDivElement>(null);

  useEChart(el);

  useEffect(() => {
    const chart = echarts.getInstanceByDom(el.current!);
    if (!chart) return;
    const fg = token('--fg');
    const muted = token('--muted');
    const rows = [...items].reverse(); // ECharts draws categories bottom-up
    chart.setOption(
      {
        animation: false,
        grid: { left: 4, right: 44, top: 4, bottom: 4, containLabel: true },
        xAxis: { type: 'value', show: false, max: (v: { max: number }) => v.max * 1.02 },
        yAxis: {
          type: 'category',
          data: rows.map((r) => r.label),
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: muted, width: 150, overflow: 'truncate', fontSize: 11 },
        },
        tooltip: {
          ...tooltipTheme(),
          trigger: 'item',
          formatter: (p: { dataIndex: number }) => rows[p.dataIndex]?.detail ?? '',
        },
        series: [
          {
            type: 'bar',
            data: rows.map((r) => r.value),
            barWidth: 14,
            itemStyle: { color, borderRadius: [0, 4, 4, 0] },
            label: {
              show: true,
              position: 'right',
              color: fg,
              fontSize: 11,
              formatter: (p: { dataIndex: number }) => rows[p.dataIndex]?.note ?? '',
            },
          },
        ],
      },
      { notMerge: true },
    );
    chart.resize({ height: rows.length * ROW + 8 });
  }, [items, color, darkMode]);

  return (
    <div
      ref={el}
      role="img"
      aria-label={ariaLabel}
      style={{ width: '100%', height: items.length * ROW + 8 }}
    />
  );
}
