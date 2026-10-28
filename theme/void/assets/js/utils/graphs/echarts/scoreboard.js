import { mergeObjects } from "../../objects";
import { cumulativeSum } from "../../math";
import dayjs from "dayjs";

// VOID series palette: brand accents first, then muted companions that stay
// readable on the near-black background.
const SERIES = [
  "#39FF88",
  "#00D9FF",
  "#FFB84D",
  "#B794F6",
  "#FF6B7A",
  "#7EE0B5",
  "#6CB6FF",
  "#F0D27A",
  "#E08FD0",
  "#9AA8BD",
];

const AXIS = "#8B9BB4";
const GRID = "rgba(139, 155, 180, 0.12)";
const MONO = "JetBrains Mono, ui-monospace, monospace";

export function getOption(mode, places, optionMerge) {
  let option = {
    backgroundColor: "transparent",
    textStyle: { fontFamily: MONO, color: AXIS },
    color: SERIES,
    tooltip: {
      trigger: "axis",
      backgroundColor: "#101720",
      borderColor: "#2C3B4F",
      textStyle: { color: "#E6EDF3", fontFamily: MONO, fontSize: 12 },
      axisPointer: {
        type: "line",
        lineStyle: { color: "rgba(57, 255, 136, 0.4)" },
      },
    },
    legend: {
      type: "scroll",
      orient: "horizontal",
      align: "left",
      bottom: 0,
      textStyle: { color: AXIS, fontFamily: MONO },
      pageTextStyle: { color: AXIS },
      icon: "roundRect",
      itemWidth: 12,
      itemHeight: 4,
      data: [],
    },
    grid: {
      left: 12,
      right: 20,
      top: 24,
      bottom: 64,
      containLabel: true,
    },
    xAxis: [
      {
        type: "time",
        boundaryGap: false,
        axisLine: { lineStyle: { color: GRID } },
        axisLabel: { color: AXIS, fontFamily: MONO, fontSize: 11 },
        splitLine: { show: false },
      },
    ],
    yAxis: [
      {
        type: "value",
        axisLabel: { color: AXIS, fontFamily: MONO, fontSize: 11 },
        splitLine: { lineStyle: { color: GRID, type: "dashed" } },
      },
    ],
    dataZoom: [
      {
        id: "dataZoomX",
        type: "inside",
        xAxisIndex: [0],
        filterMode: "filter",
      },
    ],
    animationDuration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 600,
    series: [],
  };

  const teams = Object.keys(places);
  for (let i = 0; i < teams.length; i++) {
    const team_score = [];
    const times = [];
    for (let j = 0; j < places[teams[i]]["solves"].length; j++) {
      team_score.push(places[teams[i]]["solves"][j].value);
      const date = dayjs(places[teams[i]]["solves"][j].date);
      times.push(date.toDate());
    }

    const total_scores = cumulativeSum(team_score);
    let scores = times.map(function (e, i) {
      return [e, total_scores[i]];
    });

    option.legend.data.push(places[teams[i]]["name"]);

    const data = {
      name: places[teams[i]]["name"],
      type: "line",
      step: "end",
      symbol: "circle",
      symbolSize: 5,
      showSymbol: scores.length < 40,
      lineStyle: { width: i === 0 ? 2.5 : 1.5 },
      emphasis: { focus: "series" },
      data: scores,
    };
    option.series.push(data);
  }

  if (optionMerge) {
    option = mergeObjects(option, optionMerge);
  }
  return option;
}
