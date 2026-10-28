// Landing page: live counters, featured challenges and top accounts.
// All data comes from CTFd's REST API (or the optional void_ctf plugin for
// aggregate counts); anything the visitor is not allowed to see stays hidden.
import Alpine from "alpinejs";
import CTFd from "./index";
import { competitionState } from "./components/void-ui";
import { categoryIcon, difficultyOf, displayTags, slugHash } from "./components/challenge-meta";

window.CTFd = CTFd;
window.Alpine = Alpine;

const config = JSON.parse(document.getElementById("void-home-config")?.textContent || "{}");
const esc = s =>
  String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const nf = new Intl.NumberFormat();

async function getJson(url) {
  try {
    const res = await CTFd.fetch(url, { method: "GET" });
    let body = null;
    try {
      body = await res.json();
    } catch (e) {
      body = null;
    }
    return { status: res.status, ok: res.ok && body && body.success !== false, body };
  } catch (e) {
    return { status: 0, ok: false, body: null };
  }
}

function setBoot(key, tag, value, tone) {
  const tagEl = document.querySelector(`[data-boot="${key}"]`);
  const valEl = document.querySelector(`[data-boot-val="${key}"]`);
  if (tagEl) {
    tagEl.textContent = `[${tag}]`;
    tagEl.dataset.tone = tone;
  }
  if (valEl) valEl.textContent = value;
}

function setStat(key, value) {
  const el = document.querySelector(`[data-stat="${key}"]`);
  if (!el) return;
  if (value === null || value === undefined) {
    el.textContent = "—";
    el.title = "Hidden by the organizers' visibility settings";
    el.parentElement.classList.add("is-hidden");
  } else {
    el.textContent = nf.format(value);
    el.parentElement.classList.remove("is-hidden");
  }
}

async function loadSummary(challengeList) {
  const res = await getJson("/void/api/summary");
  if (res.ok) {
    const d = res.body.data;
    ["challenges", "players", "teams", "solves"].forEach(k => setStat(k, d[k]));
    return;
  }

  // Plugin not installed: fall back to what public endpoints expose.
  setStat("challenges", challengeList ? challengeList.length : null);
  const users = await getJson("/api/v1/users?per_page=1");
  setStat("players", users.ok ? users.body.meta?.pagination?.total ?? null : null);
  if (CTFd.config.userMode === "teams") {
    const teams = await getJson("/api/v1/teams?per_page=1");
    setStat("teams", teams.ok ? teams.body.meta?.pagination?.total ?? null : null);
  }
  setStat("solves", challengeList ? challengeList.reduce((n, c) => n + (c.solves || 0), 0) : null);
}

function challengeCard(c) {
  const diff = difficultyOf(c.tags);
  const tags = displayTags(c.tags, config.featuredTag).slice(0, 3);
  const solved = c.solved_by_me;
  return `
    <a class="void-card${solved ? " is-solved" : ""}" href="${esc(config.challengesUrl)}${slugHash(c)}">
      <div class="void-card-top">
        <span class="void-card-cat"><i class="fas ${categoryIcon(c.category)}" aria-hidden="true"></i>${esc(c.category)}</span>
        ${
          solved
            ? '<span class="void-chip is-green"><i class="fas fa-check" aria-hidden="true"></i>solved</span>'
            : '<span class="void-chip"><i class="fas fa-crosshairs" aria-hidden="true"></i>open</span>'
        }
      </div>
      <h3 class="void-card-title">${esc(c.name)}</h3>
      ${tags.length ? `<div class="void-tags">${tags.map(t => `<span class="void-tag">#${esc(t)}</span>`).join("")}</div>` : ""}
      <div class="void-card-foot">
        <span class="void-card-pts"><strong>${esc(c.value)}</strong> pts</span>
        ${
          diff
            ? `<span class="void-diff" data-level="${diff.level}"><span class="void-diff-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>${esc(diff.label)}</span>`
            : ""
        }
        ${c.solves !== null && c.solves !== undefined ? `<span class="void-card-solves">${nf.format(c.solves)} ${c.solves === 1 ? "solve" : "solves"}</span>` : ""}
      </div>
    </a>`;
}

function emptyState(icon, title, text, action) {
  return `<div class="void-empty"><div class="void-empty-icon"><i class="fas ${icon}" aria-hidden="true"></i></div><strong>${esc(
    title,
  )}</strong><span>${esc(text)}</span>${action || ""}</div>`;
}

async function loadFeatured() {
  const target = document.getElementById("void-featured");
  const res = await getJson("/api/v1/challenges");

  if (!res.ok) {
    let title = "Challenges locked";
    let text = "Log in to access the challenge network.";
    let action = config.authed ? "" : `<a class="btn btn-sm btn-primary void-btn mt-3" href="${esc(CTFd.config.urlRoot)}/login">INITIALIZE SESSION</a>`;
    const msg = res.body && (res.body.message || (res.body.errors && res.body.errors[0]));
    const st = competitionState();
    if (st.key === "upcoming") {
      title = "Challenges sealed";
      text = "The challenge network opens when the competition starts.";
    } else if (st.key === "ended") {
      title = "Competition ended";
      text = msg || "Challenges are no longer available.";
    } else if (config.authed && msg) {
      text = msg;
    }
    target.innerHTML = emptyState("fa-lock", title, text, action);
    setBoot("challenges", "LOCK", st.key === "upcoming" ? "sealed" : "restricted", "amber");
    return null;
  }

  const all = res.body.data || [];
  const open = all.filter(c => c.type !== "hidden");
  setBoot("challenges", " OK ", `online · ${open.length}`, "green");

  if (!open.length) {
    target.innerHTML = emptyState("fa-satellite", "No challenges deployed yet", "Organizers can add challenges from the admin panel.");
    return all;
  }

  const ft = (config.featuredTag || "featured").toLowerCase();
  let picks = open.filter(c => (c.tags || []).some(t => (t.value || "").toLowerCase() === ft));
  if (!picks.length) picks = [...open].sort((a, b) => b.id - a.id);
  target.innerHTML = picks.slice(0, 4).map(challengeCard).join("");
  return all;
}

async function loadTop() {
  const target = document.getElementById("void-top");
  if (!config.scoreboardVisible) {
    target.innerHTML = emptyState("fa-eye-slash", "Scoreboard hidden", "The organizers have hidden the scoreboard.");
    setBoot("scoreboard", "HIDE", "hidden", "amber");
    return;
  }
  const res = await getJson("/api/v1/scoreboard");
  if (!res.ok) {
    const msg = res.body && (res.body.message || (res.body.errors && res.body.errors[0]));
    target.innerHTML = emptyState("fa-eye-slash", "Scoreboard unavailable", msg || "Scores are not visible right now.");
    setBoot("scoreboard", "HIDE", "hidden", "amber");
    return;
  }
  const rows = (res.body.data || []).slice(0, 5);
  const frozen = config.freeze && Date.now() > Number(config.freeze) * 1000;
  setBoot("scoreboard", frozen ? "FRZN" : " OK ", frozen ? "frozen" : "synced", frozen ? "cyan" : "green");

  if (!rows.length) {
    target.innerHTML = emptyState("fa-ranking-star", "No captures yet", "The first flag claims the top spot.");
    return;
  }
  const mine = CTFd.config.userMode === "teams" ? CTFd.team.id : CTFd.user.id;
  target.innerHTML = `
    <ol class="void-top-list">
      ${rows
        .map(
          (r, i) => `
        <li class="void-top-row${r.account_id === mine ? " is-me" : ""}" data-rank="${i + 1}">
          <span class="void-top-rank">${String(i + 1).padStart(2, "0")}</span>
          <a class="void-top-name" href="${esc(r.account_url)}">${esc(r.name)}</a>
          ${r.account_id === mine ? '<span class="void-chip is-cyan">you</span>' : ""}
          <span class="void-top-score">${nf.format(r.score)}</span>
        </li>`,
        )
        .join("")}
    </ol>
    <a class="void-top-more" href="${esc(CTFd.config.urlRoot)}/scoreboard">full scoreboard <span aria-hidden="true">→</span></a>`;
}

(async () => {
  const st = competitionState();
  setBoot("status", st.key === "live" ? " OK " : st.key === "ended" ? "DONE" : st.key === "paused" ? "HOLD" : "WAIT", st.key, st.tone);
  document.addEventListener("void:status-change", e => {
    const s = competitionState();
    setBoot("status", s.key === "live" ? " OK " : "WAIT", e.detail, s.tone);
  });

  const [list] = await Promise.all([loadFeatured(), loadTop()]);
  await loadSummary(list);
})();

Alpine.start();
