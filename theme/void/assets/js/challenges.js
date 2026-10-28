import Alpine from "alpinejs";

import CTFd from "./index";

import { Modal, Tab, Tooltip } from "bootstrap";
import highlight from "./theme/highlight";
import { intl } from "./theme/times";
import { categoryIcon, difficultyOf, displayTags } from "./components/challenge-meta";

function addTargetBlank(html) {
  let dom = new DOMParser();
  let view = dom.parseFromString(html, "text/html");
  let links = view.querySelectorAll('a[href*="://"]');
  links.forEach(link => {
    link.setAttribute("target", "_blank");
  });
  return view.documentElement.outerHTML;
}

window.Alpine = Alpine;

Alpine.store("challenge", {
  data: {
    view: "",
  },
});

Alpine.data("Hint", () => ({
  id: null,
  html: null,

  async showHint(event) {
    if (event.target.open) {
      let response = await CTFd.pages.challenge.loadHint(this.id);

      // Hint has some kind of prerequisite or access prevention
      if (response.errors) {
        event.target.open = false;
        CTFd._functions.challenge.displayUnlockError(response);
        return;
      }
      let hint = response.data;
      if (hint.content) {
        this.html = addTargetBlank(hint.html);
      } else {
        let answer = await CTFd.pages.challenge.displayUnlock(this.id);
        if (answer) {
          let unlock = await CTFd.pages.challenge.loadUnlock(this.id);

          if (unlock.success) {
            let response = await CTFd.pages.challenge.loadHint(this.id);
            let hint = response.data;
            this.html = addTargetBlank(hint.html);
          } else {
            event.target.open = false;
            CTFd._functions.challenge.displayUnlockError(unlock);
          }
        } else {
          event.target.open = false;
        }
      }
    }
  },
}));

Alpine.data("Challenge", () => ({
  id: null,
  next_id: null,
  submission: "",
  tab: null,
  solves: [],
  submissions: [],
  solution: null,
  response: null,
  share_url: null,
  max_attempts: 0,
  attempts: 0,
  ratingValue: 0,
  selectedRating: 0,
  ratingReview: "",
  ratingSubmitted: false,

  async init() {
    highlight();
  },

  getStyles() {
    let styles = {
      "modal-dialog": true,
      "modal-dialog-scrollable": true,
    };
    // VOID default: a roomy terminal window unless the admin chose a size
    if (!(CTFd.config.themeSettings || {}).challenge_window_size) {
      styles["modal-lg"] = true;
    }
    try {
      let size = CTFd.config.themeSettings.challenge_window_size;
      switch (size) {
        case "sm":
          styles["modal-sm"] = true;
          break;
        case "lg":
          styles["modal-lg"] = true;
          break;
        case "xl":
          styles["modal-xl"] = true;
          break;
        default:
          break;
      }
    } catch (error) {
      // Ignore errors with challenge window size
      console.log("Error processing challenge_window_size");
      console.log(error);
    }
    return styles;
  },

  async init() {
    highlight();
  },

  async showChallenge() {
    new Tab(this.$el).show();
  },

  async showSolves() {
    this.solves = await CTFd.pages.challenge.loadSolves(this.id);
    this.solves.forEach(solve => {
      solve.date = intl.format(new Date(solve.date));
      return solve;
    });
    new Tab(this.$el).show();
  },

  async showSubmissions() {
    let response = await CTFd.pages.users.userSubmissions("me", this.id);
    this.submissions = response.data;
    this.submissions.forEach(s => {
      s.date = intl.format(new Date(s.date));
      return s;
    });
    new Tab(this.$el).show();
  },

  getSolutionId() {
    let data = Alpine.store("challenge").data;
    return data.solution_id;
  },

  getSolutionState() {
    let data = Alpine.store("challenge").data;
    return data.solution_state;
  },

  setSolutionId(solutionId) {
    Alpine.store("challenge").data.solution_id = solutionId;
  },

  async showSolution() {
    let solution_id = this.getSolutionId();
    CTFd._functions.challenge.displaySolution = solution => {
      this.solution = solution.html;
      new Tab(this.$el).show();
    };
    await CTFd.pages.challenge.displaySolution(solution_id);
  },

  getNextId() {
    let data = Alpine.store("challenge").data;
    return data.next_id;
  },

  async nextChallenge() {
    let modal = Modal.getOrCreateInstance("[x-ref='challengeWindow']");

    // TODO: Get rid of this private attribute access
    // See https://github.com/twbs/bootstrap/issues/31266
    modal._element.addEventListener(
      "hidden.bs.modal",
      event => {
        // Dispatch load-challenge event to call loadChallenge in the ChallengeBoard
        Alpine.nextTick(() => {
          this.$dispatch("load-challenge", this.getNextId());
        });
      },
      { once: true },
    );
    modal.hide();
  },

  async getShareUrl() {
    let body = {
      type: "solve",
      challenge_id: this.id,
    };
    const response = await CTFd.fetch("/api/v1/shares", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await response.json();
    const url = data["data"]["url"];
    this.share_url = url;
  },

  copyShareUrl() {
    navigator.clipboard.writeText(this.share_url);
    let t = Tooltip.getOrCreateInstance(this.$el);
    t.enable();
    t.show();
    setTimeout(() => {
      t.hide();
      t.disable();
    }, 2000);
  },

  async submitChallenge() {
    this.response = await CTFd.pages.challenge.submitChallenge(
      this.id,
      this.submission,
    );

    // Challenges page might be visible to anonymous users, redirect to login on submit
    if (this.response.data.status === "authentication_required") {
      window.location = `${CTFd.config.urlRoot}/login?next=${CTFd.config.urlRoot}${window.location.pathname}${window.location.hash}`;
      return;
    }

    await this.renderSubmissionResponse();
  },

  async renderSubmissionResponse() {
    if (this.response.data.status === "correct") {
      this.submission = "";
    }

    // Decide whether to check for the solution
    if (this.getSolutionId() == null) {
      if (
        CTFd.pages.challenge.checkSolution(
          this.getSolutionState(),
          Alpine.store("challenge").data,
          this.response.data.status,
        )
      ) {
        let data = await CTFd.pages.challenge.getSolution(this.id);
        this.setSolutionId(data.id);
      }
    }

    // Increment attempts counter
    if (
      this.max_attempts > 0 &&
      this.response.data.status != "already_solved" &&
      this.response.data.status != "ratelimited"
    ) {
      this.attempts += 1;
    }

    // Dispatch load-challenges event to call loadChallenges in the ChallengeBoard
    this.$dispatch("load-challenges");
  },

  async submitRating() {
    const response = await CTFd.pages.challenge.submitRating(
      this.id,
      this.selectedRating,
      this.ratingReview,
    );
    if (response.value) {
      this.ratingValue = this.selectedRating;
      this.ratingSubmitted = true;
    } else {
      alert("Error submitting rating");
    }
  },
}));

Alpine.data("ChallengeBoard", () => ({
  loaded: false,
  challenges: [],
  challenge: null,

  // VOID filters. "q" in the URL pre-fills the search (used by the command palette).
  query: new URLSearchParams(window.location.search).get("q") || "",
  category: null,
  status: "all",
  sort: "default",

  async init() {
    this.challenges = await CTFd.pages.challenges.getChallenges();
    this.loaded = true;

    if (window.location.hash) {
      let chalHash = decodeURIComponent(window.location.hash.substring(1));
      let idx = chalHash.lastIndexOf("-");
      if (idx >= 0) {
        let pieces = [chalHash.slice(0, idx), chalHash.slice(idx + 1)];
        let id = pieces[1];
        await this.loadChallenge(id);
      }
    }
  },

  getCategories() {
    const categories = [];

    this.challenges.forEach(challenge => {
      const { category } = challenge;

      if (!categories.includes(category)) {
        categories.push(category);
      }
    });

    try {
      const f = CTFd.config.themeSettings.challenge_category_order;
      if (f) {
        const getSort = new Function(`return (${f})`);
        categories.sort(getSort());
      }
    } catch (error) {
      // Ignore errors with theme category sorting
      console.log("Error running challenge_category_order function");
      console.log(error);
    }

    return categories;
  },

  getChallenges(category) {
    let challenges = this.challenges;

    if (category !== null) {
      challenges = this.challenges.filter(challenge => challenge.category === category);
    }

    try {
      const f = CTFd.config.themeSettings.challenge_order;
      if (f) {
        const getSort = new Function(`return (${f})`);
        challenges.sort(getSort());
      }
    } catch (error) {
      // Ignore errors with theme challenge sorting
      console.log("Error running challenge_order function");
      console.log(error);
    }

    return challenges;
  },

  icon(category) {
    return categoryIcon(category);
  },

  difficulty(c) {
    return difficultyOf(c.tags);
  },

  tagsOf(c) {
    return displayTags(c.tags, (CTFd.config.themeSettings || {}).featured_tag || "featured").slice(0, 4);
  },

  playable() {
    return this.challenges.filter(c => c.type !== "hidden");
  },

  solvedCount() {
    return this.challenges.filter(c => c.solved_by_me).length;
  },

  totalPoints() {
    return this.playable().reduce((n, c) => n + (c.value || 0), 0);
  },

  earnedPoints() {
    return this.challenges.filter(c => c.solved_by_me).reduce((n, c) => n + (c.value || 0), 0);
  },

  countIn(cat) {
    return this.challenges.filter(c => c.category === cat).length;
  },

  solvedIn(cat) {
    return this.challenges.filter(c => c.category === cat && c.solved_by_me).length;
  },

  matches(c) {
    if (this.category !== null && c.category !== this.category) return false;
    if (this.status === "solved" && !c.solved_by_me) return false;
    if (this.status === "unsolved" && c.solved_by_me) return false;
    const q = this.query.trim().toLowerCase();
    if (!q) return true;
    const hay = [c.name, c.category, ...(c.tags || []).map(t => "#" + t.value)].join(" ").toLowerCase();
    return q.split(/\s+/).every(term => hay.includes(term));
  },

  filtered() {
    return this.challenges.filter(c => this.matches(c));
  },

  sorted(list) {
    const by = {
      "points-asc": (a, b) => a.value - b.value,
      "points-desc": (a, b) => b.value - a.value,
      "solves-desc": (a, b) => (b.solves || 0) - (a.solves || 0),
      "solves-asc": (a, b) => (a.solves || 0) - (b.solves || 0),
      name: (a, b) => a.name.localeCompare(b.name),
    }[this.sort];
    return by ? [...list].sort(by) : list;
  },

  groups() {
    if (this.sort !== "default") {
      const items = this.sorted(this.filtered());
      return items.length ? [{ key: "flat", title: null, slug: "results", items }] : [];
    }
    return this.getCategories()
      .map(cat => ({
        key: cat,
        title: cat,
        slug: String(cat).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "misc",
        items: this.getChallenges(cat).filter(c => this.matches(c)),
      }))
      .filter(g => g.items.length);
  },

  resultSummary() {
    const n = this.filtered().length;
    const total = this.challenges.length;
    return n === total ? `${total} challenges indexed` : `${n} of ${total} challenges match`;
  },

  resetFilters() {
    this.query = "";
    this.category = null;
    this.status = "all";
    this.sort = "default";
  },

  cardLabel(c) {
    if (c.type === "hidden") return `${c.name}, ${c.category}, locked: solve prerequisite challenges first`;
    const state = c.solved_by_me ? "solved" : "not solved";
    return `${c.name}, ${c.category}, ${c.value} points, ${state}`;
  },

  async loadChallenges() {
    this.challenges = await CTFd.pages.challenges.getChallenges();
  },

  async loadChallenge(challengeId) {
    await CTFd.pages.challenge.displayChallenge(challengeId, challenge => {
      challenge.data.view = addTargetBlank(challenge.data.view);
      Alpine.store("challenge").data = challenge.data;

      // nextTick is required here because we're working in a callback
      Alpine.nextTick(() => {
        let modal = Modal.getOrCreateInstance("[x-ref='challengeWindow']");
        // TODO: Get rid of this private attribute access
        // See https://github.com/twbs/bootstrap/issues/31266
        modal._element.addEventListener(
          "hidden.bs.modal",
          event => {
            // Remove location hash
            history.replaceState(null, null, " ");
          },
          { once: true },
        );
        modal.show();
        history.replaceState(null, null, `#${challenge.data.name}-${challengeId}`);
      });
    });
  },
}));

Alpine.start();
