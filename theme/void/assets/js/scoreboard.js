import Alpine from "alpinejs";
import CTFd from "./index";
import { getOption } from "./utils/graphs/echarts/scoreboard";
import { embed } from "./utils/graphs/echarts";

window.Alpine = Alpine;
window.CTFd = CTFd;

// Default scoreboard polling interval to every 5 minutes
const scoreboardUpdateInterval = window.scoreboardUpdateInterval || 300000;
const PAGE_SIZE = 25;
const nf = new Intl.NumberFormat();

Alpine.data("ScoreboardDetail", () => ({
  data: {},
  show: true,
  activeBracket: null,

  async update() {
    this.data = await CTFd.pages.scoreboard.getScoreboardDetail(10, this.activeBracket);
    this.show = Object.keys(this.data || {}).length > 0;
    if (!this.show) return;

    let optionMerge = window.scoreboardChartOptions;
    let option = getOption(CTFd.config.userMode, this.data, optionMerge);

    // Wait for x-show to make the container visible so ECharts can measure it
    this.$nextTick(() => embed(this.$refs.scoregraph, option));
  },

  async init() {
    this.update();

    setInterval(() => {
      this.update();
    }, scoreboardUpdateInterval);
  },
}));

Alpine.data("ScoreboardList", () => ({
  loaded: false,
  standings: [],
  brackets: [],
  activeBracket: null,
  solveCounts: null,
  query: "",
  page: 1,

  async update() {
    const [brackets, standings] = await Promise.all([
      CTFd.pages.scoreboard.getBrackets(CTFd.config.userMode),
      CTFd.pages.scoreboard.getScoreboard(),
    ]);
    this.brackets = brackets || [];
    this.standings = standings || [];
    this.solveCounts = await this.fetchSolveCounts();
    this.loaded = true;
  },

  // Solve counts come from the optional void_ctf plugin; the column hides without it.
  async fetchSolveCounts() {
    try {
      const res = await CTFd.fetch("/void/api/solve-counts", { method: "GET" });
      if (!res.ok) return null;
      const body = await res.json();
      return body.success ? body.data : null;
    } catch (e) {
      return null;
    }
  },

  async init() {
    this.$watch("activeBracket", value => {
      this.page = 1;
      this.$dispatch("bracket-change", value);
    });
    this.$watch("query", () => {
      this.page = 1;
    });

    this.update();

    setInterval(() => {
      this.update();
    }, scoreboardUpdateInterval);
  },

  fmt(n) {
    return nf.format(n || 0);
  },

  myId() {
    return CTFd.config.userMode === "teams" ? CTFd.team.id : CTFd.user.id;
  },

  isMe(s) {
    return this.myId() && s.account_id === this.myId();
  },

  // Standings for the active bracket; rank is the position inside it.
  visible() {
    return this.standings.filter(i => (this.activeBracket ? i.bracket_id == this.activeBracket : true));
  },

  filteredRows() {
    const q = this.query.trim().toLowerCase();
    return this.visible()
      .map((s, i) => ({ s, rank: i + 1 }))
      .filter(r => !q || r.s.name.toLowerCase().includes(q));
  },

  pages() {
    return Math.max(1, Math.ceil(this.filteredRows().length / PAGE_SIZE));
  },

  pageRows() {
    const start = (this.page - 1) * PAGE_SIZE;
    return this.filteredRows().slice(start, start + PAGE_SIZE);
  },

  myRow() {
    return this.visible().findIndex(s => this.isMe(s)) >= 0;
  },

  jumpToMe() {
    this.query = "";
    const idx = this.visible().findIndex(s => this.isMe(s));
    if (idx < 0) return;
    this.page = Math.floor(idx / PAGE_SIZE) + 1;
    this.$nextTick(() => {
      const el = document.getElementById("sb-" + this.myId());
      if (el) {
        el.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        el.classList.add("is-flash");
        setTimeout(() => el.classList.remove("is-flash"), 1600);
      }
    });
  },
}));

Alpine.start();
