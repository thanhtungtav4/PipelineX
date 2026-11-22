// Step 4a prototype: fetch freely licensed images for "photo" and "broll" beats, with attribution.
// photo -> Wikimedia Commons first (named people, places, products), then Openverse.
// broll -> Pixabay video clip first, then Pixabay photo, Openverse, Commons (Pixabay needs PIXABAY_API_KEY).
// Every candidate is checked by a vision model before use (right subject, a real photo, nothing misleading).
// Only licenses that allow commercial reuse and modification: CC0, Public domain, CC BY, CC BY-SA.
// Pixabay content: Pixabay Content License; Pexels: Pexels License (both free commercial use, no attribution required; we credit anyway).
// Usage: VIDEO_WORKDIR=<dir> node --env-file=<app>/.env assets.ts   (reads <dir>/script.json, writes <dir>/script-final.json and <dir>/public/assets)
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { chat, readPreset } from "./lib.ts";

const preset = readPreset();

const UA = "PipelineX-prototype/0.1 (automated news video research)";
const OK_LICENSE = /^(cc0|cc[- ]?by(-sa)?( \d\.\d)?|public domain|pd)/i;
const W = process.env.VIDEO_WORKDIR ?? "work";
const script = JSON.parse(readFileSync(`${W}/script.json`, "utf8"));
mkdirSync(`${W}/public/assets`, { recursive: true });

type Cand = { url: string; thumb: string; credit: string; license: string; sourceUrl: string; width: number; height: number;
  kind?: "image" | "video"; duration?: number };
const PIXABAY = process.env.PIXABAY_API_KEY ?? "";
/** A fetch that never throws: a source that does not answer (DNS, connect timeout…) is skipped, not fatal. */
async function get(url: string | URL, headers: Record<string, string>, timeoutMs = 30_000): Promise<Response | null> {
  try {
    return await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    let host = String(url);
    try { host = new URL(String(url)).hostname; } catch { /* keep the raw value */ }
    console.log(`  no answer from ${host}: ${(error as Error).message.slice(0, 80)}`);
    return null;
  }
}
/** A response's bytes, or null when the body stops arriving (a slow host times out mid-download). */
async function bytes(res: Response): Promise<Buffer | null> {
  try { return Buffer.from(await res.arrayBuffer()); } catch (error) { console.log(`  download cut off: ${(error as Error).message.slice(0, 80)}`); return null; }
}
const strip = (html = "") => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const used = new Set<string>();
let cost = 0;

async function commons(query: string): Promise<Cand[]> {
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  const params: Record<string, string> = { action: "query", format: "json", generator: "search", gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: "6", gsrlimit: "20", prop: "imageinfo", iiprop: "url|extmetadata|size", iiurlwidth: "1920", origin: "*" };
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const res = await get(u, { "user-agent": UA, "api-user-agent": UA });
  const body = res && await res.json().catch(() => null) as any;
  if (!res?.ok || !body) { console.log(`  commons ${res?.status ?? "-"}`); return []; }
  const pages = Object.values(body.query?.pages ?? {}) as any[];
  pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const out: Cand[] = [];
  for (const p of pages) {
    const ii = p.imageinfo?.[0]; const m = ii?.extmetadata ?? {};
    const license = strip(m.LicenseShortName?.value);
    if (!ii || !OK_LICENSE.test(license) || used.has(ii.url)) continue;
    if (ii.width < 900 || ii.width / ii.height < 0.6) continue; // skip tiny and very tall images
    const big = ii.thumburl ?? ii.url;
    out.push({ url: big, thumb: big.replace("/1920px-", "/960px-"), credit: strip(m.Artist?.value) || "Unknown", license,
      sourceUrl: ii.descriptionurl, width: ii.thumbwidth ?? ii.width, height: ii.thumbheight ?? ii.height });
  }
  return out;
}

async function openverse(query: string): Promise<Cand[]> {
  const u = new URL("https://api.openverse.org/v1/images/");
  const params: Record<string, string> = { q: query, license_type: "commercial,modification", aspect_ratio: "wide", size: "large", page_size: "20", mature: "false" };
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const res = await get(u, { "user-agent": UA });
  if (!res?.ok) return [];
  const out: Cand[] = [];
  for (const r of ((await res.json().catch(() => null)) as any)?.results ?? []) {
    const license = `${r.license === "cc0" || r.license === "pdm" ? r.license.toUpperCase() : `CC ${r.license.toUpperCase()}`} ${r.license_version ?? ""}`.trim();
    if (used.has(r.url) || !(r.width >= 1000)) continue;
    out.push({ url: r.url, thumb: r.thumbnail ?? r.url, credit: r.creator || "Unknown", license, sourceUrl: r.foreign_landing_url, width: r.width, height: r.height });
  }
  return out;
}

/** Pixabay stock clips (videos=true) or photos. Skips AI-generated and low-quality items. */
async function pixabay(query: string, videos: boolean): Promise<Cand[]> {
  if (!PIXABAY) return [];
  const u = new URL(videos ? "https://pixabay.com/api/videos/" : "https://pixabay.com/api/");
  const params: Record<string, string> = { key: PIXABAY, q: query.slice(0, 100), safesearch: "true", per_page: "20", order: "popular",
    ...(videos ? { video_type: "film" } : { image_type: "photo", orientation: "horizontal", min_width: "1600" }) };
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const res = await get(u, { "user-agent": UA });
  if (!res?.ok) { console.log(`  pixabay ${res?.status ?? "-"}`); return []; }
  const out: Cand[] = [];
  for (const h of ((await res.json().catch(() => null)) as any)?.hits ?? []) {
    if (h.isAiGenerated || h.isLowQuality) continue;
    const credit = `${h.user} on Pixabay`, license = "Pixabay License";
    if (videos) {
      const f = h.videos?.medium?.url ? h.videos.medium : h.videos?.small?.url ? h.videos.small : h.videos?.tiny;
      if (!f?.url || used.has(f.url) || h.duration < 5 || f.width / f.height < 1.6) continue;
      out.push({ url: f.url, thumb: f.thumbnail || h.videos.tiny?.thumbnail, credit, license, sourceUrl: h.pageURL,
        width: f.width, height: f.height, kind: "video", duration: h.duration });
    } else {
      if (!h.largeImageURL || used.has(h.largeImageURL)) continue;
      out.push({ url: h.largeImageURL, thumb: h.webformatURL, credit, license, sourceUrl: h.pageURL, width: h.imageWidth, height: h.imageHeight });
    }
  }
  return out;
}

type Verdict = "yes" | "no" | "error";
/** Pexels photos or videos (PEXELS_API_KEY): the Pexels License allows commercial use without attribution; we credit anyway. */
const PEXELS = process.env.PEXELS_API_KEY ?? "";
async function pexels(query: string, videos: boolean): Promise<Cand[]> {
  if (!PEXELS) return [];
  const u = new URL(videos ? "https://api.pexels.com/videos/search" : "https://api.pexels.com/v1/search");
  for (const [k, v] of Object.entries({ query: query.slice(0, 100), orientation: "landscape", size: videos ? "medium" : "large", per_page: "15" })) u.searchParams.set(k, v);
  const res = await get(u, { authorization: PEXELS, "user-agent": UA });
  if (!res?.ok) { console.log(`  pexels ${res?.status ?? "-"}`); return []; }
  const body = (await res.json().catch(() => null)) as any;
  const out: Cand[] = [];
  if (videos) for (const v of body?.videos ?? []) {
    const f = (v.video_files ?? []).filter((x: any) => x.file_type === "video/mp4" && x.width >= 1280 && x.width / x.height >= 1.6).sort((a: any, b: any) => Math.abs(a.width - 1920) - Math.abs(b.width - 1920))[0];
    if (!f || used.has(f.link) || v.duration < 5) continue;
    out.push({ url: f.link, thumb: v.image, credit: `${v.user?.name ?? "Unknown"} on Pexels`, license: "Pexels License", sourceUrl: v.url, width: f.width, height: f.height, kind: "video", duration: v.duration });
  }
  else for (const ph of body?.photos ?? []) {
    const url = ph.src?.large2x ?? ph.src?.original;
    if (!url || used.has(url) || ph.width < 1600) continue;
    out.push({ url, thumb: ph.src?.medium ?? url, credit: `${ph.photographer ?? "Unknown"} on Pexels`, license: "Pexels License", sourceUrl: ph.url, width: ph.width, height: ph.height });
  }
  return out;
}

/** Vision check: does the picture really show the query, and is it fit for a neutral news video on this story?
 * "error" (the check itself failed: a throttled or down model) is not a "no": the caller may try again. */
async function fits(c: Cand, query: string, kind: string, context: string, narration: string, ask?: string): Promise<Verdict> {
  const wanted = kind === "photo" ? `"${query}" as the main subject` : `something a viewer would recognise as "${query}"`;
  const what = c.kind === "video" ? "still frame from a stock video clip" : kind === "photo" ? "photo of a specific subject" : "generic illustrative b-roll image";
  const prompt = `A ${what} is needed for a news video.
Story: ${context}
Wanted: "${query}".
Spoken over the picture: "${narration}"
Answer YES only if ALL hold: (1) the image clearly shows ${wanted};
(2) it is a photograph, not a chart, diagram, map, logo or text screenshot;
(3) no other recognisable public figure appears who could mislead viewers about the story;
(4) nothing offensive or unrelated dominates the picture;
(5) it is not a photo of a document, letter, sign or screen with legible text, and shows no private person's name or signature;
${Array.isArray(preset?.pictureRules) && preset.pictureRules.length ? `;\n(7) ${preset.pictureRules.join("; ")}` : ""}.
Reply with one word: YES or NO.`;
  const question = ask ?? prompt;
  // Send the picture itself: providers cannot always fetch Wikimedia/Openverse URLs.
  let pic = await get(c.thumb, { "user-agent": UA });
  if (!pic?.ok) pic = await get(c.url, { "user-agent": UA });
  if (!pic?.ok) { console.log(`  thumbnail ${pic?.status ?? "-"}`); return "no"; }
  const type = pic.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  const buf = await bytes(pic);
  if (!buf) return "no";
  if (buf.length > 8 * 1024 * 1024) { console.log(`  image too large (${(buf.length / 1024 / 1024).toFixed(1)}MB), skipping`); return "no"; }
  const dataUrl = `data:${type};base64,${buf.toString("base64")}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { text, cost: spent } = await chat([{ role: "user", content: [{ type: "text", text: question }, { type: "image_url", image_url: { url: dataUrl } }] }],
        { temperature: 0, maxTokens: 3000, json: false, reasoning: 1500, timeoutMs: 120_000 });
      cost += spent;
      return /^\s*yes/i.test(text) ? "yes" : "no";
    } catch (error) {
      console.log(`  vision check failed${attempt ? "" : ", retrying"}: ${(error as Error).message.slice(0, 160)}`);
      if (!attempt) await new Promise((r) => setTimeout(r, 8_000));
    }
  }
  return "error";
}

// When nothing found for a beat's own query fits, try a few broader queries picked by what the beat is about, then
// give up (a text card). Every candidate costs a vision check, so a beat is checked at most MAX_CHECKS times.
const MAX_FALLBACKS = 2;
const MAX_CHECKS = 12;
const BROADER: ReadonlyArray<[RegExp, string[]]> = [
  [/\b(stocks?|shares|ticker|markets?|trad(e|ing|ers)|investors?|wall street|nasdaq|s&p|dow)\b/, ["stock market screen", "trading floor"]],
  [/\b(revenue|earnings|profit|results|quarter|forecast|guidance)\b/, ["financial chart screen", "business report charts"]],
  [/\b(fed|central bank|rates?|inflation|economy|jobs)\b/, ["federal reserve building", "us dollar bills"]],
  [/\b(bitcoin|crypto|ethereum|blockchain|token)\b/, ["cryptocurrency coins", "bitcoin chart screen"]],
  [/\b(pay(ment)?s?|wallet|checkout|shopping|purchase)\b/, ["contactless payment", "mobile payment"]],
  [/\b(apps?|software|smartphone|phone|users?)\b/, ["person using smartphone", "laptop screen app"]],
  [/\b(servers?|cloud|data cent(er|re)|chips?|gpus?|security|cyber|hack(ed|ers?)?)\b/, ["data center servers", "computer chip closeup"]],
  [/\b(ceo|chief|executive|founder|president|chair(man|woman)?|spokes(man|woman|person))\b/, ["business executive speaking", "corporate press conference"]],
  [/\b(headquarters|campus|offices?|company)\b/, ["modern office building exterior", "corporate office interior"]],
  [/\b(court|lawsuit|judge|regulators?|sec|probe|investigation)\b/, ["courthouse exterior", "legal documents desk"]],
];
function fallbackQueries(query: string, narration: string): string[] {
  const about = `${query} ${narration}`.toLowerCase();
  const broader = BROADER.filter(([re]) => re.test(about)).flatMap(([, qs]) => qs);
  // The query without words that rarely match free media (logos, titles).
  const plain = query.replace(/\b(app|application|logo|headquarters|ceo|vp|screen|official|photo)\b/gi, " ").replace(/\s+/g, " ").trim();
  return [...new Set([query, ...(plain.length > 2 ? [plain] : []), ...broader])].slice(0, 1 + MAX_FALLBACKS);
}

let n = 0, missing = 0;
for (const scene of script.scenes) for (const beat of scene.beats) {
  const v = beat.visual; const i = n++;
  if (v.type !== "photo" && v.type !== "broll") continue;

  const query0 = String(v.query ?? "").trim();
  if (!query0) { v.type = "card"; console.log(`beat ${i} ${v.type} "(no query)": no search words -> text card`); continue; }
  const queries = fallbackQueries(query0, beat.narration);
  let found: Cand | null = null, tried = 0, errors = 0;
  // When the vision model is down (not when it said no), a stock b-roll clip for the beat's own words beats a text card.
  let unchecked: Cand | null | undefined;

  for (const query of queries) {
    if (tried >= MAX_CHECKS) break;
    // Photos of named subjects: Commons first (real people, places, products), then Openverse and Pexels. B-roll: stock clips
    // first, alternating Pexels and Pixabay, then their photos; no Commons (it surfaces real documents and private people).
    const interleave = (...lists: Cand[][]) => lists.flatMap((l, i) => l.map((c, j) => ({ c, k: j * lists.length + i }))).sort((a, b) => a.k - b.k).map((x) => x.c);
    const cands = v.type === "photo"
      ? [...(await commons(query)).slice(0, 4), ...(await openverse(query)).slice(0, 2), ...(await pexels(query, false)).slice(0, 2)]
      : [...interleave((await pexels(query, true)).slice(0, 3), (await pixabay(query, true)).slice(0, 3)),
         ...interleave((await pexels(query, false)).slice(0, 2), (await pixabay(query, false)).slice(0, 2)),
         ...(await openverse(query)).slice(0, 2)];
    if (cands.length === 0) continue;

    for (const c of cands.slice(0, query === query0 ? 8 : 4)) {
      if (tried >= MAX_CHECKS || used.has(c.url)) continue;
      tried++;
      const verdict = await fits(c, query, v.type, script.title, beat.narration);
      if (verdict === "error") { if (unchecked === undefined && /on (Pixabay|Pexels)$/.test(c.credit)) unchecked = c; errors++; if (errors >= 3) break; continue; }
      if (verdict === "yes") {
        found = c;
        used.add(c.url);
        break;
      }
    }
    if (errors >= 3) break;
    if (found) {
      if (query !== query0) console.log(`  (matched via fallback query "${query}")`);
      break;
    }
  }

  if (!found && v.type === "broll" && unchecked) {
    found = unchecked; used.add(unchecked.url);
    console.log(`  vision checks failed; using the first stock clip for "${v.query}" unchecked`);
  }
  if (!found) { missing++; console.log(`beat ${i} ${v.type} "${v.query}": nothing fitting (${tried} checked across ${queries.length} queries) -> text card`); v.type = "card"; continue; }
  const ext = found.kind === "video" ? "mp4" : (found.url.split("?")[0].match(/\.(jpe?g|png|webp)$/i)?.[1] ?? "jpg").toLowerCase();
  const file = `assets/beat-${String(i).padStart(2, "0")}.${ext}`;
  const img = await get(found.url, { "user-agent": UA }, 120_000);
  if (!img?.ok) { missing++; console.log(`beat ${i}: download ${img?.status ?? "failed"}`); v.type = "card"; continue; }
  const data = await bytes(img);
  if (!data) { missing++; console.log(`beat ${i}: download cut off`); v.type = "card"; continue; }
  writeFileSync(`${W}/public/${file}`, data);
  v.asset = { file, credit: found.credit.slice(0, 80), license: found.license, sourceUrl: found.sourceUrl,
    kind: found.kind ?? "image", ...(found.duration ? { duration: found.duration } : {}) };
  console.log(`beat ${i} ${v.type.padEnd(5)} "${v.query}" -> ${found.kind ?? "image"} · ${found.license} · ${found.credit.slice(0, 40)} (${tried} checked)`);
}
// ── Portraits: a quote is shown with a photo of its speaker, from Wikimedia Commons by name (official US government
// portraits there are public domain). Commons file titles carry the name; the vision model only checks it is a clear
// photo of one person, since it cannot tell who someone is.
async function save(c: Cand, name: string) {
  const ext = c.kind === "video" ? "mp4" : (c.url.split("?")[0].match(/\.(jpe?g|png|webp)$/i)?.[1] ?? "jpg").toLowerCase();
  const file = `assets/${name}.${ext}`;
  const img = await get(c.url, { "user-agent": UA }, 120_000);
  if (!img?.ok) return null;
  const data = await bytes(img);
  if (!data) return null;
  writeFileSync(`${W}/public/${file}`, data);
  return { file, credit: c.credit.slice(0, 80), license: c.license, sourceUrl: c.sourceUrl, kind: c.kind ?? "image", ...(c.duration ? { duration: c.duration } : {}) };
}
const PORTRAIT = "Is this a clear photograph with one person as the main subject (a portrait, or the person speaking), not a group, a drawing, a logo, a document or a screenshot? Reply with one word: YES or NO.";
const portraits = new Map<string, Awaited<ReturnType<typeof save>>>();
let portraitCount = 0;
for (const beat of script.scenes.flatMap((s: any) => s.beats)) {
  const v = beat.visual;
  if (v.type !== "quote" || !v.speaker) continue;
  const name = String(v.speaker).split(/,|—|–| - |\(/)[0]!.trim();
  if (name.split(/\s+/).length < 2 || name.split(/\s+/).length > 4) continue;
  if (!portraits.has(name)) {
    const surname = name.split(/\s+/).at(-1)!.toLowerCase();
    const cands = (await commons(`intitle:"${name}"`)).filter((c) => { try { return decodeURIComponent(c.sourceUrl).toLowerCase().includes(surname); } catch { return false; } }).slice(0, 3);
    let saved: Awaited<ReturnType<typeof save>> = null;
    for (const c of cands) {
      if (await fits(c, name, "photo", script.title, beat.narration, PORTRAIT) !== "yes") continue;
      saved = await save(c, `portrait-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`);
      if (saved) { used.add(c.url); break; }
    }
    portraits.set(name, saved);
    console.log(`portrait "${name}": ${saved ? `${saved.license} · ${saved.credit.slice(0, 40)}` : `none (${cands.length} candidates)`}`);
  }
  const portrait = portraits.get(name);
  if (portrait) { v.portrait = portrait; portraitCount++; }
}

// ── Backdrops: numbers, quotes, headlines and cards sit on the nearest picture of the video (the same scene first),
// darkened and blurred behind the words, instead of an empty grid.
const flat = script.scenes.flatMap((s: any, si: number) => s.beats.map((b: any) => ({ si, v: b.visual })));
const pictures = flat.map((x: any, i: number) => ({ ...x, i })).filter((x: any) => x.v.asset);
let backdrops = 0;
flat.forEach((x: any, i: number) => {
  if (x.v.asset || x.v.type === "photo" || x.v.type === "broll" || !pictures.length) return;
  const near = [...pictures].sort((a: any, b: any) => (a.si === x.si ? 0 : 100) + Math.abs(a.i - i) - ((b.si === x.si ? 0 : 100) + Math.abs(b.i - i)))[0];
  x.v.backdrop = { file: near.v.asset.file, kind: near.v.asset.kind };
  backdrops++;
});
console.log(`portraits: ${portraitCount}, backdrops: ${backdrops}`);

writeFileSync(`${W}/script-final.json`, JSON.stringify(script, null, 2));
const credits = script.scenes.flatMap((s: any) => s.beats).flatMap((b: any) => [b.visual.asset, b.visual.portrait]).filter(Boolean)
  .filter((a: any, i: number, all: any[]) => all.findIndex((x: any) => x.file === a.file) === i)
  .map((a: any) => `${a.file}: ${a.credit}, ${a.license} — ${a.sourceUrl}`);
writeFileSync(`${W}/ATTRIBUTIONS.txt`, credits.join("\n") + "\n");
console.log(`assets: ${credits.length}, without image: ${missing}, vision cost: $${cost.toFixed(4)}`);
console.log(`RESULT ${JSON.stringify({ cost, assets: credits.length, missing, portraits: portraitCount, backdrops })}`);
