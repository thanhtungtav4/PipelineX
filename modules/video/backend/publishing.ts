// The publish kit: what the human editor pastes into YouTube for the long video and the Short — title, description
// with chapters, sources and picture credits, tags and hashtags. Drafted from the video's own files, editable by the
// agent or on the Videos page; nothing here publishes anything.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { INTRO_SECONDS } from "./media.ts";
import { workDir } from "./pipeline.ts";
import { channelProfile } from "./channel-profile.ts";
import { ENTITIES, IDENTITY_LEXICON } from "@aihot/industry/taxonomy";

export interface PublishKit {
  long: { title: string; description: string; tags: string[]; titleOptions?: string[] };
  short: { title: string; description: string; tags: string[] } | null;
  /** What to choose on YouTube's upload page besides the words (from the channel profile). */
  settings?: { category: string; language: string; madeForKids: false; alteredContent: string; captions: string };
  draftedAt: string;
  editedAt?: string;
}

const LIMITS = { title: 100, description: 5000, tags: 500 };
const read = <T>(id: number, name: string): T | null => {
  const p = path.join(workDir(id), name);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : null;
};

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** YouTube chapters: the first at 0:00, at least three, each at least 10 seconds long. */
export function chapters(scenes: Array<{ headline: string; start: number; duration: number }>, total: number): string[] {
  const marks = [{ at: 0, name: "Intro" }, ...scenes.map((s) => ({ at: INTRO_SECONDS + s.start, name: s.headline }))];
  const end = INTRO_SECONDS + total;
  const kept: typeof marks = [];
  for (const m of marks) {
    if (kept.length === 0 || m.at - kept[kept.length - 1]!.at >= 10) kept.push(m);
  }
  while (kept.length >= 2 && end - kept[kept.length - 1]!.at < 10) kept.pop();
  return kept.length >= 3 ? kept.map((m) => `${clock(m.at)} ${m.name}`) : [];
}

interface Subject { name: string; tag: string; ticker: string | null }

/** The companies and institutions the video is about (the pack's entity lexicon), most mentioned first, with tickers. */
function subjectsOf(text: string): Subject[] {
  const found = IDENTITY_LEXICON.map((e) => ({ e, n: e.patterns.reduce((sum, re) => sum + (text.match(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"))?.length ?? 0), 0) }))
    .filter((x) => x.n > 0).sort((x, y) => y.n - x.n);
  return found.map(({ e }) => {
    const entity = ENTITIES[e.id];
    const ticker = entity?.aliases.find((a) => /^[A-Z]{2,5}$/.test(a) && a !== entity.displayTag && !["SEC", "ECB", "FOMC"].includes(a)) ?? null;
    return { name: entity?.name ?? e.name, tag: entity?.displayTag ?? e.name, ticker };
  });
}

/** People named at least twice in the narration ("Jensen Huang", "Colette Kress"). */
const NOT_PEOPLE = /^(The|This|That|But|And|Wall|White|Federal|Supreme|United|New|Fed|Chief|Prime|Vice|Fiscal|Last|Next|First|Second|Third|Fourth|In|On|At|For|With|After|Analysts|Shares)$/;
function peopleIn(text: string): string[] {
  const counts = new Map<string, number>();
  for (const m of text.matchAll(/\b([A-Z][a-z]+) ([A-Z][a-z]{2,})\b/g)) if (!NOT_PEOPLE.test(m[1]!)) counts.set(m[0], (counts.get(m[0]) ?? 0) + 1);
  return [...counts].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([name]) => name).slice(0, 3);
}

/** What the video is, in the words people search with, per style. */
const TOPIC: Record<string, string> = { earnings: "earnings", markets: "stock", macro: "economy", crypto: "price", finance: "stock", launch: "launch", product: "review", investigation: "investigation", crime: "case", war: "news", explainer: "explained", analysis: "analysis", news: "news" };
const QUARTER = /\b(?:Q([1-4])|(first|second|third|fourth)[- ](?:fiscal[- ])?quarter)\b/i;

/**
 * Tags, most specific first: search phrases for the main subject ("nvidia earnings", "nvda stock", "nvidia q3 earnings"),
 * the people and other subjects, then the channel's own tags; within YouTube's 500 characters.
 */
export function tagsFor(title: string, text: string, style: string | null, year = new Date().getFullYear()): { tags: string[]; hashtags: string[]; subjects: Subject[] } {
  const subjects = subjectsOf(`${title} ${title} ${text}`);
  const topic = TOPIC[style ?? ""] ?? "news";
  const q = text.match(QUARTER);
  const quarter = q ? `q${q[1] ?? ["first", "second", "third", "fourth"].indexOf(q[2]!.toLowerCase()) + 1}` : null;
  const phrases: string[] = [];
  for (const [i, s] of subjects.slice(0, 2).entries()) {
    if (i > 0 && !s.ticker) continue; // a second subject without a ticker (a regulator, a person) only goes in as its name
    const name = s.tag.toLowerCase();
    phrases.push(`${name} ${topic}`);
    if (i === 0 && quarter && style === "earnings") phrases.push(`${name} ${quarter} earnings`);
    if (s.ticker) phrases.push(`${s.ticker.toLowerCase()} stock`, `${name} stock`, s.ticker.toLowerCase());
    if (i === 0) phrases.push(`${name} news`, `${name} ${topic} ${year}`);
  }
  const names = [...peopleIn(text).map((p) => p.toLowerCase()), ...subjects.slice(1, 5).map((s) => s.tag.toLowerCase())];
  const out: string[] = [];
  for (const t of [...phrases, ...names, ...channelProfile().tags]) {
    if (out.some((o) => o.toLowerCase() === t.toLowerCase())) continue;
    if ([...out, t].join(",").length <= LIMITS.tags && out.length < 15) out.push(t);
  }
  const words = [subjects[0]?.tag, subjects[0]?.ticker, style && TOPIC[style] && style !== "news" ? style : null, subjects[1]?.tag];
  const hashtags = [...words.filter((w): w is string => !!w).map((w) => `#${w.replace(/[^A-Za-z0-9]/g, "")}`.replace(/^#(\w)/, (_, c: string) => `#${c.toUpperCase()}`)), ...channelProfile().hashtags]
    .filter((h, i, a) => h.length > 2 && a.findIndex((x) => x.toLowerCase() === h.toLowerCase()) === i).slice(0, 5);
  return { tags: out, hashtags, subjects };
}

type Source = { name: string; title: string; url: string };
/** Sources worth listing: no home pages or empty titles, no repeats; the video's reports first, then at most 4 background pages. */
export function cleanSources(sources: Source[]): Source[] {
  const seen = new Set<string>();
  const ok = sources.filter((s) => {
    const key = s.url.replace(/[?#].*$/, "").replace(/\/$/, "");
    let homePage = false;
    try { homePage = new URL(s.url).pathname.replace(/\/$/, "") === ""; } catch { return false; }
    if (homePage || !s.title || s.title.trim().length < 8 || /^home$/i.test(s.title.trim()) || seen.has(key) || seen.has(s.title.toLowerCase())) return false;
    seen.add(key); seen.add(s.title.toLowerCase());
    return true;
  });
  const background = (s: Source) => /\(background\)/.test(s.name);
  return [...ok.filter((s) => !background(s)), ...ok.filter(background).slice(0, 4)];
}

/** The main subject's ticker after its first mention ("Nvidia (NVDA)"), so search snippets carry it. */
function withTicker(text: string, subject: Subject | undefined): string {
  if (!subject?.ticker || text.includes(subject.ticker)) return text;
  const re = new RegExp(`\\b${subject.tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b(?!\\s*\\()`);
  return text.replace(re, (m) => `${m} (${subject.ticker})`);
}

export function draftKit(id: number): PublishKit | null {
  const script = read<{ title: string; description?: string; thumbnail_text?: string; sources?: Source[]; scenes?: Array<{ beats: Array<{ narration: string }> }> }>(id, "script-final.json");
  const timeline = read<{ total: number; date?: string; scenes: Array<{ headline: string; start: number; duration: number }> }>(id, "timeline.json");
  if (!script || !timeline) return null;
  const short = read<{ title: string; scenes: Array<{ beats: Array<{ narration: string }> }> }>(id, "script-short.json");
  const style = read<{ key?: string }>(id, "style-preset.json")?.key ?? null;
  const channel = channelProfile();
  const yt = channel.youtube;
  const credits = existsSync(path.join(workDir(id), "ATTRIBUTIONS.txt"))
    ? readFileSync(path.join(workDir(id), "ATTRIBUTIONS.txt"), "utf8").split("\n").filter(Boolean).map((l) => l.replace(/^assets\/[^:]+:\s*/, "")) : [];
  const sources = cleanSources(script.sources ?? []);
  const narration = (script.scenes ?? []).flatMap((s) => s.beats.map((b) => b.narration)).join(" ");
  const illustrated = (script.scenes ?? []).some((s) => s.beats.some((b) => (b as { visual?: { type?: string } }).visual?.type === "illustration"));
  const { tags, hashtags, subjects } = tagsFor(script.title, `${script.description ?? ""} ${narration}`, style, Number((timeline.date ?? "").match(/(\d{4})\s*$/)?.[1]) || undefined);
  const chapterLines = chapters(timeline.scenes, timeline.total);
  const description = [
    withTicker(script.description ?? "", subjects[0]),
    yt?.subscribe ?? "",
    chapterLines.length ? `Chapters:\n${chapterLines.join("\n")}` : "",
    sources.length ? `Sources:\n${sources.map((s) => `- ${s.name}: ${s.title} — ${s.url}`).join("\n")}` : "",
    credits.length ? `Picture credits:\n${credits.map((c) => `- ${c}`).join("\n")}` : "",
    "Researched, written and narrated with AI tools, then checked against the sources above. Corrections welcome in the comments.",
    illustrated ? "Some illustrations in this video were made with AI; they are labelled on screen." : "",
    yt?.disclaimer ?? "",
    hashtags.join(" "),
  ].filter(Boolean).join("\n\n").slice(0, LIMITS.description);
  const shortTitle = short ? short.title.slice(0, LIMITS.title - 8).trim() + " #Shorts" : "";
  const title = script.title.slice(0, LIMITS.title);
  const ytRecord = read<{ longId?: string; shortId?: string }>(id, "youtube.json");
  const mainVideoUrl = ytRecord?.longId ? `https://youtu.be/${ytRecord.longId}` : null;
  const mainVideoCallout = mainVideoUrl
    ? `👉 WATCH FULL VIDEO: ${mainVideoUrl}\n(Tap "Related video" above channel name)`
    : `👉 WATCH FULL DEEP DIVE: [Link auto-inserted when main video uploads]\nFull Video: ${script.title}`;

  return {
    long: { title, description, tags, titleOptions: [title] },
    short: short ? {
      title: shortTitle,
      description: [
        mainVideoCallout,
        short.scenes[0]?.beats[0]?.narration ?? "",
        "Full story on our channel.",
        sources.length ? `Sources: ${[...new Set(sources.slice(0, 3).map((s) => s.name.replace(/\s*\(background\)/, "")))].join(", ")}` : "",
        yt?.disclaimer ?? "",
        ["#Shorts", ...hashtags.slice(0, 3)].join(" ")
      ].filter(Boolean).join("\n\n").slice(0, LIMITS.description),
      tags,
    } : null,
    settings: {
      category: yt?.category ?? "News & Politics",
      language: yt?.language ?? "English",
      madeForKids: false,
      alteredContent: "Usually No: the narrator is a synthetic voice, but no real person is shown saying or doing what they did not, and no real event is faked. Tick Yes if a video uses realistic AI-made footage or a real person's voice.",
      captions: "Upload captions.srt (and captions-short.srt for the Short) as English subtitles: they follow the narration word by word.",
    },
    draftedAt: new Date().toISOString(),
  };
}

const srtClock = (t: number) => {
  const ms = Math.max(0, Math.round(t * 1000));
  const h = Math.floor(ms / 3_600_000), m = Math.floor(ms / 60_000) % 60, sec = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
};

/** Subtitles (SRT) from the narration's word timings: lines of up to 42 characters and 3.5 seconds, broken at sentences
 * and pauses. The long video starts after its intro; the Short at once. */
export function captionsSrt(id: number, variant: "long" | "short"): string | null {
  const timeline = read<{ scenes: Array<{ start: number; beats: Array<{ start: number; narration?: string; words?: Array<{ text: string; start: number; end: number }> }> }> }>(id, variant === "short" ? "timeline-short.json" : "timeline.json");
  if (!timeline) return null;
  const offset = variant === "short" ? 0 : INTRO_SECONDS;
  const cues: Array<{ start: number; end: number; text: string }> = [];
  let line: Array<{ text: string; start: number; end: number }> = [];
  const flush = () => { if (line.length) cues.push({ start: line[0]!.start, end: line.at(-1)!.end, text: line.map((w) => w.text).join(" ") }); line = []; };
  for (const s of timeline.scenes) for (const b of s.beats) {
    // Voice engines drop punctuation from word timings: take each word as written in the narration, with its punctuation.
    let at = 0;
    for (const raw of b.words ?? []) {
      let text = raw.text;
      const i = b.narration ? b.narration.indexOf(raw.text, at) : -1;
      if (i >= 0 && i - at < 40) {
        const end = i + raw.text.length + (b.narration!.slice(i + raw.text.length).match(/^[.,;:!?%"”’')\]]*/)?.[0].length ?? 0);
        const lead = b.narration!.slice(at, i).match(/["“‘(\[]$/)?.[0] ?? "";
        text = lead + b.narration!.slice(i, end);
        at = end;
      }
      const w = { text, start: offset + s.start + b.start + raw.start, end: offset + s.start + b.start + raw.end };
      const last = line.at(-1);
      if (last && (w.start - last.end > 0.6 || [...line, w].map((x) => x.text).join(" ").length > 42 || w.end - line[0]!.start > 3.5)) flush();
      line.push(w);
      if (/[.?!]["”’']?$/.test(w.text)) flush();
    }
    flush(); // a beat ends a sentence
  }
  return cues.map((c, i) => `${i + 1}\n${srtClock(c.start)} --> ${srtClock(Math.max(c.end, c.start + 0.8))}\n${c.text}\n`).join("\n");
}

/** The saved kit, or a fresh draft (saved) when there is none yet or `redraft` is asked. */
export function publishKit(id: number, redraft = false): PublishKit | null {
  const saved = read<PublishKit>(id, "publish.json");
  if (saved && !redraft) return saved;
  const kit = draftKit(id);
  if (kit) writeFileSync(path.join(workDir(id), "publish.json"), JSON.stringify(kit, null, 2));
  return kit;
}

export type KitEdit = Partial<{ longTitle: string; longDescription: string; longTags: string[]; titleOptions: string[]; shortTitle: string; shortDescription: string }>;

/** Applies edits within YouTube's limits; returns the kit and what changed (before/after). */
export function editKit(id: number, edit: KitEdit) {
  const kit = publishKit(id);
  if (!kit) return null;
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  const set = (key: string, before: unknown, after: unknown, apply: () => void) => { if (after !== undefined) { changes[key] = { before, after }; apply(); } };
  set("longTitle", kit.long.title, edit.longTitle?.slice(0, LIMITS.title), () => (kit.long.title = edit.longTitle!.slice(0, LIMITS.title)));
  set("longDescription", kit.long.description, edit.longDescription && "(new description)", () => (kit.long.description = edit.longDescription!.slice(0, LIMITS.description)));
  const options = edit.titleOptions?.map((t) => t.trim().slice(0, LIMITS.title)).filter((t, i, a) => t && a.indexOf(t) === i).slice(0, 3);
  set("titleOptions", kit.long.titleOptions ?? [kit.long.title], options, () => (kit.long.titleOptions = options));
  set("longTags", kit.long.tags, edit.longTags, () => (kit.long.tags = edit.longTags!.filter((t, i, a) => a.slice(0, i + 1).join(",").length <= LIMITS.tags)));
  if (kit.short) {
    set("shortTitle", kit.short.title, edit.shortTitle?.slice(0, LIMITS.title), () => (kit.short!.title = edit.shortTitle!.slice(0, LIMITS.title)));
    set("shortDescription", kit.short.description, edit.shortDescription && "(new description)", () => (kit.short!.description = edit.shortDescription!.slice(0, LIMITS.description)));
  }
  kit.editedAt = new Date().toISOString();
  writeFileSync(path.join(workDir(id), "publish.json"), JSON.stringify(kit, null, 2));
  return { kit, changes };
}
