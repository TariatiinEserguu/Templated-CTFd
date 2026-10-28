import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  DatasetComponent,
  TransformComponent,
  LegendComponent,
  ToolboxComponent,
  DataZoomComponent,
} from "echarts/components";
// Features like Universal Transition and Label Layout
import { LabelLayout, UniversalTransition } from "echarts/features";
// Import the Canvas renderer
// Note that introducing the CanvasRenderer or SVGRenderer is a required step
import { CanvasRenderer } from "echarts/renderers";

// Register the required components
echarts.use([
  LineChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  DatasetComponent,
  TransformComponent,
  LegendComponent,
  ToolboxComponent,
  DataZoomComponent,
  LabelLayout,
  UniversalTransition,
  CanvasRenderer,
]);

// Dark VOID chart theme shared by the scoreboard and profile graphs.
echarts.registerTheme("void", {
  backgroundColor: "transparent",
  color: ["#39FF88", "#00D9FF", "#FFB84D", "#B794F6", "#FF6B7A", "#7EE0B5", "#6CB6FF", "#F0D27A"],
  textStyle: { color: "#8B9BB4", fontFamily: "JetBrains Mono, ui-monospace, monospace" },
  title: { textStyle: { color: "#E6EDF3", fontWeight: 500, fontSize: 14 } },
  legend: { textStyle: { color: "#8B9BB4" } },
  tooltip: { backgroundColor: "#101720", borderColor: "#2C3B4F", textStyle: { color: "#E6EDF3" } },
  categoryAxis: {
    axisLine: { lineStyle: { color: "rgba(139,155,180,0.25)" } },
    axisLabel: { color: "#8B9BB4" },
    splitLine: { lineStyle: { color: "rgba(139,155,180,0.12)" } },
  },
  valueAxis: {
    axisLine: { lineStyle: { color: "rgba(139,155,180,0.25)" } },
    axisLabel: { color: "#8B9BB4" },
    splitLine: { lineStyle: { color: "rgba(139,155,180,0.12)", type: "dashed" } },
  },
  timeAxis: {
    axisLine: { lineStyle: { color: "rgba(139,155,180,0.25)" } },
    axisLabel: { color: "#8B9BB4" },
  },
  toolbox: { iconStyle: { borderColor: "#8B9BB4" } },
  dataZoom: { textStyle: { color: "#8B9BB4" }, borderColor: "#1F2B3A" },
});

export function embed(target, option) {
  // Reuse the instance on refresh instead of stacking new charts on the node
  let existing = echarts.getInstanceByDom(target);
  if (existing) {
    existing.setOption(option, true);
    existing.resize();
    return;
  }
  let chart = echarts.init(target, "void");

  // https://echarts.apache.org/en/api.html#echartsInstance.setOption
  // https://github.com/apache/echarts/issues/6202#issuecomment-315054637
  // https://stackoverflow.com/a/72211534
  chart.setOption(option, true);

  // Charts can be created inside containers that are still hidden (x-show);
  // a ResizeObserver redraws them once they get a real size.
  if (window.ResizeObserver) {
    new ResizeObserver(() => chart.resize()).observe(target);
  } else {
    window.addEventListener("resize", () => chart.resize());
  }
}
