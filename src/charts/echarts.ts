import { BarChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import { useEffect, type RefObject } from 'react';

echarts.use([BarChart, GridComponent, LegendComponent, TooltipComponent, SVGRenderer]);

export { echarts };

/** Reads a CSS colour token so charts follow the page theme. */
export const token = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Tooltip styling shared by all charts. */
export const tooltipTheme = () => ({
  confine: true,
  backgroundColor: token('--bg'),
  borderColor: token('--border'),
  textStyle: { color: token('--fg'), fontSize: 12 },
});

/** Creates an SVG ECharts instance on the element, resizes it with the element, disposes it on unmount. */
export function useEChart(el: RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    const chart = echarts.init(el.current!, undefined, { renderer: 'svg' });
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el.current!);
    return () => {
      ro.disconnect();
      chart.dispose();
    };
  }, [el]);
}
