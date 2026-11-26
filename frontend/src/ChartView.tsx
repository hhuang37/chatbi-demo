import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { ChartSpec } from "./types";

export function Chart({ spec }: { spec: ChartSpec }) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  useEffect(() => {
    if (!container.current) return;
    const instance = echarts.init(container.current);
    chart.current = instance;
    instance.setOption({
      grid: { left: 48, right: 16, top: 24, bottom: 36 },
      tooltip: { trigger: "axis" },
      xAxis: {
        type: "category",
        data: spec.labels,
        name: spec.labelColumn,
        axisLabel: { hideOverlap: true },
      },
      yAxis: { type: "value", name: spec.valueColumn },
      series: [
        {
          type: spec.type,
          data: spec.values,
          name: spec.valueColumn,
          smooth: spec.type === "line",
          itemStyle: { color: "#184f43" },
        },
      ],
    });
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      instance.dispose();
      chart.current = null;
    };
  }, [spec]);
  return <div ref={container} className="chart" role="img" />;
}