// VOID command palette: a keyboard launcher for real CTFd pages.
// It never executes anything; every command is a navigation link that the
// server rendered into #void-commands according to the visitor's permissions.

const BUILTINS = [
  { name: "help", desc: "List available commands" },
  { name: "clear", desc: "Clear the output" },
];

function isEditable(el) {
  if (!el) return false;
  const tag = el.tagName;
  return (
    el.isContentEditable ||
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.getAttribute("role") === "textbox"
  );
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

export default function initPalette() {
  const root = document.getElementById("void-palette");
  const dataEl = document.getElementById("void-commands");
  if (!root || !dataEl) return;

  let commands = [];
  try {
    commands = JSON.parse(dataEl.textContent);
  } catch (e) {
    commands = [];
  }
  const all = [...commands, ...BUILTINS];

  const input = root.querySelector("#void-palette-input");
  const list = root.querySelector("#void-palette-list");
  const output = root.querySelector(".void-palette-output");
  const form = root.querySelector("form");
  let matches = [];
  let active = 0;
  let lastFocus = null;

  function parse(value) {
    const trimmed = value.trim();
    const space = trimmed.indexOf(" ");
    return space === -1
      ? { verb: trimmed.toLowerCase(), args: "" }
      : { verb: trimmed.slice(0, space).toLowerCase(), args: trimmed.slice(space + 1).trim() };
  }

  function render() {
    const { verb } = parse(input.value);
    matches = verb
      ? all.filter(c => c.name.startsWith(verb)).concat(all.filter(c => !c.name.startsWith(verb) && c.name.includes(verb)))
      : all.slice();
    if (active >= matches.length) active = 0;

    list.innerHTML = matches
      .map(
        (c, i) => `
        <li id="void-cmd-${i}" role="option" class="void-palette-item${i === active ? " is-active" : ""}"
            aria-selected="${i === active}" data-index="${i}">
          <span class="void-palette-name">${escapeHtml(c.name)}</span>
          <span class="void-palette-desc">${escapeHtml(c.desc || "")}</span>
          ${c.url ? '<i class="fas fa-arrow-turn-down fa-rotate-90 void-palette-go" aria-hidden="true"></i>' : ""}
        </li>`,
      )
      .join("");

    if (!matches.length) {
      list.innerHTML = `<li class="void-palette-none" role="option" aria-disabled="true">command not found: ${escapeHtml(verb)} — type <code>help</code></li>`;
      input.removeAttribute("aria-activedescendant");
    } else {
      input.setAttribute("aria-activedescendant", `void-cmd-${active}`);
      const el = list.querySelector(".is-active");
      if (el) el.scrollIntoView({ block: "nearest" });
    }
  }

  function print(html) {
    output.innerHTML = html;
  }

  function run(cmd, args) {
    if (!cmd) return;
    if (cmd.name === "help") {
      print(
        `<div class="void-label mb-2">available commands</div><dl class="void-help">${commands
          .map(c => `<dt>${escapeHtml(c.name)}</dt><dd>${escapeHtml(c.desc || "")}</dd>`)
          .join("")}<dt>clear</dt><dd>Clear the output</dd></dl>`,
      );
      input.value = "";
      render();
      // Show the help text instead of the (identical) suggestion list until the user types again
      list.hidden = true;
      return;
    }
    if (cmd.name === "clear") {
      print("");
      input.value = "";
      render();
      return;
    }
    if (cmd.url) {
      let url = cmd.url;
      if (cmd.query && args) {
        url += (url.includes("?") ? "&" : "?") + "q=" + encodeURIComponent(args);
      }
      print(`<span class="text-muted">navigating to</span> <span class="text-cyan">${escapeHtml(url)}</span> …`);
      window.location.assign(url);
    }
  }

  function submit() {
    const { verb, args } = parse(input.value);
    const exact = all.find(c => c.name === verb);
    run(exact || matches[active], args);
  }

  function open() {
    if (!root.hidden) return;
    lastFocus = document.activeElement;
    root.hidden = false;
    document.body.classList.add("void-palette-open");
    input.value = "";
    active = 0;
    list.hidden = false;
    print("");
    render();
    // Focus after paint so the open transition is not interrupted
    requestAnimationFrame(() => input.focus());
  }

  function close() {
    if (root.hidden) return;
    root.hidden = true;
    document.body.classList.remove("void-palette-open");
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  input.addEventListener("input", () => {
    active = 0;
    list.hidden = false;
    render();
  });

  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      active = matches.length ? (active + 1) % matches.length : 0;
      render();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      active = matches.length ? (active - 1 + matches.length) % matches.length : 0;
      render();
    } else if (e.key === "Tab") {
      // Keep focus inside the dialog; Tab completes the highlighted command
      e.preventDefault();
      if (matches[active]) {
        input.value = matches[active].name + (matches[active].query ? " " : "");
        render();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  });

  form.addEventListener("submit", e => {
    e.preventDefault();
    submit();
  });

  list.addEventListener("click", e => {
    const item = e.target.closest("[data-index]");
    if (!item) return;
    active = Number(item.dataset.index);
    const { args } = parse(input.value);
    run(matches[active], args);
  });

  root.querySelectorAll("[data-void-palette-close]").forEach(el => el.addEventListener("click", close));
  document.querySelectorAll("[data-void-palette-open]").forEach(el =>
    el.addEventListener("click", e => {
      e.preventDefault();
      open();
    }),
  );

  document.addEventListener("keydown", e => {
    // Ctrl/Cmd+K works everywhere; "/" only when the user is not typing,
    // so flag inputs, forms and assistive tech shortcuts are never hijacked.
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
      e.preventDefault();
      root.hidden ? open() : close();
      return;
    }
    if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !isEditable(document.activeElement) && root.hidden) {
      if (document.querySelector(".modal.show")) return;
      e.preventDefault();
      open();
    }
  });
}
