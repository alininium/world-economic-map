import { BarChart as EBar } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';

echarts.use([EBar, GridComponent, LegendComponent, TooltipComponent, SVGRenderer]);

export interface YearSeries {
  name: string;
  color: string;
  /** year → value; missing years are gaps, not zeros. */
  values: ReadonlyMap<number, number>;
}

interface Props {
  series: readonly YearSeries[];
  format: (v: number) => string;
  darkMode: boolean;
  ariaLabel: string;
}

const token = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Grouped yearly bars on one value axis, with a legend and an axis tooltip. */
export function YearBars({ series, format, darkMode, ariaLabel }: Props) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const chart = echarts.init(el.current!, undefined, { renderer: 'svg' });
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el.current!);
    return () => {
      ro.disconnect();
      chart.dispose();
    };
  }, []);

  useEffect(() => {
    const chart = echarts.getInstanceByDom(el.current!);
    if (!chart) return;
    const years = [...new Set(series.flatMap((s) => [...s.values.keys()]))].sort((a, b) => a - b);
    const muted = token('--muted');
    chart.setOption(
      {
        animation: false,
        grid: { left: 4, right: 8, top: 28, bottom: 4, containLabel: true },
        legend: {
          top: 0,
          left: 0,
          itemWidth: 12,
          itemHeight: 8,
          textStyle: { color: token('--fg'), fontSize: 11 },
        },
        xAxis: {
          type: 'category',
          data: years.map(String),
          axisLabel: { color: muted, fontSize: 10 },
          axisLine: { lineStyle: { color: token('--border') } },
          axisTick: { show: false },
        },
        yAxis: {
          type: 'value',
          axisLabel: { color: muted, fontSize: 10, formatter: (v: number) => format(v) },
          splitLine: { lineStyle: { color: token('--border'), opacity: 0.6 } },
        },
        tooltip: {
          trigger: 'axis',
          confine: true,
          backgroundColor: token('--bg'),
          borderColor: token('--border'),
          textStyle: { color: token('--fg'), fontSize: 12 },
          valueFormatter: (v: unknown) => (typeof v === 'number' ? format(v) : 'no data'),
        },
        series: series.map((s) => ({
          name: s.name,
          type: 'bar',
          barGap: '10%',
          itemStyle: { color: s.color, borderRadius: 2 },
          data: years.map((y) => s.values.get(y) ?? null),
        })),
      },
      { notMerge: true },
    );
  }, [series, format, darkMode]);

  return <div ref={el} role="img" aria-label={ariaLabel} style={{ width: '100%', height: 180 }} />;
}
