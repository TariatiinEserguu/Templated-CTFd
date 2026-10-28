// Shared VOID UI helpers: competition status, countdowns, local time formatting.
// Status is derived from CTFd's own start/end/paused configuration.

const fmt = new Intl.DateTimeFormat(localStorage.getItem("language") || navigator.language, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function competitionState(now = Date.now()) {
  const init = window.init || {};
  const start = init.start ? Number(init.start) * 1000 : null;
  const end = init.end ? Number(init.end) * 1000 : null;
  const pausedEl = document.querySelector("[data-paused]");
  const paused = pausedEl && pausedEl.dataset.paused === "true";

  if (paused) return { key: "paused", label: "PAUSED", tone: "amber", target: null };
  if (start && now < start) return { key: "upcoming", label: "UPCOMING", tone: "cyan", target: start, targetLabel: "starts in" };
  if (end && now >= end) return { key: "ended", label: "ENDED", tone: "red", target: null };
  return { key: "live", label: "LIVE", tone: "green", target: end, targetLabel: end ? "ends in" : null };
}

export function splitDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

const pad = n => String(n).padStart(2, "0");

function renderStatus() {
  const st = competitionState();
  document.querySelectorAll("[data-void-status]").forEach(el => {
    const icon = { live: "fa-circle-play", upcoming: "fa-hourglass-half", ended: "fa-flag-checkered", paused: "fa-circle-pause" }[st.key];
    el.className = `void-chip is-${st.tone}`;
    el.innerHTML = `${st.key === "live" ? '<span class="void-pulse" aria-hidden="true"></span>' : `<i class="fas ${icon}" aria-hidden="true"></i>`}<span>${st.label}</span>`;
  });
  return st;
}

function renderCountdowns() {
  const st = competitionState();
  document.querySelectorAll("[data-void-countdown]").forEach(el => {
    if (!st.target) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    const t = splitDuration(st.target - Date.now());
    const label = el.querySelector("[data-void-countdown-label]");
    if (label) label.textContent = st.targetLabel;
    ["d", "h", "m", "s"].forEach(k => {
      const slot = el.querySelector(`[data-unit="${k}"]`);
      if (slot) slot.textContent = pad(t[k]);
    });
    const sr = el.querySelector("[data-void-countdown-sr]");
    // Screen readers get a minute-resolution summary instead of a ticking clock
    if (sr) {
      const text = `${st.targetLabel} ${t.d} days ${t.h} hours ${t.m} minutes`;
      if (sr.textContent !== text) sr.textContent = text;
    }
  });
}

export default function initVoidUi() {
  document.querySelectorAll("[data-void-unix]").forEach(el => {
    const v = Number(el.getAttribute("data-void-unix"));
    if (!v) return;
    const d = new Date(v * 1000);
    el.setAttribute("datetime", d.toISOString());
    el.textContent = fmt.format(d);
  });

  let last = renderStatus().key;
  renderCountdowns();

  if (document.querySelector("[data-void-countdown]") || document.querySelector("[data-void-status]")) {
    setInterval(() => {
      renderCountdowns();
      const now = competitionState().key;
      if (now !== last) {
        last = renderStatus().key;
        document.dispatchEvent(new CustomEvent("void:status-change", { detail: now }));
      }
    }, 1000);
  }
}
