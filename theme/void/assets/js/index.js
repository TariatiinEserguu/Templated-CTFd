import CTFd from "@ctfdio/ctfd-js";

import dayjs from "dayjs";
import advancedFormat from "dayjs/plugin/advancedFormat";

import times from "./theme/times";
import styles from "./theme/styles";
import highlight from "./theme/highlight";

import alerts from "./utils/alerts";
import tooltips from "./utils/tooltips";
import collapse from "./utils/collapse";

import eventAlerts from "./utils/notifications/alerts";
import eventToasts from "./utils/notifications/toasts";
import eventRead from "./utils/notifications/read";

import "./components/language";
import initPalette from "./components/palette";
import initVoidUi from "./components/void-ui";

dayjs.extend(advancedFormat);
CTFd.init(window.init);

(() => {
  styles();
  times();
  highlight();

  alerts();
  tooltips();
  collapse();

  eventRead();
  eventAlerts();
  eventToasts();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initPalette();
      initVoidUi();
    });
  } else {
    initPalette();
    initVoidUi();
  }
})();

export default CTFd;
