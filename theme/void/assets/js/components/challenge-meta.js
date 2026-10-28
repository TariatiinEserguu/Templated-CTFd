// Presentation helpers for challenge metadata (category icons, difficulty).
// Difficulty is read from challenge tags such as "easy", "medium", "hard",
// "insane" or "difficulty:easy" — add them in Admin → Challenges → Tags.

const CATEGORY_ICONS = [
  [/web/i, "fa-globe"],
  [/crypt/i, "fa-key"],
  [/forens/i, "fa-magnifying-glass"],
  [/rev(erse|ersing)?\b|reverse/i, "fa-microchip"],
  [/osint|recon/i, "fa-satellite-dish"],
  [/pwn|binary|exploit/i, "fa-bug"],
  [/stego/i, "fa-image"],
  [/net/i, "fa-network-wired"],
  [/misc|logic|puzzle/i, "fa-puzzle-piece"],
];

export function categoryIcon(category) {
  const hit = CATEGORY_ICONS.find(([re]) => re.test(category || ""));
  return hit ? hit[1] : "fa-cube";
}

const LEVELS = {
  beginner: 1,
  easy: 1,
  medium: 2,
  normal: 2,
  hard: 3,
  insane: 4,
  expert: 4,
};

const DIFF_RE = /^(?:difficulty|diff|level)?\s*[:=\-]?\s*(beginner|easy|medium|normal|hard|insane|expert)$/i;

export function difficultyOf(tags) {
  for (const t of tags || []) {
    const value = typeof t === "string" ? t : t.value;
    const m = DIFF_RE.exec((value || "").trim());
    if (m) {
      const label = m[1].toLowerCase();
      return { label, level: LEVELS[label] };
    }
  }
  return null;
}

// Tags that only drive presentation are hidden from the visible tag list.
export function displayTags(tags, featuredTag = "featured") {
  return (tags || [])
    .map(t => (typeof t === "string" ? t : t.value))
    .filter(v => v && !DIFF_RE.test(v.trim()) && v.toLowerCase() !== featuredTag.toLowerCase());
}

export function slugHash(c) {
  return `#${encodeURIComponent(c.name)}-${c.id}`;
}
